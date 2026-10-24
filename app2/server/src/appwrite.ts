/**
 * Appwrite (Cloud free plan) as the app's database.
 *
 * Tables in database APPWRITE_DATABASE_ID (created by `npm run setup:appwrite`):
 *   liiga_games      one row per game: upcoming and finished      (anyone can read)
 *   liiga_standings  one row per team: table position and points   (anyone can read)
 *   liiga_meta       one row "latest": when the data was synced     (anyone can read)
 *   profiles         one row per signed-in user: their app settings (only that user)
 *
 * The server writes Liiga data with an API key; the browser only signs users in and
 * saves its own profile row.
 */
import { Client, Query, TablesDB } from "node-appwrite";
import type { Bundle, Game, Result } from "./types.js";
import { TEAMS, slug } from "./teams.js";

export const APPWRITE = {
  endpoint: process.env.APPWRITE_ENDPOINT || "",
  project: process.env.APPWRITE_PROJECT_ID || "",
  key: process.env.APPWRITE_API_KEY || "",
  db: process.env.APPWRITE_DATABASE_ID || "finurheilu",
};
export const T_GAMES = "liiga_games";
export const T_STAND = "liiga_standings";
export const T_META = "liiga_meta";
export const T_PROFILES = "profiles";

export const appwriteReady = () => !!(APPWRITE.endpoint && APPWRITE.project && APPWRITE.key);

let _db: TablesDB | null = null;
export function tables(): TablesDB {
  if (!appwriteReady()) throw new Error("Appwrite is not configured (APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY)");
  if (!_db) {
    const client = new Client().setEndpoint(APPWRITE.endpoint).setProject(APPWRITE.project).setKey(APPWRITE.key);
    _db = new TablesDB(client);
  }
  return _db;
}

const chunk = <T,>(a: T[], n: number) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

/** Write a fresh Liiga snapshot into Appwrite. Only live data is stored, never the sample. */
export async function saveBundle(b: Bundle): Promise<number> {
  const db = tables();
  const gameRows = [
    ...b.games.map((g) => ({ $id: `g${g.liigaId}`, liiga_id: g.liigaId ?? 0, kind: "upcoming", date: g.d, time: g.t, home: g.h, away: g.a, home_goals: 0, away_goals: 0, decided: "", season: b.season })),
    ...b.results.map((r) => ({ $id: `r${r.liigaId}`, liiga_id: r.liigaId ?? 0, kind: "result", date: r.d, time: "", home: r.h, away: r.a, home_goals: r.hs, away_goals: r.as, decided: r.x, season: b.season })),
  ].filter((r) => r.liiga_id);
  // A game that has finished moves from "g…" to "r…": remove the old upcoming row.
  const finished = b.results.map((r) => `g${r.liigaId}`);
  for (const id of finished) await db.deleteRow({ databaseId: APPWRITE.db, tableId: T_GAMES, rowId: id }).catch(() => undefined);

  for (const part of chunk(gameRows, 100)) await db.upsertRows({ databaseId: APPWRITE.db, tableId: T_GAMES, rows: part });
  const standRows = b.stand.map(([team, games, points], i) => ({ $id: slug(team) || `t${i}`, team, rank: i + 1, games, points, season: b.season }));
  await db.upsertRows({ databaseId: APPWRITE.db, tableId: T_STAND, rows: standRows });
  await db.upsertRow({
    databaseId: APPWRITE.db, tableId: T_META, rowId: "latest",
    data: { fetched_at: b.fetchedAt, season: b.season, source: b.source, games: gameRows.length },
  });
  return gameRows.length + standRows.length;
}

async function listAll(tableId: string, queries: string[] = []): Promise<Record<string, any>[]> {
  const db = tables();
  const out: Record<string, any>[] = [];
  for (let offset = 0; ; offset += 100) {
    const page = await db.listRows({ databaseId: APPWRITE.db, tableId, queries: [...queries, Query.limit(100), Query.offset(offset)] });
    out.push(...(page.rows as unknown as Record<string, any>[]));
    if (page.rows.length < 100) break;
  }
  return out;
}

/** Read the last stored snapshot (used when liiga.fi can't be reached). */
export async function loadBundle(): Promise<Bundle | null> {
  const db = tables();
  const meta = (await db.getRow({ databaseId: APPWRITE.db, tableId: T_META, rowId: "latest" }).catch(() => null)) as Record<string, any> | null;
  if (!meta) return null;
  const season = Number(meta.season);
  const rows = await listAll(T_GAMES, [Query.equal("season", season)]);
  const stand = await listAll(T_STAND, [Query.equal("season", season), Query.orderAsc("rank")]);
  const games: Game[] = rows.filter((r) => r.kind === "upcoming").map((r) => ({ id: `g${r.liiga_id}`, liigaId: r.liiga_id, d: r.date, t: r.time, h: r.home, a: r.away }));
  const results: Result[] = rows.filter((r) => r.kind === "result").map((r) => ({ id: `r${r.liiga_id}`, liigaId: r.liiga_id, d: r.date, h: r.home, a: r.away, hs: r.home_goals, as: r.away_goals, x: r.decided || "" }));
  games.sort((x, y) => (x.d + x.t).localeCompare(y.d + y.t));
  results.sort((x, y) => x.d.localeCompare(y.d));
  if (!stand.length || (!games.length && !results.length)) return null;
  return {
    mode: "cache",
    source: "appwrite",
    season,
    fetchedAt: String(meta.fetched_at),
    teams: TEAMS.map((t) => [...t] as [string, string, string, string]),
    stand: stand.map((s) => [s.team, s.games, s.points] as [string, number, number]),
    games,
    results,
    sources: [["Liiga.fi – stored in Appwrite", "https://liiga.fi/fi/ottelut"]],
  };
}
