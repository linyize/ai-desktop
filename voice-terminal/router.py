"""LLM router module."""
from typing import Optional
from config import get_config


class Router:
    """Route user input to appropriate LLM models based on keywords."""

    def __init__(self, routers_config: list):
        """Initialize router with configuration.
        
        Args:
            routers_config: List of router dicts from config.yaml.
                Each dict has name, match_keywords, model, optional match_weight.
        """
        self.routers = []
        self.default_model = "local://coder-next:8082"
        
        for router in routers_config:
            self.routers.append({
                "name": router.name,
                "match_keywords": router.match_keywords,
                "model": router.model,
                "match_weight": router.match_weight if router.match_weight is not None else 0.0,
            })
        
        self.fallback_router = None
        for router in self.routers:
            if router["match_weight"] is not None and router["match_weight"] > 0:
                if self.fallback_router is None or router["match_weight"] > self.fallback_router["match_weight"]:
                    self.fallback_router = router

    def route(self, text: str) -> dict:
        """Route user text to appropriate model.
        
        Args:
            text: User input text.
            
        Returns:
            Dict with model, name, and confidence.
        """
        text_lower = text.lower()
        
        for router in self.routers:
            if router["match_keywords"]:
                for keyword in router["match_keywords"]:
                    if keyword.lower() in text_lower:
                        return {
                            "model": router["model"],
                            "name": router["name"],
                            "confidence": 1.0
                        }
        
        if self.fallback_router:
            return {
                "model": self.fallback_router["model"],
                "name": self.fallback_router["name"],
                "confidence": self.fallback_router["match_weight"]
            }
        
        return {
            "model": self.default_model,
            "name": "default",
            "confidence": 0.0
        }

    def get_models(self) -> list:
        """Return list of all available model URIs."""
        return [router["model"] for router in self.routers]
