"""Which AI writes the texts. Every call forces a tool/function, so the answer
always comes back as structured JSON we can validate and store.

AI_PROVIDER picks it: "claude" (paid, best Finnish/Swedish), "gemini" (free tier),
or "demo" (no AI at all, templates from the Liiga data). If AI_PROVIDER is not set,
the first key found wins: ANTHROPIC_API_KEY, then GEMINI_API_KEY, else demo."""
from __future__ import annotations

from typing import Any, Protocol

from . import config


class LLM(Protocol):
    name: str

    def call_tool(self, model: str, system: str, prompt: str, tool: dict) -> tuple[dict, dict]: ...


class Claude:
    name = "claude"

    def __init__(self) -> None:
        if not config.ANTHROPIC_API_KEY:
            raise RuntimeError("ANTHROPIC_API_KEY is not set")
        import anthropic
        self.client = anthropic.Anthropic(api_key=config.ANTHROPIC_API_KEY)

    def call_tool(self, model: str, system: str, prompt: str, tool: dict) -> tuple[dict, dict]:
        msg = self.client.messages.create(
            model=model,
            max_tokens=8000,
            system=system,
            messages=[{"role": "user", "content": prompt}],
            tools=[tool],
            tool_choice={"type": "tool", "name": tool["name"]},
        )
        data: dict[str, Any] | None = None
        for block in msg.content:
            if getattr(block, "type", None) == "tool_use":
                data = block.input  # type: ignore[assignment]
                break
        if data is None:
            raise RuntimeError("Claude did not return structured output")
        usage = {"input_tokens": msg.usage.input_tokens, "output_tokens": msg.usage.output_tokens}
        return data, usage


def provider() -> str:
    p = config.AI_PROVIDER.lower()
    if p in ("claude", "gemini", "demo"):
        return p
    if config.ANTHROPIC_API_KEY:
        return "claude"
    if config.GEMINI_API_KEY:
        return "gemini"
    return "demo"


def writer_model() -> str:
    """The model name recorded on jobs and versions."""
    return {"claude": config.MODEL_WRITER, "gemini": config.GEMINI_MODEL, "demo": "demo-writer"}[provider()]


_default: LLM | None = None


def get_llm() -> LLM:
    global _default
    if _default is None:
        p = provider()
        if p == "claude":
            _default = Claude()
        elif p == "gemini":
            from .gemini import Gemini
            _default = Gemini()
        else:
            from .demo_ai import DemoWriter
            _default = DemoWriter()
    return _default


def set_llm(llm: LLM | None) -> None:
    """Used by tests to plug in a fake model."""
    global _default
    _default = llm
