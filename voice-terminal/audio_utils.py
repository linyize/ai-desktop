"""Audio utility functions for voice-terminal."""
import wave
import struct
import tempfile
import os
from typing import Tuple


def pcm16_to_wav(pcm_bytes: bytes, sample_rate: int = 16000) -> bytes:
    """
    Wrap raw PCM16 mono bytes in a WAV header.
    
    Args:
        pcm_bytes: Raw PCM16 audio data (16-bit signed little-endian)
        sample_rate: Sample rate in Hz (default: 16000)
    
    Returns:
        Complete WAV file bytes
    """
    num_channels = 1
    sample_width = 2  # 16-bit = 2 bytes
    byte_rate = sample_rate * num_channels * sample_width
    block_align = num_channels * sample_width
    data_size = len(pcm_bytes)
    chunk_size = 36 + data_size  # RIFF chunk size
    
    wav_header = struct.pack('<4sI4s',
        b'RIFF',
        chunk_size,
        b'WAVE'
    )

    wav_header += struct.pack('<4sIHHIIHH',
        b'fmt ',
        16,  # Subchunk1Size (16 for PCM)
        1,   # AudioFormat (1 for PCM)
        num_channels,
        sample_rate,
        byte_rate,
        block_align,
        sample_width * 8  # Bits per sample
    )

    wav_header += struct.pack('<4sI',
        b'data',
        data_size
    )
    
    return wav_header + pcm_bytes


def wav_to_pcm16(wav_bytes: bytes) -> bytes:
    """
    Strip WAV header, return raw PCM16 data.
    
    Args:
        wav_bytes: Complete WAV file bytes
    
    Returns:
        Raw PCM16 audio data
    """
    import struct
    
    if len(wav_bytes) < 44:
        raise ValueError("WAV data too short")
    
    # Check RIFF header
    if wav_bytes[:4] != b'RIFF':
        raise ValueError("Not a WAV file: missing RIFF header")
    
    # Parse chunk size
    chunk_size = struct.unpack('<I', wav_bytes[4:8])[0]
    
    # Check WAVE header
    if wav_bytes[8:12] != b'WAVE':
        raise ValueError("Not a WAV file: missing WAVE header")
    
    # Find data chunk
    offset = 12
    while offset + 8 <= len(wav_bytes):
        chunk_id = wav_bytes[offset:offset + 4]
        if chunk_id == b'data':
            break
        chunk_size = struct.unpack('<I', wav_bytes[offset + 4:offset + 8])[0]
        offset += 8 + chunk_size
    
    if wav_bytes[offset:offset + 4] != b'data':
        raise ValueError("WAV file missing data chunk")
    
    data_size = struct.unpack('<I', wav_bytes[offset + 4:offset + 8])[0]
    data_start = offset + 8
    data_end = data_start + data_size
    
    return wav_bytes[data_start:data_end]


def normalize_volume(pcm_bytes: bytes, target_db: float = -3.0) -> bytes:
    """
    Simple peak normalization.
    
    Args:
        pcm_bytes: Raw PCM16 audio data
        target_db: Target peak level in dB (default: -3.0)
    
    Returns:
        Normalized PCM16 audio data
    """
    import math
    
    if len(pcm_bytes) % 2 != 0:
        raise ValueError("PCM16 data length must be even")
    
    # Convert to list of samples
    samples = struct.unpack('<%dh' % (len(pcm_bytes) // 2), pcm_bytes)
    
    # Find peak
    peak = max(abs(s) for s in samples)
    if peak == 0:
        return pcm_bytes
    
    # Calculate target amplitude
    max_amplitude = 32767  # Max for 16-bit signed
    target_amplitude = int(max_amplitude * (10 ** (target_db / 20)))
    
    # Calculate gain
    gain = target_amplitude / peak
    
    # Apply gain and clamp
    normalized = []
    for s in samples:
        new_val = int(s * gain)
        new_val = max(-32768, min(32767, new_val))
        normalized.append(new_val)
    
    return struct.pack('<%dh' % len(normalized), *normalized)


def save_audio(pcm_bytes: bytes, path: str, sample_rate: int = 16000) -> None:
    """
    Save PCM16 bytes as WAV file.
    
    Args:
        pcm_bytes: Raw PCM16 audio data
        path: Output file path
        sample_rate: Sample rate in Hz (default: 16000)
    """
    wav_bytes = pcm16_to_wav(pcm_bytes, sample_rate)
    with open(path, 'wb') as f:
        f.write(wav_bytes)


def read_audio(path: str) -> Tuple[bytes, int]:
    """
    Read WAV file, return (pcm16_bytes, sample_rate).
    
    Args:
        path: Input WAV file path
    
    Returns:
        Tuple of (PCM16 audio data, sample rate)
    """
    with wave.open(path, 'rb') as wav:
        sample_rate = wav.getframerate()
        num_channels = wav.getnchannels()
        sample_width = wav.getsampwidth()
        audio_data = wav.readframes(wav.getnframes())
        
        if num_channels != 1:
            raise ValueError(f"Only mono WAV files supported, got {num_channels} channels")
        
        if sample_width != 2:
            raise ValueError(f"Only 16-bit WAV files supported, got {sample_width * 8}-bit")
        
        return audio_data, sample_rate
