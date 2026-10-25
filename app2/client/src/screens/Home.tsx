/** Home: live widgets, then "My teams / My league / My town" feeds. */
import { useEffect, useRef, useState } from "react";
import { GAMES, RESULTS, STAND, T, TEAMS } from "../lib/data";
import { IC } from "../lib/icons";
import { live, slot, started, startLive } from "../lib/live";
import { estL, playPod, pod, reels, toggleReel, type Line } from "../lib/media";
import { act, app, s, toast, useApp } from "../lib/state";
import { C, DEMO_R, NL, ctx, fDate, juniorLead, juniorLine, leagueLine, plain, story } from "../lib/stories";
import { TODAY, dayName, isPrem, nextGame, posOf, teamRes, tf, weekFrom } from "../lib/util";
import { AdCard, AutoItem, McCard, Scoreboard, StoryBody, Teaser, openGame } from "../components/cards";
import { Crest, Html, Icon, Lock, Seg, Toks, openPaywall } from "../components/ui";

export function Home() {
  const a = useApp();
  const x = s();
  const sl = live.slot && started() ? live.slot : slot();
  const when = sl ? (sl.d === TODAY ? `${x.today} · ${sl.t}` : `${dayName(sl.d, { weekday: "short", day: "numeric", month: "numeric" })} · ${sl.t}`) : "";
  return (
    <>
      {sl && (
        <>
          <div className="between"><span className="l">{started() ? x.liveNow : x.upNext} · {when}</span><span className="small muted">{sl.games.length} ×</span></div>
          <div className="widgets" style={{ marginTop: 10 }}>
            {(isPrem() ? sl.games : sl.games.slice(0, 1)).map((g) => <Scoreboard key={g.id} g={g} />)}
            {!isPrem() && sl.games.length > 1 && <Teaser><span>{x.moreLive(sl.games.length - 1)}</span></Teaser>}
          </div>
          {live.on ? (
            <button className="btn" style={{ marginTop: 10 }} onClick={() => openGame(sl.games[0].id)}>{x.laOpen}</button>
          ) : (
            <button className="btn lime" style={{ marginTop: 10 }} onClick={startLive}>{x.goLive} · {sl.games.length}</button>
          )}
          <p className="small muted">{x.demo}</p>
        </>
      )}
      <div style={{ marginTop: 12 }}>
        <Seg items={[["teams", x.feedTeams], ["league", x.feedLeague], ["town", x.feedTown]]} value={a.feedSeg}
          onPick={(k) => act((st) => { st.feedSeg = k; try { localStorage.setItem("fu2.feed", JSON.stringify(k)); } catch { /* ignore */ } })} />
      </div>
      {a.P.notif.weekly && a.feedSeg === "teams" && (
        <button className="weekcard" onClick={() => act((st) => { st.overlay = { week: 1 }; }, { top: true })}>
          <Html html={IC.summary} />
          <span className="grow"><b>{x.weekH}</b><span className="small muted">{x.weekOpen}</span></span>›
        </button>
      )}
      <div className="stack feed-grid" style={{ marginTop: 10 }}>
        {a.feedSeg === "league" ? <LeagueFeed /> : a.feedSeg === "town" ? <TownFeed /> : <TeamsFeed />}
      </div>
    </>
  );
}

function TeamsFeed() {
  const a = useApp();
  const x = s();
  return (
    <>
      {a.P.teams.map((tm, ti) => {
        const fm = tf(tm);
        const act0 = fm.includes(a.openFmt[tm]) ? a.openFmt[tm] : fm[0];
        return (
          <div key={tm} className="feed-item">
            <section className="c tsec" style={{ ["--tc" as any]: T[tm]?.col }}>
              <div className="tsec-h"><Crest name={tm} size={34} /><b>{tm}</b><span className="pos">{x.place} {posOf(tm)}</span></div>
              <StakesCard tm={tm} />
              <div className="fmts" role="tablist">
                {fm.map((k) => (
                  <button key={k} className="fbtn" role="tab" aria-pressed={act0 === k} onClick={() => act((st) => { st.openFmt[tm] = k; })}>
                    <Icon k={k} />{x.fmt[k]}
                  </button>
                ))}
                {!isPrem() && (["video", "podcast"] as const).map((k) => (
                  <button key={k} className="fbtn locked" onClick={openPaywall}><Lock />{x.fmt[k]}</button>
                ))}
              </div>
              {fm.length > 1 && <span className="hint">{x.tapFmt}</span>}
              {act0 === "video" ? <VideoBlock tm={tm} /> : act0 === "podcast" ? <PodBlock tm={tm} /> : <SummaryCard tm={tm} />}
            </section>
            <AdCard i={ti} />
          </div>
        );
      })}
    </>
  );
}

