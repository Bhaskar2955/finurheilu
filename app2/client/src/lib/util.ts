/** Small helpers carried over from the prototype. */
import { app } from "./state";
import { GAMES, RESULTS, STAND, type AnyGame, type Result } from "./data";

export const LANGS: [("fi" | "en" | "sv"), string][] = [["fi", "Suomi"], ["en", "English"], ["sv", "Svenska"]];
export const LOC = { fi: "fi-FI", en: "en-GB", sv: "sv-FI" } as const;
export const SPK = { fi: "fi-FI", en: "en-GB", sv: "sv-SE" } as const;
export const PRICE = { monthly: 4.99, annual: 39.99 };

export const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const TODAY = iso(new Date());

export const dayName = (d: string, opt: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "long" }) =>
  new Date(d + "T12:00:00").toLocaleDateString(LOC[app.P.lang], opt);
export const fmtD = (d?: string) => (d ? dayName(d, { day: "numeric", month: "numeric", year: "numeric" }) : "");
export const eur = (v: number) => (app.P.lang === "en" ? v.toFixed(2) + " €" : v.toFixed(2).replace(".", ",") + " €");
export const addPeriod = (d: string, b?: string) => {
  const x = new Date(d + "T12:00:00");
  if (b === "annual") x.setFullYear(x.getFullYear() + 1); else x.setMonth(x.getMonth() + 1);
  return iso(x);
};

export const isMine = (g: AnyGame) => app.P.teams.includes(g.h) || app.P.teams.includes(g.a);
export const posOf = (tm: string) => STAND.findIndex((r) => r[0] === tm) + 1;
export const rowOf = (tm: string): [string, number, number] => STAND.find((r) => r[0] === tm) || [tm, 0, 0];
export const ptsFor = (r: Result, tm: string) => {
  const won = r.h === tm ? r.hs > r.as : r.as > r.hs;
  return won ? (r.x ? 2 : 3) : r.x ? 1 : 0;
};
export const adult = () => !!(app.P.user && app.P.user.byear && new Date().getFullYear() - app.P.user.byear >= 18);

export function isPrem() {
  const b = app.P.sub || ({} as any);
  return b.plan === "premium" && (b.auto || (b.renew && b.renew >= TODAY));
}
export const tfRaw = (tm: string) => (app.P.tf[tm] && app.P.tf[tm].length ? app.P.tf[tm] : ["summary"]);
export const tf = (tm: string) => (isPrem() ? tfRaw(tm) : ["summary"]);

export const findGame = (id: string): AnyGame | undefined => GAMES.find((g) => g.id === id) || RESULTS.find((g) => g.id === id);
export const nextGame = (tm: string) =>
  GAMES.filter((g) => g.d >= TODAY && (g.h === tm || g.a === tm)).sort((a, b) => (a.d + a.t).localeCompare(b.d + b.t))[0];
export const teamRes = (tm: string) => RESULTS.filter((r) => r.h === tm || r.a === tm).slice().sort((a, b) => a.d.localeCompare(b.d));
export const wonBy = (r: Result, tm: string) => (r.h === tm ? r.hs > r.as : r.as > r.hs);
export const weekFrom = () => { const d = new Date(TODAY + "T12:00:00"); d.setDate(d.getDate() - 7); return iso(d); };
export const weekTo = () => { const d = new Date(TODAY + "T12:00:00"); d.setDate(d.getDate() + 7); return iso(d); };
export const gTime = (g: { d: string; t: string }) => new Date(g.d + "T" + g.t + ":00").getTime();

export function isLight() {
  const m = app.P.mode || "system";
  if (m !== "system") return m === "light";
  return typeof window.matchMedia === "function" && matchMedia("(prefers-color-scheme: light)").matches;
}
export function applyMode() { document.documentElement.classList.toggle("light", isLight()); }
