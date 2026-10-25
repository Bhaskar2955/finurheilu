/** Where the app's Liiga data comes from, in order: liiga.fi → last copy in Appwrite → built-in sample. */
import { appwriteReady, loadBundle, saveBundle } from "./appwrite.js";
import { fetchDay, fetchGame, fetchSeason, sampleBundle, seasonFor, todayHelsinki } from "./liiga.js";
import type { Bundle, Clip, LiveGame } from "./types.js";

const MODE = (process.env.DATA_MODE || "auto").toLowerCase(); // "auto" | "appwrite" | "sample"
const TTL = Number(process.env.DATA_TTL_MINUTES || 10) * 60_000;

let cached: { at: number; b: Bundle } | null = null;
let inflight: Promise<Bundle> | null = null;
export const syncState = { lastSync: "", lastError: "", rows: 0 };

async function load(): Promise<Bundle> {
  if (MODE === "sample") return sampleBundle("DATA_MODE=sample");
  if (MODE === "appwrite") {
    // Only the copy stored by `npm run sync` – no calls to liiga.fi for the season data.
    try {
      const c = appwriteReady() ? await loadBundle() : null;
      if (c) return c;
    } catch (e) {
      syncState.lastError = `Appwrite read failed: ${(e as Error).message}`;
    }
    return sampleBundle("DATA_MODE=appwrite but nothing stored yet – run npm run sync");
  }
  try {
    const b = await fetchSeason();
    if (appwriteReady()) {
      // Store the fresh copy in Appwrite in the background; the app doesn't wait for it.
      saveBundle(b)
        .then((n) => Object.assign(syncState, { lastSync: new Date().toISOString(), rows: n, lastError: "" }))
        .catch((e) => (syncState.lastError = `Appwrite save failed: ${e?.message ?? e}`));
    }
    return b;
  } catch (e) {
    const why = `liiga.fi not reachable: ${(e as Error).message}`;
    if (appwriteReady()) {
      try {
        const c = await loadBundle();
        if (c) return { ...c, note: why };
      } catch (e2) {
        syncState.lastError = `Appwrite read failed: ${(e2 as Error).message}`;
      }
    }
    return sampleBundle(why);
  }
}

export async function getBundle(force = false): Promise<Bundle> {
  if (!force && cached && Date.now() - cached.at < TTL) return cached.b;
  if (!inflight) {
    inflight = load()
      .then((b) => {
        cached = { at: Date.now(), b };
        return b;
      })
      .finally(() => (inflight = null));
  }
  return inflight;
}

/* small time-based caches for live calls, so many phones don't hammer liiga.fi */
const memo = new Map<string, { at: number; v: unknown }>();
async function cachedCall<T>(key: string, ms: number, fn: () => Promise<T>): Promise<T> {
  const hit = memo.get(key);
  if (hit && Date.now() - hit.at < ms) return hit.v as T;
  const v = await fn();
  memo.set(key, { at: Date.now(), v });
  return v;
}

export const liveDay = (date: string): Promise<LiveGame[]> =>
  MODE === "sample" ? Promise.resolve([]) : cachedCall(`day:${date}`, 20_000, () => fetchDay(date));

export const gameDetail = (liigaId: number, ended: boolean): Promise<LiveGame> =>
  cachedCall(`game:${liigaId}`, ended ? 6 * 3600_000 : 20_000, () => fetchGame(seasonFor(), liigaId));

/**
 * Liiga's own goal clips for recent finished games.
 * team given: that team's last `games` games; otherwise the league's last 3 match days.
 * The games-by-date endpoint carries videoClipUrl / videoThumbnailUrl on each goal event.
 */
export async function highlights(team: string | null, games = 5): Promise<{ source: string; clips: Clip[]; note?: string }> {
  const b = await getBundle();
  if (MODE === "sample" || b.mode === "sample") return { source: "sample", clips: [], note: "Liiga clips need the live liiga.fi connection" };
  const today = todayHelsinki();
  const done = b.results.filter((r) => r.liigaId && r.d <= today && (!team || r.h === team || r.a === team)).sort((x, y) => y.d.localeCompare(x.d));
  const picked = team ? done.slice(0, games) : done.filter((r) => [...new Set(done.map((z) => z.d))].slice(0, 3).includes(r.d));
  const byId = new Map(picked.map((r) => [r.liigaId!, r]));
  const dates = [...new Set(picked.map((r) => r.d))];
  const days = await Promise.all(
    dates.map((d) => cachedCall(`clips:${d}`, d === today ? 120_000 : 3600_000, () => fetchDay(d)).catch(() => [] as LiveGame[])),
  );
  const clips: Clip[] = [];
  for (const g of days.flat()) {
    const r = byId.get(g.liigaId);
    if (!r) continue;
    for (const e of g.goals) {
      if (!e.clip) continue;
      const tm = e.home ? r.h : r.a;
      if (team && tm !== team) continue; // a team's feed shows its own goals
      clips.push({
        key: `${g.liigaId}-${e.sec ?? e.min}-${e.score}`, liigaId: g.liigaId, d: r.d, h: r.h, a: r.a, hs: r.hs, as: r.as, x: r.x,
        team: tm, home: e.home, min: e.min, period: e.period, score: e.score, scorer: e.scorer, clip: e.clip, thumb: e.thumb ?? null, types: e.types ?? [],
      });
    }
  }
  clips.sort((p, q) => q.d.localeCompare(p.d) || p.liigaId - q.liigaId || p.min - q.min);
  return { source: "liiga.fi", clips };
}
