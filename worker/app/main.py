"""FinUrheilu AI worker. Called by the Next.js server (never by the browser)."""
from __future__ import annotations

import logging
import os

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config, db, highlights, liiga, podcast, summary

log = logging.getLogger("worker")
logging.basicConfig(level=logging.INFO)

app = FastAPI(title="FinUrheilu AI worker")

if not (config.SUPABASE_URL and config.SUPABASE_SERVICE_ROLE_KEY):
    os.makedirs(config.MEDIA_DIR, exist_ok=True)
    app.mount("/media", StaticFiles(directory=config.MEDIA_DIR), name="media")


def auth(x_worker_token: str = Header(default="")) -> None:
    if not config.WORKER_TOKEN or x_worker_token != config.WORKER_TOKEN:
        raise HTTPException(401, "Bad or missing X-Worker-Token")


class RunIn(BaseModel):
    game_id: str
    kinds: list[str] = ["summary", "highlight", "podcast"]


class RewriteIn(BaseModel):
    item_id: str
    instruction: str = ""


def _safe(fn, *a, **kw):
    try:
        return fn(*a, **kw)
    except Exception:  # noqa: BLE001  (already recorded in ai_jobs)
        log.exception("job failed: %s", fn.__name__)
        return None


def pipeline(game_id: str, kinds: list[str]) -> None:
    if "summary" in kinds:
        _safe(summary.run_summary, game_id)
    if "highlight" in kinds:
        _safe(highlights.run_highlights, game_id)
    if "podcast" in kinds:
        _safe(podcast.run_podcast, game_id)


def rewrite_summary(game_id: str, instruction: str | None) -> None:
    """New summary version; the podcast is built from it, so remake that too if it exists."""
    if _safe(summary.run_summary, game_id, instruction) is None:
        return
    with db.conn() as c:
        has_pod = c.execute("select 1 from content_items where game_id=%s and kind='podcast'", (game_id,)).fetchone()
    if has_pod:
        _safe(podcast.run_podcast, game_id)


@app.get("/")
def root() -> dict:
    return {"service": "FinUrheilu AI worker", "status": "running",
            "note": "This is the backend. Open the app at http://localhost:3000 and the newsroom at /newsroom.",
            "health": "/health"}


@app.get("/health")
def health() -> dict:
    from .llm import provider, writer_model
    return {"ok": True, "ai": provider(), "model": writer_model(), "claude": bool(config.ANTHROPIC_API_KEY),
            "voices": bool(config.AZURE_SPEECH_KEY),
            "storage": "supabase" if config.SUPABASE_URL else "local"}


@app.post("/jobs", dependencies=[Depends(auth)])
def run_jobs(body: RunIn, bg: BackgroundTasks) -> dict:
    bad = set(body.kinds) - {"summary", "highlight", "podcast"}
    if bad:
        raise HTTPException(400, f"Unknown kinds: {bad}")
    bg.add_task(pipeline, body.game_id, body.kinds)
    return {"queued": body.kinds, "game_id": body.game_id}


@app.post("/jobs/rewrite", dependencies=[Depends(auth)])
def rewrite(body: RewriteIn, bg: BackgroundTasks) -> dict:
    with db.conn() as c:
        it = c.execute("select game_id, kind from content_items where id=%s", (body.item_id,)).fetchone()
    if not it:
        raise HTTPException(404, "Item not found")
    ins = body.instruction.strip() or None
    if it["kind"] == "summary":
        bg.add_task(rewrite_summary, it["game_id"], ins)
    elif it["kind"] == "podcast":
        bg.add_task(_safe, podcast.run_podcast, it["game_id"], ins)
    else:
        bg.add_task(_safe, highlights.run_highlights, it["game_id"])
    return {"queued": it["kind"], "game_id": it["game_id"]}


@app.post("/import/game", dependencies=[Depends(auth)])
def import_game(body: liiga.GameIn) -> dict:
    return liiga.import_game(body)
