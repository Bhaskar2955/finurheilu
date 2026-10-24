/** Splash → register → login → plans → choose teams → personalise. Accounts use Appwrite when configured. */
import { useState, type FormEvent } from "react";
import { AZ, T } from "../lib/data";
import { appwriteOn, friendlyError, loadProfile, login as awLogin, register as awRegister } from "../lib/appwrite";
import { act, app, s, toast, useApp, type Prefs } from "../lib/state";
import { PRICE, TODAY, addPeriod, eur, isPrem } from "../lib/util";
import { Crest, Header, Html, BackBtn } from "../components/ui";
import { FmtButtons, VoicePick } from "../components/prefs";
import { IC } from "../lib/icons";

const go = (to: Prefs["screen"]) =>
  act((a) => {
    a.P.screen = to;
    if (to === "app") { a.tab = "home"; a.overlay = null; a.P.onboarded = true; }
  }, { persist: true, top: true });

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function Splash() {
  const x = s();
  return (
    <div className="splash">
      <div className="rink" />
      <div className="jersey">28</div>
      <Header />
      <div style={{ position: "relative" }}>
        <div className="d" style={{ fontSize: 48 }}>{x.tag}</div>
        <p className="muted" style={{ fontSize: 16, maxWidth: "30ch" }}>{x.splash}</p>
      </div>
      <div style={{ position: "relative" }} className="stack">
        <button className="btn" onClick={() => go("register")}>{x.getStarted}</button>
        <button className="textlink" style={{ alignSelf: "center" }} onClick={() => go("login")}>{x.login}</button>
      </div>
    </div>
  );
}

export function Register() {
  const a = useApp();
  const x = s();
  const u = a.P.user || {};
  const [f, setF] = useState({ name: u.name || "", email: u.email || "", pass: "", byear: u.byear ? String(u.byear) : "", terms: false, mkt: !!u.mkt });
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const by = +f.byear;
    let er = "";
    if (!f.name || !f.email || !f.pass || !by || !f.terms) er = x.errFill;
    else if (!EMAIL.test(f.email)) er = x.errEmail;
    else if (f.pass.length < 8) er = x.errPass;
    else if (by < 1920 || by > new Date().getFullYear() - 10) er = x.errYear;
    if (er) { act((st) => { st.regErr = er; }); return; }
    if (appwriteOn) {
      act((st) => { st.busy = true; st.regErr = ""; });
      try {
        const user = await awRegister(f.name.trim(), f.email.trim(), f.pass);
        act((st) => { st.busy = false; st.P.user = { name: user.name, email: user.email, byear: by, mkt: f.mkt, in: true, id: user.id }; st.P.screen = "plans"; }, { persist: true, top: true });
      } catch (err) {
        act((st) => { st.busy = false; st.regErr = friendlyError(err, x.errFill); });
      }
      return;
    }
    act((st) => { st.regErr = ""; st.P.user = { name: f.name.trim(), email: f.email.trim(), byear: by, mkt: f.mkt, in: false }; st.P.screen = "login"; }, { persist: true, top: true });
  };
  const years = Array.from({ length: 80 }, (_, i) => new Date().getFullYear() - 10 - i);
  return (
    <>
      <Header left={<BackBtn onClick={() => go("splash")} />} />
      <h2 className="title">{x.register}</h2>
      <p className="muted small">{x.regSub}</p>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">{x.name}<input id="rname" autoComplete="name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
        <label className="field">{x.email}<input id="remail" type="email" autoComplete="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></label>
        <label className="field">{x.pass}<input id="rpass" type="password" autoComplete="new-password" minLength={8} value={f.pass} onChange={(e) => setF({ ...f, pass: e.target.value })} /></label>
        <label className="field">{x.byear}
          <select id="rbyear" value={f.byear} onChange={(e) => setF({ ...f, byear: e.target.value })}>
            <option value="">–</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
        <label className="checkrow"><input type="checkbox" id="rterms" checked={f.terms} onChange={(e) => setF({ ...f, terms: e.target.checked })} /> <span>{x.terms}</span></label>
        <label className="checkrow"><input type="checkbox" id="rmkt" checked={f.mkt} onChange={(e) => setF({ ...f, mkt: e.target.checked })} /> <span>{x.mkt}</span></label>
        <div className="err">{a.regErr}</div>
        <button className="btn" type="submit" disabled={a.busy}>{x.register}</button>
      </form>
      <div className="divider" style={{ margin: "16px 0" }}>{x.orWith}</div>
      <div className="social"><button onClick={() => toast(x.socialDemo)}>Google</button><button onClick={() => toast(x.socialDemo)}>Apple</button></div>
      <p className="small" style={{ textAlign: "center", marginTop: 16 }}>{x.haveAcc} <button className="textlink" onClick={() => go("login")}>{x.login}</button></p>
      <p className="small muted" style={{ textAlign: "center" }}>{appwriteOn ? x.awSaved : x.awDemo}</p>
    </>
  );
}

