"""Configuration module for voice-terminal."""
import yaml
from dataclasses import dataclass
from pathlib import Path
from typing import Optional


@dataclass
class AudioConfig:
    """Audio configuration."""
    sample_rate: int
    channels: int
    frame_ms: int


@dataclass
class ASRConfig:
    """ASR configuration."""
    engine: str
    model: str
    language: str


@dataclass
class RouterConfig:
    """Router configuration."""
    name: str
    match_keywords: list
    model: str
    match_weight: Optional[float] = None


@dataclass
class EdgeConfig:
    """Edge TTS configuration."""
    voice: str


@dataclass
class MossttsConfig:
    """MossTTS configuration."""
    ref_audio: str
    ref_text: str
    use_gpu: bool


@dataclass
class TTSConfig:
    """TTS configuration."""
    default_engine: str
    edge: EdgeConfig
    mosstts: MossttsConfig
    fallback_engine: str


@dataclass
class StatusConfig:
    """Status/LED configuration."""
    idle_led: str
    recording_led: str
    processing_led: str
    speaking_led: str


@dataclass
class Config:
    """Global configuration object."""
    host: str
    ws_port: int
    http_port: int
    audio: AudioConfig
    asr: ASRConfig
    routers: list
    tts: TTSConfig
    status: StatusConfig


_config: Optional[Config] = None


def load_config(config_path: str = "config.yaml") -> Config:
    """Load configuration from YAML file."""
    global _config
    
    if _config is not None:
        return _config
    
    path = Path(config_path)
    if not path.exists():
        raise FileNotFoundError(f"Config file not found: {config_path}")
    
    with open(path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    _config = Config(
        host=data['host'],
        ws_port=data['ws_port'],
        http_port=data['http_port'],
        audio=AudioConfig(
            sample_rate=data['audio']['sample_rate'],
            channels=data['audio']['channels'],
            frame_ms=data['audio']['frame_ms']
        ),
        asr=ASRConfig(
            engine=data['asr']['engine'],
            model=data['asr']['model'],
            language=data['asr']['language']
        ),
        routers=[
            RouterConfig(
                name=r['name'],
                match_keywords=r.get('match_keywords', []),
                model=r['model'],
                match_weight=r.get('match_weight')
            )
            for r in data['routers']
        ],
        tts=TTSConfig(
            default_engine=data['tts']['default_engine'],
            edge=EdgeConfig(voice=data['tts']['edge']['voice']),
            mosstts=MossttsConfig(
                ref_audio=data['tts']['mosstts']['ref_audio'],
                ref_text=data['tts']['mosstts']['ref_text'],
                use_gpu=data['tts']['mosstts']['use_gpu']
            ),
            fallback_engine=data['tts']['fallback_engine']
        ),
        status=StatusConfig(
            idle_led=data['status']['idle_led'],
            recording_led=data['status']['recording_led'],
            processing_led=data['status']['processing_led'],
            speaking_led=data['status']['speaking_led']
        )
    )
    
    return _config


def get_config() -> Config:
    """Get the global config object. Raises if not loaded."""
    if _config is None:
        raise RuntimeError("Config not loaded. Call load_config() first.")
    return _config
