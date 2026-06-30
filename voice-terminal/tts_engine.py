"""TTS (Text-to-Speech) engine supporting multiple backends."""
import asyncio
import subprocess
import tempfile
import os
from typing import Tuple
from pathlib import Path


class TTSEngine:
    """
    TTS engine supporting Edge-TTS and fallback options.
    
    Uses edge-tts library for high-quality Chinese TTS.
    """
    
    def __init__(self, engine: str = "edge", edge_voice: str = "zh-CN-XiaoxiaoNeural"):
        """
        Initialize TTS engine.
        
        Args:
            engine: TTS engine ('edge' or other for fallback)
            edge_voice: Edge-TTS voice name
        """
        self.engine = engine
        self.voice = edge_voice
        self._edge_tts_available = self._check_edge_tts()
    
    def _check_edge_tts(self) -> bool:
        """Check if edge-tts is available."""
        try:
            import edge_tts
            return True
        except ImportError:
            return False
    
    async def _synthesize_edge(self, text: str) -> Tuple[bytes, int]:
        """
        Synthesize using Edge-TTS.
        
        Note: edge-tts outputs MP3 even with .wav extension.
        We save as MP3 then convert to WAV via ffmpeg.
        
        Args:
            text: Text to synthesize
        
        Returns:
            Tuple of (PCM16 audio bytes, sample rate)
        """
        import edge_tts
        import subprocess as sp
        
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as temp_file:
            mp3_path = temp_file.name
        
        try:
            # edge-tts outputs MP3 regardless of extension
            communicate = edge_tts.Communicate(text, self.voice)
            await communicate.save(mp3_path)
            
            # Convert MP3 to WAV via ffmpeg pipe
            result = sp.run(
                ["ffmpeg", "-y", "-i", mp3_path, "-f", "wav", "-acodec", "pcm_s16le",
                 "-ar", "16000", "-ac", "1", "pipe:1"],
                capture_output=True, timeout=30
            )
            if result.returncode != 0:
                raise RuntimeError(f"ffmpeg conversion failed: {result.stderr.decode()}")
            
            wav_bytes = result.stdout
            # WAV header is 44 bytes, PCM16 data follows
            pcm_data = wav_bytes[44:]
            return bytes(pcm_data), 16000
        
        finally:
            if os.path.exists(mp3_path):
                try:
                    os.unlink(mp3_path)
                except OSError:
                    pass
    
    def synthesize(self, text: str) -> Tuple[bytes, int]:
        """
        Synthesize text to audio.
        
        Args:
            text: Text to synthesize
        
        Returns:
            Tuple of (PCM16 audio bytes, sample rate)
        """
        if self.engine == "edge" and self._edge_tts_available:
            return asyncio.run(self._synthesize_edge(text))
        else:
            print("TTS unavailable")
            return b"", 16000
    
    def synthesize_to_file(self, text: str, path: str) -> str:
        """
        Synthesize text and save to WAV file.
        
        Args:
            text: Text to synthesize
            path: Output file path
        
        Returns:
            Path to saved file
        """
        if self.engine == "edge" and self._edge_tts_available:
            asyncio.run(self._synthesize_edge_to_file(text, path))
            return path
        else:
            print("TTS unavailable")
            return ""
    
    async def _synthesize_edge_to_file(self, text: str, path: str) -> None:
        """
        Synthesize and save using Edge-TTS.
        
        Saves as MP3 then converts to WAV via ffmpeg.
        
        Args:
            text: Text to synthesize
            path: Output WAV file path
        """
        import edge_tts
        import subprocess as sp
        
        with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
            mp3_path = f.name
        
        try:
            communicate = edge_tts.Communicate(text, self.voice)
            await communicate.save(mp3_path)
            
            sp.run(
                ["ffmpeg", "-y", "-i", mp3_path, "-f", "wav",
                 "-acodec", "pcm_s16le", "-ar", "16000", "-ac", "1", path],
                capture_output=True, timeout=30, check=True
            )
        finally:
            if os.path.exists(mp3_path):
                os.unlink(mp3_path)
    
    def set_voice(self, voice: str) -> None:
        """
        Change the voice.
        
        Args:
            voice: Voice name (e.g., 'zh-CN-XiaoxiaoNeural')
        """
        self.voice = voice
