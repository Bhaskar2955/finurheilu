/** Liiga goal clips: a scrollable strip of clip cards, and the video player overlay. */
import { useEffect, useRef, useState } from "react";
import { T } from "../lib/data";
import { attachClip, closeClip, openClip, stepClip, useClips, viewer, type Clip } from "../lib/highlights";
import { stopAllMedia } from "../lib/media";
import { app, s, useApp } from "../lib/state";
import { fDate } from "../lib/stories";
import { Crest } from "./ui";

const PlayIcon = ({ size = 18 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5z" /></svg>
);

/** Clip cards for one team ("" = the whole league). */
export function ClipStrip({ team }: { team: string }) {
  useApp();
  const x = s();
  const e = useClips(team);
  let body: React.ReactNode;
  if (e.state === "loading") body = <p className="small muted" style={{ margin: 0 }}>{x.hlLoading}</p>;
  else if (e.source === "sample") body = <p className="small muted" style={{ margin: 0 }}>{x.hlSample}</p>;
  else if (!e.clips.length) body = <p className="small muted" style={{ margin: 0 }}>{e.state === "error" ? x.errNet : x.hlNone}</p>;
  else
    body = (
      <div className="cliprow">
        {e.clips.slice(0, 12).map((c, i) => <ClipCard key={c.key} c={c} onClick={() => openClip(e.clips, i)} />)}
      </div>
    );
  return (
    <div className="clips">
      <div><div className="l">{x.hlH}</div><div className="small muted">{x.hlSub}</div></div>
      {body}
    </div>
  );
}

function ClipCard({ c, onClick }: { c: Clip; onClick: () => void }) {
  const x = s();
  const [bad, setBad] = useState(false);
  return (
    <button type="button" className="clipc" onClick={onClick} aria-label={`${x.hlWatch}: ${c.scorer ?? c.team} ${c.min}' (${c.score})`}>
      <span className="cthumb" style={{ ["--tc" as any]: T[c.team]?.col || "#2F80FF" }}>
        {c.thumb && !bad ? <img src={c.thumb} alt="" loading="lazy" onError={() => setBad(true)} /> : <Crest name={c.team} size={34} />}
        <span className="cplay"><PlayIcon /></span>
        <span className="cmin">{c.min}' · {c.score}</span>
      </span>
      <span className="cinfo">
        <b>{c.scorer ?? c.team}</b>
        <span className="small muted">{c.h} {c.hs}–{c.as} {c.a} · {fDate(c.d, app.P.lang)}</span>
      </span>
    </button>
  );
}

/** Plays a clip: MP4/WebM directly, HLS natively (Safari) or via hls.js; falls back to a link to Liiga's server. */
function ClipVideo({ c }: { c: Clip }) {
  const x = s();
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    setErr(false);
    const v = ref.current;
    if (!v) return;
    return attachClip(v, c.clip, () => setErr(true));
  }, [c.clip]);
  return (
    <>
    <div className="clipv">
      <video ref={ref} controls playsInline poster={c.thumb ?? undefined} onError={() => setErr(true)} />
      {err && <div className="cliperr"><p>{x.hlErr}</p><a className="btn" href={c.clip} target="_blank" rel="noopener noreferrer">{x.hlOpen}</a></div>}
    </div>
    {!err && <a className="small" href={c.clip} target="_blank" rel="noopener noreferrer">{x.hlOpen}</a>}
    </>
  );
}

/** The overlay player; mounted once in App. */
export function ClipPlayer() {
  useApp();
  const x = s();
  const c = viewer.i >= 0 ? viewer.list[viewer.i] : null;
  useEffect(() => {
    if (!c) return;
    stopAllMedia();
    document.documentElement.style.overflow = "hidden";
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeClip();
      else if (e.key === "ArrowRight") stepClip(1);
      else if (e.key === "ArrowLeft") stepClip(-1);
    };
    document.addEventListener("keydown", key);
    return () => { document.documentElement.style.overflow = ""; document.removeEventListener("keydown", key); };
  }, [!!c]);
  if (!c) return null;
  const many = viewer.list.length > 1;
  return (
    <div className="clipm" role="dialog" aria-modal="true" aria-label={x.hlH} onClick={(e) => { if (e.target === e.currentTarget) closeClip(); }}>
      <div className="clipbox">
        <div className="cliphd">
          <Crest name={c.h} size={26} /><b className="d">{c.hs}–{c.as}{c.x ? " " + c.x : ""}</b><Crest name={c.a} size={26} />
          <span className="grow small muted">{fDate(c.d, app.P.lang)}</span>
          <button type="button" className="icon sm" aria-label={x.hlClose} onClick={closeClip}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
        <ClipVideo key={c.key} c={c} />
        <div className="clipft">
          {many && <button type="button" className="smallbtn" aria-label={x.hlPrev} onClick={() => stepClip(-1)}>‹</button>}
          <div className="grow">
            <b>{c.scorer ?? c.team}</b> <span className="muted">· {c.team} · <span className="nw">{x.hlPer(c.period)} {c.min}'</span> · <span className="nw">{c.score}</span></span>
            {many && <div className="small muted">{viewer.i + 1} / {viewer.list.length}</div>}
          </div>
          {many && <button type="button" className="smallbtn" aria-label={x.hlNext} onClick={() => stepClip(1)}>›</button>}
        </div>
      </div>
    </div>
  );
}

/** A scene inside the data video: the Liiga goal clip plays muted while that scene is on screen. */
export function ClipScene({ c, active }: { c: Clip; active: boolean }) {
  const x = s();
  const ref = useRef<HTMLVideoElement>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    const v = ref.current;
    if (!v || !active || err) return;
    v.muted = true;
    return attachClip(v, c.clip, () => setErr(true));
  }, [active, c.clip, err]);
  return (
    <>
      <div className="clipscene">
        {!err && <video ref={ref} muted playsInline loop poster={c.thumb ?? undefined} onError={() => setErr(true)} />}
        {err && (c.thumb ? <img src={c.thumb} alt="" /> : <Crest name={c.team} size={60} />)}
      </div>
      <div className="cap">{x.clipScene} · {c.min}' · {c.score}</div>
      <div className="cap">{c.scorer ?? c.team}</div>
    </>
  );
}
