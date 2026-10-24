/** Match detail: scoreboard, period table, live analytics, AI summary, stats, events, contest and poll. Plus the player page. */
import { useEffect, useState } from "react";
import { T, isResult, type AnyGame, type Game, type Result } from "../lib/data";
import { IC } from "../lib/icons";
import { clockTxt, contest, gs, inSlot, live, real, slot, started, startLive, winProb, type RealGame } from "../lib/live";
import { bestList, findPlayer, fmtT, goalieLine, pModel, pst, skaters, roster } from "../lib/roster";
import { act, app, emit, s, toast, useApp } from "../lib/state";
import { checkText, preview, story } from "../lib/stories";
import { avatar, cmpRow, flowChart, gauge, mbar, miniGauge, ring } from "../lib/svg";
import { dayName, findGame, isPrem, posOf, ptsFor, rowOf, tf } from "../lib/util";
import { AdCard, McCard, MtvPartner, ResultBoard, Scoreboard, StoryBody } from "../components/cards";
import { BackBtn, Crest, Header, Html, Icon, Seg } from "../components/ui";
import { LenToneCtl, Reel } from "./Home";

/* ---------- real game detail from the server (period scores, goal scorers) ---------- */
const details: Record<number, RealGame | "loading" | "error"> = {};
function useDetail(g: AnyGame | undefined): RealGame | null {
  const id = g ? (g as Game).liigaId : undefined;
  useEffect(() => {
    if (!g || !id || details[id]) return;
    details[id] = "loading";
    fetch(`/api/game/${id}${isResult(g) ? "?ended=1" : ""}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
      .then((d: RealGame) => { details[id] = d; emit(); })
      .catch(() => { details[id] = "error"; });
  }, [id]);
  if (!id) return null;
  const live1 = real[id];
  const d = details[id];
  if (d && typeof d === "object") return live1 && !d.ended ? { ...d, ...live1, goals: d.goals.length >= live1.goals.length ? d.goals : live1.goals } : d;
  return live1 && live1.started ? live1 : null;
}

const closeOverlay = () => act((a) => { a.overlay = null; }, { top: true });

export function Detail() {
  const a = useApp();
  const x = s();
  const g = findGame(a.overlay!.id!);
  const rd = useDetail(g);
  if (!g) return (<><Header left={<BackBtn onClick={closeOverlay} />} /><p className="muted">–</p></>);
  const res = isResult(g);
  const isLive = !res && inSlot(g.id) && started();
  const myTeam = a.P.teams.includes(g.h) ? g.h : a.P.teams.includes(g.a) ? g.a : null;
  const sl = slot();
  const inNext = !res && !!sl && sl.games.some((z) => z.id === g.id);
  return (
    <>
      <Header left={<BackBtn onClick={closeOverlay} />} />
      <h2 className="title">{g.h} vs {g.a}</h2>
      <p className="small muted" style={{ margin: "4px 0 12px" }}>{dayName(g.d)}{(g as Game).t ? " · " + (g as Game).t : ""} · {T[g.h]?.city}</p>
      {isLive && <div className="dsticky"><StickyScore g={g as Game} /></div>}
      {res ? <ResultBoard g={g as Result} /> : <Scoreboard g={g as Game} />}
      <div className="c" style={{ padding: 12, marginTop: 12 }}>
        <div className="l">{x.scorecard}</div>
        <PeriodTable g={g} res={res} isLive={isLive} rd={rd} />
      </div>
      {isLive ? <LiveAnalytics g={g as Game} /> : inNext ? (
        <div className="c an" style={{ marginTop: 12 }}>
          <h3>{x.liveAn}</h3>
          <p className="muted" style={{ margin: 0 }}>{x.laPre}</p>
          <button className="btn lime" onClick={startLive}>{x.goLive}</button>
        </div>
      ) : null}
      {!res && <MtvPartner />}
      <div style={{ marginTop: 12 }}>
        <Seg items={[["sum", x.aiSum], ["stats", x.stats], ["ev", x.events]]} value={a.dSeg} onPick={(k) => act((st) => { st.dSeg = k; })} />
      </div>
      <div style={{ marginTop: 12 }}>
        {a.dSeg === "sum" ? <DetailSum g={g} res={res} myTeam={myTeam} /> : a.dSeg === "stats" ? <StatsBox g={g} res={res} isLive={isLive} /> : <EventsBox g={g} isLive={isLive} rd={rd} />}
      </div>
      {(!res && inSlot(g.id)) || inNext ? <div className="c pt" style={{ marginTop: 12 }}><ContestBox g={g as Game} /></div> : null}
      <PollBox g={g} res={res} />
      <div style={{ marginTop: 12 }}><AdCard i={3} /></div>
    </>
  );
}

function StickyScore({ g }: { g: Game }) {
  const st = gs(g.id);
  return (
    <>
      <Crest name={g.h} size={26} /><span className="ab">{T[g.h]?.ab}</span><span className="ds">{st.hs}:{st.as}</span><span className="ab">{T[g.a]?.ab}</span><Crest name={g.a} size={26} />
      {live.on && <span className="livechip" style={{ fontSize: 10 }}><i />LIVE</span>}
    </>
  );
}

function PeriodTable({ g, res, isLive, rd }: { g: AnyGame; res: boolean; isLive: boolean; rd: RealGame | null }) {
  const x = s();
  const head = (<thead><tr><th />{x.periods.map((p: string) => <th key={p}>{p}</th>)}<th>{x.tot}</th></tr></thead>);
  const rows = (per: [number, number][], hs: number, as: number) => (
    <tbody>
      <tr><td>{g.h}</td>{per.map((p, i) => <td key={i}>{p[0]}</td>)}<td className="tot">{hs}</td></tr>
      <tr><td>{g.a}</td>{per.map((p, i) => <td key={i}>{p[1]}</td>)}<td className="tot">{as}</td></tr>
    </tbody>
  );
  if (isLive) { const st = gs(g.id); return <table className="ptable">{head}{rows(st.per, st.hs, st.as)}</table>; }
  if (rd) return (<><table className="ptable">{head}{rows(rd.periods, rd.hs, rd.as)}</table><p className="small muted" style={{ margin: "6px 0 0" }}>Liiga.fi</p></>);
  if (res) {
    const r = g as Result;
    return (
      <>
        <table className="ptable">{head}<tbody>
          <tr><td>{g.h}</td><td>–</td><td>–</td><td>–</td><td className="tot">{r.hs}</td></tr>
          <tr><td>{g.a}</td><td>–</td><td>–</td><td>–</td><td className="tot">{r.as}</td></tr>
        </tbody></table>
        <p className="small muted" style={{ margin: "6px 0 0" }}>{x.noPer}</p>
      </>
    );
  }
  return <p className="small muted" style={{ margin: "6px 0 0" }}>{x.waiting} · {(g as Game).t}</p>;
}

function StatsBox({ g, res, isLive }: { g: AnyGame; res: boolean; isLive: boolean }) {
  const x = s();
  const rows: [string, number, number][] = [];
  if (isLive) { const st = gs(g.id); rows.push([x.sog, st.sh, st.sa], [x.goal, st.hs, st.as]); }
  if (res) rows.push([x.pts, ptsFor(g as Result, g.h), ptsFor(g as Result, g.a)]);
  rows.push([x.place, posOf(g.h), posOf(g.a)], [x.pts + " · Liiga", rowOf(g.h)[2], rowOf(g.a)[2]]);
  const r = g as Result;
  return (
    <div className="c pt">
      {rows.map(([n, av, bv]) => {
        const tot = av + bv || 1;
        return (
          <div key={n}>
            <div className="small muted" style={{ textAlign: "center" }}>{n}</div>
            <div className="stat"><b>{av}</b><div className="sbar"><i style={{ width: (av / tot) * 100 + "%", background: T[g.h]?.col }} /><i style={{ width: (bv / tot) * 100 + "%", background: T[g.a]?.col }} /></div><b style={{ textAlign: "end" }}>{bv}</b></div>
          </div>
        );
      })}
      {res && <div className="small muted">{x.type}: {r.x === "OT" ? x.otL : r.x === "SO" ? x.soL : x.reg}</div>}
    </div>
  );
}

function EventsBox({ g, isLive, rd }: { g: AnyGame; isLive: boolean; rd: RealGame | null }) {
  const x = s();
  if (rd && rd.goals.length)
    return (
      <div className="c pt">
        {rd.goals.map((e, i) => {
          const team = e.home ? g.h : g.a;
          return <div key={i} className="ev"><span className="m">{e.min}'</span><Crest name={team} size={20} /><span>{x.goal} · {e.scorer ? `${e.no ? "#" + e.no + " " : ""}${e.scorer} · ` : ""}{team} ({e.score})</span></div>;
        })}
      </div>
    );
  const ev = isLive ? gs(g.id).ev : [];
  return (
    <div className="c pt">
      {ev.length ? ev.map((e, i) => (
        <div key={i} className="ev"><span className="m">{e.m}'</span><Crest name={e.team} size={20} /><span>{x.goal} · {e.who ? `#${e.who.no} ${e.who.n} · ` : ""}{e.team} ({e.score})</span></div>
      )) : <p className="small muted" style={{ margin: 0 }}>{x.noEv}</p>}
    </div>
  );
}

