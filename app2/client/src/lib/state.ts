/**
 * App state. Same model as the 2.0 prototype: one preferences object (P) saved on the device
 * (and in Appwrite when signed in) plus screen state (tabs, overlays, segments).
 * Components re-render through useApp() whenever emit() is called.
 */
import { useSyncExternalStore } from "react";
import { S, type Lang } from "./strings";

export interface Sub { plan: "free" | "premium"; billing?: "monthly" | "annual"; start?: string; renew?: string; auto?: boolean; via?: string; hist?: { d: string; b: string; trial?: boolean }[] }
export interface User { name?: string; email?: string; byear?: number; mkt?: boolean; in?: boolean; id?: string }
export interface Prefs {
  screen: "splash" | "register" | "login" | "plans" | "select" | "personal" | "app";
  teams: string[]; tf: Record<string, string[]>; lang: Lang; voice: "female" | "male";
  notif: { match: boolean; weekly: boolean; player: boolean }; mode: "dark" | "light" | "system";
  user: User | null; sub: Sub; onboarded: boolean; len: "short" | "medium" | "deep"; tone: "fan" | "neutral" | "analyst" | "kids";
  poll: Record<string, string>; picks: Record<string, string>; town: string | null; points: number;
}
export const DEF = (): Prefs => ({
  screen: "splash", teams: ["Kärpät", "Tappara"], tf: { "Kärpät": ["video"], "Tappara": ["podcast", "summary"] }, lang: "fi", voice: "female",
  notif: { match: true, weekly: true, player: false }, mode: "system", user: null, sub: { plan: "free" }, onboarded: false,
  len: "medium", tone: "neutral", poll: {}, picks: {}, town: null, points: 0,
});

export const ls = {
  get<T>(k: string, d: T): T { try { const v = localStorage.getItem(k); return v == null ? d : (JSON.parse(v) as T); } catch { return d; } },
  set(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  clear() { try { Object.keys(localStorage).filter((k) => k.startsWith("fu2.")).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } },
};

export type Overlay = null | { pay?: 1; notif?: 1; week?: 1; id?: string; player?: string; back?: string };
export type Tab = "home" | "matches" | "calendar" | "teams" | "community" | "profile";

export const app = {
  P: { ...DEF(), ...ls.get<Partial<Prefs>>("fu2.p", {}) } as Prefs,
  tab: ls.get<Tab>("fu2.tab", "home"),
  overlay: null as Overlay,
  mSeg: "upcoming" as "upcoming" | "recent" | "pickem",
  mFil: "mine" as "mine" | "all",
  tSeg: "stand" as "stand" | "az",
  nSeg: "all" as "all" | "match" | "news",
  dSeg: "sum" as "sum" | "stats" | "ev",
  feedSeg: ls.get<"teams" | "league" | "town">("fu2.feed", "teams"),
  calTeam: null as string | null, calMonth: null as string | null, calSel: null as string | null,
  langOpen: false, search: "", openFmt: {} as Record<string, string>,
  boxSide: "h" as "h" | "a", pSeg: "data" as "data" | "stats" | "video" | "art",
  bill: "annual" as "monthly" | "annual", regErr: "", logErr: "", busy: false,
  toast: "", pop: null as null | { kind: "claim" | "facts" | "share"; payload: any },
  others: [{ n: "Aino", p: 30 }, { n: "Rahul", p: 20 }, { n: "Olena", p: 20 }],
};
if (!["home", "matches", "calendar", "teams", "community", "profile"].includes(app.tab)) app.tab = "home";

/* ---------- change notification ---------- */
let version = 0;
const subs = new Set<() => void>();
export function emit() { version++; subs.forEach((f) => f()); }
export function useApp() {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => version);
  return app;
}

/* ---------- saving ---------- */
const saveHooks: ((p: Prefs) => void)[] = [];
export const onSave = (f: (p: Prefs) => void) => saveHooks.push(f);
export function save() { ls.set("fu2.p", app.P); saveHooks.forEach((f) => f(app.P)); }

/** Change state and re-render in one go. */
export function act(fn: (a: typeof app) => void, opts: { persist?: boolean; top?: boolean } = {}) {
  fn(app);
  if (opts.persist) save();
  emit();
  if (opts.top) window.scrollTo(0, 0);
}

export const s = () => S[app.P.lang];
let toastTimer = 0;
export function toast(m: string) {
  app.toast = m; emit();
  clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { app.toast = ""; emit(); }, 2400);
}
