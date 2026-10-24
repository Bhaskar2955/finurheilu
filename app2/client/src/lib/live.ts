/**
 * Live scores.
 * 1) Real: the server's /api/live gives today's Liiga games with scores and goals (polled every 30 s).
 * 2) Demo: "Start live demo" simulates the next round of your teams' games minute by minute,
 *    with shots, goals, win probability and player stats, exactly like the 2.0 prototype.
 */
import { GAMES, type AnyGame, type Game } from "./data";
import { addShots, goalBy, playMinute } from "./roster";
import { app, emit, ls, s, toast } from "./state";
import { TODAY, isMine, posOf } from "./util";

export interface GameState {
  hs: number; as: number; sh: number; sa: number; xh: number; xa: number;
  tl: { h: number; a: number; g: null | "h" | "a" }[]; per: [number, number][];
  ev: { m: number; team: string; score: string; who?: { id: string; no: number; n: string } | null }[];
  flash: number; ps?: Record<string, any>;
}
export const live = {
  on: false, min: 0, timer: 0 as any, st: {} as Record<string, GameState>, goals: 0,
  feed: [] as { k: string; t: string; team: string; time?: 1; sub?: string }[],
  slot: null as null | { d: string; t: string; games: Game[] },
};
export const gs = (id: string): GameState =>
  live.st[id] || (live.st[id] = { hs: 0, as: 0, sh: 0, sa: 0, xh: 0, xa: 0, tl: [], per: [[0, 0], [0, 0], [0, 0]], ev: [], flash: 0 });
export const started = () => live.on || live.min > 0;
export const inSlot = (id: string) => !!live.slot && live.slot.games.some((g) => g.id === id);

/** The next round that includes one of the user's teams. */
export function slot() {
  const mine = GAMES.filter((g) => g.d >= TODAY && isMine(g)).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t));
  if (!mine.length) return null;
  const { d, t } = mine[0];
  return { d, t, games: mine.filter((g) => g.d === d && g.t === t) };
}

export function clockTxt() {
  const x = s();
  if (live.min >= 60) return x.final;
  const p = Math.floor(live.min / 20) + 1;
  return `${x.per}${p} · ${String(20 - (live.min % 20)).padStart(2, "0")}:00`;
}

/* ---------- next-goal contest ---------- */
export const contest = { game: null as string | null, pick: null as null | "home" | "away" | "none", mood: 0, bub: "" };
export function addPts() { app.P.points = (app.P.points || 0) + 10; ls.set("fu2.p", app.P); }
function resolvePick(side: "home" | "away") {
  const x = s();
  if (contest.pick) {
    if (contest.pick === side) { addPts(); toast(x.correct); contest.bub = x.correct; } else { toast(x.wrong); contest.bub = x.wrong; }
  } else contest.bub = x.goal + "!";
  contest.mood = Date.now() + 2000;
  contest.pick = null;
  app.others.forEach((o) => { if (Math.random() < 0.35) o.p += 10; });
}

/* ---------- demo simulation ---------- */
export function startLive() {
  if (live.on) return;
  const sl = slot();
  if (!sl) return;
  if (live.min >= 60) { live.min = 0; live.st = {}; live.feed = []; }
  live.slot = sl;
  live.on = true;
  live.timer = setInterval(tick, 650);
  emit();
}

function tick() {
  live.min++;
  const x = s();
  live.slot!.games.forEach((g) => {
    const st = gs(g.id);
    const p = Math.min(2, Math.floor((live.min - 1) / 20));
    const bias = (posOf(g.a) - posOf(g.h)) / 60;
    const nh = (Math.random() < 0.42 + bias ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0);
    const na = (Math.random() < 0.42 - bias ? 1 : 0) + (Math.random() < 0.12 ? 1 : 0);
    for (let k = 0; k < nh; k++) st.xh += 0.04 + Math.random() * 0.12;
    for (let k = 0; k < na; k++) st.xa += 0.04 + Math.random() * 0.12;
    st.sh += nh; st.sa += na;
    playMinute(g, st); addShots(g, st, nh, na);
    const mm: GameState["tl"][number] = { h: nh, a: na, g: null };
    st.tl.push(mm);
    const r = Math.random();
    if (r < 0.05 || r > 0.955) {
      const home = r < 0.05;
      if (home) { st.hs++; st.per[p][0]++; st.sh++; mm.h++; st.xh += 0.22; } else { st.as++; st.per[p][1]++; st.sa++; mm.a++; st.xa += 0.22; }
      mm.g = home ? "h" : "a";
      st.flash = Date.now();
      const team = home ? g.h : g.a;
      const who = goalBy(g, st, home);
      st.ev.push({ m: live.min, team, score: `${st.hs}–${st.as}`, who });
      if (app.P.teams.includes(team)) { live.goals++; live.feed.unshift({ k: "match", t: x.nGoal(team, `${g.h} ${st.hs}–${st.as} ${g.a}`), team, time: 1 }); }
      if (contest.game === g.id) resolvePick(home ? "home" : "away");
    }
  });
  if (live.min >= 60) {
    clearInterval(live.timer);
    live.on = false;
    if (contest.pick === "none") { addPts(); toast(x.correct); }
    contest.pick = null;
  }
  emit();
}

export function winProb(g: AnyGame) {
  const st = gs(g.id);
  const t = Math.min(live.min, 60);
  const diff = st.hs - st.as;
  const z = 0.15 + (0.5 * (posOf(g.a) - posOf(g.h))) / 16 + diff * (0.9 + (1.8 * t) / 60) + 0.035 * (st.sh - st.sa) * (1 - t / 60);
  if (t >= 60 && diff === 0) return 50;
  if (t >= 60) return diff > 0 ? 99 : 1;
  return Math.round(Math.max(2, Math.min(98, 100 / (1 + Math.exp(-z)))));
}

/* ---------- real live scores from the server ---------- */
export interface RealGame { liigaId: number; h: string; a: string; hs: number; as: number; started: boolean; ended: boolean; min: number; x: string; periods: [number, number][]; goals: { min: number; period: number; home: boolean; score: string; scorer: string | null; no?: number | null }[] }
export const real: Record<number, RealGame> = {};
let realTimer = 0;
export function realOf(g: AnyGame): RealGame | null {
  const id = (g as Game).liigaId;
  const r = id ? real[id] : null;
  return r && r.started ? r : null;
}
async function pollReal() {
  if (!GAMES.some((g) => g.d === TODAY && g.liigaId)) return;
  try {
    const r = await fetch(`/api/live?date=${TODAY}`);
    if (!r.ok) return;
    const { games } = (await r.json()) as { games: RealGame[] };
    let changed = false;
    for (const g of games) {
      const old = real[g.liigaId];
      if (!old || old.hs !== g.hs || old.as !== g.as || old.min !== g.min || old.ended !== g.ended) changed = true;
      real[g.liigaId] = g;
    }
    if (changed) emit();
  } catch { /* offline: keep last scores */ }
}
export function startRealPolling() {
  clearInterval(realTimer);
  pollReal();
  realTimer = window.setInterval(() => { if (document.visibilityState === "visible") pollReal(); }, 30_000);
}
