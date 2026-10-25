/** "Playoff chances" card on Home: every team's chance to reach the qualifiers, quarters, semis and final. */
import { useState } from "react";
import { getOdds, FORMAT, type OddsRow } from "../lib/odds";
import { app, emit, s, useApp } from "../lib/state";
import { Crest } from "./ui";

const pct = (p: number) => (p >= 0.995 && p < 1 ? ">99%" : p > 0 && p < 0.005 ? "<1%" : Math.round(p * 100) + "%");

function Cell({ p, strong }: { p: number; strong?: boolean }) {
  // The number carries the meaning; the tint only helps scanning.
  return (
    <td className={`od ${strong ? "odm" : ""}`} style={{ ["--p" as any]: Math.round(p * 100) + "%" }}>
      <span>{pct(p)}</span>
    </td>
  );
}

export function PlayoffOdds() {
  useApp();
  const x = s();
  const [all, setAll] = useState(false);
  const res = getOdds(emit);
  const mine = new Set(app.P.teams);
  if (!res) return (
    <div className="c odds"><div className="l">{x.odH}</div><p className="small muted" style={{ margin: 0 }}>{x.odCalc}</p></div>
  );
  const rows: OddsRow[] = all ? res.rows : res.rows.filter((r) => mine.has(r.team));
  const shown = rows.length ? rows : res.rows.slice(0, 4);
  return (
    <div className="c odds">
      <div className="between">
        <div><div className="l">{x.odH}</div><div className="small muted">{x.odSub}</div></div>
      </div>
      <div className="odwrap">
        <table className="odt">
          <thead>
            <tr>
              <th className="otm">{x.odTeam}</th>
              <th title={x.odPlayoffsT}>{x.odPlayoffs}</th>
              <th title={x.odQfT}>{x.odQf}</th>
              <th>{x.odSf}</th>
              <th>{x.odFinal}</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((r) => (
              <tr key={r.team} className={mine.has(r.team) ? "me" : ""} style={r.rank === FORMAT.direct || r.rank === FORMAT.playoffs ? { borderBottom: "2px dashed var(--cyan)" } : undefined}>
                <td className="otm"><span className="otmi"><span className="orank">{r.rank}.</span><Crest name={r.team} size={18} /><b>{r.team}</b></span></td>
                <Cell p={r.playoffs} />
                <Cell p={r.qf} />
                <Cell p={r.sf} />
                <Cell p={r.final} strong />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" className="link" onClick={() => setAll(!all)}>{all ? x.odMine : x.odAll(res.rows.length)}</button>
      <p className="small muted" style={{ margin: 0 }}>{x.odFormat}</p>
      <p className="small muted" style={{ margin: 0 }}>{x.odHow(res.sims.toLocaleString(app.P.lang === "en" ? "en-GB" : "fi-FI"), res.games)}</p>
    </div>
  );
}
