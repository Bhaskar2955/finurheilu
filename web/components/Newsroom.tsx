"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { Kind, Lang, NrItem, NrState, Status, Style } from "@/lib/types";

const KIND: Record<Kind, string> = { summary: "Text summary", podcast: "Podcast", highlight: "Highlight video" };
const ST: Record<Status, string> = {
  draft: "Draft", needs_review: "Needs review", flagged: "Flagged", approved: "Approved",
  scheduled: "Scheduled", published: "Published", rejected: "Rejected",
};
const LANG: Record<Lang, string> = { fi: "Suomi", sv: "Svenska", en: "English" };
const STYLE: Record<Style, string> = { quick: "Quick read", full: "Full story", fan: "Fan voice" };
const ORDER: Record<Status, number> = { flagged: 0, needs_review: 1, draft: 2, approved: 3, scheduled: 4, published: 5, rejected: 6 };

const plural = (n: number) => `${n} reader${n === 1 ? "" : "s"}`;
const time = (s: string | null) => (s ? new Date(s).toLocaleString("fi-FI", { hour: "2-digit", minute: "2-digit", day: "numeric", month: "numeric" }) : "");

export default function Newsroom() {
  const [state, setState] = useState<NrState | null>(null);
  const [needLogin, setNeedLogin] = useState(false);
  const [tab, setTab] = useState<"review" | "games" | "how">("review");
  const [sel, setSel] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | Kind>("all");
  const [toast, setToast] = useState("");
  const [busy, setBusy] = useState(false);
  const [waitUntil, setWaitUntil] = useState(0);

  const say = (m: string) => { setToast(m); setTimeout(() => setToast(""), 3200) };

  const refresh = useCallback(async () => {
    const r = await fetch("/api/newsroom/state", { cache: "no-store" });
    if (r.status === 401) { setNeedLogin(true); return }
    if (r.ok) { setNeedLogin(false); setState(await r.json()) }
  }, []);

  useEffect(() => { refresh() }, [refresh]);
  const jobsRunning = !!state?.jobs.some((j) => j.status === "running" || j.status === "queued");
  useEffect(() => {
    const fast = jobsRunning || Date.now() < waitUntil;
    const h = setInterval(refresh, fast ? 4000 : 20000);
    return () => clearInterval(h);
  }, [refresh, jobsRunning, waitUntil]);

  const act = async (id: string, body: Record<string, unknown>, done?: string) => {
    setBusy(true);
    try {
      const r = await fetch(`/api/newsroom/items/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json();
      if (!r.ok) { say(d.error ?? "Something went wrong"); return false }
      setState(d);
      if (done) say(done);
      if (body.action === "rewrite" || body.action === "fix_with_ai") setWaitUntil(Date.now() + 90_000);
      return true;
    } finally { setBusy(false) }
  };

  const generate = async (game_id: string, kinds: Kind[]) => {
    const r = await fetch("/api/newsroom/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ game_id, kinds }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { say(d.error ?? d.detail ?? "The AI worker didn't respond"); return }
    say(`AI started: ${kinds.join(", ")}`);
    setWaitUntil(Date.now() + 120_000);
    setTimeout(refresh, 1500);
  };

  if (needLogin) return <Login onDone={refresh} />;
  if (!state) return <main className="wrap"><p className="mut" style={{ marginTop: 40 }}>Loading the newsroom…</p></main>;

  const items = [...state.items].filter((i) => filter === "all" || i.kind === filter).sort((a, b) => ORDER[a.status] - ORDER[b.status]);
  const current = state.items.find((i) => i.id === sel) ?? items[0] ?? null;
  const open = state.items.filter((i) => i.status === "needs_review" || i.status === "flagged").length;
  const team = (id: string) => state.teams.find((x) => x.id === id)?.name ?? id;

  return (
    <>
      <header className="nr-head">
        <div className="wrap">
          <div className="nr-top">
            <div className="brand grow" style={{ fontSize: 24 }}>FinUrheilu <b>Newsroom</b></div>
            {jobsRunning && <span className="pill running">AI working…</span>}
            <span className="small mut">{state.editor}</span>
            <button className="btn sm" onClick={async () => { await fetch("/api/newsroom/login", { method: "DELETE" }); setNeedLogin(true) }}>Sign out</button>
          </div>
          <nav className="tabs" role="tablist">
            {([["review", "Review queue", open], ["games", "Games and AI", null], ["how", "How it works", null]] as const).map(([k, l, n]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}{n != null && <span className="n">{n}</span>}</button>
            ))}
          </nav>
        </div>
      </header>

      <main className="wrap">
        {tab === "review" && (
          <>
            <div className="kpis">
              <div className="kpi"><span className="label">Waiting for you</span><b>{state.items.filter((i) => i.status === "needs_review").length}</b></div>
              <div className={`kpi ${state.items.some((i) => i.status === "flagged") ? "bad" : ""}`}><span className="label">Flagged by fact check</span><b>{state.items.filter((i) => i.status === "flagged").length}</b></div>
              <div className="kpi"><span className="label">Live in the app</span><b>{state.items.filter((i) => i.status === "published" || i.status === "scheduled").length}</b></div>
              <div className="kpi"><span className="label">AI jobs today</span><b>{state.jobs.filter((j) => new Date(j.created_at).toDateString() === new Date().toDateString()).length}</b></div>
            </div>
            {!state.items.length ? (
              <div className="card empty">
                <h2 style={{ fontFamily: "var(--display)" }}>Nothing to review yet</h2>
                <p className="mut">Open <b>Games and AI</b> and press <b>Run AI</b> on a finished game. Drafts appear here in about a minute.</p>
                <button className="btn pri" onClick={() => setTab("games")}>Go to games</button>
              </div>
            ) : (
              <div className="grid">
                <section className="queue" aria-label="Review queue">
                  <div className="row" style={{ padding: 10, borderBottom: "1px solid var(--line)" }}>
                    {(["all", "highlight", "summary", "podcast"] as const).map((k) => (
                      <button key={k} className="chip" aria-pressed={filter === k} onClick={() => setFilter(k)}>{k === "all" ? "All" : KIND[k]}</button>
                    ))}
                  </div>
                  {items.map((i) => (
                    <button key={i.id} className="qi" aria-current={current?.id === i.id} onClick={() => setSel(i.id)} data-item={i.id}>
                      <div className="t">{i.title}</div>
                      <div className="row small mut" style={{ marginTop: 4 }}>
                        <span className={`pill ${i.status}`}>{ST[i.status]}</span><span>{KIND[i.kind]}</span><span>v{i.version}</span><span>{time(i.updated_at)}</span>
                      </div>
                    </button>
                  ))}
                </section>
                {current && <Detail key={current.id + (current.version ?? 0)} item={current} state={state} busy={busy} act={act} team={team} />}
              </div>
            )}
          </>
        )}
        {tab === "games" && <Games state={state} team={team} generate={generate} />}
        {tab === "how" && <How />}
      </main>
      {toast && <div className="toast" role="status">{toast}</div>}
    </>
  );
}

/* ---------------------------------------------------------------- login */
function Login({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  return (
    <main className="wrap">
      <form className="login card" onSubmit={async (e) => {
        e.preventDefault(); setErr("");
        const r = await fetch("/api/newsroom/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, password: pw }) });
        if (r.ok) onDone(); else setErr((await r.json().catch(() => ({}))).error ?? "Sign-in failed");
      }}>
        <div className="brand">FinUrheilu <b>Newsroom</b></div>
        <p className="mut small" style={{ margin: 0 }}>For Kaleva editors. Readers never see this page.</p>
        <label className="small">Your name<input id="nr-name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: "100%", marginTop: 4 }} autoComplete="name" /></label>
        <label className="small">Newsroom password<input id="nr-pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} style={{ width: "100%", marginTop: 4 }} autoComplete="current-password" /></label>
        {err && <span className="why">{err}</span>}
        <button className="btn pri" type="submit">Sign in</button>
      </form>
    </main>
  );
}

/* ---------------------------------------------------------------- one item */
function Detail({ item, state, busy, act, team }: {
  item: NrItem; state: NrState; busy: boolean; team: (id: string) => string;
  act: (id: string, body: Record<string, unknown>, done?: string) => Promise<boolean>;
}) {
  const [lang, setLang] = useState<Lang>("fi");
  const [style, setStyle] = useState<Style>("quick");
  const [edit, setEdit] = useState<string | null>(null);
  const [ask, setAsk] = useState("");
  const [mode, setMode] = useState<"none" | "approve" | "reject">("none");
  const [when, setWhen] = useState("");

  const game = state.games.find((g) => g.id === item.game_id);
  const openClaims = item.claims.filter((c) => c.check_status !== "ok");
  const dep = item.depends_on ? state.items.find((i) => i.id === item.depends_on) : null;
  const block = openClaims.length ? `Resolve ${openClaims.length} flagged fact${openClaims.length > 1 ? "s" : ""} first.`
    : dep && !["approved", "scheduled", "published"].includes(dep.status) ? "Approve the match report first: this is built from it." : "";
  const runningJob = state.jobs.find((j) => j.game_id === item.game_id && (j.status === "running" || j.status === "queued"));

  const styles = useMemo(() => [...new Set(item.variants.map((v) => v.style))] as Style[], [item.variants]);
  const langs = useMemo(() => [...new Set(item.variants.map((v) => v.language))] as Lang[], [item.variants]);
  const st = styles.includes(style) ? style : styles[0];
  const variant = item.variants.find((v) => v.language === lang && v.style === st);

  return (
    <section className="detail" aria-label="Item">
      <div className="dh">
        <div className="grow">
          <div className="mono mut">{KIND[item.kind]} · v{item.version} · {item.author}</div>
          <h2>{item.title}</h2>
          <div className="small mut">{game ? `${team(game.home_id)} ${game.home_score}–${game.away_score} ${team(game.away_id)} · ${game.status} · ${game.venue ?? ""}` : ""}{item.note ? ` · ${item.note}` : ""}</div>
        </div>
        <div><span className={`pill ${item.status}`}>{ST[item.status]}</span></div>
      </div>

      <div className="db">
        {runningJob && <div className="card small" style={{ background: "var(--warnsoft)" }}>The AI is working on a new version ({runningJob.kind}). It will appear here when ready.</div>}

        {item.kind === "summary" && (
          <>
            <div>
              <div className="label" style={{ marginBottom: 8 }}>Fact check against Liiga data</div>
              {item.claims.length === 0 && <p className="small mut">No claims recorded.</p>}
              {item.claims.map((c) => (
                <div key={c.id} className={`claim ${c.check_status === "ok" ? "" : "bad"}`}>
                  <span className="st">{c.check_status === "ok" ? "✓" : "!"}</span>
                  <span>{c.text}<span className="mono mut" style={{ display: "block" }}>
                    {c.fact_key ?? "no source"}{c.check_status === "mismatch" ? ` · AI wrote ${c.ai_value}, Liiga says ${c.source_value}` : c.source_value ? ` · ${c.source_value}` : ""}</span></span>
                  {c.check_status !== "ok" && item.status !== "published" && (
                    <span className="row">
                      <button className="btn sm pri" disabled={busy} onClick={() => act(item.id, { action: "fix_with_ai", claim_id: c.id }, "Sent to the AI to fix")}>Fix with AI</button>
                      <button className="btn sm" disabled={busy} onClick={() => act(item.id, { action: "accept_claim", claim_id: c.id }, "Marked as checked")}>I checked it</button>
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div>
              <div className="label" style={{ marginBottom: 8 }}>Variants · who gets which</div>
              <div className="tablewrap"><table>
                <thead><tr><th>Language</th>{styles.map((s) => <th key={s}>{STYLE[s]}</th>)}</tr></thead>
                <tbody>{langs.map((l) => (
                  <tr key={l}><td>{LANG[l]}</td>{styles.map((s) => (
                    <td key={s}><button className="chip" aria-pressed={l === lang && s === st} onClick={() => { setLang(l); setStyle(s); setEdit(null) }}>
                      {plural(item.reach[`${l}/${s}`] ?? 0)}</button></td>))}</tr>))}
                </tbody>
              </table></div>
              <p className="small mut">Each reader gets the approved variant matching their language and style.</p>
            </div>

            <div>
              <div className="row" style={{ justifyContent: "space-between", marginBottom: 10 }}>
                <div className="row">
                  <div className="seg">{langs.map((l) => <button key={l} aria-pressed={l === lang} onClick={() => { setLang(l); setEdit(null) }}>{l.toUpperCase()}</button>)}</div>
                  <div className="seg">{styles.map((s) => <button key={s} aria-pressed={s === st} onClick={() => { setStyle(s); setEdit(null) }}>{STYLE[s]}</button>)}</div>
                </div>
                <span className="small mut">{variant?.text.split(/\s+/).length ?? 0} words</span>
              </div>
              {edit != null ? (
                <>
                  <textarea id="nr-edit" value={edit} onChange={(e) => setEdit(e.target.value)} aria-label="Edit text" />
                  <div className="row" style={{ marginTop: 8 }}>
                    <button className="btn pri" disabled={busy} onClick={async () => { if (await act(item.id, { action: "edit_variant", language: lang, style: st, text: edit }, "Edit saved and re-checked")) setEdit(null) }}>Save edit</button>
                    <button className="btn" onClick={() => setEdit(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div className="text">{variant?.text}</div>
                  {item.status !== "published" && variant && <button className="btn sm" style={{ marginTop: 8 }} onClick={() => setEdit(variant.text)}>Edit this variant</button>}
                </>
              )}
            </div>
          </>
        )}

        {item.kind === "podcast" && (
          <>
            {dep && <div className="card small">Built from: <b>{dep.title}</b> · {ST[dep.status]}</div>}
            {typeof item.payload.stray_numbers === "object" && (item.payload.stray_numbers as string[]).length > 0 && (
              <div className="claim bad"><span className="st">!</span><span>Numbers not in the Liiga data: {(item.payload.stray_numbers as string[]).join(", ")}. Ask the AI to fix it below.</span></div>
            )}
            <div className="seg">{item.episodes.map((e) => <button key={e.language} aria-pressed={e.language === lang} onClick={() => setLang(e.language)}>{e.language.toUpperCase()}</button>)}</div>
            {(() => {
              const ep = item.episodes.find((e) => e.language === lang) ?? item.episodes[0];
              if (!ep) return <p className="mut">No episode yet.</p>;
              return (
                <div>
                  {ep.audio_url ? <audio src={ep.audio_url} controls style={{ width: "100%" }} /> : <p className="small mut">No audio: add AZURE_SPEECH_KEY to the worker for neural voices. The app will read this script with the phone&apos;s voice.</p>}
                  <div style={{ marginTop: 8 }}>{ep.script.map((l, i) => (
                    <div key={i} className="podline"><b className={l.host === "B" ? "m" : ""}>{l.host === "A" ? "Host A ♀" : "Host B ♂"}</b><span>{l.text}</span></div>))}
                  </div>
                  <p className="small mut">{plural(item.reach[lang] ?? 0)} in {LANG[lang]} get this episode.</p>
                </div>
              );
            })()}
          </>
        )}

        {item.kind === "highlight" && (
          <>
            {typeof item.payload.video_url === "string" && <video src={item.payload.video_url} controls playsInline style={{ maxHeight: 520 }} />}
            <p className="small mut">{item.payload.mode === "data video" ? "Data video built from Liiga events (no footage used)." : "Cut from licensed footage."} {plural(item.reach.all ?? 0)} get video.</p>
            <div className="tablewrap"><table>
              <thead><tr><th>Moment</th><th>In reel</th><th>Rank</th></tr></thead>
              <tbody>{item.clips.map((c) => (
                <tr key={c.id}><td>{c.label}</td><td>{c.included ? `${c.start_s.toFixed(1)}–${c.end_s.toFixed(1)} s` : "Left out"}</td><td>{c.rank.toFixed(2)}</td></tr>))}
              </tbody>
            </table></div>
          </>
        )}
      </div>

      <div className="act">
        {item.status === "published" || item.status === "scheduled" ? (
          <div className="row">
            <span className="small mut grow">{item.status === "scheduled" ? `Goes live ${time(item.publish_at)}` : `Live since ${time(item.published_at)}`} · approved by {item.approved_by}</span>
            <button className="btn bad" disabled={busy} onClick={() => act(item.id, { action: "unpublish" }, "Removed from the app")}>Unpublish</button>
          </div>
        ) : item.status === "rejected" ? (
          <div className="row"><span className="small mut grow">Rejected. Ask the AI for a new version or reopen it.</span>
            <button className="btn" disabled={busy} onClick={() => act(item.id, { action: "reopen" })}>Reopen</button></div>
        ) : mode === "approve" ? (
          <div className="card" style={{ borderColor: "var(--acc)", display: "grid", gap: 10 }}>
            <b>Publish to {plural(item.reach.all ?? 0)}?</b>
            <div className="row">
              <button className="btn ok" disabled={busy} onClick={async () => { if (await act(item.id, { action: "approve" }, "Published")) setMode("none") }}>Publish now</button>
              <input id="nr-when" type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Publish time" />
              <button className="btn" disabled={busy || !when} onClick={async () => { if (await act(item.id, { action: "approve", publish_at: new Date(when).toISOString() }, "Scheduled")) setMode("none") }}>Schedule</button>
              <button className="btn" onClick={() => setMode("none")}>Cancel</button>
            </div>
          </div>
        ) : mode === "reject" ? (
          <div className="card" style={{ borderColor: "var(--bad)", display: "grid", gap: 10 }}>
            <b>Why are you rejecting it?</b>
            <div className="row">{["Wrong facts", "Tone", "Video rights", "Poor quality"].map((r) => (
              <button key={r} className="btn" disabled={busy} onClick={async () => { if (await act(item.id, { action: "reject", reason: r }, "Rejected")) setMode("none") }}>{r}</button>))}
              <button className="btn" onClick={() => setMode("none")}>Cancel</button></div>
          </div>
        ) : (
          <>
            <div className="row">
              <input id="nr-ask" className="grow" value={ask} onChange={(e) => setAsk(e.target.value)} placeholder="Tell the AI what to change, e.g. shorter, start with the goalie" aria-label="Instruction for the AI" />
              <button className="btn" disabled={busy || !ask.trim()} onClick={async () => { if (await act(item.id, { action: "rewrite", instruction: ask }, "Sent to the AI")) setAsk("") }}>Send to AI</button>
            </div>
            <div className="row">
              <button className="btn ok" disabled={!!block || busy} onClick={() => setMode("approve")}>Approve and publish</button>
              <button className="btn bad" disabled={busy} onClick={() => setMode("reject")}>Reject</button>
              {block && <span className="why">{block}</span>}
            </div>
          </>
        )}
        <div className="log">{item.log.slice(0, 6).map((l, i) => <span key={i}>{time(l.created_at)} {l.editor}: {l.action}{l.reason ? ` · ${l.reason}` : ""}</span>)}</div>
      </div>
    </section>
  );
}

/* ---------------------------------------------------------------- games + jobs */
function Games({ state, team, generate }: { state: NrState; team: (id: string) => string; generate: (g: string, k: Kind[]) => void }) {
  const status = (g: string, k: Kind) => state.items.find((i) => i.game_id === g && i.kind === k);
  return (
    <div style={{ display: "grid", gap: 16, padding: "18px 0 48px" }}>
      <div className="card">
        <h2 style={{ fontFamily: "var(--display)", fontSize: 24 }}>Games</h2>
        <p className="small mut">Run the AI on a game to create drafts. Highlights and podcasts need a finished game; live games get a live text update.</p>
        <div className="tablewrap"><table>
          <thead><tr><th>Game</th><th>Events</th><th>Text</th><th>Video</th><th>Podcast</th><th></th></tr></thead>
          <tbody>{state.games.map((g) => {
            const cell = (k: Kind) => { const it = status(g.id, k); return it ? <span className={`pill ${it.status}`}>{ST[it.status]}</span> : <span className="mut">–</span> };
            const kinds: Kind[] = g.status === "final" ? ["summary", "highlight", "podcast"] : ["summary"];
            return (
              <tr key={g.id}>
                <td><b>{team(g.home_id)} {g.home_score}–{g.away_score} {team(g.away_id)}</b><div className="small mut">{g.status} · {time(g.starts_at)}</div></td>
                <td>{g.event_count}</td><td>{cell("summary")}</td><td>{cell("highlight")}</td><td>{cell("podcast")}</td>
                <td>{g.status !== "scheduled" && <button className="btn sm pri" data-run={g.id} onClick={() => generate(g.id, kinds)}>Run AI</button>}</td>
              </tr>);
          })}</tbody>
        </table></div>
      </div>
      <div className="card">
        <h2 style={{ fontFamily: "var(--display)", fontSize: 24 }}>AI jobs</h2>
        <div className="tablewrap"><table>
          <thead><tr><th>Job</th><th>Game</th><th>Model</th><th>Tokens in / out</th><th>Result</th><th>Status</th></tr></thead>
          <tbody>{state.jobs.map((j) => (
            <tr key={j.id}>
              <td><b>{j.kind}</b><div className="small mut">{time(j.created_at)}</div></td>
              <td className="small">{j.game_id}</td><td className="mono">{j.model}</td>
              <td className="mono">{j.input_tokens} / {j.output_tokens}</td>
              <td className="small">{j.error ? <span className="why">{j.error}</span> : j.note}</td>
              <td><span className={`pill ${j.status}`}>{j.status}</span></td>
            </tr>))}</tbody>
        </table></div>
      </div>
    </div>
  );
}

function How() {
  const steps = [
    ["Capture the game", "Liiga events (goals, saves, penalties, shots) arrive in game_events, from the sample data or POST /import/game on the worker."],
    ["Write the summary", "Claude Sonnet writes a fact sheet-based report in Finnish, Swedish and English, each as quick read, full story and fan voice. Every claim cites a Liiga fact."],
    ["Check the facts", "Code, not AI, compares each claim and every number with the Liiga data. Mismatches block approval."],
    ["Make video and podcast", "FFmpeg builds the highlight reel (from licensed footage, or a data video from events). Claude writes a two-host script; Azure neural voices read it."],
    ["Approve", "You approve, schedule, reject or ask the AI to change something. Every action is logged."],
    ["Deliver", "The app reads only published content (row-level security) and picks the variant matching each reader's language and style."],
  ];
  return (
    <div className="card" style={{ margin: "18px 0 48px" }}>
      <h2 style={{ fontFamily: "var(--display)", fontSize: 24 }}>From the rink to the reader</h2>
      <ol style={{ display: "grid", gap: 12, paddingLeft: 20 }}>
        {steps.map(([h, p]) => <li key={h}><b>{h}</b><div className="small mut">{p}</div></li>)}
      </ol>
    </div>
  );
}
