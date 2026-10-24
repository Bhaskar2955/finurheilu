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


class Gemini:
    name = "gemini"

    def __init__(self) -> None:
        if not config.GEMINI_API_KEY:
            raise RuntimeError("GEMINI_API_KEY is not set")

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
        r = httpx.post(URL.format(model=config.GEMINI_MODEL), params={"key": config.GEMINI_API_KEY},
                       json=body, timeout=180)
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
