"""ASR (Automatic Speech Recognition) engine using Whisper."""
import subprocess
import json
import tempfile
import os
from typing import Dict, List, Any
from pathlib import Path


class ASREngine:
    """
    ASR engine using Whisper CLI.
    
    Transcribes audio using OpenAI's Whisper model via command-line interface.
    """
    
    def __init__(self, model: str = "tiny", language: str = "zh"):
        """
        Initialize ASR engine.
        
        Args:
            model: Whisper model size (tiny, base, small, medium, large)
            language: Language code (e.g., 'zh', 'en')
        """
        self.model = model
        self.language = language
        self._whisper_available = self._check_whisper()
    
    def _check_whisper(self) -> bool:
        """Check if whisper CLI is available."""
        try:
            result = subprocess.run(
                ["whisper", "--help"],
                capture_output=True,
                timeout=5
            )
            return result.returncode == 0
        except (subprocess.TimeoutExpired, FileNotFoundError):
            return False
    
    def transcribe(self, audio_pcm: bytes, sample_rate: int = 16000) -> Dict[str, Any]:
        """
        Transcribe PCM16 audio bytes.
        
        Args:
            audio_pcm: Raw PCM16 audio data
            sample_rate: Sample rate in Hz (default: 16000)
        
        Returns:
            Dictionary with 'text' and 'segments' keys
        
        Raises:
            RuntimeError: If whisper is not installed
        """
        if not self._whisper_available:
            raise RuntimeError(
                "Whisper CLI not found. Please install with: pip install openai-whisper"
            )
        
        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as temp_wav:
            temp_wav_path = temp_wav.name
        
        try:
            # Convert PCM to WAV
            from audio_utils import pcm16_to_wav
            wav_data = pcm16_to_wav(audio_pcm, sample_rate)
            with open(temp_wav_path, 'wb') as f:
                f.write(wav_data)
            
            # Run whisper CLI
            output_dir = os.path.dirname(temp_wav_path)
            result = subprocess.run(
                [
                    "whisper",
                    temp_wav_path,
                    "--model", self.model,
                    "--language", self.language,
                    "--output_format", "json",
                    "--output_dir", output_dir
                ],
                capture_output=True,
                text=True,
                timeout=60
            )
            
            if result.returncode != 0:
                raise RuntimeError(f"Whisper failed: {result.stderr}")
            
            # Parse JSON output
            json_path = temp_wav_path + ".json"
            if os.path.exists(json_path):
                with open(json_path, 'r', encoding='utf-8') as f:
                    output = json.load(f)
                
                return {
                    "text": output.get("text", ""),
                    "segments": output.get("segments", [])
                }
            else:
                raise RuntimeError("Whisper did not produce JSON output")
        
        finally:
            # Cleanup temp files
            for ext in [".wav", ".json", ".txt", ".vtt", ".srt"]:
                temp_file = temp_wav_path + ext
                if os.path.exists(temp_file):
                    try:
                        os.unlink(temp_file)
                    except OSError:
                        pass
    
    def transcribe_file(self, wav_path: str) -> Dict[str, Any]:
        """
        Transcribe a WAV file directly.
        
        Args:
            wav_path: Path to WAV file
        
        Returns:
            Dictionary with 'text' and 'segments' keys
        """
        if not self._whisper_available:
            raise RuntimeError(
                "Whisper CLI not found. Please install with: pip install openai-whisper"
            )
        
        if not os.path.exists(wav_path):
            raise FileNotFoundError(f"WAV file not found: {wav_path}")
        
        output_dir = os.path.dirname(wav_path) or "."
        result = subprocess.run(
            [
                "whisper",
                wav_path,
                "--model", self.model,
                "--language", self.language,
                "--output_format", "json",
                "--output_dir", output_dir
            ],
            capture_output=True,
            text=True,
            timeout=60
        )
        
        if result.returncode != 0:
            raise RuntimeError(f"Whisper failed: {result.stderr}")
        
        json_path = wav_path + ".json"
        if os.path.exists(json_path):
            with open(json_path, 'r', encoding='utf-8') as f:
                output = json.load(f)
            
            return {
                "text": output.get("text", ""),
                "segments": output.get("segments", [])
            }
        else:
            raise RuntimeError("Whisper did not produce JSON output")
