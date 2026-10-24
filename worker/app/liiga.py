"""Getting Liiga data into the database.

The demo uses the sample games in supabase/seed.sql. For real games, convert
whatever Liiga source you get access to (official feed, partner API, Kaleva's
data) into the JSON shape below and POST it to /import/game. Call it again
every ~10 s during a live game; it is safe to repeat.

{
  "id": "2026-10-24-karpat-tappara", "liiga_game_id": "…",
  "home_id": "karpat", "away_id": "tappara", "starts_at": "2026-10-24T18:30:00+03:00",
  "status": "live" | "final" | "scheduled", "ended_in": "overtime" | null,
  "home_score": 3, "away_score": 2, "shots_home": 29, "shots_away": 31, "venue": "Raksila, Oulu",
  "video_source_url": null,
  "events": [{"period": 1, "clock": "08:14", "game_seconds": 494, "type": "goal", "team_id": "karpat",
              "player_name": "Eetu Saarinen", "detail": null, "score_after": "1–0", "video_offset_s": null}]
}
"""
from __future__ import annotations

from pydantic import BaseModel

from . import db


class EventIn(BaseModel):
    period: int
    clock: str
    game_seconds: int
    type: str
    team_id: str | None = None
    player_name: str | None = None
    detail: str | None = None
    score_after: str | None = None
    video_offset_s: int | None = None


class GameIn(BaseModel):
    id: str
    liiga_game_id: str | None = None
    home_id: str
    away_id: str
    starts_at: str
    status: str = "scheduled"
    ended_in: str | None = None
    home_score: int = 0
    away_score: int = 0
    shots_home: int | None = None
    shots_away: int | None = None
    venue: str | None = None
    video_source_url: str | None = None
    events: list[EventIn] = []


def import_game(g: GameIn) -> dict:
    with db.conn() as c:
        c.execute(
            """insert into games (id, liiga_game_id, home_id, away_id, starts_at, status, ended_in, home_score, away_score,
                                  shots_home, shots_away, venue, video_source_url, updated_at)
               values (%(id)s,%(liiga_game_id)s,%(home_id)s,%(away_id)s,%(starts_at)s,%(status)s,%(ended_in)s,%(home_score)s,
                       %(away_score)s,%(shots_home)s,%(shots_away)s,%(venue)s,%(video_source_url)s, now())
               on conflict (id) do update set status=excluded.status, ended_in=excluded.ended_in,
                 home_score=excluded.home_score, away_score=excluded.away_score, shots_home=excluded.shots_home,
                 shots_away=excluded.shots_away, video_source_url=coalesce(excluded.video_source_url, games.video_source_url),
                 updated_at=now()""",
            g.model_dump(exclude={"events"}),
        )
        added = 0
        for e in g.events:
            exists = c.execute("select 1 from game_events where game_id=%s and game_seconds=%s and type=%s",
                               (g.id, e.game_seconds, e.type)).fetchone()
            if exists:
                continue
            pid = None
            if e.player_name and e.team_id:
                row = c.execute("select id from players where team_id=%s and name=%s", (e.team_id, e.player_name)).fetchone()
                if not row:
                    row = c.execute("insert into players (team_id, name) values (%s,%s) returning id",
                                    (e.team_id, e.player_name)).fetchone()
                pid = row["id"]
            c.execute("""insert into game_events (game_id, period, clock, game_seconds, type, team_id, player_id, detail,
                                                  score_after, video_offset_s)
                         values (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)""",
                      (g.id, e.period, e.clock, e.game_seconds, e.type, e.team_id, pid, e.detail, e.score_after,
                       e.video_offset_s))
            added += 1
        c.commit()
        return {"game": g.id, "new_events": added}
