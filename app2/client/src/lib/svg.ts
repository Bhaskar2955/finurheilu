// @ts-nocheck
/** SVG charts for live analytics and player cards (markup strings, rendered with <Html>). */
/* eslint-disable */
import { T } from "./data";
const esc=(v)=>String(v).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
import { gs, live } from "./live";

export function gauge(p?):any{const cx=150,cy=150,r=110;const pt=(v,rr)=>{const a=Math.PI*(1-v/100);return [cx+rr*Math.cos(a),cy-rr*Math.sin(a)]};
 const arc=(v0,v1,col,w)=>{const [x0,y0]=pt(v0,r),[x1,y1]=pt(v1,r);return `<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A${r} ${r} 0 0 1 ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="${w}"/>`};
 let ticks="";for(let v=0;v<=100;v+=10){const [x,y]=pt(v,r-28);ticks+=`<text x="${x.toFixed(1)}" y="${(y+4).toFixed(1)}" text-anchor="middle" font-size="11" fill="var(--muted)" font-weight="600">${v}</text>`}
 for(let v=0;v<=100;v+=2.5){const [x0,y0]=pt(v,r+10),[x1,y1]=pt(v,r+(v%10===0?18:14));ticks+=`<line x1="${x0.toFixed(1)}" y1="${y0.toFixed(1)}" x2="${x1.toFixed(1)}" y2="${y1.toFixed(1)}" stroke="var(--line)" stroke-width="1.5"/>`}
 const [nx,ny]=pt(p,r-8);
 return `<svg viewBox="0 0 300 175" role="img" aria-label="${p}%">${arc(0,100,"var(--line)",16)}${arc(0,p,"var(--blue)",16)}${arc(p,100,"var(--red)",16)}${ticks}
  <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="var(--ink)" stroke-width="4" stroke-linecap="round" style="transition:all .6s"/><circle cx="${cx}" cy="${cy}" r="8" fill="var(--ink)"/><circle cx="${cx}" cy="${cy}" r="3" fill="var(--card)"/></svg>`}
export function flowChart(g?):any{const st=gs(g.id);const W=300,H=150,mid=75,bw=W/60;const mx=3;
 let bars="";st.tl.forEach((m,i)=>{const x=i*bw+.5;const hh=m.h/mx*60,ha=m.a/mx*60;
  if(m.h)bars+=`<rect x="${x.toFixed(1)}" y="${(mid-hh).toFixed(1)}" width="${(bw-1).toFixed(1)}" height="${hh.toFixed(1)}" rx="1" fill="var(--blue)"/>`;
  if(m.a)bars+=`<rect x="${x.toFixed(1)}" y="${mid}" width="${(bw-1).toFixed(1)}" height="${ha.toFixed(1)}" rx="1" fill="var(--red)"/>`;
  if(m.g)bars+=`<circle cx="${(x+bw/2).toFixed(1)}" cy="${m.g==="h"?(mid-hh-7).toFixed(1):(mid+ha+7).toFixed(1)}" r="4" fill="var(--gold)" stroke="var(--card)" stroke-width="1.5"/>`});
 const lines=[20,40].map(v=>`<line x1="${v*bw}" y1="6" x2="${v*bw}" y2="${H-6}" stroke="var(--line)" stroke-dasharray="3 3"/>`).join("");
 const lbl=[0,20,40,60].map(v=>`<text x="${Math.min(W-10,Math.max(8,v*bw))}" y="${H+12}" text-anchor="middle" font-size="10" fill="var(--muted)">${v}'</text>`).join("");
 const now=`<line x1="${Math.min(60,live.min)*bw}" y1="2" x2="${Math.min(60,live.min)*bw}" y2="${H-2}" stroke="var(--cyan)" stroke-width="2"/>`;
 return `<svg viewBox="0 0 ${W} ${H+16}" role="img" aria-label="flow"><line x1="0" y1="${mid}" x2="${W}" y2="${mid}" stroke="var(--muted)" stroke-width="1"/>${lines}${bars}${now}${lbl}</svg>`}
