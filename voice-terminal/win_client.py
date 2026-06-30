import argparse
import base64
import json
import struct
import threading
import time
import tkinter as tk
from typing import Optional

import numpy as np
import websocket
import keyboard
import sys
from websocket import WebSocketApp
from colorama import Fore, Style, init

init(autoreset=True)


class StatusOverlay:
    def __init__(self):
        self.root = tk.Tk()
        self.root.title("Voice Terminal")
        self.root.geometry("180x60")
        self.root.attributes('-topmost', True)
        self.root.attributes('-transparentcolor', 'gray')
        self.root.overrideredirect(True)
        self.root.configure(bg='gray')
        
        self.label = tk.Label(
            self.root, 
            text="💤 待机", 
            font=("Microsoft YaHei", 12),
            bg='gray',
            fg='white',
            padx=10,
            pady=10
        )
        self.label.pack(expand=True)
        
        self.status = "idle"
        self._position_window()
        
    def _position_window(self):
        screen_width = self.root.winfo_screenwidth()
        screen_height = self.root.winfo_screenheight()
        self.root.geometry(f"180x60+{screen_width-200}+{screen_height-80}")
        
    def show_status(self, text: str):
        self.label.config(text=text)
        self.root.update()
        
    def set_color(self, color: str):
        self.root.configure(bg=color)
        
    def update_status(self, status: str):
        self.status = status
        status_texts = {
            "idle": "💤 待机",
            "recording": "🎤 录音中...",
            "processing": "🤖 思考中...",
            "speaking": "🔊 播放中..."
        }
        self.show_status(status_texts.get(status, "💤 待机"))
        
        colors = {
            "idle": "gray",
            "recording": "red",
            "processing": "orange",
            "speaking": "green"
        }
        self.set_color(colors.get(status, "gray"))
        
    def destroy(self):
        self.root.destroy()


