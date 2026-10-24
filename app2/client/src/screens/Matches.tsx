/** Matches: upcoming games, results and the pick'em game. */
import { GAMES, RESULTS } from "../lib/data";
import { act, app, s, useApp } from "../lib/state";
import { TODAY, dayName, gTime, isMine } from "../lib/util";
import { AdCard, McCard } from "../components/cards";
import { Crest, Seg } from "../components/ui";

export function Matches() {
  const a = useApp();
  const x = s();
  return (
    <>
      <h2 className="title">{x.nav[1]}</h2>
      <div style={{ marginTop: 12 }}>
        <Seg items={[["upcoming", x.upcoming], ["recent", x.recent], ["pickem", x.pickem]]} value={a.mSeg} onPick={(k) => act((st) => { st.mSeg = k; })} />
      </div>
      {a.mSeg !== "pickem" && (
        <div className="row" style={{ marginTop: 10 }}>
          <button className="chip" aria-pressed={a.mFil === "mine"} onClick={() => act((st) => { st.mFil = "mine"; })}>{x.mine}</button>
          <button className="chip" aria-pressed={a.mFil === "all"} onClick={() => act((st) => { st.mFil = "all"; })}>{x.all}</button>
        </div>
      )}
      <div className="stack" style={{ marginTop: 12, gap: 8 }}>{a.mSeg === "pickem" ? <Pickem /> : <MatchList />}</div>
    </>
  );
}

function MatchList() {
  const a = useApp();
  const x = s();
  const res = a.mSeg === "recent";
  let list = (res ? [...RESULTS].reverse() : GAMES).filter((g) => a.mFil === "all" || isMine(g));
  if (res) list = list.slice(0, 30);
  else list = list.slice(0, 80);
  const days = [...new Set(list.map((g) => g.d))];
  if (!days.length) return <p className="muted">–</p>;
  return (
    <>
      {days.map((d, di) => (
        <div key={d} className="stack" style={{ gap: 8 }}>
          <div className="dayh">{d === TODAY ? x.today + " · " : ""}{dayName(d)}</div>
          {list.filter((g) => g.d === d).map((g) => <McCard key={g.id} g={g} res={res} />)}
          {di % 2 === 1 && <AdCard i={di + 1} />}
        </div>
      ))}
    </>
  );
}

function Pickem() {
  const a = useApp();
  const x = s();
  const now = Date.now();
  const fut = GAMES.filter((g) => gTime(g) > now);
  if (!fut.length) return <p className="muted">{x.noRound}</p>;
  const d = fut.map((g) => g.d).sort()[0];
  const round = GAMES.filter((g) => g.d === d);
  const picks = a.P.picks || {};
  let mine = 0, pend = 0;
  Object.entries(picks).forEach(([id, k]) => {
    const g = GAMES.find((z) => z.id === id) || null;
    const r = g && RESULTS.find((z) => z.d === g.d && z.h === g.h);
    if (!r) { pend++; return; }
    if ((r.hs > r.as ? "h" : "a") === k) mine += 10;
  });
  const board = [{ n: x.you, p: mine, me: 1 }, { n: "Aino", p: 40 }, { n: "Rahul", p: 30 }, { n: "Olena", p: 30 }, { n: "Mikko", p: 20 }].sort((p, q) => q.p - p.p);
  const pick = (id: string, k: string) => act((st) => { st.P.picks = { ...(st.P.picks || {}), [id]: k }; }, { persist: true });
  return (
    <>
      <p className="small muted" style={{ margin: 0 }}>{x.pickemSub}</p>
      <div className="dayh">{dayName(d)}</div>
      {round.map((g) => {
        const lk = gTime(g) <= now;
        const pk = picks[g.id];
        return (
          <div key={g.id} className="c pkrow">
            <button className="pk" aria-pressed={pk === "h"} disabled={lk} onClick={() => pick(g.id, "h")}><Crest name={g.h} size={24} /><b>{g.h}</b></button>
            <span className="small muted">{lk ? x.lockedP : g.t}</span>
            <button className="pk" aria-pressed={pk === "a"} disabled={lk} onClick={() => pick(g.id, "a")}><b>{g.a}</b><Crest name={g.a} size={24} /></button>
          </div>
        );
      })}
      <div className="l" style={{ marginTop: 14 }}>{x.board}</div>
      <div className="c" style={{ marginTop: 8 }}>
        {board.map((b, i) => (
          <div key={b.n} className="set"><span className="small muted">{i + 1}.</span><span className="grow"><b>{b.n}</b>{!(b as any).me && <span className="small muted"> · {x.demoFans}</span>}</span><b>{b.p}</b></div>
        ))}
      </div>
      <p className="small muted">{x.pendingP(pend)}</p>
    </>
  );
}

export { app };
