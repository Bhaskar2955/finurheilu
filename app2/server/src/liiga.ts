/**
 * Liiga data from liiga.fi's public JSON API (the same API the liiga.fi website uses).
 * It is not an official, documented API: field names can change, so everything is
 * normalised here and the app falls back to cached or sample data if a call fails.
 *
 * Endpoints used (season = the year the season ends, e.g. 2027 for 2026–27):
 *   GET {base}/schedule?tournament=runkosarja&week=1&season={season}  – every regular-season game
 *   GET {base}/standings/?season={season}                              – the table
 *   GET {base}/games?tournament=runkosarja&date=YYYY-MM-DD              – one day, with goal events
 *   GET {base}/games/{season}/{gameId}                                  – one game: periods, goals, players
 */
import { SAMPLE_GAMES, SAMPLE_RESULTS, SAMPLE_SOURCES, SAMPLE_STAND } from "./sample.js";
import { TEAMS, teamOf } from "./teams.js";
import type { Bundle, Game, LiveGame, LiveGoal, Result } from "./types.js";

export const LIIGA_BASE = (process.env.LIIGA_API_BASE || "https://liiga.fi/api/v2").replace(/\/$/, "");
const TZ = "Europe/Helsinki";

/** Liiga seasons are named by the year they end; July onwards belongs to the next season. */
export function seasonFor(d = new Date()): number {
  const local = new Date(d.toLocaleString("en-US", { timeZone: TZ }));
  return local.getMonth() + 1 <= 6 ? local.getFullYear() : local.getFullYear() + 1;
}

/** ISO timestamp -> ["2026-10-24", "17:00"] in Finnish time. */
export function localDateTime(iso: string): [string, string] {
  const s = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false,
  }).format(new Date(iso));
  const [d, t] = s.split(" ");
  return [d, t];
}

export const todayHelsinki = () => localDateTime(new Date().toISOString())[0];

const endType = (f: string | null | undefined): "" | "OT" | "SO" =>
  f === "ENDED_DURING_EXTENDED_GAME_TIME" ? "OT" : f === "ENDED_DURING_WINNING_SHOT_COMPETITION" ? "SO" : "";

async function getJson<T>(url: string, timeoutMs = 10000): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { accept: "application/json", "user-agent": "FinUrheilu/2.0 (hackathon demo)" } });
    if (!r.ok) throw new Error(`HTTP ${r.status} from ${url}`);
    return (await r.json()) as T;
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- raw API shapes (only the fields we use) ---------- */
interface ApiScheduleGame {
  id: number; season: number; start: string | null;
  homeTeamName: string | null; awayTeamName: string | null;
  started: boolean; ended: boolean; finishedType?: string | null;
  homeTeamGoals?: number; awayTeamGoals?: number;
}
interface ApiStandingsRow { teamName: string; ranking: number; games: number; points: number }
interface ApiGoal { scorerPlayerId: number; gameTime: number; period: number; homeTeamScore: number; awayTeamScore: number }
interface ApiTeam { teamName: string; goals: number; goalEvents?: ApiGoal[] }
interface ApiDayGame { id: number; season: number; start: string; homeTeam: ApiTeam; awayTeam: ApiTeam; started: boolean; ended: boolean; gameTime?: number; finishedType?: string }
interface ApiPlayer { id: number; firstName: string; lastName: string; jersey?: number; jerseyNumber?: number }
interface ApiDetail {
  game: ApiDayGame & { periods?: { index: number; homeTeamGoals: number; awayTeamGoals: number }[] };
  homeTeamPlayers?: ApiPlayer[]; awayTeamPlayers?: ApiPlayer[];
}

