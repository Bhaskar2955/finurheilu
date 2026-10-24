/** Calendar, Teams/standings, Profile, Notifications, Weekly roundup and the Community tab. */
import { AZ, DATA_INFO, GAMES, RESULTS, SOURCES, STAND, T, loadData } from "../lib/data";
import { appwriteOn, logout as awLogout } from "../lib/appwrite";
import { IC } from "../lib/icons";
import { live } from "../lib/live";
import { stopAllMedia } from "../lib/media";
import { DEF, act, app, emit, ls, s, toast, useApp } from "../lib/state";
import { weekStory } from "../lib/stories";
import { LANGS, LOC, PRICE, TODAY, addPeriod, applyMode, dayName, eur, fmtD, iso, isPrem, posOf, weekTo } from "../lib/util";
import { FcBtn, McCard, openGame } from "../components/cards";
import { FmtButtons, VoicePick } from "../components/prefs";
import { BackBtn, Crest, Flag, Header, Html, Lock, Seg, Toks, openPaywall } from "../components/ui";
import { LenToneCtl } from "./Home";

/* ---------- Calendar ---------- */
export function Calendar() {
  const a = useApp();
  const x = s();
  if (!a.calTeam || !a.P.teams.includes(a.calTeam)) a.calTeam = a.P.teams[0];
  if (!a.calMonth) a.calMonth = TODAY.slice(0, 7);
  if (!a.calSel) a.calSel = TODAY;
  const cal = a.calTeam!;
  const [Y, M] = a.calMonth.split("-").map(Number);
  const first = new Date(Y, M - 1, 1);
  const off = (first.getDay() + 6) % 7;
  const start = new Date(Y, M - 1, 1 - off);
  const rows = Math.ceil((off + new Date(Y, M, 0).getDate()) / 7);
  const all = [...RESULTS.map((r) => ({ ...r, res: 1 as const })), ...GAMES].filter((g) => g.h === cal || g.a === cal);
  const byDay: Record<string, any> = Object.fromEntries(all.map((g) => [g.d, g]));
  const cells: React.ReactNode[] = [];
  for (let i = 0; i < rows * 7; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const k = iso(d);
    const g = byDay[k];
    const opp = g ? (g.h === cal ? g.a : g.h) : null;
    let rs: React.ReactNode = null;
    if (g && g.res) { const won = g.h === cal ? g.hs > g.as : g.as > g.hs; rs = <span className={`rs ${won ? "w" : "l"}`}>{won ? "W" : "L"} {g.hs}–{g.as}</span>; }
    cells.push(
      <button key={k} className={`cday ${d.getMonth() !== M - 1 ? "out" : ""} ${k === a.calSel ? "sel" : ""} ${k === TODAY ? "today" : ""} ${g && g.h === cal ? "home" : ""}`}
        aria-label={`${dayName(k)}${g ? ": " + g.h + " – " + g.a : ""}`} onClick={() => act((st) => { st.calSel = k; })}>
        <span className="n">{d.getDate()}</span>{opp && <Crest name={opp} size={20} />}{rs}
      </button>,
    );
  }
  const sel = byDay[a.calSel];
  const monthName = first.toLocaleDateString(LOC[a.P.lang], { month: "long", year: "numeric" });
  const move = (n: number) => act((st) => { st.calMonth = iso(new Date(Y, M - 1 + n, 1)).slice(0, 7); });
  return (
    <>
      <h2 className="title">{x.cal}</h2>
      <div className="l" style={{ marginTop: 12 }}>{x.calFor}</div>
      <div className="row" style={{ marginTop: 8 }}>
        {a.P.teams.map((tm) => <button key={tm} className="chip" aria-pressed={cal === tm} onClick={() => act((st) => { st.calTeam = tm; })}><Crest name={tm} size={16} />{tm}</button>)}
      </div>
      <div className="cal-layout">
        <div style={{ marginTop: 12 }}>
          <div className="calhead"><button aria-label="‹" onClick={() => move(-1)}>‹</button><b>{monthName}</b><button aria-label="›" onClick={() => move(1)}>›</button></div>
          <div className="cal">{x.wd.map((w: string) => <div key={w} className="wd">{w}</div>)}{cells}</div>
          <p className="small muted">{x.legend}</p>
        </div>
        <div className="c calinfo">
          <div className="big">{dayName(a.calSel, { weekday: "short", day: "numeric", month: "numeric", year: "numeric" })}</div>
          {sel ? (
            <>
              {sel.t && <div className="big">{sel.t}</div>}
              <div className="mt">{sel.h}–{sel.a}{sel.res ? ` · ${sel.hs}–${sel.as}${sel.x ? " " + sel.x : ""}` : ""}</div>
              <div className="small muted">{sel.h === cal ? x.home : x.away} · {T[sel.h]?.city}</div>
              <button className="btn" style={{ marginTop: 6 }} onClick={() => openGame(sel.id)}>{x.open}</button>
            </>
          ) : <p className="muted" style={{ margin: 0 }}>{x.noMatch}</p>}
        </div>
      </div>
    </>
  );
}