/** "What's at stake": table position meter + why it matters (+ what-if for Premium). */
export function StakesCard({ tm }: { tm: string }) {
  const x = s();
  const c = ctx(tm, app.P.lang);
  if (!c || !c.hasTable) return null;
  const W = NL[app.P.lang];
  return (
    <div className="stk">
      <div className="between"><span className="l">{x.stakes}</span>{!isPrem() && <span className="spons">{x.stakesBy} <b>Continental</b></span>}</div>
      <div className="meter" aria-hidden="true">{STAND.map((z, i) => <i key={z[0]} className={`${i < 6 ? "z6" : ""} ${z[0] === tm ? "me" : ""}`} />)}</div>
      <div className="between small muted"><span>1.</span><span>{x.top6}</span><span>{STAND.length}.</span></div>
      <p style={{ margin: "6px 0 0" }}><Toks toks={W.why(c)} /></p>
      {isPrem() ? <p className="small" style={{ margin: "4px 0 0" }}><Toks toks={W.scen(c)} /></p> : <Teaser style={{ marginTop: 8 }}><span>{x.premDeep}</span></Teaser>}
    </div>
  );
}

export function LenToneCtl() {
  const a = useApp();
  const x = s();
  if (!isPrem())
    return (
      <div className="ltc">
        <button className="teaser" onClick={openPaywall}><Lock /><span className="grow"><b>{x.fixSumH}</b><br /><span className="small muted">{x.fixSumD}</span></span></button>
      </div>
    );
  return (
    <div className="ltc">
      <Seg small items={[["short", x.lenS], ["medium", x.lenM], ["deep", x.lenD]]} value={a.P.len} onPick={(k) => act((st) => { st.P.len = k; }, { persist: true })} />
      <div className="row tch">
        {Object.entries(x.tones as Record<string, string>).map(([k, n]) => (
          <button key={k} className="chip sm" aria-pressed={a.P.tone === k} onClick={() => act((st) => { st.P.tone = k as any; }, { persist: true })}>{n}</button>
        ))}
      </div>
    </div>
  );
}

const isQuiet = (st: any) => st.c.r.d <= weekFrom();

function SummaryCard({ tm }: { tm: string }) {
  const x = s();
  const len = isPrem() ? app.P.len : "medium";
  const st = story(tm, { len, tone: isPrem() ? app.P.tone : "neutral" });
  if (!st) return <p className="small muted">–</p>;
  if (isQuiet(st)) {
    const ng = nextGame(tm);
    return (
      <div className="item">
        <span className="tag">{x.labAuto}</span>
        <p style={{ margin: 0 }}>{x.quiet(fDate(st.c.r.d, app.P.lang), ng ? `${ng.h} – ${ng.a}, ${fDate(ng.d, app.P.lang)} ${ng.t}` : "")}</p>
      </div>
    );
  }
  return (<><LenToneCtl /><StoryBody st={st} label={x.labAuto} /></>);
}

/* ---------- podcast: daily episodes with two voices ---------- */
function epLines(tm: string, rid: string | undefined, today: boolean) {
  const x = s();
  const st = story(tm, { len: "deep", tone: "neutral", rid });
  if (!st) return null;
  const lines: Line[] = [];
  if (today && !isPrem()) lines.push({ h: 0, t: x.podSp });
  lines.push({ h: 0, t: today ? x.podIntro(tm) : x.podRecap(tm, fDate(st.c.r.d, app.P.lang)) });
  st.body.forEach((b: any, i: number) => lines.push({ h: ((i + 1) % 2) as 0 | 1, t: plain(b) }));
  if (st.why) lines.push({ h: ((st.body.length + 1) % 2) as 0 | 1, t: x.why + ": " + plain(st.why) });
  lines.push({ h: 0, t: x.podOutro });
  return { st, lines };
}

