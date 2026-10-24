"""Demo writer: no AI, no API key, no cost.

Writes the summaries and podcast scripts from the Liiga fact sheet with
templates in Finnish, Swedish and English. Use it when you have no AI credit
(AI_PROVIDER=demo). The texts are plainer than an AI's, but every fact is real.

To show off the fact check, the first draft of a match report deliberately gets
the shot count wrong (DEMO_MISTAKE=1, the default). When the editor asks for a change, the
corrected version comes back. Set DEMO_MISTAKE=0 to turn this off."""
from __future__ import annotations

import json
import os
import re

ENDED = {
    "overtime": {"fi": " jatkoajalla", "sv": " efter förlängning", "en": " in overtime"},
    "shootout": {"fi": " voittolaukauskilpailun jälkeen", "sv": " efter straffar", "en": " after a shootout"},
}


def _facts(prompt: str) -> dict[str, dict]:
    m = re.search(r"Fact sheet(?: \(JSON\))?:\n(\[.*?\n\])", prompt, re.S)
    return {f["key"]: f for f in json.loads(m.group(1))} if m else {}


def _goals(f: dict) -> list[tuple[str, str, str]]:
    """[(scorer, game time, score after)]"""
    out = []
    n = 1
    while f"goal_{n}" in f:
        name, t = f[f"goal_{n}"]["value"].rsplit(" ", 1)
        m = re.search(r"score after ([^\s,]+)", f[f"goal_{n}"]["label"])
        out.append((name, t, m.group(1) if m else ""))
        n += 1
    return out


def _fi_time(t: str) -> str:
    return t.replace(":", ".").lstrip("0") or "0"