/* ---------- AI summary (demo writer, optional Gemini rewrite that must pass the fact check) ---------- */
let aiStatus: { provider: string } | null = null;
fetch("/api/ai/status").then((r) => r.json()).then((d) => { aiStatus = d; emit(); }).catch(() => { aiStatus = { provider: "demo" }; });
const rewrites: Record<string, { text?: string; busy?: boolean; rejected?: boolean }> = {};

function DetailSum({ g, res, myTeam }: { g: AnyGame; res: boolean; myTeam: string | null }) {
  useApp();
  const x = s();
  if (!res) {
    const pv = preview(g as Game);
    return <div className="c pt">{pv ? <StoryBody st={pv} label={x.labAuto} /> : <p className="small muted">–</p>}</div>;
  }
  const tm = myTeam || g.h;
  const len = isPrem() ? app.P.len : "medium";
  const tone = isPrem() ? app.P.tone : "neutral";
  const st = story(tm, { rid: g.id, len, tone });
  if (!st) return null;
  const key = `${st.id}:${app.P.lang}:${len}:${tone}`;
  const rw = rewrites[key];
  const gem = aiStatus?.provider === "gemini";
  const ask = async () => {
    rewrites[key] = { busy: true }; emit();
    try {
      const r = await fetch("/api/ai/rewrite", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ lang: app.P.lang, tone, text: st.text, facts: st.claims.map((c: any) => c.v) }) });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error);
      const bad = checkText(d.text, st.claims);
      rewrites[key] = bad.length ? { rejected: true } : { text: d.text };
      if (bad.length) toast(x.aiRejected);
    } catch {
      rewrites[key] = {}; toast(x.errNet);
    }
    emit();
  };
  return (
    <div className="c pt">
      <LenToneCtl />
      <StoryBody st={st} label={rw?.text ? x.aiRewritten : x.labAuto} edited={rw?.text || null}
        extra={gem ? (<><span className="muted">·</span><button className="link" disabled={rw?.busy} onClick={ask}>{rw?.busy ? x.aiRewriting : x.aiRewrite}</button></>) : null} />
      {rw?.rejected && <p className="small badc" style={{ margin: 0 }}>{x.aiRejected}</p>}
    </div>
  );
}