function PodBlock({ tm }: { tm: string }) {
  useApp();
  const x = s();
  const all = teamRes(tm);
  if (!all.length) return null;
  const eps = [{ id: "ep:" + tm + ":today", today: true, rid: undefined as string | undefined }, ...all.slice(-3, -1).reverse().map((r) => ({ id: "ep:" + tm + ":" + r.id, today: false, rid: r.id }))];
  return (
    <>
      <div className="l" style={{ margin: "4px 0 2px" }}>{x.epH}</div>
      {eps.map((e) => {
        const d = epLines(tm, e.rid, e.today);
        if (!d) return null;
        const title = e.today ? x.epToday : x.epRecap(fDate(d.st.c.r.d, app.P.lang));
        if (!isPrem()) return <button key={e.id} className="ep locked" onClick={openPaywall}><Lock /><span className="grow"><b>{title}</b></span><span className="small muted">{x.epLocked}</span></button>;
        const on = pod.id === e.id && pod.on;
        const tr = pod.transcript[e.id];
        return (
          <div key={e.id} className={`ep ${on ? "playing" : ""}`}>
            <div className="pod">
              <button className="playbtn" aria-label={on ? x.pause : x.play} onClick={() => playPod(e.id, { lines: d.lines })}><Html html={on ? IC.pause : IC.play} /></button>
              <div className="stack" style={{ gap: 6, minWidth: 0 }}>
                <div className="between"><b className="small">{title}</b><span className="small muted">~{Math.round(estL(d.lines))} s</span></div>
                <span className="vsw" role="group" aria-label={x.voice}>
                  {(["female", "male"] as const).map((v) => (
                    <button key={v} aria-pressed={app.P.voice === v} onClick={() => { act((st) => { st.P.voice = v; }, { persist: true }); if (on) { playPod(e.id, { lines: d.lines }); playPod(e.id, { lines: d.lines }); } }}>{x[v]}</button>
                  ))}
                </span>
                <div className="wave">{Array.from({ length: 24 }, (_, i) => <i key={i} style={{ height: 6 + ((i * 37) % 16), animationDelay: `${(i % 8) * 0.1}s` }} />)}</div>
                <div className="bar"><span style={{ width: on ? pod.progress * 100 + "%" : 0 }} /></div>
              </div>
            </div>
            {tr && (on || pod.id === null) && (
              <div className="transcript">
                {!tr.ok && <><b>{x.noVoice}</b><br /></>}
                {(tr.lines || []).map((l, i) => <div key={i}><b>{l.h ? x.hostB : x.hostA}:</b> {l.t}</div>)}
              </div>
            )}
          </div>
        );
      })}
      <p className="small muted" style={{ margin: "6px 0 0" }}>{x.labAuto}{isPrem() ? "" : " · " + x.ad + ": iLOQ"}</p>
    </>
  );
}

/* ---------- data short: vertical video built only from data, with a voice-over ---------- */
export function VideoBlock({ tm }: { tm: string }) {
  useApp();
  const x = s();
  const st = story(tm, { len: "short", tone: app.P.tone === "kids" ? "kids" : "neutral" });
  if (!st) return null;
  const c = ctx(tm, app.P.lang);
  const r = c.r;
  const LT = ({ en: ["W", "L"], fi: ["V", "H"], sv: ["V", "F"] } as any)[app.P.lang];
  const W = NL[app.P.lang];
  const scenes = [
    <><div className="cap">{x.lastGame} · {fDate(r.d, app.P.lang)}</div><div className="row" style={{ gap: 10 }}><Crest name={r.h} size={46} /><span className="big" style={{ fontSize: 44 }}>{r.hs}–{r.as}</span><Crest name={r.a} size={46} /></div><div className="cap">{plain(st.title)}</div></>,
    <><div className="cap">{x.formL}</div><div className="fdots">{c.letters.map((w: boolean, i: number) => <i key={i} className={w ? "w" : "l"}>{w ? LT[0] : LT[1]}</i>)}</div><div className="cap">{plain(W.form(c, "neutral"))}</div></>,
    c.hasTable ? <><div className="cap">{x.tableL}</div><div className="big" style={{ fontSize: 76, color: "var(--lime)" }}>{c.pos.v}</div><div className="cap">{plain(W.why(c))}</div></> : null,
    c.ng ? <><div className="cap">{x.nextL}</div><div className="row" style={{ gap: 10 }}><Crest name={c.ng.h} size={46} /><span className="d" style={{ fontSize: 22 }}>vs</span><Crest name={c.ng.a} size={46} /></div><div className="cap">{c.nd.v} · {c.nt.v}</div></> : null,
    <><div className="big" style={{ fontSize: 34 }}>Fin<span style={{ color: "var(--lime)" }}>Urheilu</span></div><div className="cap">{x.madeFrom}</div><div className="cap">{x.labAuto}</div></>,
  ].filter(Boolean);
  const vo = [plain(st.title), ...st.body.map(plain), st.why ? plain(st.why) : ""].filter(Boolean).join(". ").replace(/[.!]\./g, (m) => m[0]);
  const id = "sv:" + tm;
  return <Reel id={id} scenes={scenes} vo={vo} color={T[tm]?.col} cap={x.shortCap} share={tm} short />;
}

