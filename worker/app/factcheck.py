"""Deterministic fact check: no AI involved, so it can't be talked out of a mistake.

1. Each claim must cite a fact key, and its value must equal the Liiga value.
2. Every number written in any text must exist somewhere in the fact sheet."""
from __future__ import annotations

import re
from dataclasses import dataclass

from .facts import Fact

DASHES = re.compile(r"\s*[–—−-]\s*")
NUM = re.compile(r"\d+")


def norm(v: str | None) -> str:
    v = (v or "").strip().lower()
    v = DASHES.sub("–", v)
    v = re.sub(r"(\d)[.,](\d\d)\b", r"\1:\2", v)   # 63.41 -> 63:41 (Finnish/Swedish time style)
    v = re.sub(r"\s+", " ", v)
    return v


@dataclass
class ClaimResult:
    text: str
    fact_key: str | None
    ai_value: str | None
    source_value: str | None
    status: str  # ok | mismatch | unverified


def check_claims(claims: list[dict], facts: dict[str, Fact]) -> list[ClaimResult]:
    out: list[ClaimResult] = []
    for c in claims:
        key, val = c.get("fact_key"), c.get("value")
        f = facts.get(key or "")
        if not f:
            out.append(ClaimResult(c.get("text", ""), key, val, None, "unverified"))
        elif norm(val) == norm(f.value):
            out.append(ClaimResult(c.get("text", ""), key, val, f.value, "ok"))
        else:
            out.append(ClaimResult(c.get("text", ""), key, val, f.value, "mismatch"))
    return out


def allowed_numbers(facts: dict[str, Fact]) -> set[str]:
    nums: set[str] = set()
    for f in facts.values():
        for s in (f.value, f.label):
            nums.update(n.lstrip("0") or "0" for n in NUM.findall(s))
    nums.update({"1", "2", "3"})  # periods ("3rd period") are always fine
    return nums


def stray_numbers(texts: list[str], facts: dict[str, Fact]) -> list[str]:
    """Numbers that appear in the AI's texts but nowhere in the Liiga data."""
    ok = allowed_numbers(facts)
    found: list[str] = []
    for t in texts:
        for n in NUM.findall(t):
            n2 = n.lstrip("0") or "0"
            if n2 not in ok and n2 not in found:
                found.append(n2)
    return found
