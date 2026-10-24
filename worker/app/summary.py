"""Text summaries: one fact sheet, then 9 variants (fi/sv/en x quick/full/fan)."""
from __future__ import annotations

import json
from typing import Any

from . import config, db
from .factcheck import check_claims, stray_numbers
from .facts import build_facts, fact_map
from .llm import get_llm, writer_model

LANGS = ["fi", "sv", "en"]
STYLES = ["quick", "full", "fan"]

STYLE_GUIDE = {
    "quick": "Quick read: 2-3 sentences, about 40 words.",
    "full": "Full story: 4-6 sentences, about 120 words, goal by goal.",
    "fan": "Fan voice: about 50 words, warm and excited, written for fans of {fan}. Never insult the other team.",
}

SYSTEM = """You are the AI writer for FinUrheilu, a Finnish ice hockey news app run by Kaleva Media.
A human editor reviews everything you write before readers see it.

Rules:
- Use ONLY the facts in the fact sheet. Do not add standings, streaks, injuries, quotes or anything else.
- Every number you write must come from the fact sheet.
- Write each language natively, as a Finnish, Swedish or English sports journalist would. Do not translate word for word.
  Finnish and Swedish may write game time as 63.41; English as 63:41.
- Scores are written home team first, like the fact sheet.
- List every factual statement you make as a claim, citing the fact_key it comes from and the value exactly as in the fact sheet."""


def _variant_props(styles: list[str]) -> dict:
    return {"type": "object", "required": styles, "properties": {s: {"type": "string"} for s in styles}}


def report_tool(styles: list[str]) -> dict:
    return {
        "name": "submit_match_report",
        "description": "Submit the match report in all languages and styles, with the claims it makes.",
        "input_schema": {
            "type": "object",
            "required": ["headline", "claims", "variants"],
            "properties": {
                "headline": {"type": "object", "required": LANGS,
                             "properties": {l: {"type": "string"} for l in LANGS}},
                "claims": {
                    "type": "array",
                    "items": {"type": "object", "required": ["text", "fact_key", "value"],
                              "properties": {"text": {"type": "string", "description": "The claim in English"},
                                             "fact_key": {"type": "string"},
                                             "value": {"type": "string"}}},
                },
                "variants": {"type": "object", "required": LANGS,
                             "properties": {l: _variant_props(styles) for l in LANGS}},
            },
        },
    }


def fan_team(g: dict[str, Any]) -> tuple[str, str]:
    """Fan voice is written for the winner (or the home team if level)."""
    if g["away_score"] > g["home_score"]:
        return g["away_id"], g["away_name"]
    return g["home_id"], g["home_name"]


def build_prompt(g: dict, facts: list, styles: list[str], fan_name: str,
                 previous: dict | None = None, instruction: str | None = None) -> str:
    guide = "\n".join(f"- {s}: {STYLE_GUIDE[s].format(fan=fan_name)}" for s in styles)
    p = (f"Fact sheet (JSON):\n{json.dumps([f.dict() for f in facts], ensure_ascii=False, indent=1)}\n\n"
         f"Write the report in Finnish (fi), Swedish (sv) and English (en), each in these styles:\n{guide}\n")
    if g["status"] == "live":
        p += "\nThe game is still LIVE: write it as a live update, present tense, no final result.\n"
    if previous:
        p += f"\nPrevious version:\n{json.dumps(previous, ensure_ascii=False)}\n"
    if instruction:
        p += f"\nThe editor asks for this change: {instruction}\nKeep everything else accurate.\n"
    return p


def run_summary(game_id: str, instruction: str | None = None, author_note: str | None = None) -> str:
    llm = get_llm()
    with db.conn() as c:
        job = db.job_start(c, game_id, "rewrite" if instruction else "summary", writer_model(), author_note)
        try:
            g = db.fetch_game(c, game_id)
            facts = build_facts(g)
            fm = fact_map(facts)
            styles = ["quick"] if g["status"] == "live" else STYLES
            fan_id, fan_name = fan_team(g)

            previous = None
            item_row = c.execute("select id, current_version_id from content_items where game_id=%s and kind='summary'",
                                 (game_id,)).fetchone()
            if instruction and item_row and item_row["current_version_id"]:
                rows = c.execute("select language, style, text from summary_variants where version_id=%s",
                                 (item_row["current_version_id"],)).fetchall()
                previous = {f"{r['language']}/{r['style']}": r["text"] for r in rows}

            data, usage = llm.call_tool(writer_model(), SYSTEM,
                                        build_prompt(g, facts, styles, fan_name, previous, instruction),
                                        report_tool(styles))

            texts = [data["variants"][l][s] for l in LANGS for s in styles]
            results = check_claims(data.get("claims", []), fm)
            strays = stray_numbers(texts, fm)
            bad = any(r.status != "ok" for r in results) or bool(strays)

            live = " · live update" if g["status"] == "live" else " · match report"
            title = f"{g['home_name']} {g['home_score']}–{g['away_score']} {g['away_name']}{live}"
            item_id = db.upsert_item(c, game_id, "summary", title, fan_team_id=fan_id)
            vid = db.new_version(c, item_id, f"ai:{writer_model()}", job,
                                 {"headline": data.get("headline", {}), "facts": [f.dict() for f in facts],
                                  "instruction": instruction},
                                 note=f"Editor asked: {instruction}" if instruction else None)
            for l in LANGS:
                for s in styles:
                    c.execute("insert into summary_variants (version_id,item_id,language,style,text) values (%s,%s,%s,%s,%s)",
                              (vid, item_id, l, s, data["variants"][l][s].strip()))
            for r in results:
                c.execute("""insert into claims (version_id,item_id,text,fact_key,ai_value,source_value,check_status)
                             values (%s,%s,%s,%s,%s,%s,%s)""",
                          (vid, item_id, r.text, r.fact_key, r.ai_value, r.source_value, r.status))
            for n in strays:
                c.execute("""insert into claims (version_id,item_id,text,fact_key,ai_value,source_value,check_status)
                             values (%s,%s,%s,null,%s,null,'unverified')""",
                          (vid, item_id, f"The number {n} is in the text but not in the Liiga data", n))
            db.set_current(c, item_id, vid, "flagged" if bad else "needs_review")
            c.commit()
            mism = sum(r.status == "mismatch" for r in results)
            db.job_finish(c, job, usage, f"{len(texts)} variants, {len(results)} claims, {mism} mismatch, {len(strays)} unknown numbers")
            return item_id
        except Exception as e:  # noqa: BLE001
            db.job_fail(c, job, f"{type(e).__name__}: {e}")
            raise
