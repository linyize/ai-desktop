"""LLM client module for OpenAI-compatible endpoints."""
import os
import urllib.request
import urllib.error
import json
from typing import Generator, AsyncGenerator
from urllib.parse import urlparse

from config import get_config


class LLMClient:
    """Unified LLM client for local and cloud endpoints."""

    def __init__(self):
        """Initialize LLM client."""
        self.config = get_config()

    def _parse_model_uri(self, model_uri: str) -> dict:
        """Parse model URI into components.
        
        Args:
            model_uri: URI in format "local://host:port" or "cloud://provider".
            
        Returns:
            Dict with type, host, port, and provider.
        """
        if model_uri.startswith("local://"):
            parts = model_uri.replace("local://", "").split(":")
            host = parts[0]
            port = int(parts[1]) if len(parts) > 1 else 8082
            return {
                "type": "local",
                "host": host,
                "port": port,
                "provider": None
            }
        elif model_uri.startswith("cloud://"):
            provider = model_uri.replace("cloud://", "")
            return {
                "type": "cloud",
                "host": None,
                "port": None,
                "provider": provider
            }
        else:
            raise ValueError(f"Unknown model URI format: {model_uri}")

    def _build_local_url(self, host: str, port: int) -> str:
        """Build local endpoint URL."""
        return f"http://{host}:{port}/v1/chat/completions"

    def _build_cloud_url(self, provider: str) -> str:
        """Build cloud endpoint URL."""
        urls = {
            "deepseek": "https://api.deepseek.com/v1/chat/completions",
            "doubao": "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
            "openai": "https://api.openai.com/v1/chat/completions",
            "claude": "https://api.anthropic.com/v1/messages",
        }
        return urls.get(provider, f"https://api.{provider}.com/v1/chat/completions")

    def _get_api_key(self, provider: str) -> str:
        """Get API key for cloud provider."""
        keys = {
            "deepseek": "DEEPSEEK_API_KEY",
            "doubao": "DOUBAO_API_KEY",
            "openai": "OPENAI_API_KEY",
            "claude": "ANTHROPIC_API_KEY",
        }
        env_var = keys.get(provider)
        if env_var:
            return os.environ.get(env_var, "")
        return ""

    def _make_request(self, url: str, api_key: str, data: dict) -> str:
        """Make HTTP request to endpoint."""
        headers = {
            "Content-Type": "application/json",
        }
        if api_key:
            headers["Authorization"] = f"Bearer {api_key}"

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                result = json.loads(response.read().decode("utf-8"))
                
                if "deepseek" in url or "openai" in url:
                    return result["choices"][0]["message"]["content"]
                elif "doubao" in url:
                    return result["choices"][0]["message"]["content"]
                elif "claude" in url:
                    return result["content"][0]["text"]
                else:
                    return result["choices"][0]["message"]["content"]
        except urllib.error.URLError as e:
            return f"Error: Connection failed - {str(e)}"
        except urllib.error.HTTPError as e:
            return f"Error: HTTP {e.code} - {e.reason}"
        except Exception as e:
            return f"Error: {str(e)}"

    def _process_messages(self, messages: list) -> dict:
        """Process messages into API format."""
        processed = {
            "messages": [],
            "temperature": 0.7,
            "max_tokens": 2048,
        }
        
        for msg in messages:
            processed["messages"].append({
                "role": msg["role"],
                "content": msg["content"]
            })
        
        return processed

    def chat(self, model_uri: str, messages: list, stream: bool = False) -> str:
        """Chat with LLM endpoint.
        
        Args:
            model_uri: Model URI (local://host:port or cloud://provider).
            messages: List of message dicts with role and content.
            stream: Whether to use streaming (not supported yet).
            
        Returns:
            Assistant response text or error message.
        """
        parsed = self._parse_model_uri(model_uri)
        
        data = self._process_messages(messages)
        
        if parsed["type"] == "local":
            url = self._build_local_url(parsed["host"], parsed["port"])
            api_key = ""
        else:
            url = self._build_cloud_url(parsed["provider"])
            api_key = self._get_api_key(parsed["provider"])
        
        return self._make_request(url, api_key, data)

    async def chat_stream(self, model_uri: str, messages: list) -> AsyncGenerator[str, None]:
        """Async streaming chat with LLM endpoint.
        
        Args:
            model_uri: Model URI.
            messages: List of message dicts.
            
        Yields:
            Text chunks from streaming response.
        """
        parsed = self._parse_model_uri(model_uri)
        
        data = self._process_messages(messages)
        data["stream"] = True
        
        if parsed["type"] == "local":
            url = self._build_local_url(parsed["host"], parsed["port"])
            api_key = ""
        else:
            url = self._build_cloud_url(parsed["provider"])
            api_key = self._get_api_key(parsed["provider"])
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}" if api_key else "",
        }
        
        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(data).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=30) as response:
                for line in response:
                    line = line.decode("utf-8").strip()
                    if line.startswith("data: "):
                        chunk = line[6:]
                        if chunk == "[DONE]":
                            break
                        data = json.loads(chunk)
                        if "content" in data["choices"][0]["delta"]:
                            yield data["choices"][0]["delta"]["content"]
        except Exception as e:
            yield f"Error: {str(e)}"

    def get_available_models(self) -> dict:
        """Get available models from routers.
        
        Returns:
            Dict mapping model_uri to readable name.
        """
        models = {}
        for router in self.config.routers:
            model_uri = router["model"]
            if model_uri not in models:
                if model_uri.startswith("local://"):
                    parts = model_uri.replace("local://", "").split(":")
                    models[model_uri] = f"Local: {parts[0]}:{parts[1]}"
                elif model_uri.startswith("cloud://"):
                    provider = model_uri.replace("cloud://", "")
                    models[model_uri] = f"Cloud: {provider}"
                else:
                    models[model_uri] = model_uri
        return models
