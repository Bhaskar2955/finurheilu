/** Building blocks shared by several screens: scoreboards, match cards, ads, story cards, fact-check pop-up. */
import { useState } from "react";
import { RESULTS, GAMES, T, isResult, type AnyGame, type Game, type Result } from "../lib/data";
import { clockTxt, gs, inSlot, live, realOf, started } from "../lib/live";
import { act, app, s, toast, useApp } from "../lib/state";
import { DEMO_R, factCheck, fDate, verify } from "../lib/stories";
import { TODAY, adult, dayName, isMine, isPrem } from "../lib/util";
import { Crest, Html, Icon, Lock, Toks, openPaywall } from "./ui";
import { IC } from "../lib/icons";

export const openGame = (id: string) =>
  act((a) => { if (a.overlay && a.overlay.id === id) return; a.overlay = { id }; a.dSeg = "sum"; }, { top: true });

/** Big live scoreboard widget. Real Liiga score when the game is on; otherwise the demo simulation. */
export function Scoreboard({ g }: { g: Game }) {
  useApp();
  const x = s();
  const rl = realOf(g);
  const demoOn = started() && inSlot(g.id);
  const st = gs(g.id);
  const on = !!rl || demoOn;
  const isLiveNow = rl ? !rl.ended : demoOn && live.on;
  const hs = rl ? rl.hs : st.hs, as = rl ? rl.as : st.as;
  const last = rl ? rl.goals[rl.goals.length - 1] : st.ev[st.ev.length - 1];
  const lastTeam = rl ? (rl.goals.length ? (rl.goals[rl.goals.length - 1].home ? g.h : g.a) : "") : (last as any)?.team;
  const lastMin = (last as any)?.min ?? (last as any)?.m;
  const flash = !rl && Date.now() - st.flash < 1800;
  const pFill = (i: number) => {
    const min = rl ? (rl.ended ? 60 : rl.min) : live.min;
    return on ? Math.max(0, Math.min(100, ((min - i * 20) / 20) * 100)) : 0;
  };
  const clock = rl ? (rl.ended ? x.realFinal : `${x.per}${Math.min(3, Math.floor(rl.min / 20) + 1)} · ${rl.min}'`) : clockTxt();
  const dateTxt = g.d === TODAY ? x.today : dayName(g.d, { weekday: "short", day: "numeric", month: "numeric" });
  return (
    <button className={`sb ${isLiveNow ? "live" : ""} ${flash ? "flash" : ""}`} style={{ ["--hc" as any]: T[g.h]?.col, ["--ac" as any]: T[g.a]?.col }} aria-label={`${g.h} – ${g.a}`} onClick={() => openGame(g.id)}>
      <div className="sb-top">
        {isLiveNow ? <span className="livechip"><i />LIVE</span> : <span className="prechip">{on ? x.final : `${x.faceoff} ${g.t}`}</span>}
        <span>{on ? clock : dateTxt}</span>
        <span>{rl ? x.realLive : "Liiga"}</span>
      </div>
      <div className="sb-main">
        <div className="sb-team"><Crest name={g.h} size={44} /><b>{g.h}</b><small>{rl ? "" : `${x.sog} ${st.sh}`}</small></div>
        <div className="sb-score">
          {on ? (<><span className="dig">{hs}</span><span className="colon">:</span><span className="dig">{as}</span></>) : <span className="dig time">{g.t}</span>}
        </div>
        <div className="sb-team"><Crest name={g.a} size={44} /><b>{g.a}</b><small>{rl ? "" : `${x.sog} ${st.sa}`}</small></div>
      </div>
      <div className="sb-per">
        {[0, 1, 2].map((i) => (
          <span key={i} style={{ display: "contents" }}>
            <span>{x.per}{i + 1}</span>
            <span className="pb"><i style={{ width: pFill(i) + "%" }} /></span>
          </span>
        ))}
      </div>
      <div className="sb-tick">
        {last ? (<><Html html={IC.bolt} />{`${x.goal} · ${lastTeam} ${lastMin}' · ${last.score}`}</>) : on ? "–" : x.waiting}
      </div>
    </button>
  );
}

