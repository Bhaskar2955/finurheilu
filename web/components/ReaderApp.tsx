"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/i18n";
import type { FeedGame, FeedItem, Lang, ScriptLine, Style, Team } from "@/lib/types";

interface Prefs { language: Lang; team_ids: string[]; style: Style; formats: string[] }
const KEY = "fu.prefs";
const DEV = "fu.device";

function load<T>(k: string): T | null {
  try { const v = localStorage.getItem(k); return v ? (JSON.parse(v) as T) : null } catch { return null }
}
function store(k: string, v: unknown) { try { localStorage.setItem(k, JSON.stringify(v)) } catch { /* private mode */ } }
function deviceId(): string {
  let id = load<string>(DEV);
  if (!id) { id = crypto.randomUUID(); store(DEV, id) }
  return id;
}

export default function ReaderApp() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [editing, setEditing] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    setPrefs(load<Prefs>(KEY));
    setReady(true);
    fetch("/api/teams").then((r) => r.json()).then((d) => setTeams(d.teams ?? [])).catch(() => setTeams([]));
  }, []);

  const save = (p: Prefs) => {
    setPrefs(p); store(KEY, p); setEditing(false);
    fetch("/api/readers", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ device_id: deviceId(), ...p }) }).catch(() => {});
  };

  if (!ready) return null;
  if (!prefs || editing) return <Setup teams={teams} initial={prefs} onSave={save} />;
  return <Feed teams={teams} prefs={prefs} onSettings={() => setEditing(true)} onLang={(language) => save({ ...prefs, language })} />;
}

