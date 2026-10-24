/** Podcast playback (device voices, female/male) and data-video reels, from the 2.0 prototype. */
import { app, emit, s } from "./state";
import { SPK } from "./util";

const FEM = /female|woman|samantha|karen|moira|tessa|fiona|serena|kate|susan|zira|hazel|libby|sonia|heidi|satu|noora|alva|klara|sofie|emma|amy|jenny|aria|anna|sara|maria|ida|nora|victoria/i;
const MAL = /\bmale\b|daniel|oliver|alex|fred|george|ryan|guy|david|mark|onni|harri|oskar|mattias|erik|arthur|thomas|james|william|lee/i;

function pickVoice(lang: string, gender: string) {
  let vs: SpeechSynthesisVoice[] = [];
  try { vs = speechSynthesis.getVoices(); } catch { /* no speech */ }
  const m = vs.filter((v) => v.lang && v.lang.toLowerCase().startsWith(lang.slice(0, 2)));
  if (!m.length) return { voice: null as SpeechSynthesisVoice | null, exact: false, none: vs.length > 0 };
  const want = gender === "female" ? m.find((v) => FEM.test(v.name) && !/\bmale\b/i.test(v.name)) : m.find((v) => MAL.test(v.name) && !/female/i.test(v.name));
  return { voice: want || m[0], exact: !!want, none: false };
}

export function speak(texts: string[], onend?: () => void): boolean {
  const lang = SPK[app.P.lang];
  try {
    speechSynthesis.cancel();
    const { voice, exact, none } = pickVoice(lang, app.P.voice);
    if (none) return false;
    texts.forEach((t, i) => {
      const u = new SpeechSynthesisUtterance(t);
      u.lang = lang; if (voice) u.voice = voice;
      u.rate = 0.9; u.volume = 0.85;
      u.pitch = app.P.voice === "female" ? (exact ? 1.05 : 1.25) : exact ? 0.9 : 0.7;
      if (i === texts.length - 1 && onend) u.onend = onend;
      speechSynthesis.speak(u);
    });
    return true;
  } catch { return false; }
}

export interface Line { h: 0 | 1; t: string }
function speakLines(lines: Line[], onend?: () => void): boolean {
  const lang = SPK[app.P.lang];
  try {
    speechSynthesis.cancel();
    const g0 = app.P.voice, g1 = g0 === "female" ? "male" : "female";
    const v0 = pickVoice(lang, g0), v1 = pickVoice(lang, g1);
    if (v0.none) return false;
    lines.forEach((ln, i) => {
      const pv = ln.h ? v1 : v0, gd = ln.h ? g1 : g0;
      const u = new SpeechSynthesisUtterance(ln.t);
      u.lang = lang; if (pv.voice) u.voice = pv.voice;
      u.rate = 0.92; u.volume = 0.85;
      u.pitch = gd === "female" ? (pv.exact ? 1.05 : 1.25) : pv.exact ? 0.9 : 0.7;
      if (i === lines.length - 1 && onend) u.onend = onend;
      speechSynthesis.speak(u);
    });
    return true;
  } catch { return false; }
}

export const estL = (lines: Line[]) => Math.max(15, lines.map((l) => l.t).join(" ").split(/\s+/).length * 0.45 + 4);
export const est = (t: string, b: string) => Math.max(12, (t + " " + b).split(/\s+/).length * 0.5 + 3);

/* ---------- podcast ---------- */
export const pod = { id: null as string | null, on: false, t0: 0, dur: 0, timer: 0 as any, progress: 0, transcript: {} as Record<string, { ok: boolean; lines: Line[] | null; text: string }> };

export function stopPod() {
  clearInterval(pod.timer);
  try { speechSynthesis.cancel(); } catch { /* ignore */ }
  pod.on = false; pod.id = null; pod.progress = 0;
  emit();
}

export function playPod(id: string, entry: { lines?: Line[]; t?: string; b?: string }) {
  if (pod.id === id && pod.on) { stopPod(); return; }
  stopPod(); stopReels();
  pod.id = id; pod.on = true; pod.t0 = Date.now();
  pod.dur = (entry.lines ? estL(entry.lines) : est(entry.t || "", entry.b || "")) * 1000;
  const end = () => { if (pod.id === id) stopPod(); };
  const ok = entry.lines ? speakLines(entry.lines, end) : speak([entry.t || "", entry.b || ""], end);
  pod.transcript[id] = { ok, lines: entry.lines || null, text: entry.lines ? "" : `${entry.t}. ${entry.b}` };
  pod.timer = setInterval(() => {
    pod.progress = Math.min(1, (Date.now() - pod.t0) / pod.dur);
    if (pod.progress >= 1 && !ok) stopPod(); else emit();
  }, 200);
  emit();
}

/** Restart with the other voice while playing. */
export function setVoice(v: "female" | "male", entryFor?: () => { id: string; entry: { lines?: Line[]; t?: string; b?: string } } | null) {
  app.P.voice = v;
  if (pod.on && entryFor) { const e = entryFor(); if (e) { stopPod(); playPod(e.id, e.entry); return; } }
  emit();
}

/* ---------- reels (scene-by-scene data videos) ---------- */
export const reels: Record<string, { i: number; on: boolean; t: any; dur: number }> = {};
export function pauseReel(id: string) {
  const r = reels[id]; if (!r) return;
  clearTimeout(r.t);
  if (r.on) try { speechSynthesis.cancel(); } catch { /* ignore */ }
  r.on = false;
  emit();
}
export function stopReels(except?: string) { Object.keys(reels).forEach((id) => { if (id !== except && reels[id].on) pauseReel(id); }); }
export function toggleReel(id: string, n: number, vo?: string) {
  const r = reels[id] || (reels[id] = { i: 0, on: false, t: 0, dur: 3000 });
  if (r.on) { pauseReel(id); return; }
  stopReels(id);
  if (pod.on) stopPod();
  if (r.i >= n) r.i = 0;
  r.on = true; r.dur = vo ? 4000 : 3000;
  if (vo && r.i === 0) speak([vo]);
  const step = () => {
    r.t = setTimeout(() => {
      r.i++;
      if (r.i >= n) { r.i = 0; r.on = false; emit(); return; }
      emit(); step();
    }, r.dur);
  };
  step();
  emit();
}
export function stopAllMedia() { if (pod.on) stopPod(); stopReels(); }
export const sampleVoice = () => speak([s().sample]);
