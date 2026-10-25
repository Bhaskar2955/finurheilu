/**
 * Playoff chances: a Monte Carlo model of the rest of the Liiga season.
 *
 * 1. Team strength = points per game from the Liiga table, pulled towards the league average
 *    early in the season (so 2 games don't decide everything).
 * 2. Every remaining game in the schedule is played many times at random: win chance from the
 *    strength difference plus a small home advantage; about 22% go to overtime (2–1 points).
 *    If the schedule is incomplete, missing games are played against an average opponent.
 * 3. Playoffs as in the Liiga format: places 1–4 go straight to the quarter-finals, 5–12 play the
 *    qualifiers (best of 5: 5–12, 6–11, 7–10, 8–9), 13th and below are out. Quarter-finals,
 *    semi-finals and the final are best of 7. Simplification: the best-ranked team always meets
 *    the lowest-ranked one left (in reality the top teams pick their quarter-final opponent).
 *
 * It is a model estimate, not a forecast from Liiga and not betting advice.
 */
import { GAMES, STAND } from "./data";

export const FORMAT = { direct: 4, playoffs: 12, qualifierBestOf: 5, bestOf: 7 };
const PRIOR_PPG = 1.5;   // points per game an average team gets
const PRIOR_GAMES = 8;   // how strongly early results are pulled towards that average
const SCALE = 2.2;       // how much one point-per-game of difference matters
const HOME = 0.15;       // home advantage (in the same logistic units)
const OT_SHARE = 0.22;   // share of games decided in overtime or shootout

export interface OddsRow {
  team: string; rank: number; gp: number; pts: number; left: number;
  top4: number; playoffs: number; qf: number; sf: number; final: number; champ: number;
}
export interface OddsResult { rows: OddsRow[]; sims: number; games: number; key: string }

const pWin = (rh: number, ra: number, homeAdv = HOME) => 1 / (1 + Math.exp(-((rh - ra) * SCALE + homeAdv)));

/** One best-of-N series; the higher seed (a) has home ice in games 1, 2, 5 and 7. Returns the winner. */
function series(a: number, b: number, r: Float64Array, bestOf: number): number {
  const need = Math.ceil(bestOf / 2);
  let wa = 0, wb = 0, g = 0;
  while (wa < need && wb < need) {
    const aHome = g === 0 || g === 1 || g === 4 || g === 6;
    const p = aHome ? pWin(r[a], r[b]) : 1 - pWin(r[b], r[a]);
    if (Math.random() < p) wa++; else wb++;
    g++;
  }
  return wa > wb ? a : b;
}

/** Pairs best with worst from a list already sorted by regular-season rank. */
function bracket(seeds: number[], r: Float64Array, bestOf: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < seeds.length / 2; i++) out.push(series(seeds[i], seeds[seeds.length - 1 - i], r, bestOf));
  return out;
}

export function simulate(n = 4000): OddsResult {
  const teams = STAND.map((s) => s[0]);
  const idx = new Map(teams.map((t, i) => [t, i]));
  const N = teams.length;
  const strength = new Float64Array(N);
  STAND.forEach(([, gp, pts], i) => { strength[i] = (pts + PRIOR_PPG * PRIOR_GAMES) / (gp + PRIOR_GAMES); });
  const left = new Array(N).fill(0);
  const games: [number, number][] = [];
  for (const g of GAMES) {
    const h = idx.get(g.h), a = idx.get(g.a);
    if (h === undefined || a === undefined) continue;
    games.push([h, a]); left[h]++; left[a]++;
  }
  // If the schedule we have is incomplete (sample data), every team still plays the same total:
  // the missing games are played against an average opponent.
  const total = Math.max(...STAND.map(([, gp], i) => gp + left[i]));
  const extra = STAND.map(([, gp], i) => Math.max(0, total - gp - left[i]));
  const c = { top4: new Float64Array(N), playoffs: new Float64Array(N), qf: new Float64Array(N), sf: new Float64Array(N), final: new Float64Array(N), champ: new Float64Array(N) };
  const pts = new Float64Array(N);
  const order = teams.map((_, i) => i);
  for (let s = 0; s < n; s++) {
    STAND.forEach(([, , p], i) => { pts[i] = p + Math.random() * 0.01; }); // tiny random tie-break
    for (const [h, a] of games) {
      const homeWins = Math.random() < pWin(strength[h], strength[a]);
      const ot = Math.random() < OT_SHARE;
      const w = homeWins ? h : a, l = homeWins ? a : h;
      pts[w] += ot ? 2 : 3;
      if (ot) pts[l] += 1;
    }
    for (let i = 0; i < N; i++) {
      for (let k = 0; k < extra[i]; k++) {
        const won = Math.random() < pWin(strength[i], PRIOR_PPG, 0);
        const ot = Math.random() < OT_SHARE;
        pts[i] += won ? (ot ? 2 : 3) : ot ? 1 : 0;
      }
    }
    order.sort((x, y) => pts[y] - pts[x]);
    const top = order.slice(0, Math.min(FORMAT.playoffs, N));
    top.forEach((t, i) => { c.playoffs[t]++; if (i < FORMAT.direct) c.top4[t]++; });
    const direct = top.slice(0, FORMAT.direct);
    const qualWinners = bracket(top.slice(FORMAT.direct), strength, FORMAT.qualifierBestOf);
    const rank = new Map(order.map((t, i) => [t, i]));
    const byRank = (list: number[]) => list.sort((x, y) => rank.get(x)! - rank.get(y)!);
    const qf = byRank([...direct, ...qualWinners]);
    qf.forEach((t) => c.qf[t]++);
    const sf = byRank(bracket(qf, strength, FORMAT.bestOf));
    sf.forEach((t) => c.sf[t]++);
    const fin = byRank(bracket(sf, strength, FORMAT.bestOf));
    fin.forEach((t) => c.final[t]++);
    c.champ[series(fin[0], fin[1], strength, FORMAT.bestOf)]++;
  }
  const rows: OddsRow[] = teams.map((team, i) => ({
    team, rank: i + 1, gp: STAND[i][1], pts: STAND[i][2], left: left[i],
    top4: c.top4[i] / n, playoffs: c.playoffs[i] / n, qf: c.qf[i] / n, sf: c.sf[i] / n, final: c.final[i] / n, champ: c.champ[i] / n,
  }));
  return { rows, sims: n, games: games.length, key: oddsKey() };
}

const oddsKey = () => `${STAND.map((r) => r.join(":")).join("|")}#${GAMES.length}`;

/** Cached result for the current data; recomputed (after paint) when the table or schedule changes. */
let cached: OddsResult | null = null;
let pending = false;
export function getOdds(onReady: () => void): OddsResult | null {
  const key = oddsKey();
  if (cached && cached.key === key) return cached;
  if (!pending && STAND.length >= FORMAT.playoffs) {
    pending = true;
    setTimeout(() => { try { cached = simulate(); } finally { pending = false; onReady(); } }, 30);
  }
  return cached && cached.key === key ? cached : null;
}