export function ResultBoard({ g }: { g: Result }) {
  const x = s();
  return (
    <div className="sb" style={{ ["--hc" as any]: T[g.h]?.col, ["--ac" as any]: T[g.a]?.col, cursor: "default" }}>
      <div className="sb-top"><span className="prechip">{x.final}{g.x ? " · " + g.x : ""}</span><span>{dayName(g.d, { day: "numeric", month: "numeric" })}</span><span>Liiga</span></div>
      <div className="sb-main">
        <div className="sb-team"><Crest name={g.h} size={48} /><b>{g.h}</b></div>
        <div className="sb-score"><span className="dig">{g.hs}</span><span className="colon">:</span><span className="dig">{g.as}</span></div>
        <div className="sb-team"><Crest name={g.a} size={48} /><b>{g.a}</b></div>
      </div>
      <div className="sb-tick">{g.x === "OT" ? x.otL : g.x === "SO" ? x.soL : x.reg}</div>
    </div>
  );
}

/** One row in a match list. */
export function McCard({ g, res }: { g: AnyGame; res: boolean }) {
  useApp();
  const x = s();
  const st = live.st[g.id];
  const rl = !res ? realOf(g) : null;
  const lv = !res && ((st && started() && inSlot(g.id)) || !!rl);
  const r = g as Result;
  return (
    <button className={`mcard ${isMine(g) ? "mine" : ""}`} onClick={() => openGame(g.id)}>
      <span className="tm"><Crest name={g.h} size={30} /><b>{g.h}</b></span>
      <span className={`mid ${lv ? "lv" : ""}`}>
        {res ? `${r.hs}–${r.as}` : lv ? (rl ? `${rl.hs}–${rl.as}` : `${st.hs}–${st.as}`) : (g as Game).t}
        <small>{res ? (r.x ? (r.x === "OT" ? x.otL : x.soL) : x.final) : lv ? (rl ? (rl.ended ? x.final : `${rl.min}'`) : clockTxt()) : T[g.h]?.city}</small>
      </span>
      <span className="tm aw"><Crest name={g.a} size={30} /><b>{g.a}</b></span>
      <span className="sclink">{x.scorecard} ›</span>
    </button>
  );
}

/* ---------- sponsor ads (free plan only) ---------- */
const ADS = [
  { k: "mtv", name: "MTV", bg: "linear-gradient(120deg,#1b1b1f,#3a0d14)", fg: "#ff3b4a", url: "https://www.mtv.fi/" },
  { k: "continental", name: "Continental", bg: "linear-gradient(120deg,#111,#2a2a2a)", fg: "#FFA500", url: "https://www.continental.com/" },
  { k: "iloq", name: "iLOQ", bg: "linear-gradient(120deg,#0b2a4a,#0d4f7a)", fg: "#7fd3ff", url: "https://www.iloq.com/" },
  { k: "veikkaus", name: "Veikkaus", bg: "linear-gradient(120deg,#062a6e,#0b4fb3)", fg: "#ffffff", url: "https://www.veikkaus.fi/", adult: 1 },
];
export function AdCard({ i }: { i: number }) {
  if (isPrem()) return null;
  const x = s();
  const list = ADS.filter((a) => !a.adult || adult());
  const a = list[i % list.length];
  const t = x.ads[a.k];
  return (
    <a className="ad" href={a.url} target="_blank" rel="noopener sponsored" style={{ ["--adbg" as any]: a.bg, ["--adfg" as any]: a.fg }}>
      <span className="adl">{x.ad}{a.adult ? " · K18" : ""}</span><span className="brandw">{a.name}</span>
      <span className="adt"><b>{t[0]}</b><span>{t[1]}</span></span><span className="cta">{t[2]}</span>
    </a>
  );
}
export function MtvPartner() {
  if (isPrem()) return null;
  const x = s();
  return (
    <a className="ad" href="https://www.mtv.fi/" target="_blank" rel="noopener" style={{ ["--adbg" as any]: "linear-gradient(120deg,#1b1b1f,#3a0d14)", ["--adfg" as any]: "#ff3b4a", marginTop: 12 }}>
      <span className="adl">{x.partner}</span><span className="brandw">MTV</span>
      <span className="adt"><b>{x.watchMTV}</b><span>{x.watchMTVB}</span></span><span className="cta">{x.ads.mtv[2]}</span>
    </a>
  );
}

