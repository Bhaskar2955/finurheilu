import type { CSSProperties, ReactNode } from "react";
import { T, logoUrl } from "../lib/data";
import { FLAG, IC } from "../lib/icons";
import { live } from "../lib/live";
import { act, app, s, save, useApp } from "../lib/state";
import { LANGS, applyMode, isLight } from "../lib/util";

/** Trusted, app-generated SVG/markup (icons, charts). Never used for user text. */
export function Html({ html, className, style, as = "span" }: { html: string; className?: string; style?: CSSProperties; as?: "span" | "div" }) {
  const Tag = as;
  return <Tag className={className} style={style} dangerouslySetInnerHTML={{ __html: html }} />;
}

export const Icon = ({ k, size }: { k: string; size?: number }) => {
  let svg: string = k.startsWith("nav") ? IC.nav[+k.slice(3)] : IC[k];
  if (size) svg = svg.replace("<svg", `<svg width="${size}" height="${size}"`);
  return <Html html={svg} style={{ display: "inline-flex" }} />;
};
export const lockSvg = (n?: number) => (n ? IC.lock.replace('class="lk"', `class="lk" width="${n}" height="${n}"`) : IC.lock);
export const Lock = ({ size }: { size?: number }) => <Html html={lockSvg(size)} style={{ display: "inline-flex" }} />;

export function Flag({ l, w = 24, h = 16 }: { l: string; w?: number; h?: number }) {
  return <span className="flag" style={{ width: w, height: h }} dangerouslySetInnerHTML={{ __html: FLAG[l].replace("<svg", `<svg width="${w}" height="${h}"`) }} />;
}

export function Crest({ name, size = 34 }: { name: string; size?: number }) {
  const z = Math.round(size * 1.35);
  if (!T[name]) return null;
  return (
    <span className="crest lg" title={name} style={{ width: z, height: z }}>
      <img src={logoUrl(name)} alt={name} width={z} height={z} onError={(e) => ((e.currentTarget.style.visibility = "hidden"))} />
    </span>
  );
}

/** Top bar: brand (or a back button), light/dark switch, notifications, language menu. */
export function Header({ left }: { left?: ReactNode }) {
  const a = useApp();
  const x = s();
  return (
    <div className="hdr">
      {left || (
        <div className="brand">
          <Html html={IC.logo} />
          <span>Fin<b>Urheilu</b></span>
        </div>
      )}
      <span className="spacer" />
      <button className="icon" aria-label={isLight() ? x.dark : x.light} onClick={() => act((st) => { st.P.mode = isLight() ? "dark" : "light"; applyMode(); }, { persist: true })}>
        <Icon k={isLight() ? "moon" : "sun"} />
      </button>
      {a.P.screen === "app" && (
        <button className="icon" aria-label={x.notifs} onClick={() => act((st) => { st.overlay = { notif: 1 }; live.goals = 0; }, { top: true })}>
          <Icon k="bell" />
          {live.goals > 0 && <span className="dot" />}
        </button>
      )}
      <div className="langwrap">
        <button className="langbtn" aria-expanded={a.langOpen} aria-label={x.lang} onClick={() => act((st) => { st.langOpen = !st.langOpen; })}>
          <Flag l={a.P.lang} />
          {a.P.lang.toUpperCase()}
        </button>
        {a.langOpen && (
          <div className="langmenu">
            {LANGS.map(([k, n]) => (
              <button key={k} aria-pressed={a.P.lang === k} onClick={() => act((st) => { st.P.lang = k; st.langOpen = false; document.documentElement.lang = k; }, { persist: true })}>
                <Flag l={k} w={28} h={18} />
                <span>{n}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export const BackBtn = ({ onClick }: { onClick: () => void }) => (
  <button className="icon" aria-label={s().back} onClick={onClick}>
    <Icon k="back" />
  </button>
);

export function Toast() {
  const a = useApp();
  return a.toast ? <div className="toast" role="status">{a.toast}</div> : null;
}

/** Claims in a story render bold, exactly like the prototype's R2(). */
export function Toks({ toks }: { toks: any[] | null | undefined }) {
  return (
    <>
      {(toks || []).map((t, i) => (!t ? null : t.cl ? <b key={i}>{t.v}</b> : <span key={i}>{t}</span>))}
    </>
  );
}

export function Seg<K extends string>({ items, value, onPick, small }: { items: [K, ReactNode][]; value: K; onPick: (k: K) => void; small?: boolean }) {
  return (
    <div className={`seg${small ? " sm" : ""}`}>
      {items.map(([k, n]) => (
        <button key={k} aria-pressed={value === k} onClick={() => onPick(k)}>{n}</button>
      ))}
    </div>
  );
}

export const openPaywall = () =>
  act((st) => { if (st.P.screen === "app") st.overlay = { pay: 1 }; else st.P.screen = "plans"; }, { top: true });

export const setPref = (fn: (p: typeof app.P) => void) => act((st) => fn(st.P), { persist: true });
export { save };
