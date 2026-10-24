"""Google Gemini as a free alternative to Claude (Google AI Studio has a free tier).

Same contract as the Claude wrapper: one forced function call, structured JSON back."""
from __future__ import annotations

import copy

import httpx

from . import config

URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def to_gemini_schema(schema: dict) -> dict:
    """Gemini wants upper-case type names (OBJECT, STRING, …); otherwise the JSON schema is the same."""
    s = copy.deepcopy(schema)

    def fix(node):
        if isinstance(node, dict):
            if isinstance(node.get("type"), str):
                node["type"] = node["type"].upper()
            for v in node.values():
                fix(v)
        elif isinstance(node, list):
            for v in node:
                fix(v)

    fix(s)
    return s


def pick_model(names: list[str]) -> str | None:
    """Choose a Flash model (fast, on the free tier) from the models this key can use."""
    flash = [n for n in names if "flash" in n and "lite" not in n and "image" not in n and "tts" not in n
             and "live" not in n and "audio" not in n and "exp" not in n]
    lite = [n for n in names if "flash-lite" in n]
    pool = flash or lite or names
    return sorted(pool, reverse=True)[0] if pool else None


class Gemini:
    name = "gemini"

    def __init__(self) -> None:
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set")
        self.model = config.GEMINI_MODEL

    def _available_models(self) -> list[str]:
        r = httpx.get("https://generativelanguage.googleapis.com/v1beta/models",
                      params={"key": config.GEMINI_API_KEY, "pageSize": 200}, timeout=30)
        r.raise_for_status()
        return [m["name"].split("/", 1)[1] for m in r.json().get("models", [])
                if "generateContent" in m.get("supportedGenerationMethods", [])]

    def call_tool(self, model: str, system: str, prompt: str, tool: dict) -> tuple[dict, dict]:
        body = {
            "systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "tools": [{"functionDeclarations": [{
                "name": tool["name"], "description": tool.get("description", ""),
                "parameters": to_gemini_schema(tool["input_schema"]),
            }]}],
            "toolConfig": {"functionCallingConfig": {"mode": "ANY", "allowedFunctionNames": [tool["name"]]}},
            "generationConfig": {"temperature": 0.4},
        }
        r = httpx.post(URL.format(model=self.model), params={"key": config.GEMINI_API_KEY}, json=body, timeout=180)
        if r.status_code == 404:  # model retired or renamed: pick a current Flash model and retry once
            better = pick_model(self._available_models())
            if better and better != self.model:
                self.model = better
                r = httpx.post(URL.format(model=self.model), params={"key": config.GEMINI_API_KEY}, json=body, timeout=180)
        if r.status_code >= 400:
            raise RuntimeError(f"Gemini error {r.status_code}: {r.text[:400]}")
        data = r.json()
        for part in data.get("candidates", [{}])[0].get("content", {}).get("parts", []):
            if "functionCall" in part:
                meta = data.get("usageMetadata", {})
                return part["functionCall"].get("args", {}), {
                    "input_tokens": meta.get("promptTokenCount", 0),
                    "output_tokens": meta.get("candidatesTokenCount", 0),
                }
        raise RuntimeError("Gemini did not return structured output")