/* ---------- next-goal contest ---------- */
function Mascot() {
  const yay = Date.now() < contest.mood;
  const flagSvg = ({ fi: '<svg x="101" y="27" width="28" height="18" viewBox="0 0 18 11" preserveAspectRatio="none"><rect width="18" height="11" fill="#fff"/><rect x="5" width="3" height="11" fill="#002F6C"/><rect y="4" width="18" height="3" fill="#002F6C"/></svg>', sv: '<svg x="101" y="27" width="28" height="18" viewBox="0 0 16 10" preserveAspectRatio="none"><rect width="16" height="10" fill="#006AA7"/><rect x="5" width="2" height="10" fill="#FECC02"/><rect y="4" width="16" height="2" fill="#FECC02"/></svg>', en: '<svg x="101" y="27" width="28" height="18" viewBox="0 0 60 30" preserveAspectRatio="none"><rect width="60" height="30" fill="#012169"/><path d="M0,0L60,30M60,0L0,30" stroke="#fff" stroke-width="6"/><path d="M30,0v30M0,15h60" stroke="#fff" stroke-width="10"/><path d="M30,0v30M0,15h60" stroke="#C8102E" stroke-width="6"/></svg>' } as Record<string, string>)[app.P.lang];
  const svg = `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="108" rx="30" ry="5" fill="rgba(0,0,0,.35)"/><g class="bg"><line x1="27" y1="72" x2="12" y2="58" stroke="#000" stroke-width="5" stroke-linecap="round"/><circle cx="12" cy="57" r="5" fill="#49C6FF"/><line x1="48" y1="92" x2="46" y2="102" stroke="#000" stroke-width="5" stroke-linecap="round"/><line x1="72" y1="92" x2="74" y2="102" stroke="#000" stroke-width="5" stroke-linecap="round"/><rect x="36" y="101" width="18" height="4" rx="2" fill="#49C6FF"/><rect x="66" y="101" width="18" height="4" rx="2" fill="#49C6FF"/><path d="M26 58v28a34 10 0 0 0 68 0V58z" fill="#05080f" stroke="#1F2E4A"/><ellipse cx="60" cy="58" rx="34" ry="11" fill="#2a3446"/><ellipse cx="60" cy="56" rx="26" ry="6" fill="#3a4658"/><circle cx="48" cy="72" r="7" fill="#fff"/><circle cx="72" cy="72" r="7" fill="#fff"/><circle cx="50" cy="72" r="3.4" fill="#08111F"/><circle cx="74" cy="72" r="3.4" fill="#08111F"/><path d="M50 82q10 9 20 0" fill="none" stroke="#C6FF3D" stroke-width="2.5" stroke-linecap="round"/><line x1="93" y1="72" x2="100" y2="58" stroke="#000" stroke-width="5" stroke-linecap="round"/><line x1="100" y1="26" x2="100" y2="80" stroke="#c08a4a" stroke-width="3" stroke-linecap="round"/><circle cx="100" cy="60" r="5" fill="#49C6FF"/>${flagSvg}</g></svg>`;
  return <button className={`mascot ${yay ? "yay" : ""}`} aria-label="Kiekkis" onClick={() => { contest.mood = Date.now() + 1500; contest.bub = s().cheer; emit(); }} dangerouslySetInnerHTML={{ __html: svg }} />;
}

