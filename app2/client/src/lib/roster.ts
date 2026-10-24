// @ts-nocheck
/** Demo rosters and player analytics (simulated), from the 2.0 prototype. */
/* eslint-disable */
import { TEAMS } from "./data";
import { s } from "./state";
import { gs, live } from "./live";

export const FNAMES=["Aleksi","Eetu","Juho","Kasper","Lauri","Mikko","Niko","Otto","Rasmus","Santeri","Teemu","Valtteri","Veeti","Joonas","Henri","Arttu","Jere","Konsta","Oskari","Roope","Elias","Leevi"];
export const LNAMES=["Ahonen","Halme","Heikkilä","Kallio","Koskinen","Lehto","Mäkelä","Niemi","Nurmi","Ojala","Rantanen","Salo","Tuominen","Valo","Virta","Laine","Hakala","Peltola","Kivelä","Aalto","Hirvonen","Lindqvist"];
export function rng(seed?):any{let a=seed>>>0;return()=>{a=(a+0x6D2B79F5)>>>0;let t=a;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296}}
const ROSTER={};
export const resetRosters=()=>{for(const k in ROSTER)delete ROSTER[k]};
export function roster(tm?):any{if(ROSTER[tm])return ROSTER[tm];const r=rng(TEAMS.findIndex(t=>t.name===tm)*977+13);const used=new Set(),nums=new Set();
 const pick=()=>{let n;do{n=FNAMES[Math.floor(r()*FNAMES.length)]+" "+LNAMES[Math.floor(r()*LNAMES.length)]}while(used.has(n));used.add(n);return n};
 const num=(lo,hi)=>{let k;do{k=lo+Math.floor(r()*(hi-lo))}while(nums.has(k));nums.add(k);return k};
 const L=[{pos:"G",no:num(30,40)},{pos:"G",no:num(30,40)}];for(let i=0;i<9;i++)L.push({pos:"F",no:num(10,99)});for(let i=0;i<6;i++)L.push({pos:"D",no:num(2,80)});
 L.forEach(p=>{p.n=pick();p.team=tm;p.id=tm+"#"+p.no;p.base={att:35+r()*50,def:35+r()*50,sho:30+r()*55,pas:30+r()*55,ska:40+r()*45}});
 return ROSTER[tm]=L}
export const skaters=tm=>roster(tm).filter(p=>p.pos!=="G");
export const findPlayer=id=>{const i=id.lastIndexOf("#");return roster(id.slice(0,i)).find(p=>String(p.no)===id.slice(i+1))};
export const fmtT=v=>{v=Math.round(v);return Math.floor(v/60)+":"+String(v%60).padStart(2,"0")};
export const clp=v=>Math.max(1,Math.min(99,Math.round(v)));
export function pst(st?,p?):any{st.ps=st.ps||{};return st.ps[p.id]||(st.ps[p.id]={g:0,a:0,s:0,pm:0,toi:0,xg:0})}
export function wpick(list?):any{const w=list.map(p=>p.pos==="F"?3:1);let r=Math.random()*w.reduce((a,b)=>a+b,0);for(let i=0;i<list.length;i++){r-=w[i];if(r<=0)return list[i]}return list[0]}
export function playMinute(g?,st?):any{[g.h,g.a].forEach(tm=>skaters(tm).forEach(p=>{pst(st,p).toi+=p.pos==="D"?19+Math.random()*9:12+Math.random()*10}))}
export function addShots(g?,st?,nh?,na?):any{[[g.h,nh],[g.a,na]].forEach(([tm,n])=>{for(let k=0;k<n;k++){const q=pst(st,wpick(skaters(tm)));q.s++;q.xg+=.04+Math.random()*.12}})}
export function goalBy(g?,st?,home?):any{const tm=home?g.h:g.a,op=home?g.a:g.h;const sk=skaters(tm);const sc=wpick(sk);const q=pst(st,sc);q.g++;q.s++;q.xg+=.22;
 const rest=sk.filter(p=>p!==sc).sort(()=>Math.random()-.5);const na=Math.random()<.15?0:Math.random()<.4?1:2;const as=rest.slice(0,na);as.forEach(p=>pst(st,p).a++);
 [sc,...rest.slice(0,4)].forEach(p=>pst(st,p).pm++);[...skaters(op)].sort(()=>Math.random()-.5).slice(0,5).forEach(p=>pst(st,p).pm--);
 return {id:sc.id,no:sc.no,n:sc.n}}