/** Whole season: upcoming games, results and the table, in the app's shapes. */
export async function fetchSeason(): Promise<Bundle> {
  const season = seasonFor();
  const [schedule, standings] = await Promise.all([
    getJson<ApiScheduleGame[]>(`${LIIGA_BASE}/schedule?tournament=runkosarja&week=1&season=${season}`),
    getJson<{ season: ApiStandingsRow[] }>(`${LIIGA_BASE}/standings/?season=${season}`),
  ]);
  if (!Array.isArray(schedule) || !schedule.length) throw new Error("Liiga schedule came back empty");

  const games: Game[] = [];
  const results: Result[] = [];
  for (const g of schedule) {
    const h = teamOf(g.homeTeamName), a = teamOf(g.awayTeamName);
    if (!h || !a || !g.start) continue;
    const [d, t] = localDateTime(g.start);
    if (g.ended) {
      results.push({ id: `r${g.id}`, liigaId: g.id, d, h, a, hs: g.homeTeamGoals ?? 0, as: g.awayTeamGoals ?? 0, x: endType(g.finishedType) });
    } else {
      games.push({ id: `g${g.id}`, liigaId: g.id, d, t, h, a, live: g.started || undefined });
    }
  }
  games.sort((x, y) => (x.d + x.t).localeCompare(y.d + y.t));
  results.sort((x, y) => x.d.localeCompare(y.d));

  const rows = (standings?.season ?? []).slice().sort((x, y) => x.ranking - y.ranking);
  const stand: [string, number, number][] = rows
    .map((r) => [teamOf(r.teamName), r.games, r.points] as [string | null, number, number])
    .filter((r): r is [string, number, number] => !!r[0]);
  if (!stand.length) throw new Error("Liiga standings came back empty");

  return {
    mode: "live",
    source: "liiga.fi",
    season,
    fetchedAt: new Date().toISOString(),
    teams: TEAMS.map((t) => [...t] as [string, string, string, string]),
    stand,
    games,
    results,
    sources: [["Liiga.fi – live data", "https://liiga.fi/fi/ottelut"], ...SAMPLE_SOURCES.slice(0, 3)],
  };
}

/** The sample data from the prototype, used when nothing else works. */
export function sampleBundle(note?: string): Bundle {
  return {
    mode: "sample",
    source: "sample",
    season: 2027,
    fetchedAt: "2026-10-24T12:00:00Z",
    note,
    teams: TEAMS.map((t) => [...t] as [string, string, string, string]),
    stand: SAMPLE_STAND.map((r) => [...r] as [string, number, number]),
    games: SAMPLE_GAMES.map(([d, t, h, a]) => ({ id: "g" + d + t + h, d, t, h, a })),
    results: SAMPLE_RESULTS.map(([d, h, a, hs, as, x]) => ({ id: "r" + d + h, d, h, a, hs, as, x: x as Result["x"] })),
    sources: SAMPLE_SOURCES.map((s) => [...s] as [string, string]),
  };
}

function toLive(g: ApiDayGame, names: Map<number, { n: string; no: number | null }> = new Map()): LiveGame {
  const h = teamOf(g.homeTeam?.teamName) ?? "?", a = teamOf(g.awayTeam?.teamName) ?? "?";
  const goals: LiveGoal[] = [];
  for (const [team, home] of [[g.homeTeam, true], [g.awayTeam, false]] as [ApiTeam, boolean][]) {
    for (const e of team?.goalEvents ?? []) {
      const who = names.get(e.scorerPlayerId);
      goals.push({ min: Math.max(1, Math.ceil(e.gameTime / 60)), period: e.period, home, score: `${e.homeTeamScore}–${e.awayTeamScore}`, scorer: who?.n ?? null, no: who?.no ?? null });
    }
  }
  goals.sort((x, y) => x.min - y.min);
  const periods: [number, number][] = [[0, 0], [0, 0], [0, 0]];
  for (const goal of goals) {
    const p = Math.min(2, Math.max(0, goal.period - 1));
    if (goal.period <= 3) periods[p][goal.home ? 0 : 1]++;
  }
  return {
    liigaId: g.id, h, a, hs: g.homeTeam?.goals ?? 0, as: g.awayTeam?.goals ?? 0,
    started: !!g.started, ended: !!g.ended, min: Math.round((g.gameTime ?? 0) / 60), x: endType(g.finishedType), periods, goals,
  };
}

/** Today's (or any day's) games with live scores and goal events. */
export async function fetchDay(date: string): Promise<LiveGame[]> {
  const data = await getJson<{ games?: ApiDayGame[] } | ApiDayGame[]>(`${LIIGA_BASE}/games?tournament=runkosarja&date=${date}`);
  const list = Array.isArray(data) ? data : data.games ?? [];
  return list.map((g) => toLive(g));
}

/** One game in detail: period scores and goal scorers by name. */
export async function fetchGame(season: number, liigaId: number): Promise<LiveGame> {
  const d = await getJson<ApiDetail>(`${LIIGA_BASE}/games/${season}/${liigaId}`);
  const names = new Map<number, { n: string; no: number | null }>();
  for (const p of [...(d.homeTeamPlayers ?? []), ...(d.awayTeamPlayers ?? [])]) {
    names.set(p.id, { n: `${p.firstName} ${p.lastName}`.trim(), no: p.jersey ?? p.jerseyNumber ?? null });
  }
  const live = toLive(d.game, names);
  if (d.game.periods?.length) {
    live.periods = [[0, 0], [0, 0], [0, 0]];
    for (const p of d.game.periods) if (p.index >= 1 && p.index <= 3) live.periods[p.index - 1] = [p.homeTeamGoals, p.awayTeamGoals];
  }
  return live;
}