function ContestBox({ g }: { g: Game }) {
  const a = useApp();
  const x = s();
  contest.game = g.id;
  const pick = (k: "home" | "none" | "away") => { if (live.min >= 60) return; contest.pick = k; emit(); };
  return (
    <>
      <div className="l">{x.contest}</div>
      {!isPrem() && (
        <div className="sponsor"><div className="slogo" style={{ background: "#FFA500", fontSize: 12 }}>CONTI</div><div className="small"><b>{x.contSp}</b><br /><span className="muted">{x.contPrize}</span></div></div>
      )}
      <div className="row" style={{ flexWrap: "nowrap" }}><Mascot /><div className="bubble">{Date.now() < contest.mood ? contest.bub : x.cheer}</div></div>
      <div className="picks">
        <button className="pick" aria-pressed={contest.pick === "home"} onClick={() => pick("home")}>{g.h}</button>
        <button className="pick" aria-pressed={contest.pick === "none"} onClick={() => pick("none")}>{x.noGoal}</button>
        <button className="pick" aria-pressed={contest.pick === "away"} onClick={() => pick("away")}>{g.a}</button>
      </div>
      {!live.on && <button className="btn lime" onClick={startLive}>{x.goLive}</button>}
      <div className="small muted">{x.points}: <b style={{ color: "var(--lime-t)" }}>{a.P.points || 0}</b> · {a.others.map((o) => `${o.n} ${o.p}`).join(" · ")}</div>
    </>
  );
}