export function Login() {
  const a = useApp();
  const x = s();
  const [email, setEmail] = useState(a.P.user?.email || "");
  const [pass, setPass] = useState("");
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!EMAIL.test(email.trim()) || pass.length < 8) { act((st) => { st.logErr = x.errLogin; }); return; }
    if (appwriteOn) {
      act((st) => { st.busy = true; st.logErr = ""; });
      try {
        const user = await awLogin(email.trim(), pass);
        const saved = await loadProfile(user.id);
        act((st) => {
          st.busy = false;
          if (saved) Object.assign(st.P, saved);
          st.P.user = { ...(st.P.user || {}), name: user.name || email.split("@")[0], email: user.email, in: true, id: user.id };
          st.P.screen = st.P.onboarded ? "app" : "plans";
          if (st.P.screen === "app") st.tab = "home";
        }, { persist: true, top: true });
      } catch (err) {
        act((st) => { st.busy = false; st.logErr = friendlyError(err, x.errLogin); });
      }
      return;
    }
    act((st) => {
      st.logErr = "";
      st.P.user = { name: email.split("@")[0], ...(st.P.user || {}), email: email.trim(), in: true };
      st.P.screen = st.P.onboarded ? "app" : "plans";
      if (st.P.screen === "app") st.tab = "home";
    }, { persist: true, top: true });
  };
  const kaleva = () =>
    act((st) => {
      st.P.user = { name: "Kaleva", email: "", ...(st.P.user || {}), in: true };
      st.P.sub = { plan: "premium", billing: "annual", via: "kaleva", start: TODAY, renew: addPeriod(TODAY, "annual"), auto: true, hist: st.P.sub?.hist || [] };
      st.P.screen = st.P.onboarded ? "app" : "select";
      if (st.P.screen === "app") st.tab = "home";
      toast(x.kalevaDemo);
    }, { persist: true, top: true });
  return (
    <>
      <Header left={<BackBtn onClick={() => go("register")} />} />
      <h2 className="title">{x.loginH}</h2>
      <p className="muted small">{x.loginSub}</p>
      <form className="form" onSubmit={submit} noValidate>
        <label className="field">{x.email}<input id="lemail" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
        <label className="field">{x.pass}<input id="lpass" type="password" autoComplete="current-password" value={pass} onChange={(e) => setPass(e.target.value)} /></label>
        <div className="between"><span className="err">{a.logErr}</span><button type="button" className="textlink small" onClick={() => toast(x.resetSent)}>{x.forgot}</button></div>
        <button className="btn" type="submit" disabled={a.busy}>{x.login}</button>
      </form>
      <button className="btn kalbtn" onClick={kaleva}>{x.kaleva}</button>
      <div className="divider" style={{ margin: "16px 0" }}>{x.orWith}</div>
      <div className="social"><button onClick={() => toast(x.socialDemo)}>Google</button><button onClick={() => toast(x.socialDemo)}>Apple</button></div>
      <p className="small" style={{ textAlign: "center", marginTop: 16 }}>{x.noAcc} <button className="textlink" onClick={() => go("register")}>{x.register}</button></p>
      <p className="small muted" style={{ textAlign: "center" }}>{appwriteOn ? x.awSaved : x.awDemo}</p>
    </>
  );
}

