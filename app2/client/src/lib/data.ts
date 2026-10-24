/** Liiga data the whole app reads. Starts with the built-in sample, then loads from the server. */
import { SAMPLE_GAMES, SAMPLE_RESULTS, SAMPLE_SOURCES, SAMPLE_STAND, SAMPLE_TEAMS } from "./sample";

export interface Team { name: string; city: string; col: string; ab: string }
export interface Game { id: string; d: string; t: string; h: string; a: string; liigaId?: number; live?: boolean; hs?: undefined }
export interface Result { id: string; d: string; h: string; a: string; hs: number; as: number; x: "" | "OT" | "SO"; liigaId?: number; t?: string }
export type AnyGame = Game | Result;
export interface Bundle {
  mode: "live" | "cache" | "sample"; source: string; season: number; fetchedAt: string; note?: string;
  teams: [string, string, string, string][]; stand: [string, number, number][]; games: Game[]; results: Result[]; sources: [string, string][];
}

export let TEAMS: Team[] = [];
export let T: Record<string, Team> = {};
export let AZ: Team[] = [];
export let STAND: [string, number, number][] = [];
export let GAMES: Game[] = [];
export let RESULTS: Result[] = [];
export let SOURCES: [string, string][] = [];
export const DATA_INFO = { mode: "sample" as Bundle["mode"], source: "sample", fetchedAt: "", note: "" as string | undefined, season: 2027 };

export function setData(b: Bundle) {
  TEAMS = b.teams.map(([name, city, col, ab]) => ({ name, city, col, ab }));
  T = Object.fromEntries(TEAMS.map((t) => [t.name, t]));
  AZ = [...TEAMS].sort((a, b) => a.name.localeCompare(b.name, "fi"));
  STAND = b.stand;
  GAMES = b.games;
  RESULTS = b.results;
  SOURCES = b.sources.length ? b.sources : SAMPLE_SOURCES;
  Object.assign(DATA_INFO, { mode: b.mode, source: b.source, fetchedAt: b.fetchedAt, note: b.note, season: b.season });
}

export const sampleBundle = (): Bundle => ({
  mode: "sample", source: "sample", season: 2027, fetchedAt: "2026-10-24T12:00:00Z",
  teams: SAMPLE_TEAMS, stand: SAMPLE_STAND,
  games: SAMPLE_GAMES.map(([d, t, h, a]) => ({ id: "g" + d + t + h, d, t, h, a })),
  results: SAMPLE_RESULTS.map(([d, h, a, hs, as, x]) => ({ id: "r" + d + h, d, h, a, hs, as, x: x as Result["x"] })),
  sources: SAMPLE_SOURCES,
});

setData(sampleBundle());

/** Load the season from the Node server (liiga.fi → Appwrite copy → sample). Keeps the sample if the server is down. */
export async function loadData(): Promise<boolean> {
  try {
    const r = await fetch("/api/data", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    const b = (await r.json()) as Bundle;
    if (!b.teams?.length || !b.stand?.length) throw new Error("empty");
    setData(b);
    return true;
  } catch {
    DATA_INFO.note = "API server not reachable – showing built-in sample data";
    return false;
  }
}

export const isResult = (g: AnyGame): g is Result => (g as Result).hs !== undefined;
export const logoUrl = (name: string) =>
  `/logos/${name.toLowerCase().replace(/ä/g, "a").replace(/ö/g, "o").replace(/å/g, "a").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}.png`;
