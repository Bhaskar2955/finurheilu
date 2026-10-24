"""Run the worker locally with a FAKE Claude (no API key, no cost).

    cd worker && DATABASE_URL=... WORKER_TOKEN=dev python ../dev/fake_ai.py

The fake writes plausible texts from the real fact sheet. Its first draft has a
deliberate mistake (wrong shot count) so you can try the fact check; when the
editor asks for a change it returns a corrected version."""
from __future__ import annotations

import json
import os
import re
import sys

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "worker"))

from app import llm  # noqa: E402


def _facts(prompt: str) -> dict[str, dict]:
    m = re.search(r"Fact sheet(?: \(JSON\))?:\n(\[.*?\n\])", prompt, re.S)
    return {f["key"]: f for f in json.loads(m.group(1))} if m else {}


class FakeClaude:
    def call_tool(self, model, system, prompt, tool):
        f = _facts(prompt)
        fixing = "editor asks for this change" in prompt
        home, away = f["teams"]["value"].split("–")
        score = f["score"]["value"]
        goals = [f[k]["value"] for k in sorted(k for k in f if k.startswith("goal_") and k != "goal_count")]
        last = goals[-1] if goals else ""
        shots = f.get("shots", {}).get("value", "")
        wrong = ""
        if shots and not fixing:  # deliberate mistake: 5 shots too many for the home team
            a, b = shots.split("–")
            wrong = f"{int(a) + 5}–{b}"
        if tool["name"] == "submit_match_report":
            styles = list(tool["input_schema"]["properties"]["variants"]["properties"]["fi"]["properties"])
            sh = shots if fixing or not shots else wrong
            base = {
                "fi": f"{home} – {away} päättyi {score}. Ratkaisun teki {last.replace(':', '.')}." + (f" Laukaukset {sh}." if shots else ""),
                "sv": f"{home} mot {away} slutade {score}. Avgörandet: {last.replace(':', '.')}." + (f" Skott {sh}." if shots else ""),
                "en": f"{home} v {away} finished {score}. The deciding goal: {last}." + (f" Shots {sh}." if shots else ""),
            }
            claims = [{"text": f"Score {score}", "fact_key": "score", "value": score}]
            if goals:
                claims.append({"text": f"Last goal {last}", "fact_key": f"goal_{len(goals)}", "value": last})
            if shots:
                claims.append({"text": f"Shots {sh}", "fact_key": "shots", "value": sh})
            variants = {l: {s: (base[l] if s != "full" else base[l] + " " + " ".join(goals)) for s in styles} for l in base}
            return ({"headline": {"fi": f"{home} {score} {away}", "sv": f"{home} {score} {away}", "en": f"{home} {score} {away}"},
                     "claims": claims, "variants": variants}, {"input_tokens": 1200, "output_tokens": 600})
        if tool["name"] == "submit_podcast_scripts":
            def ep(hello, res):
                return {"title": f"{home}–{away}", "lines": [{"host": "A", "text": hello}, {"host": "B", "text": res}]}
            return ({"fi": ep("Hei ja tervetuloa FinUrheilun podcastiin!", f"{home} ja {away}: {score}."),
                     "sv": ep("Hej och välkommen till FinUrheilus podd!", f"{home} mot {away}: {score}."),
                     "en": ep("Hello and welcome to the FinUrheilu podcast!", f"{home} against {away}: {score}.")},
                    {"input_tokens": 900, "output_tokens": 300})
        raise ValueError(tool["name"])


if __name__ == "__main__":
    import uvicorn

    llm.set_llm(FakeClaude())
    uvicorn.run("app.main:app", host="0.0.0.0", port=int(os.environ.get("PORT", "8000")))