export function Plans({ inApp }: { inApp: boolean }) {
  const a = useApp();
  const x = s();
  const pr = a.bill === "annual" ? PRICE.annual : PRICE.monthly;
  const cur = isPrem();
  const cell = (v: number | string) => (v === 1 ? <span className="y">✓</span> : v === 0 ? <span className="n">✕</span> : v);
  const choose = (pl: "premium" | "free") =>
    act((st) => {
      if (pl === "premium") {
        const hist = st.P.sub?.hist || [];
        st.P.sub = { plan: "premium", billing: st.bill, start: TODAY, renew: addPeriod(TODAY, st.bill), auto: true, hist: [...hist, { d: TODAY, b: st.bill, trial: !hist.length }] };
        toast(x.upgraded);
      } else {
        st.P.sub = { plan: "free", hist: st.P.sub?.hist || [] };
        if (st.P.teams.length > 4) st.P.teams = st.P.teams.slice(0, 4);
        if (st.P.onboarded) toast(x.toFree);
      }
      if (st.P.screen === "plans") st.P.screen = "select"; else st.overlay = null;
    }, { persist: true, top: true });
  return (
    <>
      <Header left={<BackBtn onClick={() => (inApp ? act((st) => { st.overlay = null; }, { top: true }) : go("login"))} />} />
      <h2 className="title">{x.plansH}</h2>
      <p className="muted small">{x.plansSub}</p>
      <div className="seg" style={{ margin: "12px 0 16px" }}>
        <button aria-pressed={a.bill === "monthly"} onClick={() => act((st) => { st.bill = "monthly"; })}>{x.monthly}</button>
        <button aria-pressed={a.bill === "annual"} onClick={() => act((st) => { st.bill = "annual"; })}>{x.annual} · {x.save}</button>
      </div>
      <div className="stack plans-grid" style={{ gap: 16 }}>
        <div className="c plan prem">
          <span className="ribbon">{a.bill === "annual" ? x.save : x.trialTag + " 7 d"}</span>
          <div className="between"><b className="d" style={{ fontSize: 26 }}>{x.premium}</b>{cur && <span className="pbadge prem">✓</span>}</div>
          <div className="price">{eur(pr)} <small>{a.bill === "annual" ? x.perYr : x.perMo}</small></div>
          <ul className="feat">{x.premF.map((f: string) => <li key={f}><span className="ok">✓</span>{f}</li>)}</ul>
          <button className="btn" onClick={() => choose("premium")}>{x.getPrem}</button>
          <span className="small muted">{x.trial}</span>
        </div>
        <div className="c plan">
          <div className="between"><b className="d" style={{ fontSize: 26 }}>{x.free}</b>{!cur && a.P.sub?.plan === "free" && a.P.onboarded && <span className="pbadge">✓</span>}</div>
          <div className="price">0 € <small>{x.perMo}</small></div>
          <ul className="feat">
            {x.freeF.map((f: string) => <li key={f}><span className="ok">✓</span>{f}</li>)}
            {x.freeNo.map((f: string) => <li key={f} className="off"><span className="no">✕</span>{f}</li>)}
          </ul>
          <button className="btn" style={{ background: "var(--card-2)", color: "var(--ink)", border: "1px solid var(--line)" }} onClick={() => choose("free")}>{x.contFree}</button>
        </div>
        <div className="c cmp-card" style={{ padding: 12 }}>
          <div className="l" style={{ marginBottom: 6 }}>{x.cmpH}</div>
          <div style={{ overflowX: "auto" }}>
            <table className="cmpt">
              <thead><tr><th />{x.cmpCols.map((c: string, i: number) => <th key={c} className={i < 2 ? "us" : ""}>{c}</th>)}</tr></thead>
              <tbody>{x.cmpRows.map((r: any[]) => <tr key={r[0]}><td>{r[0]}</td>{r.slice(1).map((v, i) => <td key={i}>{cell(v)}</td>)}</tr>)}</tbody>
            </table>
          </div>
          <p className="small muted" style={{ margin: "8px 0 0" }}>{x.cmpNote} <a href="https://kauppa.telia.fi/kauppa/mtv-katsomo/liiga" target="_blank" rel="noopener">MTV Katsomo · Telia</a> · <a href="https://etusuora.com/live-stream/jaakiekko/liiga" target="_blank" rel="noopener">Etusuora</a></p>
        </div>
      </div>
    </>
  );
}