/* ---------- Teams / standings ---------- */
const toggleTeam = (n: string) => {
  const x = s();
  if (app.P.teams.includes(n)) {
    if (app.P.teams.length === 1) { toast(x.pickTeam); return; }
    act((st) => { st.P.teams = st.P.teams.filter((t) => t !== n); }, { persist: true });
    return;
  }
  if (!isPrem() && app.P.teams.length >= 4) { toast(x.maxTeams); openPaywall(); return; }
  act((st) => { st.P.teams = [...st.P.teams, n]; if (!st.P.tf[n]) st.P.tf[n] = ["summary"]; }, { persist: true });
};

export function Teams() {
  const a = useApp();
  const x = s();
  return (
    <>
      <h2 className="title">{x.teams}</h2>
      <div style={{ marginTop: 12 }}><Seg items={[["stand", x.stand], ["az", "A–Ö"]]} value={a.tSeg} onPick={(k) => act((st) => { st.tSeg = k; })} /></div>
      {a.tSeg === "stand" ? (
        <>
          <div className="c" style={{ marginTop: 12, padding: "6px 8px", overflowX: "auto" }}>
            <table className="st">
              <thead><tr><th>#</th><th>{x.teams}</th><th className="n">{x.gp}</th><th className="n">{x.ptsH}</th></tr></thead>
              <tbody>
                {STAND.map((r, i) => (
                  <tr key={r[0]} className={`${a.P.teams.includes(r[0]) ? "me" : ""} ${i === 5 ? "cut" : ""}`}>
                    <td>{i + 1}</td><td><span className="tcell"><Crest name={r[0]} size={20} />{r[0]}</span></td><td className="n">{r[1]}</td><td className="n"><b>{r[2]}</b></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small muted">{x.cut} · <a href={SOURCES[0]?.[1]} target="_blank" rel="noopener">{DATA_INFO.mode === "sample" ? x.src : `${SOURCES[0]?.[0]} · ${fmtD(DATA_INFO.fetchedAt.slice(0, 10))}`}</a></p>
        </>
      ) : (
        <div className="tlist" style={{ marginTop: 12 }}>
          {AZ.map((t) => (
            <button key={t.name} className="trow" aria-pressed={a.P.teams.includes(t.name)} onClick={() => toggleTeam(t.name)}>
              <Crest name={t.name} size={30} />
              <span className="grow"><b>{t.name}</b><span className="small muted">{t.city} · {x.place} {posOf(t.name)}</span></span>
              <span className="check">{a.P.teams.includes(t.name) && <Html html={IC.check} />}</span>
            </button>
          ))}
        </div>
      )}
    </>
  );
}

/* ---------- Profile ---------- */
function SubBlock() {
  const a = useApp();
  const x = s();
  const u = a.P.user || {};
  const b = a.P.sub || { plan: "free" };
  const pr = isPrem();
  const ini = (u.name || "F").trim()[0]?.toUpperCase() || "F";
  const renew = () => act((st) => { const bb = st.P.sub; const base = bb.renew && bb.renew > TODAY ? bb.renew : TODAY; bb.renew = addPeriod(base, bb.billing); bb.auto = true; bb.hist = [...(bb.hist || []), { d: TODAY, b: bb.billing! }]; toast(x.renewed(fmtD(bb.renew))); }, { persist: true });
  return (
    <>
      <div className="c pcard" style={{ marginTop: 12 }}>
        <div className="av">{ini}</div>
        <div className="grow"><b>{u.name || x.fan}</b><div className="small muted">{u.email || ""}</div><div className="small muted">{x.points}: {a.P.points || 0}</div></div>
        <span className={`pbadge ${pr ? "prem" : ""}`}>{pr ? x.premium : x.free}</span>
      </div>
      {pr && !b.auto && (
        <div className="banner" style={{ marginTop: 12 }}>
          <Html html={IC.bell.replace("<svg", '<svg width="20" height="20"')} />
          <span className="grow">{x.endBanner(fmtD(b.renew))}</span>
          <button className="smallbtn add" onClick={renew}>{x.renewNow}</button>
        </div>
      )}
      <div className="l" style={{ marginTop: 18 }}>{x.subH}</div>
      <div className="c" style={{ marginTop: 8 }}>
        <div className="set">
          <span className="grow"><b>{pr ? x.premium : x.free}</b><div className="small muted">{pr ? `${eur(PRICE[b.billing || "monthly"])} ${b.billing === "annual" ? x.perYr : x.perMo} · ${b.auto ? x.renews(fmtD(b.renew)) : x.ends(fmtD(b.renew))}` : "0 €"}</div></span>
          {pr ? <button className="smallbtn" onClick={renew}>{x.renewNow}</button> : <button className="smallbtn add" onClick={openPaywall}>{x.upgrade}</button>}
        </div>
        {pr && (
          <div className="set"><span className="grow">{x.autoRenew}</span>
            <button className="tgl" aria-pressed={!!b.auto} aria-label={x.autoRenew} onClick={() => act((st) => { st.P.sub.auto = !st.P.sub.auto; toast(st.P.sub.auto ? x.renews(fmtD(st.P.sub.renew)) : x.cancelled); }, { persist: true })} />
          </div>
        )}
        <button className="set" onClick={openPaywall}><span className="grow">{x.changePlan}</span>›</button>
        {pr && <button className="set" onClick={() => act((st) => { st.P.sub = { plan: "free", hist: st.P.sub.hist || [] }; if (st.P.teams.length > 4) st.P.teams = st.P.teams.slice(0, 4); toast(x.toFree); }, { persist: true })}><span className="grow" style={{ color: "var(--red)" }}>{x.toFreeBtn}</span>›</button>}
      </div>
      <div className="l" style={{ marginTop: 18 }}>{x.offers}</div>
      <div className="c" style={{ marginTop: 8 }}>
        {!pr && <button className="upsell" onClick={openPaywall}><span className="ui">★</span><span className="grow"><b>{x.upPrem}</b><div className="small muted">{x.upPremB}</div></span>›</button>}
        {pr && b.billing === "monthly" && (
          <button className="upsell" onClick={() => act((st) => { const bb = st.P.sub; bb.billing = "annual"; bb.renew = addPeriod(TODAY, "annual"); bb.auto = true; bb.hist = [...(bb.hist || []), { d: TODAY, b: "annual" }]; toast(x.switched); }, { persist: true })}>
            <span className="ui" style={{ background: "var(--lime)", color: "#08111F" }}>%</span><span className="grow"><b>{x.upAnnual}</b><div className="small muted">{x.upAnnualB}</div></span>›
          </button>
        )}
        {!pr && <a className="upsell" href="https://www.mtv.fi/" target="_blank" rel="noopener"><span className="ui" style={{ background: "#c8102e" }}>TV</span><span className="grow"><b>{x.upMTV}</b><div className="small muted">{x.upMTVB} · {x.partner}</div></span>↗</a>}
      </div>
      {b.hist && b.hist.length > 0 && (
        <>
          <div className="l" style={{ marginTop: 18 }}>{x.billing}</div>
          <div className="c" style={{ marginTop: 8 }}>
            {b.hist.slice().reverse().map((h, i) => <div key={i} className="hist"><span>{fmtD(h.d)} · Premium {h.b === "annual" ? x.annual : x.monthly}</span><span>{h.trial ? x.trialTag + " · 0 €" : eur(PRICE[h.b as "monthly" | "annual"])}</span></div>)}
          </div>
        </>
      )}
    </>
  );
}

export function Profile() {
  const a = useApp();
  const x = s();
  const avail = AZ.filter((t) => !a.P.teams.includes(t.name));
  const dataLabel = DATA_INFO.mode === "live" ? x.dataLive : DATA_INFO.mode === "cache" ? x.dataCache : x.dataSample;
  return (
    <>
      <h2 className="title">{x.profile}</h2>
      <div className="profile-grid">
        <div>
          <SubBlock />
          {a.P.sub?.via === "kaleva" && <div className="banner" style={{ marginTop: 12 }}><span className="ui kal">K</span><span className="grow"><b>{x.kalevaOn}</b><div className="small muted">{x.kalevaB}</div></span></div>}
          <div className="l" style={{ marginTop: 18 }}>{x.yourSum}</div>
          <div className="c pt" style={{ marginTop: 8 }}><p className="small muted" style={{ margin: 0 }}>{x.yourSumB}</p><LenToneCtl /></div>
          <div className="l" style={{ marginTop: 18 }}>{x.following} · {a.P.teams.length}</div>
          <div className="c" style={{ marginTop: 8 }}>
            {a.P.teams.map((tm) => (
              <div key={tm} className="fol">
                <div className="between"><span className="row"><Crest name={tm} size={26} /><b>{tm}</b></span><button className="smallbtn" onClick={() => toggleTeam(tm)}>{x.unfollow}</button></div>
                <FmtButtons tm={tm} />
              </div>
            ))}
          </div>
          <div className="l" style={{ marginTop: 18 }}>{x.available} · {avail.length}</div>
          <div className="c" style={{ marginTop: 8 }}>
            {avail.map((t) => (
              <div key={t.name} className="set"><Crest name={t.name} size={24} /><span className="grow"><b>{t.name}</b> <span className="small muted">{t.city}</span></span><button className="smallbtn add" onClick={() => toggleTeam(t.name)}>+ {x.follow}</button></div>
            ))}
          </div>
        </div>
        <div>
          <div className="l" style={{ marginTop: 18 }}>{x.voice}</div>
          <div style={{ marginTop: 8 }}><VoicePick /></div>
          <div className="l" style={{ marginTop: 18 }}>{x.appear}</div>
          <div className="seg" style={{ marginTop: 8 }}>
            {(["dark", "light", "system"] as const).map((m) => (
              <button key={m} aria-pressed={(a.P.mode || "system") === m} onClick={() => act((st) => { st.P.mode = m; applyMode(); }, { persist: true })}>
                {m !== "system" && <Html html={(m === "dark" ? IC.moon : IC.sun).replace("<svg", '<svg width="14" height="14" style="vertical-align:-2px"')} />} {x[m]}
              </button>
            ))}
          </div>
          <div className="l" style={{ marginTop: 18 }}>{x.lang}</div>
          <div className="c" style={{ marginTop: 8 }}>
            {LANGS.map(([k, n]) => (
              <div key={k} className="set"><Flag l={k} w={30} h={20} /><span className="grow">{n}</span><button className="tgl" aria-pressed={a.P.lang === k} aria-label={n} onClick={() => act((st) => { st.P.lang = k; document.documentElement.lang = k; }, { persist: true })} /></div>
            ))}
          </div>
          <div className="l" style={{ marginTop: 18 }}>{x.notifs}</div>
          <div className="c" style={{ marginTop: 8 }}>
            {([["match", x.nMatch], ["weekly", x.nWeekly], ["player", x.nPlayer]] as const).map(([k, n]) => (
              <div key={k} className="set"><span className="grow">{n}</span><button className="tgl" aria-pressed={!!a.P.notif[k]} aria-label={n} onClick={() => act((st) => { st.P.notif[k] = !st.P.notif[k]; }, { persist: true })} /></div>
            ))}
          </div>
          <div className="l" style={{ marginTop: 18 }}>{x.dataH}</div>
          <div className="c" style={{ marginTop: 8 }}>
            <div className="set"><span className="grow"><b>{dataLabel}</b><div className="small muted">{DATA_INFO.fetchedAt ? x.dataAt(new Date(DATA_INFO.fetchedAt).toLocaleString(LOC[a.P.lang], { dateStyle: "short", timeStyle: "short" })) : ""}{DATA_INFO.note ? " · " + DATA_INFO.note : ""}</div></span>
              <button className="smallbtn" onClick={async () => { await fetch("/api/data?refresh=1").catch(() => null); await loadData(); emit(); toast(x.refresh + " ✓"); }}>{x.refresh}</button>
            </div>
            <div className="set"><span className="grow small muted">Appwrite: {appwriteOn ? x.awSaved : x.awDemo}</span></div>
          </div>
          <div className="l" style={{ marginTop: 18 }}>{x.settings}</div>
          <div className="c" style={{ marginTop: 8 }}>
            <button className="set" onClick={() => act((st) => { st.P.screen = "splash"; }, { persist: true, top: true })}><span className="grow">{x.restart}</span>›</button>
            <button className="set" onClick={() => { ls.clear(); act((st) => { st.P = DEF(); st.overlay = null; }, { top: true }); }}><span className="grow">{x.clear}</span>›</button>
            <div className="set"><span className="grow">{x.about}</span><span className="small muted">{x.version} 2.0.0</span></div>
          </div>
          <div className="c" style={{ marginTop: 12, padding: 12 }}>
            <div className="stack" style={{ gap: 6 }}>{SOURCES.map((z) => <a key={z[1]} className="small" href={z[1]} target="_blank" rel="noopener">{z[0]}</a>)}</div>
          </div>
          <button className="btn" style={{ marginTop: 16, background: "var(--card-2)", color: "var(--red)", border: "1px solid var(--line)" }}
            onClick={async () => { stopAllMedia(); if (appwriteOn) await awLogout(); act((st) => { st.P.user = { ...(st.P.user || {}), in: false }; st.P.screen = "login"; st.overlay = null; }, { persist: true, top: true }); }}>
            {x.logout}
          </button>
        </div>
      </div>
    </>
  );
}

/* ---------- Notifications ---------- */
export function Notif() {
  const a = useApp();
  const x = s();
  const items: { k: string; t: string; team: string; time?: 1; sub?: string }[] = [...live.feed];
  a.P.teams.forEach((tm) => {
    const g = GAMES.find((z) => z.d >= TODAY && (z.h === tm || z.a === tm));
    if (g && a.P.notif.match) items.push({ k: "match", t: x.nNext(g, dayName(g.d, { weekday: "short", day: "numeric", month: "numeric" })), team: tm, sub: T[g.h]?.city });
    if (a.P.notif.weekly) items.push({ k: "news", t: x.nWeek(tm), team: tm, sub: x.nWeekB });
  });
  const list = items.filter((i) => a.nSeg === "all" || i.k === a.nSeg);
  return (
    <>
      <Header left={<BackBtn onClick={() => act((st) => { st.overlay = null; }, { top: true })} />} />
      <h2 className="title">{x.notifs}</h2>
      <div style={{ marginTop: 12 }}><Seg items={[["all", x.nAll], ["match", x.nMatches], ["news", x.nNews]]} value={a.nSeg} onPick={(k) => act((st) => { st.nSeg = k; })} /></div>
      <div className="stack" style={{ marginTop: 12 }}>
        {list.length ? list.map((i, n) => (
          <div key={n} className="c nt" role={i.k === "news" ? "button" : undefined} style={i.k === "news" ? { cursor: "pointer" } : undefined}
            onClick={i.k === "news" ? () => act((st) => { st.overlay = { week: 1 }; }, { top: true }) : undefined}>
            <span className="ic" style={{ background: T[i.team]?.col }}><Html html={i.time ? IC.bolt : i.k === "news" ? IC.summary : IC.nav[2]} /></span>
            <div><b>{i.t}</b><div className="small muted">{i.time ? x.justNow : i.sub}</div></div>
          </div>
        )) : <p className="muted">–</p>}
      </div>
    </>
  );
}

/* ---------- Weekly roundup ---------- */
export function Week() {
  const a = useApp();
  const x = s();
  const end = weekTo();
  return (
    <>
      <Header left={<BackBtn onClick={() => act((st) => { st.overlay = null; }, { top: true })} />} />
      <h2 className="title">{x.weekH}</h2>
      <p className="small muted" style={{ margin: "6px 0 12px" }}>{x.weekSub}</p>
      <div className="stack feed-grid">
        {a.P.teams.map((tm) => {
          const w: any = weekStory(tm, a.P.lang);
          w.id = "w:" + tm;
          const nx = GAMES.filter((g) => g.d >= TODAY && g.d <= end && (g.h === tm || g.a === tm));
          return (
            <section key={tm} className="c tsec" style={{ ["--tc" as any]: T[tm]?.col }}>
              <div className="tsec-h"><Crest name={tm} size={30} /><b>{tm}</b></div>
              <div className="item"><span className="tag">{x.labAuto}</span><p style={{ margin: 0 }}><Toks toks={w.toks} /></p><div className="row small"><FcBtn st={w} /></div></div>
              {w.rs.length ? w.rs.slice().reverse().map((r: any) => <McCard key={r.id} g={r} res />) : <p className="small muted">{x.weekNone}</p>}
              <div className="l" style={{ marginTop: 6 }}>{x.weekNext}</div>
              {nx.length ? nx.map((g) => <McCard key={g.id} g={g} res={false} />) : <p className="small muted">–</p>}
            </section>
          );
        })}
      </div>
    </>
  );
}

/* ---------- Community (round 2) ---------- */
export function Community() {
  useApp();
  const x = s();
  if (!isPrem())
    return (
      <>
        <h2 className="title">{x.cmTitle}</h2>
        <p className="small muted" style={{ margin: "4px 0 14px" }}>{x.cmSub}</p>
        <div className="c cmlock">
          <div className="cmlock-i"><Html html={IC.comm} /></div>
          <b className="d">{x.cmLockH}</b>
          <ul className="feat">{x.cmLockF.map((f: string) => <li key={f}><span className="ok">✓</span>{f}</li>)}</ul>
          <button className="btn lime" onClick={openPaywall}><Lock size={16} /> {x.cmLockB}</button>
        </div>
      </>
    );
  return (
    <>
      <h2 className="title">{x.cmTitle}</h2>
      <p className="small muted" style={{ margin: "4px 0 14px" }}>{x.cmSub}</p>
      <div className="c cmlock"><div className="cmlock-i"><Html html={IC.comm} /></div><b className="d">{x.cmSoonH}</b><p className="muted" style={{ margin: 0 }}>{x.cmSoonB}</p></div>
    </>
  );
}

export { RESULTS };