/* ---------------------------------------------------------------- onboarding / settings */
function Setup({ teams, initial, onSave }: { teams: Team[]; initial: Prefs | null; onSave: (p: Prefs) => void }) {
  const [p, setP] = useState<Prefs>(initial ?? { language: "fi", team_ids: [], style: "quick", formats: ["summary", "highlight", "podcast"] });
  const [msg, setMsg] = useState("");
  const s = t(p.language);
  const toggleTeam = (id: string) => {
    if (p.team_ids.includes(id)) setP({ ...p, team_ids: p.team_ids.filter((x) => x !== id) });
    else if (p.team_ids.length >= 4) setMsg(s.max);
    else { setMsg(""); setP({ ...p, team_ids: [...p.team_ids, id] }) }
  };
  const toggleFmt = (f: string) => {
    const has = p.formats.includes(f);
    if (has && p.formats.length === 1) return;
    setP({ ...p, formats: has ? p.formats.filter((x) => x !== f) : [...p.formats, f] });
  };
  return (
    <main className="app">
      <div className="brand">Fin<b>Urheilu</b></div>
      <h1 className="hero">{s.hero}</h1>
      <p className="mut">{s.sub}</p>

      <section style={{ marginTop: 20 }}>
        <div className="label">{s.lang}</div>
        <div className="row" style={{ marginTop: 8 }}>
          {(["fi", "sv", "en"] as Lang[]).map((l) => (
            <button key={l} className="chip" aria-pressed={p.language === l} onClick={() => setP({ ...p, language: l })}>
              {{ fi: "Suomi", sv: "Svenska", en: "English" }[l]}
            </button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div className="label">{s.teams} · {p.team_ids.length}/4</div>
        <div className="teamgrid" style={{ marginTop: 8 }}>
          {teams.map((tm) => (
            <button key={tm.id} className="teambtn" aria-pressed={p.team_ids.includes(tm.id)} onClick={() => toggleTeam(tm.id)} data-team={tm.id}>
              <span className="dot" style={{ background: tm.color }} />{tm.name}
            </button>
          ))}
        </div>
        {msg && <p className="why" role="status">{msg}</p>}
      </section>

      <section style={{ marginTop: 20 }}>
        <div className="label">{s.style}</div>
        <div className="row" style={{ marginTop: 8 }}>
          {(["quick", "full", "fan"] as Style[]).map((st) => (
            <button key={st} className="chip" aria-pressed={p.style === st} onClick={() => setP({ ...p, style: st })}>{s[st]}</button>
          ))}
        </div>
      </section>

      <section style={{ marginTop: 20 }}>
        <div className="label">{s.formats}</div>
        <div className="row" style={{ marginTop: 8 }}>
          {(["summary", "highlight", "podcast"] as const).map((f) => (
            <button key={f} className="chip" aria-pressed={p.formats.includes(f)} onClick={() => toggleFmt(f)}>{s[f]}</button>
          ))}
        </div>
      </section>

      <button className="btn pri" style={{ width: "100%", marginTop: 28, padding: 14 }} disabled={!p.team_ids.length} onClick={() => onSave(p)}>
        {initial ? s.save : s.start}
      </button>
    </main>
  );
}

/* ---------------------------------------------------------------- feed */
function Feed({ teams, prefs, onSettings, onLang }: { teams: Team[]; prefs: Prefs; onSettings: () => void; onLang: (l: Lang) => void }) {
  const s = t(prefs.language);
  const [games, setGames] = useState<FeedGame[] | null>(null);
  const [err, setErr] = useState(false);
  const name = (id: string) => teams.find((x) => x.id === id)?.name ?? id;

  const loadFeed = useCallback(() => {
    const q = new URLSearchParams({ teams: prefs.team_ids.join(","), lang: prefs.language, style: prefs.style });
    fetch(`/api/feed?${q}`).then((r) => { if (!r.ok) throw new Error(); return r.json() })
      .then((d) => { setGames(d.games); setErr(false) }).catch(() => setErr(true));
  }, [prefs]);

  useEffect(() => { loadFeed(); const h = setInterval(loadFeed, 30000); return () => clearInterval(h) }, [loadFeed]);

  return (
    <main className="app">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div className="brand">Fin<b>Urheilu</b></div>
        <div className="row">
          <select aria-label={s.lang} value={prefs.language} onChange={(e) => onLang(e.target.value as Lang)}>
            <option value="fi">FI</option><option value="sv">SV</option><option value="en">EN</option>
          </select>
          <button className="btn sm" onClick={onSettings}>{s.settings}</button>
        </div>
      </div>

      {err && <p className="why">{s.error}</p>}
      {!games && !err && <p className="mut">{s.loading}</p>}
      {games && games.every((g) => !g.items.length) && <div className="card empty mut" style={{ marginTop: 16 }}>{s.empty}</div>}

      <div style={{ display: "grid", gap: 24, marginTop: 16 }}>
        {games?.filter((g) => g.items.length).map((g) => (
          <article key={g.id} className="game" data-game={g.id}>
            <div className="score">
              <span className="t">{name(g.home_id)}</span>
              <span>
                <span className="n">{g.home_score}–{g.away_score}</span>
                <div className="s">{g.status === "live" ? s.live : s.final}{g.ended_in === "overtime" ? ` · ${s.ot}` : g.ended_in === "shootout" ? ` · ${s.so}` : ""}</div>
              </span>
              <span className="t">{name(g.away_id)}</span>
            </div>
            {g.items.filter((i) => prefs.formats.includes(i.kind)).map((i) => <ItemView key={i.id} item={i} lang={prefs.language} />)}
          </article>
        ))}
      </div>
    </main>
  );
}

function ItemView({ item, lang }: { item: FeedItem; lang: Lang }) {
  const s = t(lang);
  if (item.kind === "summary") {
    return (
      <div className="card story">
        <div className="tag">{s.checked}</div>
        {item.headline && <h3 style={{ marginTop: 6 }}>{item.headline}</h3>}
        <p>{item.text}</p>
      </div>
    );
  }
  if (item.kind === "highlight" && item.video_url) {
    return (
      <div className="card">
        <div className="label" style={{ marginBottom: 8 }}>{s.highlight}</div>
        <video src={`${item.video_url}#t=1`} controls playsInline preload="metadata" />
      </div>
    );
  }
  if (item.kind === "podcast") return <PodcastView item={item} lang={lang} />;
  return null;
}

/** Plays the rendered audio when there is one; otherwise reads the script with the device's own voices. */
function PodcastView({ item, lang }: { item: FeedItem; lang: Lang }) {
  const s = t(lang);
  const [on, setOn] = useState(-1);
  const stopRef = useRef(false);
  const script: ScriptLine[] = item.script ?? [];

  const speak = () => {
    if (!("speechSynthesis" in window)) return;
    if (on >= 0) { stopRef.current = true; speechSynthesis.cancel(); setOn(-1); return }
    stopRef.current = false;
    const tag = { fi: "fi", sv: "sv", en: "en" }[lang];
    const voices = speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith(tag));
    const female = voices.find((v) => /female|selma|noora|sofie|sonia|libby|aria|jenny|samantha|satu|alva/i.test(v.name)) ?? voices[0];
    const male = voices.find((v) => v !== female && /male|harri|mattias|ryan|thomas|guy|daniel|onni|oskar/i.test(v.name)) ?? voices[1] ?? female;
    const say = (i: number) => {
      if (stopRef.current || i >= script.length) { setOn(-1); return }
      setOn(i);
      const u = new SpeechSynthesisUtterance(script[i].text);
      const v = script[i].host === "B" ? male : female;
      if (v) u.voice = v;
      u.lang = v?.lang ?? tag;
      u.rate = 0.95;
      u.onend = () => setTimeout(() => say(i + 1), 350);
      u.onerror = () => setOn(-1);
      speechSynthesis.speak(u);
    };
    say(0);
  };

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between", marginBottom: 8 }}>
        <div className="label">{s.podcast}{item.duration_s ? ` · ${Math.floor(item.duration_s / 60)}:${String(item.duration_s % 60).padStart(2, "0")}` : ""}</div>
        {!item.audio_url && <button className="btn sm pri" onClick={speak}>{on >= 0 ? s.stop : s.listen}</button>}
      </div>
      {item.audio_url && <audio src={item.audio_url} controls preload="none" style={{ width: "100%" }} />}
      <div style={{ marginTop: 8 }}>
        {script.map((l, i) => (
          <div key={i} className={`podline ${on === i ? "on" : ""}`}><b className={l.host === "B" ? "m" : ""}>{l.host === "A" ? "♀" : "♂"}</b><span>{l.text}</span></div>
        ))}
      </div>
    </div>
  );
}