export function miniGauge(v?,col?):any{const cx=70,cy=70,r=52;const c=Math.max(-5,Math.min(5,v));const pt=(x,rr)=>{const a=Math.PI*(1-(x+5)/10);return [cx+rr*Math.cos(a),cy-rr*Math.sin(a)]};
 const [x0,y0]=pt(0,r),[x1,y1]=pt(c,r),[nx,ny]=pt(c,r-10);const sweep=c>=0?1:0;
 return `<svg viewBox="0 0 140 92"><path d="M18 70A52 52 0 0 1 122 70" fill="none" stroke="var(--line)" stroke-width="12"/>${Math.abs(c)>.01?`<path d="M${x0.toFixed(1)} ${y0.toFixed(1)}A52 52 0 0 ${sweep} ${x1.toFixed(1)} ${y1.toFixed(1)}" fill="none" stroke="${col}" stroke-width="12"/>`:""}
  <line x1="${cx}" y1="${cy}" x2="${nx.toFixed(1)}" y2="${ny.toFixed(1)}" stroke="${col}" stroke-width="3" stroke-linecap="round"/><circle cx="${cx}" cy="${cy}" r="5" fill="${col}"/>
  <text x="10" y="88" font-size="10" fill="var(--muted)">−5</text><text x="130" y="88" font-size="10" fill="var(--muted)" text-anchor="end">+5</text><text x="70" y="12" font-size="10" fill="var(--muted)" text-anchor="middle">0</text></svg>`}
export function cmpRow(label?,a?,b?,fa=v=>v,fb=v=>v):any{const t=(+a)+(+b)||1;return `<span class="v" style="color:var(--blue)">${fa(a)}</span><span class="lbl">${label}</span><span class="v" style="color:var(--red);text-align:end">${fb(b)}</span>
 <div class="bar2"><i style="width:${a/t*100}%;background:var(--blue)"></i><i style="width:${b/t*100}%;background:var(--red)"></i></div>`}
export function avatar(p?,size=40):any{const t=T[p.team];const gk=p.pos==="G";return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true" style="flex:0 0 auto;border-radius:50%;display:block;width:${size}px;height:${size}px"><rect width="40" height="40" fill="var(--card-2)"/>
 ${gk?`<rect x="13" y="7" width="14" height="16" rx="7" fill="#e6ecf4"/><path d="M15 13h10M15 16h10M15 19h10" stroke="#8a97ab" stroke-width="1"/>`:`<circle cx="20" cy="15" r="7" fill="#d9c2a8"/><path d="M13 13a7 7 0 0 1 14 0z" fill="${t.col}"/>`}
 <path d="M5 40c1-9 7-14 15-14s14 5 15 14z" fill="${t.col}"/><text x="20" y="38" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="10" fill="#fff">${p.no}</text></svg>`}
export function ring(v?,label?):any{const r=22,c=2*Math.PI*r;const col=v>=50?"var(--teal)":"var(--red)";
 return `<div class="ring"><svg width="58" height="58" viewBox="0 0 58 58" style="width:58px;height:58px"><circle cx="29" cy="29" r="${r}" fill="none" stroke="var(--card-2)" stroke-width="5"/><circle cx="29" cy="29" r="${r}" fill="none" stroke="${col}" stroke-width="5" stroke-linecap="round" stroke-dasharray="${(c*v/100).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 29 29)"/><text x="29" y="35" text-anchor="middle" font-family="Barlow Condensed,Arial Narrow,sans-serif" font-weight="800" font-size="19" fill="${col}">${v}</text></svg><span>${esc(label)}</span></div>`}
export function mbar(label?,raw?,pct?,bad?):any{const good=bad?pct<50:pct>=50;const col=good?"var(--teal)":"var(--red)";
 return `<div class="mbar"><div class="t"><span>${esc(label)} · ${esc(String(raw))}</span><b style="color:${col}">${pct}</b></div><div class="tr"><i style="width:${pct}%;background:${col}"></i></div></div>`}
