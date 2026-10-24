import { useEffect } from "react";
import { GAMES, T, loadData } from "./lib/data";
import { appwriteOn, currentUser, saveProfile } from "./lib/appwrite";
import { IC } from "./lib/icons";
import { clockTxt, gs, live, started, startRealPolling } from "./lib/live";
import { stopAllMedia } from "./lib/media";
import { act, app, emit, onSave, s, useApp, type Tab } from "./lib/state";
import { applyMode, isPrem } from "./lib/util";
import { Crest, Header, Html, Toast } from "./components/ui";
import { Pop, openGame } from "./components/cards";
import { Login, Personal, Plans, Register, Select, Splash } from "./screens/Onboarding";
import { Home } from "./screens/Home";
import { Matches } from "./screens/Matches";
import { Detail, Player } from "./screens/Detail";
import { Calendar, Community, Notif, Profile, Teams, Week } from "./screens/Other";

// Signed-in users: every settings change is also saved to their Appwrite profile row.
onSave((p) => { if (appwriteOn && p.user?.in && p.user.id) saveProfile(p.user.id, p); });

const NAV: [Tab, number][] = [["home", 0], ["matches", 1], ["calendar", 2], ["teams", 3], ["community", 6], ["profile", 4]];

export default function App() {
  const a = useApp();
  const x = s();

  useEffect(() => {
    applyMode();
    document.documentElement.lang = app.P.lang;
    loadData().then(() => { emit(); startRealPolling(); });
    if (appwriteOn) currentUser().then((u) => { if (u && app.P.user?.in) act((st) => { st.P.user = { ...st.P.user, id: u.id, email: u.email }; }); });
    const mq = typeof window.matchMedia === "function" ? matchMedia("(prefers-color-scheme: light)") : null;
    const onMq = () => { applyMode(); emit(); };
    mq?.addEventListener?.("change", onMq);
    const closeMenu = (e: MouseEvent) => { if (app.langOpen && !(e.target as HTMLElement).closest(".langwrap")) act((st) => { st.langOpen = false; }); };
    document.addEventListener("click", closeMenu);
    try { speechSynthesis.getVoices(); } catch { /* no speech */ }
    return () => { mq?.removeEventListener?.("change", onMq); document.removeEventListener("click", closeMenu); };
  }, []);

  // Leaving a screen stops any podcast or reel that is playing (as in the prototype).
  useEffect(() => { stopAllMedia(); }, [a.tab, a.overlay, a.P.screen]);

  if (a.P.screen !== "app") {
    const V = { splash: Splash, register: Register, login: Login, plans: () => <Plans inApp={false} />, select: Select, personal: Personal }[a.P.screen];
    return (<><main className="app">{V ? <V /> : <Splash />}</main><Toast /><Pop /></>);
  }

  const ov = a.overlay;
  const body = ov ? (ov.pay ? <Plans inApp /> : ov.notif ? <Notif /> : ov.week ? <Week /> : ov.player ? <Player /> : <Detail />) : (
    <>
      <Header />
      {{ home: <Home />, matches: <Matches />, calendar: <Calendar />, teams: <Teams />, community: <Community />, profile: <Profile /> }[a.tab]}
    </>
  );
  const showDock = !ov && ["matches", "calendar", "teams"].includes(a.tab) && started() && !!live.slot;
  return (
    <div className={`shell ${showDock ? "has-dock" : ""}`}>
      <main className="app">{body}</main>
      {showDock && <Dock />}
      <nav className="bottom">
        <div className="inner">
          {NAV.map(([k, i]) => (
            <button key={k} aria-current={a.tab === k && !ov ? "page" : undefined}
              onClick={() => act((st) => { st.tab = k; st.overlay = null; try { localStorage.setItem("fu2.tab", JSON.stringify(k)); } catch { /* ignore */ } }, { top: true })}>
              {k === "community" && !isPrem() && <i className="nlock"><Html html={IC.lock.replace('class="lk"', 'class="lk" width="9" height="9"')} /></i>}
              <Html html={k === "community" ? IC.comm : IC.nav[i]} />
              <span>{x.nav[i]}</span>
            </button>
          ))}
        </div>
      </nav>
      <Toast />
      <Pop />
    </div>
  );
}

/** Small floating live scores on Matches, Calendar and Teams while a demo round is running. */
function Dock() {
  useApp();
  const games = live.slot ? (isPrem() ? live.slot.games : live.slot.games.slice(0, 1)) : [];
  return (
    <div className="dock">
      <div className="inner">
        {games.map((g) => {
          const st = gs(g.id);
          return (
            <button key={g.id} className={`dmini ${live.on ? "live" : ""}`} style={{ ["--hc" as any]: T[g.h]?.col, ["--ac" as any]: T[g.a]?.col }} aria-label={`${g.h} ${st.hs}–${st.as} ${g.a}`} onClick={() => openGame(g.id)}>
              {live.on && <span className="lv" />}
              <Crest name={g.h} size={20} /><span className="dsc">{st.hs}<i>:</i>{st.as}</span><Crest name={g.a} size={20} /><span className="dclk">{clockTxt()}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export { GAMES };
