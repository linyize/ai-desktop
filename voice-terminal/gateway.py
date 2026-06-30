"""Voice Gateway - Main entry point for the voice terminal service."""
import asyncio
import base64
import json
import tempfile
import os
import uuid
import threading
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from datetime import datetime

from config import Config, load_config
from asr_engine import ASREngine
from tts_engine import TTSEngine
from router import Router
from llm_client import LLMClient
from audio_utils import pcm16_to_wav, wav_to_pcm16


class Session:
    """Per-client session state."""
    
    def __init__(self, session_id: str, websocket=None):
        self.session_id = session_id
        self.websocket = websocket
        self.audio_buffer: List[bytes] = []
        self.conversation_history: List[dict] = []
        self.selected_model: str = "local://coder-next:8082"
        self.selected_voice: str = "zh-CN-XiaoxiaoNeural"
        self.state: str = "idle"
        self.audio_sample_rate: int = 16000
        self.temp_wav_path: Optional[str] = None
    
    def add_audio_chunk(self, chunk: bytes):
        self.audio_buffer.append(chunk)
    
    def clear_audio(self):
        self.audio_buffer = []
    
    def get_audio_data(self) -> bytes:
        return b"".join(self.audio_buffer)
    
    def save_to_temp_wav(self, sample_rate: int = 16000) -> str:
        if not self.audio_buffer:
            return None
        audio_data = self.get_audio_data()
        wav_data = pcm16_to_wav(audio_data, sample_rate)
        fd, path = tempfile.mkstemp(suffix=".wav")
        os.close(fd)
        with open(path, "wb") as f:
            f.write(wav_data)
        self.temp_wav_path = path
        return path
    
    def cleanup_temp_wav(self):
        if self.temp_wav_path and os.path.exists(self.temp_wav_path):
            try:
                os.unlink(self.temp_wav_path)
            except OSError:
                pass
        self.temp_wav_path = None
    
    def add_message(self, role: str, content: str):
        self.conversation_history.append({"role": role, "content": content})
    
    def get_messages(self) -> List[dict]:
        return self.conversation_history.copy()


class VoiceGateway:
    """Ties all voice processing components together."""
    
    def __init__(self, config: Config):
        self.config = config
        self.asr_engine = ASREngine(
            model=config.asr.model,
            language=config.asr.language
        )
        self.tts_engine = TTSEngine(
            engine=config.tts.default_engine,
            edge_voice=config.tts.edge.voice
        )
        self.router = Router(config.routers)
        self.llm_client = LLMClient()
        self._voices = self._load_available_voices()
    
    def _load_available_voices(self) -> List[str]:
        voices = [f"edge:{self.config.tts.edge.voice}"]
        voices.append("mosstts:default")
        return voices
    
    async def process_audio(self, session: Session) -> bool:
        """Process audio from session. Returns True on success."""
        session.state = "recording"
        await self._send_status(session)
        
        if not session.audio_buffer:
            await self._send_error(session, "没有收到音频数据")
            return False
        
        session.state = "asr"
        await self._send_status(session)
        
        wav_path = None
        try:
            wav_path = session.save_to_temp_wav(session.audio_sample_rate)
            if not wav_path:
                await self._send_error(session, "保存音频失败")
                return False
            
            try:
                asr_result = self.asr_engine.transcribe_file(wav_path)
                recognized_text = asr_result["text"]
            except Exception as e:
                await self._send_error(session, f"语音识别失败: {str(e)}")
                return False
            
            if not recognized_text.strip():
                await self._send_error(session, "未检测到语音")
                return False
            
            await self._send_asr_result(session, recognized_text)
            
            session.state = "routing"
            await self._send_status(session)
            
            try:
                route_result = self.router.route(recognized_text)
                session.selected_model = route_result["model"]
                await self._send_model_selected(session, route_result)
            except Exception as e:
                await self._send_error(session, f"路由失败: {str(e)}")
                return False
            
            session.state = "llm"
            await self._send_status(session)
            
            session.add_message("user", recognized_text)
            try:
                llm_response = self.llm_client.chat(
                    session.selected_model,
                    session.get_messages()
                )
            except Exception as e:
                llm_response = "抱歉，我暂时无法回答"
                await self._send_error(session, f"LLM响应超时或失败: {str(e)}")
            
            session.add_message("assistant", llm_response)
            
            session.state = "tts"
            await self._send_status(session)
            
            try:
                tts_audio, sample_rate = self.tts_engine.synthesize(llm_response)
                
                await self._send_tts_start(session, sample_rate)
                chunk_size = 3200
                for i in range(0, len(tts_audio), chunk_size):
                    chunk = tts_audio[i:i + chunk_size]
                    base64_data = base64.b64encode(chunk).decode("utf-8")
                    await self._send_tts_chunk(session, base64_data)
                await self._send_tts_end(session)
            except Exception as e:
                await self._send_error(session, f"语音合成失败: {str(e)}")
                await self._send_status(session)
            
            session.state = "idle"
            await self._send_status(session)
            
            return True
            
        finally:
            session.cleanup_temp_wav()
    
    async def _send_status(self, session: Session):
        if session.websocket:
            await session.websocket.send(json.dumps({
                "type": "status",
                "state": session.state
            }))
    
    async def _send_asr_result(self, session: Session, text: str):
        if session.websocket:
            await session.websocket.send(json.dumps({
                "type": "asr_result",
                "text": text
            }))
    
    async def _send_model_selected(self, session: Session, result: dict):
        if session.websocket:
            await session.websocket.send(json.dumps({
                "type": "model_selected",
                "model": result["model"],
                "name": result["name"],
                "confidence": result["confidence"]
            }))
    
    async def _send_tts_start(self, session: Session, sample_rate: int):
        if session.websocket:
            await session.websocket.send(json.dumps({
                "type": "tts_start",
                "format": "pcm16",
                "sample_rate": sample_rate
            }))
    
    async def _send_tts_chunk(self, session: Session, data: str):
        if session.websocket:
            await session.websocket.send(json.dumps({
                "type": "tts_chunk",
                "data": data
            }))
    
    async def _send_tts_end(self, session: Session):
        if session.websocket:
            await session.websocket.send(json.dumps({"type": "tts_end"}))
    
    async def _send_error(self, session: Session, message: str):
        if session.websocket:
            await session.websocket.send(json.dumps({
                "type": "error",
                "message": message
            }))
    
    async def _send_pong(self, session: Session):
        if session.websocket:
            await session.websocket.send(json.dumps({"type": "pong"}))
    
    def set_voice(self, session: Session, voice: str):
        session.selected_voice = voice
        if voice.startswith("edge:"):
            self.tts_engine.set_voice(voice[5:])
    
    def get_models(self) -> List[str]:
        return self.router.get_models()
    
    def get_voices(self) -> List[str]:
        return self._voices.copy()


