/** Where the app's Liiga data comes from, in order: liiga.fi → last copy in Appwrite → built-in sample. */
import { appwriteReady, loadBundle, saveBundle } from "./appwrite.js";
import { fetchDay, fetchGame, fetchSeason, sampleBundle, seasonFor } from "./liiga.js";
import type { Bundle, LiveGame } from "./types.js";

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