class DemoWriter:
    name = "demo-writer"

    def __init__(self) -> None:
        self.mistake = os.environ.get("DEMO_MISTAKE", "1") != "0"

    def call_tool(self, model: str, system: str, prompt: str, tool: dict) -> tuple[dict, dict]:
        f = _facts(prompt)
        fixing = "editor asks for this change" in prompt
        home, away = f["teams"]["value"].split("–")
        score = f["score"]["value"]
        live = f.get("status", {}).get("value") == "live"
        ended = f.get("ended_in", {}).get("value", "regulation")
        goals = _goals(f)
        shots = f.get("shots", {}).get("value", "")
        if shots and self.mistake and not fixing:
            a, b = shots.split("–")
            shots_written = f"{int(a) + 5}–{b}"
        else:
            shots_written = shots
        saves = [(v["label"].replace("Goalie ", "").replace(" saves/shots faced", ""), v["value"])
                 for k, v in f.items() if k.startswith("saves_")]
        winner = f.get("winner", {}).get("value")

        if tool["name"] == "submit_match_report":
            styles = list(tool["input_schema"]["properties"]["variants"]["properties"]["fi"]["properties"])
            variants = {l: {s: self._report(l, s, home, away, score, live, ended, goals, shots_written, saves, winner)
                            for s in styles} for l in ("fi", "sv", "en")}
            claims = [{"text": f"Score {home} {score} {away}", "fact_key": "score", "value": score}]
            if goals:
                claims.append({"text": f"Last goal by {goals[-1][0]} at {goals[-1][1]}",
                               "fact_key": f"goal_{len(goals)}", "value": f"{goals[-1][0]} {goals[-1][1]}"})
            if shots:
                claims.append({"text": f"Shots {shots_written} (home–away)", "fact_key": "shots", "value": shots_written})
            for name, v in saves:
                key = next(k for k, x in f.items() if k.startswith("saves_") and name in x["label"])
                claims.append({"text": f"{name} saved {v}", "fact_key": key, "value": v})
            head = {"fi": f"{home}–{away} {score}", "sv": f"{home}–{away} {score}", "en": f"{home} {score} {away}"}
            return {"headline": head, "claims": claims, "variants": variants}, {"input_tokens": 0, "output_tokens": 0}

        if tool["name"] == "submit_podcast_scripts":
            eps = {l: self._podcast(l, home, away, score, ended, goals, shots, saves) for l in ("fi", "sv", "en")}
            return eps, {"input_tokens": 0, "output_tokens": 0}
        raise ValueError(f"Demo writer can't handle {tool['name']}")

    # ------------------------------------------------------------ texts
    def _report(self, l, style, home, away, score, live, ended, goals, shots, saves, winner) -> str:
        e = ENDED.get(ended, {}).get(l, "")
        last = goals[-1] if goals else None
        if live:
            return {
                "fi": f"Ottelu {home}–{away} on käynnissä, tilanne {score}." + (f" Viimeisin maali: {last[0]} ajassa {_fi_time(last[1])}." if last else ""),
                "sv": f"Matchen {home}–{away} pågår, ställningen är {score}." + (f" Senaste målet: {last[0]} i {_fi_time(last[1])}." if last else ""),
                "en": f"{home} v {away} is under way, the score is {score}." + (f" Latest goal: {last[0]} at {last[1]}." if last else ""),
            }[l]
        quick = {
            "fi": f"Ottelu {home}–{away} päättyi {score}{e}." + (f" Viimeisen maalin teki {last[0]} ajassa {_fi_time(last[1])}." if last else ""),
            "sv": f"Matchen {home}–{away} slutade {score}{e}." + (f" Sista målet gjorde {last[0]} i {_fi_time(last[1])}." if last else ""),
            "en": f"{home} and {away} finished {score}{e}." + (f" The last goal came from {last[0]} at {last[1]}." if last else ""),
        }[l]
        if style == "quick":
            return quick
        if style == "full":
            gl = ", ".join(f"{n} {(_fi_time(t) if l != 'en' else t)} ({s})" for n, t, s in goals)
            extra = {
                "fi": (f" Maalit: {gl}." if gl else "") + (f" Laukaukset {shots}." if shots else "")
                      + "".join(f" {n} torjui {v}." for n, v in saves),
                "sv": (f" Mål: {gl}." if gl else "") + (f" Skott {shots}." if shots else "")
                      + "".join(f" {n} räddade {v}." for n, v in saves),
                "en": (f" Goals: {gl}." if gl else "") + (f" Shots {shots}." if shots else "")
                      + "".join(f" {n} saved {v}." for n, v in saves),
            }[l]
            return quick + extra
        # fan voice
        w = winner or home
        return {
            "fi": f"Mikä ilta! {w} vei voiton, {score}{e}." + (f" {last[0]} hoiti viimeisen sanan ajassa {_fi_time(last[1])}." if last else "") + " Tästä jatketaan!",
            "sv": f"Vilken kväll! {w} tog segern, {score}{e}." + (f" {last[0]} fick sista ordet i {_fi_time(last[1])}." if last else "") + " Nu kör vi vidare!",
            "en": f"What a night! {w} took it, {score}{e}." + (f" {last[0]} had the final word at {last[1]}." if last else "") + " On to the next one!",
        }[l]

    def _podcast(self, l, home, away, score, ended, goals, shots, saves) -> dict:
        e = ENDED.get(ended, {}).get(l, "")
        last = goals[-1] if goals else None
        if l == "fi":
            lines = [("A", "Hei ja tervetuloa FinUrheilun otteluraporttiin."),
                     ("B", f"Tänään vuorossa {home}–{away}. Ottelu päättyi {score}{e}.")]
            if goals:
                lines.append(("A", f"Maaleja nähtiin {len(goals)}. Avausmaalin teki {goals[0][0]}."))
            if last:
                lines.append(("B", f"Viimeisen maalin teki {last[0]} ajassa {_fi_time(last[1])}."))
            if shots:
                lines.append(("A", f"Laukaukset olivat {shots}."))
            lines.append(("B", "Siinä tämän illan tärkeimmät. Kiitos kun kuuntelit, hyvää yötä!"))
        elif l == "sv":
            lines = [("A", "Hej och välkommen till FinUrheilus matchrapport."),
                     ("B", f"I kväll gäller det {home}–{away}. Matchen slutade {score}{e}.")]
            if goals:
                lines.append(("A", f"Det blev {len(goals)} mål. Första målet gjorde {goals[0][0]}."))
            if last:
                lines.append(("B", f"Sista målet gjorde {last[0]} i {_fi_time(last[1])}."))
            if shots:
                lines.append(("A", f"Skotten var {shots}."))
            lines.append(("B", "Det var det viktigaste i kväll. Tack för att du lyssnade, god natt!"))
        else:
            lines = [("A", "Hello and welcome to the FinUrheilu match report."),
                     ("B", f"Tonight it's {home} against {away}. It finished {score}{e}.")]
            if goals:
                lines.append(("A", f"We saw {len(goals)} goals. {goals[0][0]} opened the scoring."))
            if last:
                lines.append(("B", f"The last goal came from {last[0]} at {last[1]}."))
            if shots:
                lines.append(("A", f"Shots on goal were {shots}."))
            lines.append(("B", "That's the night in short. Thanks for listening, good night!"))
        return {"title": f"{home}–{away} {score}", "lines": [{"host": h, "text": t} for h, t in lines]}
