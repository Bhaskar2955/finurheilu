"""Thin wrapper around the Claude API. Every call forces a tool, so the answer
always comes back as structured JSON we can validate and store."""
from __future__ import annotations

from typing import Any, Protocol

from . import config


class LLM(Protocol):
    def call_tool(self, model: str, system: str, prompt: str, tool: dict) -> tuple[dict, dict]: ...


class Claude:
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


_default: LLM | None = None


def get_llm() -> LLM:
    global _default
    if _default is None:
        _default = Claude()
    return _default


def set_llm(llm: LLM | None) -> None:
    """Used by tests to plug in a fake model."""
    global _default
    _default = llm