const FS_LABEL: Record<string, string> = { fi: "Koko näyttö", en: "Full screen", sv: "Helskärm" };
const FS_EXIT: Record<string, string> = { fi: "Poistu koko näytöstä", en: "Exit full screen", sv: "Avsluta helskärm" };

export function Reel({ id, scenes, vo, color, cap, share, short }: { id: string; scenes: React.ReactNode[]; vo?: string; color?: string; cap: string; share?: string; short?: boolean }) {
  useApp();
  const x = s();
  const r = reels[id] || { i: 0, on: false, dur: 3000 };
  const shareTeam = async () => {
    const st = story(share!, { len: "short", tone: "neutral" });
    if (!st) return;
    const text = st.text + " #FinUrheilu";
    try { if (navigator.share) { await navigator.share({ title: "FinUrheilu", text }); return; } } catch (e: any) { if (e?.name === "AbortError") return; }
    try { await navigator.clipboard.writeText(text); toast(x.shared); } catch { act((a) => { a.pop = { kind: "share", payload: text }; }); }
  };
  // Full screen: the browser's real full-screen mode where allowed, otherwise the video fills the window (iPhone).
  const ref = useRef<HTMLDivElement>(null);
  const [fake, setFake] = useState(false);
  const [real, setReal] = useState(false);
  useEffect(() => {
    const on = () => setReal(((document as any).fullscreenElement || (document as any).webkitFullscreenElement) === ref.current && !!ref.current);
    document.addEventListener("fullscreenchange", on); document.addEventListener("webkitfullscreenchange", on);
    return () => { document.removeEventListener("fullscreenchange", on); document.removeEventListener("webkitfullscreenchange", on); };
  }, []);
  useEffect(() => {
    if (!fake) return;
    document.documentElement.style.overflow = "hidden";
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setFake(false); };
    document.addEventListener("keydown", esc);
    return () => { document.documentElement.style.overflow = ""; document.removeEventListener("keydown", esc); };
  }, [fake]);
  const isFs = fake || real;
  const toggleFs = (e: React.MouseEvent) => {
    e.stopPropagation();
    const el = ref.current as any; const d = document as any;
    if (fake) { setFake(false); return; }
    if (real) { const ex = d.exitFullscreen || d.webkitExitFullscreen; try { ex?.call(d)?.catch?.(() => {}); } catch { /* ignore */ } return; }
    const rq = el?.requestFullscreen || el?.webkitRequestFullscreen;
    if (!rq) setFake(true);
    else try { rq.call(el)?.catch?.(() => setFake(true)); } catch { setFake(true); }
    if (!r.on) toggleReel(id, scenes.length, vo);
  };
  const fsLabel = (isFs ? FS_EXIT : FS_LABEL)[app.P.lang] || FS_LABEL.en;
  const body = (
    <div ref={ref} className={`reel ${short ? "short" : ""} ${r.on ? "playing" : ""} ${fake ? "fsx" : ""}`} style={{ ["--ra" as any]: color || "#2F80FF", ["--sd" as any]: r.dur + "ms" }} role="button" aria-label={x.play} onClick={() => toggleReel(id, scenes.length, vo)}>
      <div className="bars">{scenes.map((_, i) => <i key={i + "-" + (i === r.i ? r.i + String(r.on) : "")} className={i < r.i ? "done" : i === r.i ? "on" : ""}><b /></i>)}</div>
      <span className="bd">{cap}</span>
      {!short && <><div className="ice" /><div className="rp" /></>}
      {scenes.map((z, i) => <div key={i} className={`scene ${i === r.i ? "on" : ""}`}>{z}</div>)}
      <button type="button" className="fsb" title={fsLabel} aria-label={fsLabel} onClick={toggleFs}>
        {isFs
          ? <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
          : <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
      </button>
      <div className="ov"><span><Html html={IC.play.replace("<svg", '<svg width="24" height="24"')} /></span></div>
    </div>
  );
  if (!short) return body;
  return (
    <div className="shortwrap">
      {body}
      <div className="row"><button className="smallbtn" onClick={shareTeam}>{x.share} ↗</button><span className="small muted">{x.madeFrom}</span></div>
    </div>
  );
}