class VoiceClient:
    def __init__(self, host: str, port: int, retry_max: int = 30, retry_interval: float = 3.0):
        self.host = host
        self.port = port
        self.retry_max = retry_max
        self.retry_interval = retry_interval
        self.retry_count = 0
        self.ws = None
        self.audio = None
        self.stream_in = None
        self.stream_out = None
        self.recording = False
        self.audio_buffer = []
        self.models = ["coder-next", "35b", "deepseek"]
        self.current_model_idx = 0
        self.current_voice = None
        self.overlay = StatusOverlay()
        self.running = True
        self.audio_lock = threading.Lock()
        self.recording_start_time = 0
        self.recording_thread = None
        self.volume_timer = None
        self.volume_level = 0
        
    def connect(self) -> bool:
        try:
            ws_url = f"ws://{self.host}:{self.port}"
            self.ws = websocket.create_connection(ws_url)
            print(f"{Fore.GREEN}✓ Connected to {ws_url}{Style.RESET_ALL}")
            self.retry_count = 0
            return True
        except Exception as e:
            self.retry_count += 1
            if self.retry_count <= self.retry_max:
                print(f"{Fore.RED}✗ Connection failed ({self.retry_count}/{self.retry_max}): {e}{Style.RESET_ALL}")
            else:
                print(f"{Fore.RED}✗ Connection failed: max retries ({self.retry_max}) reached{Style.RESET_ALL}")
            return False
            
    def start_recording(self):
        if self.recording:
            return
        self.recording = True
        self.audio_buffer = []
        self.recording_start_time = time.time()
        self.volume_level = 0
        
        try:
            self.audio = pyaudio.PyAudio()
            
            devices = self.audio.get_device_count()
            for i in range(devices):
                info = self.audio.get_device_info_by_index(i)
                print(f"  Device {i}: {info['name']}")
                
            self.stream_in = self.audio.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=16000,
                input=True,
                frames_per_buffer=1600
            )
            
            self.overlay.update_status("recording")
            
            self.show_recording_progress()
            self.show_volume_indicator()
            
            self.recording_thread = threading.Thread(target=self._recording_loop, daemon=True)
            self.recording_thread.start()
            
        except Exception as e:
            print(f"{Fore.RED}✗ Recording error: {e}{Style.RESET_ALL}")
            self.recording = False
            
    def _recording_loop(self):
        while self.recording:
            data = self.stream_in.read(1600, exception_on_overflow=False)
            self.audio_buffer.append(data)
            self._update_volume(data)
            
    def stop_recording(self):
        if not self.recording:
            return
        self.recording = False
        
        if self.recording_thread and self.recording_thread.is_alive():
            self.recording_thread.join(timeout=1)
        
        if self.stream_in:
            try:
                self.stream_in.stop_stream()
                self.stream_in.close()
            except:
                pass
        if self.audio:
            try:
                self.audio.terminate()
            except:
                pass
                
        audio_data = b''.join(self.audio_buffer)
        self.send_audio(audio_data)
        
    def send_audio(self, audio_data: bytes):
        if not self.ws:
            print(f"{Fore.RED}✗ WebSocket not connected{Style.RESET_ALL}")
            return
            
        try:
            self.overlay.update_status("processing")
            
            self.send_json({
                "type": "audio_start",
                "sample_rate": 16000,
                "channels": 1,
                "duration": len(audio_data) / 32000
            })
            
            chunk_size = 3200
            for i in range(0, len(audio_data), chunk_size):
                chunk = audio_data[i:i + chunk_size]
                encoded = base64.b64encode(chunk).decode('utf-8')
                self.send_json({
                    "type": "audio_chunk",
                    "data": encoded
                })
                
            self.send_json({"type": "audio_end"})
            
        except Exception as e:
            print(f"{Fore.RED}✗ Send audio error: {e}{Style.RESET_ALL}")
            
    def play_audio(self, pcm_data: bytes, sample_rate: int = 16000):
        try:
            self.overlay.update_status("speaking")
            
            p = pyaudio.PyAudio()
            stream = p.open(
                format=pyaudio.paInt16,
                channels=1,
                rate=sample_rate,
                output=True
            )
            
            stream.write(pcm_data)
            stream.stop_stream()
            stream.close()
            p.terminate()
            
        except Exception as e:
            print(f"{Fore.RED}✗ Playback error: {e}{Style.RESET_ALL}")
            
    def send_json(self, data: dict):
        if not self.ws:
            return
        try:
            self.ws.send(json.dumps(data))
        except Exception as e:
            print(f"{Fore.RED}✗ Send JSON error: {e}{Style.RESET_ALL}")
            
    def recv_loop(self):
        while self.running:
            if not self.ws:
                time.sleep(1)
                continue
                
            try:
                result = self.ws.recv()
                if result:
                    self.handle_message(result)
            except Exception as e:
                print(f"{Fore.RED}✗ Receive error: {e}{Style.RESET_ALL}")
                self.ws = None
                
    def handle_message(self, message: str):
        try:
            data = json.loads(message)
            msg_type = data.get("type")
            
            if msg_type == "tts_start":
                print("TTS starting...")
                
            elif msg_type == "tts_chunk":
                encoded = data.get("data", "")
                pcm_data = base64.b64decode(encoded)
                sample_rate = data.get("sample_rate", 16000)
                self.play_audio(pcm_data, sample_rate)
                
            elif msg_type == "tts_end":
                print("TTS complete")
                self.overlay.update_status("idle")
                
            elif msg_type == "ack":
                print(f"Ack: {data.get('message', '')}")
                
            elif msg_type == "error":
                print(f"{Fore.RED}✗ Error: {data.get('message', 'Unknown error')}{Style.RESET_ALL}")
                
        except Exception as e:
            print(f"{Fore.RED}✗ Handle message error: {e}{Style.RESET_ALL}")
            
    def set_model(self, model_uri: str):
        if not self.ws:
            return
        self.send_json({"type": "set_model", "model": model_uri})
        
    def cycle_model(self):
        self.current_model_idx = (self.current_model_idx + 1) % len(self.models)
        model = self.models[self.current_model_idx]
        self.set_model(model)
        print(f"Model changed to: {model}")
        
    def cycle_voice(self):
        try:
            import winreg
            voices = []
            key = winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE, 
                r"SOFTWARE\Microsoft\Speech_OneCore\Voices")
            
            i = 0
            while True:
                try:
                    voice_name = winreg.EnumKey(key, i)
                    voices.append(voice_name)
                    i += 1
                except:
                    break
                    
            if not voices:
                return
                
            if self.current_voice is None:
                self.current_voice = voices[0]
            else:
                idx = voices.index(self.current_voice)
                self.current_voice = voices[(idx + 1) % len(voices)]
                
            self.send_json({"type": "set_voice", "voice": self.current_voice})
            print(f"Voice changed to: {self.current_voice}")
            
        except Exception as e:
            print(f"{Fore.RED}✗ Cycle voice error: {e}{Style.RESET_ALL}")
            
    def run(self):
        print("Starting Voice Client...")
        
        threading.Thread(target=self.recv_loop, daemon=True).start()
        
        keyboard.add_hotkey('space', self.start_recording, suppress=True)
        keyboard.add_hotkey('space+release', self.stop_recording, suppress=True)
        keyboard.add_hotkey('ctrl+q', self.quit)
        keyboard.add_hotkey('ctrl+m', self.cycle_model)
        keyboard.add_hotkey('ctrl+v', self.cycle_voice)
        
        self.overlay.update_status("idle")
        
        while self.running:
            if not self.ws:
                if self.connect():
                    self.send_json({"type": "hello", "client": "voice-terminal"})
                elif self.retry_count <= self.retry_max:
                    time.sleep(self.retry_interval)
                else:
                    break
            time.sleep(0.1)
            
        self.quit()
        
    def load_config(self, config_path: str = "win_config.json"):
        try:
            with open(config_path, 'r', encoding='utf-8') as f:
                config = json.load(f)
                self.host = config.get("host", self.host)
                self.port = config.get("port", self.port)
                self.retry_max = config.get("retry_max", self.retry_max)
                self.retry_interval = config.get("retry_interval", self.retry_interval)
                self.current_voice = config.get("voice", self.current_voice)
                print(f"✓ Loaded config from {config_path}")
        except FileNotFoundError:
            print(f"Config file not found: {config_path}, using defaults")
        except Exception as e:
            print(f"{Fore.RED}✗ Error loading config: {e}{Style.RESET_ALL}")
            
    def quit(self):
        print("\nQuitting...")
        self.running = False
        
        if self.ws:
            try:
                self.send_json({"type": "disconnect", "client": "voice-terminal"})
                self.ws.close()
            except:
                pass
                
        self.overlay.destroy()
        keyboard.unhook_all()
        
        sys.exit(0)
        
    def _update_volume(self, audio_data: bytes):
        if len(audio_data) >= 2:
            samples = np.frombuffer(audio_data, dtype=np.int16)
            volume = np.abs(samples).mean()
            self.volume_level = min(100, int(volume / 32768 * 100))
            
            if self.volume_timer is None or time.time() - self.volume_timer >= 0.3:
                self.volume_timer = time.time()
                bar_len = self.volume_level // 10
                bar = '█' * bar_len + '░' * (10 - bar_len)
                print(f"\rVOL: [{bar}] {self.volume_level}%", end='', flush=True)
                
    def show_recording_progress(self):
        def update_progress():
            while self.recording:
                elapsed = time.time() - self.recording_start_time
                bar_len = int(elapsed / 10 * 10)
                bar = '█' * bar_len + '░' * (10 - bar_len)
                print(f"\r[{bar}] {elapsed:.1f}s", end='', flush=True)
                time.sleep(0.1)
                
        progress_thread = threading.Thread(target=update_progress, daemon=True)
        progress_thread.start()
        
    def show_volume_indicator(self):
        def update_volume():
            while self.recording:
                time.sleep(0.3)
                
        volume_thread = threading.Thread(target=update_volume, daemon=True)
        volume_thread.start()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Voice Terminal - Windows Client",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python win_client.py                      # Use default config
  python win_client.py --host 192.168.1.100 # Connect to specific gateway
  python win_client.py --port 8765          # Use custom port
  python win_client.py --config custom.json # Use custom config file

Shortcuts:
  [Space]       Start/stop recording
  [Ctrl+Q]      Quit
  [Ctrl+M]      Cycle models (coder-next, 35b, deepseek)
  [Ctrl+V]      Cycle voices
        """
    )
    parser.add_argument("--host", default="192.168.1.100", help="Voice gateway IP address")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port (default: 8765)")
    parser.add_argument("--config", default="win_config.json", help="Config file path (default: win_config.json)")
    parser.add_argument("--retry-max", type=int, default=None, help="Max retry attempts (default: from config)")
    parser.add_argument("--retry-interval", type=float, default=None, help="Retry interval in seconds (default: from config)")
    args = parser.parse_args()
    
    client = VoiceClient(args.host, args.port)
    
    client.load_config(args.config)
    
    if args.retry_max is not None:
        client.retry_max = args.retry_max
    if args.retry_interval is not None:
        client.retry_interval = args.retry_interval
    
    client.run()
