"""Turn Liiga game data into a fact sheet.

Every statement the AI makes has to point at one of these facts. The fact check
(factcheck.py) then compares the AI's value with the value here."""
from __future__ import annotations

from dataclasses import dataclass, asdict
from typing import Any


@dataclass
class Fact:
    key: str
    value: str
    label: str

    def dict(self) -> dict[str, str]:
        return asdict(self)


def game_clock(seconds: int) -> str:
    """Seconds from puck drop -> 'mm:ss' (e.g. 3821 -> '63:41')."""
    return f"{seconds // 60:02d}:{seconds % 60:02d}"


def period_name(p: int) -> str:
    return {1: "1st period", 2: "2nd period", 3: "3rd period"}.get(p, "overtime")


def build_facts(g: dict[str, Any]) -> list[Fact]:
    home, away = g["home_name"], g["away_name"]
    hs, as_ = g["home_score"], g["away_score"]
    facts: list[Fact] = []
    live = g["status"] == "live"

    facts.append(Fact("teams", f"{home}–{away}", f"Home team {home}, away team {away}"))
    facts.append(Fact("venue", g.get("venue") or "", "Venue"))
    facts.append(Fact("score", f"{hs}–{as_}",
                      f"{'Current' if live else 'Final'} score {home} {hs}–{as_} {away} (home–away)"))
    facts.append(Fact("status", g["status"], "Game status: scheduled, live or final"))

    if not live and g["status"] == "final":
        if hs != as_:
            winner, loser = (home, away) if hs > as_ else (away, home)
            facts.append(Fact("winner", winner, f"{winner} won, {loser} lost"))
        facts.append(Fact("ended_in", g.get("ended_in") or "regulation", "How the game ended"))

    if g.get("shots_home") is not None and g.get("shots_away") is not None:
        facts.append(Fact("shots", f"{g['shots_home']}–{g['shots_away']}",
                          f"Shots on goal {home} {g['shots_home']}, {away} {g['shots_away']} (home–away)"))
        for gk in g.get("goalies", []):
            if gk["team_id"] == g["home_id"]:
                faced, conceded = g["shots_away"], as_
            else:
                faced, conceded = g["shots_home"], hs
            facts.append(Fact(f"saves_{gk['team_id']}", f"{faced - conceded}/{faced}",
                              f"Goalie {gk['name']} saves/shots faced"))

    n = 0
    for e in g["events"]:
        if e["type"] != "goal":
            continue
        n += 1
        extra = f" ({e['detail']})" if e.get("detail") else ""
        facts.append(Fact(
            f"goal_{n}",
            f"{e.get('player_name') or 'unknown'} {game_clock(e['game_seconds'])}",
            f"Goal {n}: {e['team_name']}, {e.get('player_name')}, game time {game_clock(e['game_seconds'])}, "
            f"{period_name(e['period'])} {e['clock']}{extra}, score after {e.get('score_after')}",
        ))
    facts.append(Fact("goal_count", str(n), "Number of goals in the game"))
    if live and g["events"]:
        last = g["events"][-1]
        facts.append(Fact("last_event_time", game_clock(last["game_seconds"]), "Game time of the latest event"))
    return facts


def fact_map(facts: list[Fact]) -> dict[str, Fact]:
    return {f.key: f for f in facts}
