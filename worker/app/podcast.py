"""Podcast: Claude writes a two-host script from the summary, Azure reads it."""
from __future__ import annotations

import json
import os
import subprocess
import tempfile

from . import config, db, storage, tts
from .factcheck import stray_numbers
from .facts import build_facts, fact_map
from .llm import get_llm, writer_model

LANGS = ["fi", "sv", "en"]
HOSTS = {"fi": ("Aino", "Eero"), "sv": ("Saga", "Erik"), "en": ("Aino", "Eero")}

SYSTEM = """You write short, friendly hockey podcast scripts for FinUrheilu (Kaleva Media).
Two hosts talk: host A is a woman, host B is a man. They are polite, warm and clear, like public radio.
Use ONLY the facts given. Every number must come from the fact sheet. No made-up quotes, standings or streaks.
Each language is written natively, not translated. About 8-10 lines, 60-90 seconds when read aloud.
Open with a greeting and the result, go through the goals, end with a short goodbye."""

TOOL = {
    "name": "submit_podcast_scripts",
    "description": "Submit the podcast script in each language.",
    "input_schema": {
        "type": "object",
        "required": LANGS,
        "properties": {
            l: {"type": "object", "required": ["title", "lines"], "properties": {
                "title": {"type": "string"},
                "lines": {"type": "array", "items": {
                    "type": "object", "required": ["host", "text"],
                    "properties": {"host": {"type": "string", "enum": ["A", "B"]}, "text": {"type": "string"}}}},
            }} for l in LANGS
        },
    },
}


def duration_s(mp3: bytes) -> int | None:
    # delete=False + manual cleanup: Windows can't reopen a file that is still open.
    with tempfile.NamedTemporaryFile(suffix=".mp3", delete=False) as f:
        f.write(mp3)
        name = f.name
    try:
        out = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", name],
                             capture_output=True, text=True)
    finally:
        os.remove(name)
    try:
        return round(float(out.stdout.strip()))
    except ValueError:
        return None


def run_podcast(game_id: str, instruction: str | None = None) -> str:
    llm = get_llm()
    with db.conn() as c:
        job = db.job_start(c, game_id, "podcast", writer_model(), instruction)
        try:
            g = db.fetch_game(c, game_id)
            facts = build_facts(g)
            summ = c.execute("select id, current_version_id from content_items where game_id=%s and kind='summary'",
                             (game_id,)).fetchone()
            if not summ or not summ["current_version_id"]:
                raise RuntimeError("Write the summary first: the podcast is built from it")
            rows = c.execute("select language, text from summary_variants where version_id=%s and style in ('full','quick') "
                             "order by style desc", (summ["current_version_id"],)).fetchall()
            source = {r["language"]: r["text"] for r in rows}

            names = "; ".join(f"{l}: host A = {a}, host B = {b}" for l, (a, b) in HOSTS.items())
            prompt = (f"Fact sheet:\n{json.dumps([f.dict() for f in facts], ensure_ascii=False, indent=1)}\n\n"
                      f"Approved-for-review summary per language:\n{json.dumps(source, ensure_ascii=False)}\n\n"
                      f"Host names per language: {names}.\n")
            if instruction:
                prompt += f"\nThe editor asks for this change: {instruction}\n"
            data, usage = llm.call_tool(writer_model(), SYSTEM, prompt, TOOL)

            strays = stray_numbers([ln["text"] for l in LANGS for ln in data[l]["lines"]], fact_map(facts))
            title = f"Podcast · {g['home_name']} {g['home_score']}–{g['away_score']} {g['away_name']}"
            item_id = db.upsert_item(c, game_id, "podcast", title, depends_on=str(summ["id"]))
            vid = db.new_version(c, item_id, f"ai:{writer_model()}", job,
                                 {"titles": {l: data[l]["title"] for l in LANGS}, "hosts": HOSTS,
                                  "voices": tts.VOICES if tts.enabled() else None,
                                  "stray_numbers": strays})
            for l in LANGS:
                lines = data[l]["lines"]
                audio_url, dur = None, None
                if tts.enabled():
                    mp3 = tts.synthesize(lines, l)
                    audio_url = storage.save(f"podcasts/{item_id}/{vid}-{l}.mp3", mp3, "audio/mpeg")
                    dur = duration_s(mp3)
                c.execute("""insert into podcast_episodes (version_id,item_id,language,script,audio_url,duration_s)
                             values (%s,%s,%s,%s,%s,%s)""",
                          (vid, item_id, l, json.dumps(lines, ensure_ascii=False), audio_url, dur))
            db.set_current(c, item_id, vid, "flagged" if strays else "needs_review")
            c.commit()
            db.job_finish(c, job, usage, f"3 scripts{', audio rendered' if tts.enabled() else ', no audio (Azure not set)'}")
            return item_id
        except Exception as e:  # noqa: BLE001
            db.job_fail(c, job, f"{type(e).__name__}: {e}")
            raise
