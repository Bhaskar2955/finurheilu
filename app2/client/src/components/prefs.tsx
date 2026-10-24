/** Per-team format buttons and podcast voice picker (onboarding and profile). */
import { act, app, s, toast } from "../lib/state";
import { sampleVoice } from "../lib/media";
import { isPrem, tf } from "../lib/util";
import { Icon, Lock, openPaywall } from "./ui";

export function FmtButtons({ tm }: { tm: string }) {
  const x = s();
  const cur = tf(tm);
  const pr = isPrem();
  return (
    <div className="fmts">
      {(["video", "podcast", "summary"] as const).map((k) =>
        !pr && k !== "summary" ? (
          <button key={k} className="fbtn locked" onClick={openPaywall}><Lock />{x.fmt[k]}</button>
        ) : (
          <button
            key={k}
            className="fbtn"
            aria-pressed={cur.includes(k)}
            onClick={() => {
              if (!isPrem()) { act((a) => { a.P.tf[tm] = ["summary"]; }, { persist: true }); return; }
              const now = tf(tm);
              if (now.includes(k)) {
                if (now.length === 1) { toast(x.needOne); return; }
                act((a) => { a.P.tf[tm] = now.filter((f) => f !== k); }, { persist: true });
              } else act((a) => { a.P.tf[tm] = [...now, k]; }, { persist: true });
            }}
          >
            <Icon k={k} />{x.fmt[k]}
          </button>
        ),
      )}
    </div>
  );
}

export function VoicePick() {
  const x = s();
  if (!isPrem())
    return (
      <button className="teaser" onClick={openPaywall}>
        <Lock /><span>{x.voice} · {x.female} / {x.male} — {x.premium}</span>
      </button>
    );
  return (
    <div className="voice">
      {(["female", "male"] as const).map((v) => (
        <button key={v} className="vbtn" aria-pressed={app.P.voice === v} onClick={() => act((a) => { a.P.voice = v; }, { persist: true })}>
          <b>{x[v]}</b>
          <small>{x.soft}</small>
          <span className="link" onClick={(e) => { e.stopPropagation(); act((a) => { a.P.voice = v; }, { persist: true }); sampleVoice(); }}>▶ {x.preview}</span>
        </button>
      ))}
    </div>
  );
}