export function Select() {
  const a = useApp();
  const x = s();
  const list = AZ.filter((t) => t.name.toLowerCase().includes(a.search.toLowerCase()));
  const toggle = (n: string) => {
    if (a.P.teams.includes(n)) { act((st) => { st.P.teams = st.P.teams.filter((t) => t !== n); }, { persist: true }); return; }
    if (!isPrem() && a.P.teams.length >= 4) { toast(x.maxTeams); return; }
    act((st) => { st.P.teams = [...st.P.teams, n]; if (!st.P.tf[n]) st.P.tf[n] = ["summary"]; }, { persist: true });
  };
  return (
    <>
      <Header left={<BackBtn onClick={() => go("plans")} />} />
      <h2 className="title">{x.choose}</h2>
      <p className="muted small">{x.chooseSub}</p>
      <label className="search">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94A6C4" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-4-4" /></svg>
        <input id="search" placeholder={x.search} value={a.search} aria-label={x.search} onChange={(e) => act((st) => { st.search = e.target.value; })} />
      </label>
      <div className="tlist" style={{ marginTop: 12 }}>
        {list.map((t) => (
          <button key={t.name} className="trow" aria-pressed={a.P.teams.includes(t.name)} onClick={() => toggle(t.name)}>
            <Crest name={t.name} size={32} />
            <span className="grow"><b>{t.name}</b><span className="small muted">{t.city}</span></span>
            <span className="check">{a.P.teams.includes(t.name) && <Html html={IC.check} />}</span>
          </button>
        ))}
      </div>
      <div style={{ position: "sticky", bottom: 16, marginTop: 16 }}>
        <button className="btn" disabled={!a.P.teams.length} onClick={() => (a.P.teams.length ? go("personal") : toast(x.pickTeam))}>{x.cont} · {a.P.teams.length}</button>
      </div>
    </>
  );
}

export function Personal() {
  const a = useApp();
  const x = s();
  a.P.teams.forEach((tm) => { if (!a.P.tf[tm] || !a.P.tf[tm].length) a.P.tf[tm] = ["summary"]; });
  return (
    <>
      <Header left={<BackBtn onClick={() => go("select")} />} />
      <h2 className="title">{x.persH}</h2>
      <p className="muted small">{x.persSub}</p>
      <div className="stack">
        {a.P.teams.map((tm) => (
          <div key={tm} className="c pt" style={{ borderTop: `3px solid ${T[tm]?.col}` }}>
            <div className="row"><Crest name={tm} size={30} /><b className="d" style={{ fontSize: 22 }}>{tm}</b></div>
            <FmtButtons tm={tm} />
          </div>
        ))}
        <div className="l" style={{ marginTop: 6 }}>{x.voice}</div>
        <VoicePick />
      </div>
      <div style={{ position: "sticky", bottom: 16, marginTop: 16 }}>
        <button className="btn" onClick={() => go("app")}>{x.start}</button>
      </div>
    </>
  );
}

export { app };