@dataclass
class GatewayServer:
    """Handles WebSocket and HTTP server."""
    config: Config
    gateway: VoiceGateway
    sessions: Dict[str, Session] = field(default_factory=dict)
    ws_server = None
    http_server = None
    _client_count: int = 0
    
    async def handle_websocket(self, websocket, path=None):
        session_id = str(uuid.uuid4())[:8]
        session = Session(session_id, websocket)
        self.sessions[session_id] = session
        self._client_count += 1
        
        print(f"[{datetime.now().isoformat()}] Client connected: {session_id} (total: {self._client_count})")
        
        try:
            async for message in websocket:
                try:
                    data = json.loads(message)
                    msg_type = data.get("type")
                    
                    if msg_type == "audio_start":
                        session.audio_sample_rate = data.get("sample_rate", 16000)
                        session.state = "idle"
                        await self.gateway._send_status(session)
                    
                    elif msg_type == "audio_chunk":
                        if session.state == "idle" or session.state == "recording":
                            chunk_data = base64.b64decode(data["data"])
                            session.add_audio_chunk(chunk_data)
                            session.state = "recording"
                    
                    elif msg_type == "audio_end":
                        if session.state == "recording":
                            session.state = "processing"
                            await self.gateway._send_status(session)
                            await self.gateway.process_audio(session)
                    
                    elif msg_type == "set_voice":
                        voice = data.get("profile", "zh-CN-XiaoxiaoNeural")
                        self.gateway.set_voice(session, voice)
                    
                    elif msg_type == "set_model":
                        model = data.get("model", "local://coder-next:8082")
                        session.selected_model = model
                    
                    elif msg_type == "ping":
                        await self.gateway._send_pong(session)
                    
                    else:
                        await self.gateway._send_error(session, f"Unknown message type: {msg_type}")
                
                except json.JSONDecodeError:
                    await self.gateway._send_error(session, "Invalid JSON")
                except Exception as e:
                    await self.gateway._send_error(session, str(e))
        
        except Exception as e:
            print(f"[{datetime.now().isoformat()}] WebSocket error: {e}")
        
        finally:
            if session_id in self.sessions:
                session.cleanup_temp_wav()
                del self.sessions[session_id]
            self._client_count -= 1
            print(f"[{datetime.now().isoformat()}] Client disconnected: {session_id} (total: {self._client_count})")
    
    async def start_http_server(self):
        from http.server import HTTPServer, BaseHTTPRequestHandler
        import urllib.parse
        
        class Handler(BaseHTTPRequestHandler):
            gateway_server = self
            
            def log_message(self, format, *args):
                pass
            
            def _send_json(self, data, status=200):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps(data).encode())
            
            def _send_binary(self, data, content_type="audio/wav", status=200):
                self.send_response(status)
                self.send_header("Content-Type", content_type)
                self.send_header("Content-Length", len(data))
                self.end_headers()
                self.wfile.write(data)
            
            def do_GET(self):
                parsed = urllib.parse.urlparse(self.path)
                path = parsed.path
                
                if path == "/v1/status":
                    self._send_json({
                        "state": "idle",
                        "model": "coder-next",
                        "clients": len(self.gateway_server.sessions)
                    })
                
                elif path == "/v1/models":
                    self._send_json(self.gateway_server.gateway.get_models())
                
                elif path == "/v1/voices":
                    self._send_json(self.gateway_server.gateway.get_voices())
                
                elif path == "/health":
                    self._send_json({"status": "ok"})
                
                else:
                    self._send_json({"error": "Not found"}, 404)
            
            def do_POST(self):
                parsed = urllib.parse.urlparse(self.path)
                path = parsed.path
                
                if path == "/v1/tts":
                    content_length = int(self.headers.get("Content-Length", 0))
                    body = self.rfile.read(content_length).decode()
                    data = json.loads(body)
                    text = data.get("text", "")
                    voice = data.get("voice", "zh-CN-XiaoxiaoNeural")
                    
                    try:
                        audio, sample_rate = self.gateway_server.gateway.tts_engine.synthesize(text)
                        wav_data = pcm16_to_wav(audio, sample_rate)
                        self._send_binary(wav_data)
                    except Exception as e:
                        self._send_json({"error": str(e)}, 500)
                
                elif path == "/v1/asr":
                    content_type = self.headers.get("Content-Type", "")
                    if "multipart/form-data" in content_type:
                        from email.parser import BytesParser
                        parser = BytesParser()
                        msg = parser.parsebytes(self.rfile.read(content_length))
                        
                        for part in msg.walk():
                            if part.get_content_type() == "audio/wav" or part.get_content_type() == "audio/x-wav":
                                wav_data = part.get_payload(decode=True)
                                try:
                                    audio_data = wav_to_pcm16(wav_data)
                                    result = self.gateway_server.gateway.asr_engine.transcribe(audio_data, 16000)
                                    self._send_json({"text": result["text"]})
                                except Exception as e:
                                    self._send_json({"error": str(e)}, 500)
                                break
                        else:
                            self._send_json({"error": "No audio file found"}, 400)
                    else:
                        self._send_json({"error": "Multipart form data required"}, 400)
                
                else:
                    self._send_json({"error": "Not found"}, 404)
        
        self.http_server = HTTPServer((self.config.host, self.config.http_port), Handler)
        print(f"[{datetime.now().isoformat()}] HTTP server started on http://{self.config.host}:{self.config.http_port}")
        await asyncio.get_event_loop().run_in_executor(None, self.http_server.serve_forever)
    
    async def start(self):
        import websockets
        
        print(f"[{datetime.now().isoformat()}] WebSocket server starting on ws://{self.config.host}:{self.config.ws_port} ...")
        
        async with websockets.serve(
            self.handle_websocket,
            self.config.host,
            self.config.ws_port
        ):
            # Start HTTP server in background
            http_task = asyncio.create_task(self.start_http_server())
            
            print(f"[{datetime.now().isoformat()}] Voice Gateway started")
            print(f"[{datetime.now().isoformat()}] WebSocket: ws://{self.config.host}:{self.config.ws_port}")
            print(f"[{datetime.now().isoformat()}] HTTP REST: http://{self.config.host}:{self.config.http_port}")
            
            # Run forever
            await asyncio.Future()


async def main():
    config = load_config()
    gateway = VoiceGateway(config)
    server = GatewayServer(config, gateway)
    await server.start()


if __name__ == "__main__":
    config = load_config()
    print(f"[Voice Gateway] Starting on ws://{config.host}:{config.ws_port} ...")
    asyncio.run(main())