/* ---------- fan poll ---------- */
function seedVotes(id: string) { let h = 7; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return [40 + (h % 80), 8 + ((h >>> 7) % 22), 35 + ((h >>> 13) % 80)]; }
function PollBox({ g, res }: { g: AnyGame; res: boolean }) {
  const a = useApp();
  const x = s();
  const v = (a.P.poll || {})[g.id];
  const ks = ["h", "x", "a"];
  const cnt = seedVotes(g.id).map((n, i) => n + (v === ks[i] ? 1 : 0));
  const tot = cnt.reduce((p, q) => p + q, 0);
  const labels = [g.h, x.pollOT, g.a];
  const top = labels[cnt.indexOf(Math.max(...cnt))];
  return (
    <div className="c pt" style={{ marginTop: 12 }}>
      <div className="between"><span className="l">{x.pollH}</span><span className="small muted">{x.votes(tot)}</span></div>
      {ks.map((k, i) => (
        <button key={k} className="pollrow" disabled={res} aria-pressed={v === k} onClick={() => act((st) => { st.P.poll = { ...(st.P.poll || {}), [g.id]: k }; }, { persist: true })}>
          <span className="pl">{labels[i]}</span><span className="pb"><i style={{ width: Math.round((cnt[i] / tot) * 100) + "%" }} /></span><b>{Math.round((cnt[i] / tot) * 100)} %</b>
        </button>
      ))}
      <p className="small muted" style={{ margin: "6px 0 0" }}>{res ? x.pollClosed + " · " + x.pollFans(top) + " " : ""}{x.pollNote}</p>
    </div>
  );
}

/* ---------- live analytics (demo simulation) ---------- */
function ShareBtn({ k }: { k: string }) {
  return <button className="icon sm" aria-label={s().laShare} onClick={() => shareNow(k)}><Icon k="share" /></button>;
}
function shareNow(k: string) {
  const x = s();
  const ov = app.overlay || {};
  const gid = ov.id || ov.back;
  const g = gid ? findGame(gid) : null;
  let t = "";
  if (g && !isResult(g)) {
    const st = gs(g.id);
    t = `${g.h} ${st.hs}–${st.as} ${g.a} · ${clockTxt()}`;
    if (k === "win") t += ` · ${x.winProb}: ${g.h} ${winProb(g)}% – ${g.a} ${100 - winProb(g)}%`;
    if (k === "best") t += ` · ${x.laBest}: ` + bestList(g).map((b: any) => `${b.p.n} (${b.p.team}, ${b.line})`).join(", ");
    if (k === "player" && ov.player) { const p = findPlayer(ov.player); t = `${p.n} #${p.no} ${p.team} · ${pModel(p, g).art} · ` + t; }
  }
  t += " — FinUrheilu";
  try { navigator.clipboard.writeText(t).then(() => toast(x.laShared), () => toast(t)); } catch { toast(t); }
}
const openPlayer = (id: string) => act((a) => { a.overlay = { player: id, back: (a.overlay && (a.overlay.id || a.overlay.back)) || undefined }; a.pSeg = "data"; }, { top: true });

