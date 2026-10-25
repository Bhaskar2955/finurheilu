/** Liiga goal clips: fetched from our server (/api/highlights), which reads them from liiga.fi. */
import { useEffect } from "react";
import { emit } from "./state";

export interface Clip {
  key: string; liigaId: number; d: string; h: string; a: string; hs: number; as: number; x: string;
  team: string; home: boolean; min: number; period: number; score: string; scorer: string | null;
  clip: string; thumb: string | null; types?: string[];
}
interface Entry { state: "loading" | "ok" | "error"; clips: Clip[]; source: string; at: number }

const cache: Record<string, Entry> = {};
const TTL = 10 * 60_000;

function load(team: string) {
  const prev = cache[team];
  cache[team] = { state: prev?.clips.length ? "ok" : "loading", clips: prev?.clips ?? [], source: prev?.source ?? "", at: Date.now() };
  fetch(`/api/highlights?games=5${team ? "&team=" + encodeURIComponent(team) : ""}`)
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((d: { source: string; clips: Clip[] }) => { cache[team] = { state: "ok", clips: d.clips ?? [], source: d.source, at: Date.now() }; emit(); })
    .catch(() => { cache[team] = { state: "error", clips: prev?.clips ?? [], source: "error", at: Date.now() }; emit(); });
}

/** Clips for one team ("" = whole league). Re-fetched every 10 minutes while shown. */
export function useClips(team: string): Entry {
  useEffect(() => {
    const e = cache[team];
    if (!e || (e.state !== "loading" && Date.now() - e.at > TTL)) load(team);
  }, [team]);
  return cache[team] ?? { state: "loading", clips: [], source: "", at: 0 };
}

/* ---------- the clip player (one at a time, shown as an overlay) ---------- */
export const viewer: { list: Clip[]; i: number } = { list: [], i: -1 };
export function openClip(list: Clip[], i: number) { viewer.list = list; viewer.i = i; emit(); }
export function closeClip() { viewer.list = []; viewer.i = -1; emit(); }
export function stepClip(d: number) {
  if (viewer.i < 0) return;
  viewer.i = (viewer.i + d + viewer.list.length) % viewer.list.length;
  emit();
}

/** hls.js from a CDN, loaded only when a clip is an HLS stream and the browser can't play it natively. */
let hlsP: Promise<any> | null = null;
export function loadHls(): Promise<any> {
  const w = window as any;
  if (w.Hls) return Promise.resolve(w.Hls);
  if (!hlsP) {
    hlsP = new Promise((ok, bad) => {
      const sc = document.createElement("script");
      sc.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.20/dist/hls.min.js";
      sc.async = true;
      sc.onload = () => (w.Hls ? ok(w.Hls) : bad(new Error("hls.js missing")));
      sc.onerror = () => { hlsP = null; bad(new Error("hls.js failed to load")); };
      document.head.appendChild(sc);
    });
  }
  return hlsP;
}

/**
 * Plays a clip URL in a <video>: MP4/WebM directly, HLS natively (Safari) or through hls.js.
 * Returns a cleanup function. onfail runs when the clip can't be played.
 */
export function attachClip(v: HTMLVideoElement, url: string, onfail: () => void): () => void {
  let hls: any = null;
  let gone = false;
  const isHls = /\.m3u8(\?|#|$)/i.test(url);
  if (isHls && !v.canPlayType("application/vnd.apple.mpegurl")) {
    loadHls()
      .then((Hls) => {
        if (gone) return;
        if (!Hls.isSupported()) { onfail(); return; }
        hls = new Hls();
        hls.on(Hls.Events.ERROR, (_e: unknown, d: any) => { if (d?.fatal) onfail(); });
        hls.loadSource(url);
        hls.attachMedia(v);
        v.play().catch(() => { /* autoplay blocked: controls are there */ });
      })
      .catch(() => !gone && onfail());
  } else {
    v.src = url;
    v.play().catch(() => { /* autoplay blocked */ });
  }
  return () => { gone = true; try { hls?.destroy(); } catch { /* ignore */ } v.pause(); v.removeAttribute("src"); v.load(); };
}