export const Teaser = ({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) => (
  <button className="teaser" onClick={openPaywall} style={style}><Lock />{children}</button>
);

/* ---------- stories with the fact check ---------- */
export function FcBtn({ st }: { st: any }) {
  const x = s();
  const fc = factCheck(st);
  return (
    <button className={`fc ${fc.ok ? "ok" : "bad"}`} onClick={() => act((a) => { a.pop = { kind: "facts", payload: st }; })}>
      {fc.ok ? "✓ " + x.fcPass(fc.n) : "✕ " + x.fcFail(fc.wrong.length + fc.unbacked.length, fc.n)}
    </button>
  );
}

export function StoryBody({ st, label, edited, extra }: { st: any; label?: string; edited?: string | null; extra?: React.ReactNode }) {
  const x = s();
  return (
    <div className="item">
      <span className="tag">{label || x.labAuto}</span>
      <h4><Toks toks={st.title} /></h4>
      {edited ? <p style={{ margin: 0 }}>{edited}</p> : st.body.map((b: any, i: number) => <p key={i} style={{ margin: 0 }}><Toks toks={b} /></p>)}
      {st.why && <div className="why"><b>{x.why}:</b> <Toks toks={st.why} /></div>}
      <div className="row small">
        <FcBtn st={st} />
        <span className="muted">·</span>
        <button className="link" onClick={() => toast(x.sent)}>{x.report}</button>
        {extra}
      </div>
    </div>
  );
}

export function AutoItem({ it, tag }: { it: any; tag: string }) {
  return (
    <div className="item">
      <span className="tag">{tag}</span>
      <p style={{ margin: 0 }}><Toks toks={it.toks} /></p>
      <div className="row small"><FcBtn st={it} /></div>
    </div>
  );
}

/** Where a claim came from, in words. */
export function srcOf(cl: any): string {
  const x = s();
  const f = cl.ref || {};
  if ((f.rid && DEMO_R.some((r) => r.id === f.rid)) || cl.k === "dlead" || cl.k === "dleadPts") return x.srcDemo;
  if (["formN", "formW", "formP", "formMax", "formStr", "streak", "h2hN", "h2hW", "wkN", "wkP"].includes(cl.k)) return x.srcCalc;
  if (f.rid) { const r = RESULTS.find((z) => z.id === f.rid); return r ? `${x.srcGame}: ${r.h}–${r.a} ${r.hs}–${r.as}${r.x ? " (" + r.x + ")" : ""} · ${fDate(r.d, app.P.lang)}` : x.srcGame; }
  if (f.gid) { const g = GAMES.find((z) => z.id === f.gid); return g ? `${x.srcSched}: ${g.h}–${g.a} · ${fDate(g.d, app.P.lang)} ${g.t}` : x.srcSched; }
  return x.srcStand;
}

/** The modal pop-up: list of facts in a story, or text to copy. */
export function Pop() {
  const a = useApp();
  const [, force] = useState(0);
  if (!a.pop) return null;
  const x = s();
  const close = () => act((st) => { st.pop = null; });
  let inner: React.ReactNode = null;
  if (a.pop.kind === "facts") {
    const st = a.pop.payload;
    const fc = factCheck(st);
    inner = (
      <>
        <div className="l">{x.factsH}</div>
        <div className="stack" style={{ gap: 6, margin: "10px 0" }}>
          {st.claims.map((c: any, i: number) => {
            const ok = verify(c);
            return (
              <div className="fact" key={i}>
                <b className={ok ? "okc" : "badc"}>{ok ? "✓" : "✕"}</b>
                <span className="grow"><b>{c.v}</b><span className="small muted"> · {srcOf(c)}</span></span>
              </div>
            );
          })}
          {fc.unbacked.length > 0 && <p className="small badc">{x.blocked(fc.unbacked.join(", "))}</p>}
        </div>
      </>
    );
  } else if (a.pop.kind === "share") {
    inner = (<><div className="l">{x.share}</div><textarea className="notes" readOnly value={a.pop.payload} onFocus={(e) => e.currentTarget.select()} /></>);
  }
  return (
    <div className="pop" onClick={(e) => { if (e.target === e.currentTarget) close(); force((n) => n + 1); }}>
      <div className="popin" role="dialog" aria-modal="true">
        {inner}
        <button className="btn" onClick={close}>{x.close}</button>
      </div>
    </div>
  );
}

export { isResult };