/* ---------- My league ---------- */
function LeagueFeed() {
  const a = useApp();
  const x = s();
  const L = a.P.lang;
  const six = STAND[5]?.[2] ?? 0;
  const dates = [...new Set(RESULTS.map((r) => r.d))].sort().slice(-2);
  const lr = RESULTS.filter((r) => dates.includes(r.d)).slice().reverse();
  return (
    <>
      <section className="c pt">
        <div className="between"><span className="l">{x.raceH}</span><span className="small muted">{x.raceSub}</span></div>
        <table className="rt race"><tbody>
          {STAND.slice(2, 10).map((z, i) => {
            const p = i + 3, d = z[2] - six;
            return (
              <tr key={z[0]} className={`${a.P.teams.includes(z[0]) ? "me" : ""} ${p === 6 ? "cut" : ""}`}>
                <td>{p}.</td><td><span className="tcell"><Crest name={z[0]} size={20} />{z[0]}</span></td><td className="n"><b>{z[2]}</b></td>
                <td className={`n small ${d > 0 ? "okc" : d < 0 ? "badc" : ""}`}>{d > 0 ? "+" + d : d < 0 ? "−" + -d : "0"} {x.gapTo6}</td>
              </tr>
            );
          })}
        </tbody></table>
        <p className="small muted" style={{ margin: 0 }}>{x.srcStand}</p>
      </section>
      <div className="l">{x.latestH}</div>
      {lr.map((r) => <AutoItem key={r.id} it={leagueLine(r, L)} tag={x.autoTag} />)}
      <AdCard i={1} />
    </>
  );
}

/* ---------- My town ---------- */
function TownFeed() {
  const a = useApp();
  const x = s();
  const L = a.P.lang;
  const cities = [...new Set(TEAMS.map((t) => t.city).filter(Boolean))].sort((p, q) => p.localeCompare(q, "fi"));
  const town = a.P.town || (T[a.P.teams[0]] && T[a.P.teams[0]].city) || "Oulu";
  const mine = TEAMS.filter((t) => t.city === town).map((t) => t.name);
  const jl = juniorLead(L);
  (jl as any).id = "jl";
  return (
    <>
      <div className="l">{x.townPick}</div>
      <div className="row" style={{ flexWrap: "wrap", gap: 6 }}>
        {cities.map((cty) => <button key={cty} className="chip sm" aria-pressed={cty === town} onClick={() => act((st) => { st.P.town = cty; }, { persist: true })}>{cty}</button>)}
      </div>
      <section className="c pt">
        <span className="l">{x.townLiiga(town)}</span>
        {mine.map((tm) => {
          const lr = teamRes(tm).slice(-1)[0];
          const ng = nextGame(tm);
          return (
            <div key={tm}>
              <div className="tsec-h" style={{ marginTop: 6 }}><Crest name={tm} size={28} /><b>{tm}</b><span className="pos">{x.place} {posOf(tm)}</span></div>
              {lr && <AutoItem it={leagueLine(lr, L)} tag={x.autoTag} />}
              {ng && <McCard g={ng} res={false} />}
            </div>
          );
        })}
      </section>
      {town === "Oulu" ? (
        <section className="c pt junior">
          <span className="l">{x.junH}</span>
          <p className="small muted" style={{ margin: 0 }}>{x.junNote}</p>
          <AutoItem it={jl} tag={x.junAuto} />
          {DEMO_R.slice().reverse().map((r) => <AutoItem key={r.id} it={juniorLine(r, L)} tag={x.junAuto} />)}
        </section>
      ) : (
        <p className="small muted">{x.townNoJun}</p>
      )}
    </>
  );
}

export { GAMES, C };
