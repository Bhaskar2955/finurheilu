"""Database access. Uses a direct Postgres connection (Supabase gives you the
connection string under Project settings -> Database). The worker connects as a
privileged user, so it can write drafts that readers cannot see."""
from __future__ import annotations

import json
from contextlib import contextmanager
from typing import Any, Iterator

import psycopg
from psycopg.rows import dict_row

from . import config


@contextmanager
def conn() -> Iterator[psycopg.Connection]:
    if not config.DATABASE_URL:
        raise RuntimeError("DATABASE_URL is not set")
    # prepare_threshold=None keeps it compatible with Supabase's transaction pooler.
    with psycopg.connect(config.DATABASE_URL, row_factory=dict_row, prepare_threshold=None) as c:
        yield c


def fetch_game(c: psycopg.Connection, game_id: str) -> dict[str, Any]:
    g = c.execute(
        """select g.*, h.name as home_name, a.name as away_name
           from games g join teams h on h.id = g.home_id join teams a on a.id = g.away_id
           where g.id = %s""",
        (game_id,),
    ).fetchone()
    if not g:
        raise LookupError(f"Game {game_id} not found")
    g["events"] = c.execute(
        """select e.*, p.name as player_name, p.position as player_position, t.name as team_name
           from game_events e left join players p on p.id = e.player_id left join teams t on t.id = e.team_id
           where e.game_id = %s order by e.game_seconds""",
        (game_id,),
    ).fetchall()
    g["goalies"] = c.execute(
        "select team_id, name from players where position = 'G' and team_id in (%s, %s)",
        (g["home_id"], g["away_id"]),
    ).fetchall()
    return g


# ---------------------------------------------------------------- jobs
def job_start(c, game_id: str | None, kind: str, model: str | None, note: str | None = None) -> str:
    row = c.execute(
        """insert into ai_jobs (game_id, kind, status, model, note, started_at)
           values (%s, %s, 'running', %s, %s, now()) returning id""",
        (game_id, kind, model, note),
    ).fetchone()
    c.commit()
    return str(row["id"])


def job_finish(c, job_id: str, usage: dict | None = None, note: str | None = None) -> None:
    usage = usage or {}
    c.execute(
        """update ai_jobs set status='done', finished_at=now(),
             input_tokens = coalesce(input_tokens,0) + %s, output_tokens = coalesce(output_tokens,0) + %s,
             note = coalesce(%s, note)
           where id = %s""",
        (usage.get("input_tokens", 0), usage.get("output_tokens", 0), note, job_id),
    )
    c.commit()


def job_fail(c, job_id: str, error: str) -> None:
    c.rollback()
    c.execute("update ai_jobs set status='failed', finished_at=now(), error=%s where id=%s", (error[:2000], job_id))
    c.commit()


# ---------------------------------------------------------------- content
def upsert_item(c, game_id: str, kind: str, title: str, depends_on: str | None = None,
                fan_team_id: str | None = None) -> str:
    row = c.execute(
        """insert into content_items (game_id, kind, title, depends_on, fan_team_id, status)
           values (%s, %s, %s, %s, %s, 'draft')
           on conflict (game_id, kind) do update set title = excluded.title,
             depends_on = coalesce(excluded.depends_on, content_items.depends_on),
             fan_team_id = coalesce(excluded.fan_team_id, content_items.fan_team_id),
             updated_at = now()
           returning id""",
        (game_id, kind, title, depends_on, fan_team_id),
    ).fetchone()
    return str(row["id"])


def new_version(c, item_id: str, author: str, job_id: str | None, payload: dict, note: str | None = None) -> str:
    v = c.execute("select coalesce(max(version),0)+1 as v from content_versions where item_id=%s", (item_id,)).fetchone()["v"]
    row = c.execute(
        """insert into content_versions (item_id, version, author, job_id, payload, note)
           values (%s, %s, %s, %s, %s, %s) returning id""",
        (item_id, v, author, job_id, json.dumps(payload, ensure_ascii=False), note),
    ).fetchone()
    return str(row["id"])


def set_current(c, item_id: str, version_id: str, status: str) -> None:
    # A new AI version always goes back to the editor, even if the old one was live.
    c.execute(
        """update content_items set current_version_id=%s, status=%s, updated_at=now(),
             approved_by=null, publish_at=null, published_at=null
           where id=%s""",
        (version_id, status, item_id),
    )


def log_action(c, item_id: str, editor: str, action: str, reason: str | None = None) -> None:
    c.execute("insert into review_actions (item_id, editor, action, reason) values (%s,%s,%s,%s)",
              (item_id, editor, action, reason))
