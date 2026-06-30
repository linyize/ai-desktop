# AI Voice Terminal Gateway — 实现计划

## 总体

语音网关服务，跑在 Linux 服务器上，对局域网提供：
- **WebSocket** `ws://<ip>:8765` — 音频流交互
- **REST API** `http://<ip>:8766` — 状态/配置查询

Windows 客户端通过 WebSocket 连接，发送音频、接收 TTS 音频播放。

---

## 文件清单

### 网关服务（Linux 端）

| 文件 | 职责 | 约行数 |
|:----|:-----|:------|
| `gateway.py` | WebSocket + HTTP server，会话管理，主循环 | 200 |
| `asr_engine.py` | Whisper ASR 封装，调用 `whisper` CLI 或模型 | 80 |
| `router.py` | 根据关键词/权重选择 LLM 后端 | 100 |
| `llm_client.py` | 统一 LLM 调用接口（本地 API / 云端 API） | 120 |
| `tts_engine.py` | TTS 引擎选择 + 调用（Edge-TTS / MOSS-TTS） | 150 |
| `audio_utils.py` | 音频格式转换、opus 编解码、音量归一化 | 60 |
| `config.py` | 加载 `config.yaml` | 30 |
| `requirements-gateway.txt` | Python 依赖 | 10 |

### Windows 客户端

| 文件 | 职责 | 约行数 |
|:----|:-----|:------|
| `win_client.py` | 录音 + WebSocket + 播放，快捷键控制 | 200 |
| `requirements-win.txt` | Windows 端 Python 依赖 | 10 |

### 测试

| 文件 | 职责 |
|:----|:-----|
| `test_asr.py` | 传一个音频文件测试 ASR |
| `test_llm.py` | 测试 LLM 路由和调用 |
| `test_tts.py` | 测试 TTS 合成 |
| `test_e2e.py` | 用 ping 音频模拟一次完整对话 |

---

## 组件接口定义

### 1. ASR Engine

```python
class ASREngine:
    def transcribe(audio_path: str) -> dict:
        return {"text": "识别的文字", "segments": [...]}
    
    def transcribe_chunk(audio_chunk: bytes, sample_rate: int = 16000) -> dict:
        # 流式分段识别（可选）
```

### 2. Router

```python
class Router:
    def route(text: str) -> str:
        # 返回模型标识: "coder-next:8082" | "35b:8080" | "deepseek-api" | ...
```

### 3. LLM Client

```python
class LLMClient:
    def chat(messages: list, stream: bool = False) -> str:
        # 统一的 OpenAI 兼容接口调用
```

### 4. TTS Engine

```python
class TTSEngine:
    def synthesize(text: str, voice: str = None) -> bytes:
        # 返回 WAV 音频字节
```

---

## 协议设计

### WebSocket 消息格式 (JSON)

**客户端 → 服务端：**
```json
{"type": "audio_start", "sample_rate": 16000, "format": "pcm16"}
{"type": "audio_chunk", "data": "<base64 pcm16 bytes>"}
{"type": "audio_end"}
{"type": "set_voice", "profile": "default"}    // 切换音色
{"type": "set_model", "model": "local://35b"}   // 切换模型
{"type": "ping"}
```

**服务端 → 客户端：**
```json
{"type": "status", "state": "recording|processing|speaking|idle"}
{"type": "asr_result", "text": "识别出的文字"}
{"type": "model_selected", "model": "coder-next:8082", "reason": "编程"}
{"type": "tts_start", "format": "pcm16", "sample_rate": 24000}
{"type": "tts_chunk", "data": "<base64 pcm16 bytes>"}
{"type": "tts_end"}
{"type": "error", "message": "错误描述"}
{"type": "pong"}
```

### REST API

```
GET  /v1/status         → { "state": "idle", "model": "coder-next", "clients": 1 }
GET  /v1/models         → [ "local://coder-next:8082", "local://35b:8080", ... ]
POST /v1/tts            → { "text": "...", "voice": "..." } → audio/wav
POST /v1/asr            → multipart audio file → { "text": "..." }
GET  /v1/voices         → [ "edge:zh-CN-XiaoxiaoNeural", "mosstts:default", ... ]
```

---

## 实现顺序

### Task 1: 基础框架 + ASR + TTS（独立可测）
- `config.py`, `audio_utils.py`, `asr_engine.py`, `tts_engine.py`
- 验证：`test_asr.py` 能识别本地 wav，`test_tts.py` 能合成语音

### Task 2: LLM 路由 + 调用
- `router.py`, `llm_client.py`
- 验证：`test_llm.py` 能调用 Coder-Next 并拿到回答

### Task 3: 网关服务 + WebSocket
- `gateway.py` — 整合所有组件，暴露 WebSocket + HTTP
- 验证：用 websocat 或简单 Python 脚本连接，发一段音频，收到 TTS 回复

### Task 4: Windows 客户端
- `win_client.py` — 录音 + WebSocket + 播放
- 验证：Windows 上按住空格说话，Windows 喇叭播放 AI 回答

---

## 环境要求

Linux 端：
```bash
# 核心
pip install websockets pyyaml numpy soundfile
# TTS
pip install edge-tts
# ASR (二选一)
pip install openai-whisper           # 本地模型，需 GPU
# 或系统安装 whisper.cpp CLI
```

Windows 端：
```powershell
pip install pyaudio websocket-client keyboard numpy
```