export function goalieLine(g?,st?,home?):any{const p=roster(home?g.h:g.a)[0];const sa=home?st.sa:st.sh,ga=home?st.as:st.hs,sv=sa-ga;return {p,sa,ga,sv,svp:sa?sv/sa:1,gsax:(home?st.xa:st.xh)-ga,toi:Math.min(live.min,60)*60}}
export function bestList(g?):any{const x=s();const st=gs(g.id);const L=[];
 [g.h,g.a].forEach(tm=>skaters(tm).forEach(p=>{const q=pst(st,p);L.push({p,r:q.g*3+q.a*2+q.s*.4+q.pm*.8+q.xg+q.toi/3000,line:`${q.g}+${q.a} · ${q.s} ${x.laCols[2]}`})}));
 [true,false].forEach(h=>{const G=goalieLine(g,st,h);L.push({p:G.p,r:G.sv*.3+G.gsax*1.5,line:`${G.sv} ${x.laGcols[1]} · ${(G.svp*100).toFixed(1)}%`})});
 return L.sort((a,b)=>b.r-a.r).slice(0,3)}
export function pModel(p?,g?):any{const x=s();const st=g?gs(g.id):{};
 if(p.pos==="G"){const starter=roster(p.team)[0]===p;const L=g&&starter?goalieLine(g,st,p.team===g.h):{sa:0,sv:0,ga:0,svp:1,gsax:0,toi:0};
  return {rings:[clp(20+L.sv*3),clp((L.svp-.8)*450),clp(50+L.gsax*18),clp(p.base.def),clp(p.base.ska)].map((v,i)=>[v,x.laRingsG[i]]),
   bars:[[x.laBarsG[0],L.sa,clp(L.sa*2.4)],[x.laBarsG[1],L.sv,clp(L.sv*2.6)],[x.laBarsG[2],Math.round(L.sv*.3),clp(L.sv*1.1+p.base.sho/3)],[x.laBarsG[3],L.ga,clp(L.ga*16),1],[x.laBarsG[4],fmtT(L.toi),clp(L.toi/36)]],
   tiles:[[x.laGcols[0],L.sa],[x.laGcols[1],L.sv],[x.laGcols[2],L.ga],[x.laGcols[3],(L.svp*100).toFixed(1)],["GSAx",(L.gsax>=0?"+":"")+L.gsax.toFixed(2)],[x.laGcols[4],fmtT(L.toi)]],
   art:x.laArtG(p.n,p.team,L.sv,L.ga,(L.svp*100).toFixed(1)+" %")}}
 const q=g?pst(st,p):{g:0,a:0,s:0,pm:0,toi:0,xg:0};
 return {rings:[clp(p.base.att+q.g*8+q.a*5+q.s*2),clp(p.base.def+q.pm*6),clp(p.base.sho+q.g*6+q.s*3),clp(p.base.pas+q.a*9),clp(p.base.ska+q.toi/90)].map((v,i)=>[v,x.laRingsF[i]]),
  bars:[[x.laBarsF[0],q.xg.toFixed(2),clp(q.xg*70)],[x.laBarsF[1],fmtT(q.toi),clp(q.toi/14+q.s*5)],[x.laBarsF[2],q.s,clp(q.s*14)],[x.laBarsF[3],q.a,clp(q.a*30)],[x.laBarsF[4],(q.pm>0?"+":"")+q.pm,clp(50+q.pm*15)]],
  tiles:[[x.laCols[0],q.g],[x.laCols[1],q.a],["P",q.g+q.a],[x.laCols[2],q.s],[x.laCols[3],(q.pm>0?"+":"")+q.pm],[x.laCols[4],fmtT(q.toi)]],
  art:x.laArtF(p.n,p.team,q.g,q.a,q.s,q.pm)}}