function LiveAnalytics({ g }: { g: Game }) {
  useApp();
  const x = s();
  const st = gs(g.id);
  const p = winProb(g);
  const svH = st.sa ? ((st.sa - st.as) / st.sa) * 100 : 100, svA = st.sh ? ((st.sh - st.hs) / st.sh) * 100 : 100;
  const gsH = st.xa - st.as, gsA = st.xh - st.hs;
  return (
    <>
      <div className="l" style={{ margin: "14px 0 8px" }}>{x.liveAn}</div>
      <div className="an-grid">
        <div className="c an">
          <div className="between"><h3>{x.winMeter}</h3><span className="row" style={{ flexWrap: "nowrap" }}><span className="vs"><Crest name={g.h} size={24} />×<Crest name={g.a} size={24} /></span><ShareBtn k="win" /></span></div>
          <div className="between"><b className="d" style={{ fontSize: 30, color: "var(--blue)" }}>{p}%</b><span className="small muted" style={{ textTransform: "uppercase", letterSpacing: ".08em", fontWeight: 700 }}>{x.winProb}</span><b className="d" style={{ fontSize: 30, color: "var(--red)" }}>{100 - p}%</b></div>
          <Html as="div" html={gauge(p)} />
          <p className="small muted" style={{ margin: 0 }}>{x.modelNote}</p>
        </div>
        <div className="c an">
          <div className="between"><h3>{x.flow}</h3><span className="vs"><Crest name={g.h} size={22} />×<Crest name={g.a} size={22} /></span></div>
          <Html as="div" html={flowChart(g)} />
          <p className="small muted" style={{ margin: 0 }}>{x.flowNote} · <span style={{ color: "var(--blue)" }}>■</span> {g.h} <span style={{ color: "var(--red)" }}>■</span> {g.a}</p>
        </div>
        <div className="c an">
          <h3>{x.goalies}</h3>
          <div className="gk">
            {[true, false].map((h) => {
              const L = goalieLine(g, st, h);
              return (
                <button key={String(h)} className="goalie" onClick={() => openPlayer(L.p.id)}>
                  <Html html={avatar(L.p, 56)} /><b>{L.p.no} {L.p.n}</b><span className="small muted"><Crest name={L.p.team} size={16} /> {fmtT(L.toi)}</span>
                </button>
              );
            })}
          </div>
          <div className="lbl small" style={{ textAlign: "center", fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase" }}>{x.gsax}</div>
          <div className="gk">
            <div><Html html={miniGauge(gsH, "var(--blue)")} /><b style={{ color: "var(--blue)" }}>{gsH >= 0 ? "+" : ""}{gsH.toFixed(2)}</b></div>
            <div><Html html={miniGauge(gsA, "var(--red)")} /><b style={{ color: "var(--red)" }}>{gsA >= 0 ? "+" : ""}{gsA.toFixed(2)}</b></div>
          </div>
          <Html as="div" className="cmp" html={cmpRow(x.ga, st.as, st.hs) + cmpRow(x.svp, svH, svA, (v: number) => v.toFixed(1) + "%", (v: number) => v.toFixed(1) + "%") + cmpRow(x.saves, st.sa - st.as, st.sh - st.hs)} />
        </div>
        <div className="c an">
          <div className="between"><h3>{x.laBest}</h3><ShareBtn k="best" /></div>
          <div className="best">
            {bestList(g).map((b: any, i: number) => (
              <button key={b.p.id} className="bp" onClick={() => openPlayer(b.p.id)}>
                <span className="rk">#{i + 1}</span><Html html={avatar(b.p, 52)} /><b>{b.p.no} {b.p.n}</b>
                <span className="small muted" style={{ display: "flex", alignItems: "center", gap: 4 }}><Crest name={b.p.team} size={14} />{x.laPos[b.p.pos]}</span>
                <span className="small" style={{ fontWeight: 700 }}>{b.line}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
      <BoxScore g={g} />
    </>
  );
}

function BoxScore({ g }: { g: Game }) {
  const a = useApp();
  const x = s();
  const st = gs(g.id);
  const tm = a.boxSide === "a" ? g.a : g.h;
  const rows = skaters(tm).map((p: any) => ({ p, q: pst(st, p) })).sort((p: any, q: any) => q.q.g * 2 + q.q.a - (p.q.g * 2 + p.q.a) || q.q.s - p.q.s || q.q.toi - p.q.toi);
  const G = goalieLine(g, st, tm === g.h);
  const Name = ({ p }: { p: any }) => <td className="pl"><span className="pn"><Html html={avatar(p, 26)} /><span><b>{p.no}</b> {p.n}</span></span></td>;
  return (
    <div className="c an" style={{ marginTop: 12 }}>
      <div className="between"><h3>{x.laBoxScore}</h3><ShareBtn k="box" /></div>
      <div className="seg">
        <button aria-pressed={a.boxSide !== "a"} onClick={() => act((s2) => { s2.boxSide = "h"; })}><Crest name={g.h} size={18} /> {g.h}</button>
        <button aria-pressed={a.boxSide === "a"} onClick={() => act((s2) => { s2.boxSide = "a"; })}><Crest name={g.a} size={18} /> {g.a}</button>
      </div>
      <div style={{ overflowX: "auto" }}>
        <table className="box">
          <thead><tr><th className="pl">{x.laPlayer}</th>{x.laCols.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody>
            {rows.map(({ p, q }: any) => (
              <tr key={p.id} onClick={() => openPlayer(p.id)} style={{ cursor: "pointer" }}>
                <Name p={p} /><td className={q.g ? "hi" : ""}>{q.g}</td><td className={q.a ? "hi" : ""}>{q.a}</td><td>{q.s}</td><td>{q.pm > 0 ? "+" : ""}{q.pm}</td><td>{fmtT(q.toi)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <table className="box" style={{ marginTop: 8 }}>
          <thead><tr><th className="pl">{x.laPos.G}</th>{x.laGcols.map((c: string) => <th key={c}>{c}</th>)}</tr></thead>
          <tbody><tr onClick={() => openPlayer(G.p.id)} style={{ cursor: "pointer" }}><Name p={G.p} /><td>{G.sa}</td><td>{G.sv}</td><td>{G.ga}</td><td>{(G.svp * 100).toFixed(1)}</td><td>{fmtT(G.toi)}</td></tr></tbody>
        </table>
      </div>
      <p className="small muted" style={{ margin: 0 }}>{x.laDemoRoster}</p>
    </div>
  );
}

/* ---------- player page ---------- */
export function Player() {
  const a = useApp();
  const x = s();
  const p = findPlayer(a.overlay!.player!);
  const g = a.overlay!.back ? (findGame(a.overlay!.back) as Game) : null;
  if (!p) return null;
  const m = pModel(p, g);
  const back = () => act((st) => { st.overlay = st.overlay && st.overlay.back ? { id: st.overlay.back } : null; }, { top: true });
  let body: React.ReactNode;
  if (a.pSeg === "stats") body = <div className="c an"><h3>{x.laTonight}</h3><div className="tiles">{m.tiles.map(([k, v]: any) => <div key={k} className="tile"><b>{String(v)}</b><span>{k}</span></div>)}</div></div>;
  else if (a.pSeg === "video") {
    const ev = g ? gs(g.id).ev.filter((e) => e.who && e.who.id === p.id) : [];
    body = ev.length ? (
      <div className="stack">
        {ev.map((e, i) => (
          <div key={i} className="item">
            <span className="tag">{x.aiOk}</span>
            <h4>{x.goal} {e.m}' · {e.score}</h4>
            <Reel id={"pv" + p.id + i} cap={x.reel} color={T[p.team]?.col} scenes={[
              <><div className="big">{x.goal}</div>{g && <div className="row"><Crest name={g.h} size={40} /><span className="d" style={{ fontSize: 22 }}>vs</span><Crest name={g.a} size={40} /></div>}</>,
              <><div className="big" style={{ fontSize: 52, color: "var(--lime)" }}>{e.score}</div><div className="cap">{e.m}' · #{p.no} {p.n}</div></>,
              <div className="cap" style={{ fontSize: 14 }}>#{p.no} {p.n} · {e.team} · {e.score}</div>,
            ]} />
          </div>
        ))}
      </div>
    ) : <div className="c an"><p className="muted" style={{ margin: 0 }}>{x.laNoClips}</p></div>;
  } else if (a.pSeg === "art") body = (
    <div className="item"><span className="tag">{x.aiOk}</span><h4>{p.n} · {x.laTonight}</h4><p style={{ margin: 0 }}>{m.art}</p><div className="row small"><button className="link" onClick={() => toast(x.sent)}>{x.report}</button></div></div>
  );
  else body = (
    <div className="c an">
      <div className="between"><h3>{p.pos === "G" ? x.laPos.G : x.laRingsF[0]}</h3><span className="small muted">{x.laRating}</span></div>
      <Html as="div" className="rings" html={m.rings.map(([v, l]: any) => ring(v, l)).join("")} />
      <Html as="div" className="stack" style={{ gap: 10, marginTop: 6 }} html={m.bars.map((b: any) => mbar(b[0], b[1], b[2], b[3])).join("")} />
    </div>
  );
  return (
    <>
      <Header left={<BackBtn onClick={back} />} />
      {g && inSlot(g.id) && started() && <div className="dsticky"><StickyScore g={g} /></div>}
      <div className="c phero">
        <div style={{ position: "relative" }}><Html html={avatar(p, 112)} /><span style={{ position: "absolute", right: -8, bottom: -4 }}><Crest name={p.team} size={34} /></span></div>
        <h2>{p.n}</h2>
        <div className="small muted">#{p.no} · {x.laPos[p.pos]} · {p.team}</div>
        <ShareBtn k="player" />
      </div>
      <div style={{ marginTop: 12 }}>
        <Seg items={x.laPtabs.map((t: string, i: number) => [["data", "stats", "video", "art"][i], t])} value={a.pSeg} onPick={(k: any) => act((st) => { st.pSeg = k; })} />
      </div>
      <div style={{ marginTop: 12 }}>{body}</div>
      <p className="small muted">{x.laDemoRoster}</p>
    </>
  );
}

export { McCard, tf, roster, useState };
