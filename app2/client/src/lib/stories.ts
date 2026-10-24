// @ts-nocheck
/**
 * Story engine + trust layer from the 2.0 prototype.
 * Every number and name in a story is a "claim" that points to the data it came from.
 * verify() re-checks each claim with its own code path; checkText() blocks any number or
 * team name in the final text that no claim backs up.
 */
/* eslint-disable */
import { GAMES, RESULTS, STAND, TEAMS } from "./data";
import { app } from "./state";
import { TODAY, nextGame, posOf, ptsFor, teamRes, weekFrom, wonBy } from "./util";

const MON_EN=["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
export function fDate(d?,L?):any{const [y,m,dd]=d.split("-").map(Number);return L==="en"?`${dd} ${MON_EN[m-1]}`:`${dd}.${m}.`}
export function fOrd(n?,L?):any{if(L!=="en")return String(n);const t=(n%100>=11&&n%100<=13)?"th":({1:"st",2:"nd",3:"rd"}[n%10]||"th");return n+t}
export function fNum(n?,L?):any{const t=n.toFixed(2);return L==="en"?t:t.replace(".",",")}
export const C=(v,k,ref)=>({cl:1,v:String(v),k,ref});
export function K(str?,...vals):any{const out=[];str.forEach((p,i)=>{if(p)out.push(p);if(i<vals.length){const v=vals[i];if(v==null||v==="")return;if(Array.isArray(v))out.push(...v);else out.push(v)}});return out}
export const plain=(toks:any)=>(toks||[]).map((t:any)=>t&&t.cl?t.v:t).join("");

/* demo lower-division league (fictional teams, clearly labelled) */
export const DEMO_T=["Polar Foxes U16","Bay Eagles U16","River Wolves U16","North Stars U16"];
export const DEMO_R=[{id:"j1",d:"2026-10-04",h:DEMO_T[0],a:DEMO_T[1],hs:4,as:2,x:""},{id:"j2",d:"2026-10-05",h:DEMO_T[2],a:DEMO_T[3],hs:1,as:3,x:""},
 {id:"j3",d:"2026-10-11",h:DEMO_T[3],a:DEMO_T[0],hs:2,as:5,x:""},{id:"j4",d:"2026-10-12",h:DEMO_T[1],a:DEMO_T[2],hs:3,as:3,x:""},
 {id:"j5",d:"2026-10-18",h:DEMO_T[0],a:DEMO_T[2],hs:6,as:1,x:""},{id:"j6",d:"2026-10-19",h:DEMO_T[1],a:DEMO_T[3],hs:2,as:4,x:""}];
export function demoStand():any{const m={};DEMO_T.forEach(t=>m[t]=0);DEMO_R.forEach(r=>{if(r.hs>r.as)m[r.h]+=3;else if(r.as>r.hs)m[r.a]+=3;else{m[r.h]+=1;m[r.a]+=1}});return DEMO_T.map(t=>[t,m[t]]).sort((a,b)=>b[1]-a[1])}

/* ---------- context for one team (one game) ---------- */
export function ctx(tm?,L?,rid?):any{const all=teamRes(tm);if(!all.length)return null;
 const idx=rid?all.findIndex(r=>r.id===rid):all.length-1;if(idx<0)return null;
 const r=all[idx],latest=idx===all.length-1,home=r.h===tm,my=home?r.hs:r.as,op=home?r.as:r.hs,opp=home?r.a:r.h,won=my>op,gpn=won?(r.x?2:3):(r.x?1:0);
 const c={r,latest,won,x:r.x,gpn,tmName:tm,oppName:opp,
  tm:C(tm,"team",{rid:r.id}),opp:C(opp,"team",{rid:r.id}),score:C(`${my}–${op}`,"score",{rid:r.id,team:tm}),gp:C(gpn,"gpts",{rid:r.id,team:tm}),date:C(fDate(r.d,L),"date",{rid:r.id,L})};
 const f=all.slice(Math.max(0,idx-4),idx+1),fw=f.filter(z=>wonBy(z,tm)).length,fp=f.reduce((s2,z)=>s2+ptsFor(z,tm),0);
 const LT={en:["W","L"],fi:["V","H"],sv:["V","F"]}[L];
 Object.assign(c,{fnn:f.length,fwn:fw,letters:f.map(z=>wonBy(z,tm)),fn:C(f.length,"formN",{team:tm,rid:r.id}),fw:C(fw,"formW",{team:tm,rid:r.id}),fp:C(fp,"formP",{team:tm,rid:r.id}),fmax:C(f.length*3,"formMax",{team:tm,rid:r.id}),
  fstr:C(f.map(z=>wonBy(z,tm)?LT[0]:LT[1]).join("-"),"formStr",{team:tm,rid:r.id,L})});
 let k=0;for(let i=idx;i>=0;i--){if(wonBy(all[i],tm)===won)k++;else break}c.skn=k;c.sk=C(k,"streak",{team:tm,rid:r.id,won});
 const hh=all.slice(0,idx+1).filter(z=>z.h===opp||z.a===opp);c.hnn=hh.length;c.hn=C(hh.length,"h2hN",{team:tm,opp,rid:r.id});c.hw=C(hh.filter(z=>wonBy(z,tm)).length,"h2hW",{team:tm,opp,rid:r.id});
 if(latest){const i=STAND.findIndex(z=>z[0]===tm);if(i>=0){const row=STAND[i],pos=i+1,pts=row[2];
  Object.assign(c,{hasTable:true,posn:pos,in6:pos<=6,pos:C(fOrd(pos,L),"pos",{team:tm,L}),pts:C(pts,"pts",{team:tm}),ppg:C(fNum(pts/row[1],L),"ppg",{team:tm,L})});
  if(c.in6){c.cushn=pts-STAND[6][2];c.cush=C(c.cushn,"cushion",{team:tm})}else{c.gapn=STAND[5][2]-pts;c.gap=C(c.gapn,"gap6",{team:tm})}
  const wp=pts+3,wpos=1+STAND.filter(z=>z[0]!==tm&&z[2]>wp).length;c.wp=C(wp,"winPts",{team:tm});c.wpos=C(fOrd(wpos,L),"winPos",{team:tm,L});
  c.pnn=STAND.slice(i+1).filter(z=>z[2]>=pts-3).length;c.pn=C(c.pnn,"passN",{team:tm})}
  const ng=nextGame(tm);if(ng){const nh=ng.h===tm,no=nh?ng.a:ng.h;Object.assign(c,{ng,nhome:nh,no:C(no,"team",{gid:ng.id}),nopos:C(fOrd(posOf(no),L),"pos",{team:no,L}),nd:C(fDate(ng.d,L),"gdate",{gid:ng.id,L}),nt:C(ng.t,"gtime",{gid:ng.id})})}}
 return c}

/* ---------- writers in three languages ---------- */
const xtE={OT:" after overtime",SO:" after a shootout"},xtF={OT:" jatkoajalla",SO:" voittolaukauskisan jälkeen"},xtS={OT:" efter förlängning",SO:" efter straffar"};
const pE=n=>n===1?"point":"points",pF=n=>n===1?"piste":"pistettä";
export const NL: any={
en:{head:(c,t)=>c.won?{fan:K`${c.tm} take the win against ${c.opp}!`,neutral:K`${c.tm} beat ${c.opp} ${c.score}`,analyst:K`${c.tm} ${c.score} ${c.opp}: ${c.gp} ${pE(c.gpn)} banked`,kids:K`${c.tm} won against ${c.opp}!`}[t]
  :{fan:K`Tough night: ${c.tm} fall to ${c.opp}`,neutral:K`${c.tm} lose ${c.score} to ${c.opp}`,analyst:K`${c.tm} ${c.score} ${c.opp}: ${c.gp} ${pE(c.gpn)} from the game`,kids:K`${c.tm} lost against ${c.opp} this time`}[t],
 res:(c,t)=>t==="kids"?K`The game ended ${c.score}${xtE[c.x]||""} on ${c.date}. ${c.tm} got ${c.gp} ${pE(c.gpn)}.`:K`${c.tm} ${c.won?"beat":"lost to"} ${c.opp} ${c.score}${xtE[c.x]||""} on ${c.date}, which gave ${c.gp} ${pE(c.gpn)}.`,
 form:(c,t)=>t==="kids"?K`In the last ${c.fn} games they won ${c.fw}.`:K`That makes ${c.fw} ${c.fwn===1?"win":"wins"} in the last ${c.fn} games (${c.fstr}) and ${c.fp} points out of ${c.fmax}.`,
 streak:c=>K`${c.tm} have now ${c.won?"won":"lost"} ${c.sk} games in a row.`,
 table:(c,t)=>t==="kids"?(c.in6?K`${c.tm} are ${c.pos} in the league. The top six go straight to the playoffs!`:K`${c.tm} are ${c.pos} in the league and want to climb into the top six.`)
  :c.in6?(c.cushn===0?K`${c.tm} are ${c.pos} in the table with ${c.pts} points, level on points with seventh place.`:K`${c.tm} are ${c.pos} in the table with ${c.pts} points, ${c.cush} ${pE(c.cushn)} ahead of seventh place.`)
  :(c.gapn===0?K`${c.tm} are ${c.pos} with ${c.pts} points, level on points with sixth place.`:K`${c.tm} are ${c.pos} with ${c.pts} points, ${c.gap} ${pE(c.gapn)} behind the top six.`),
 h2h:c=>K`This season the teams have met ${c.hn} ${c.hnn===1?"time":"times"} in our data, and ${c.tm} won ${c.hw}.`,
 next:c=>K`Next up: ${c.nhome?"at home against":"away at"} ${c.no} (${c.nopos}) on ${c.nd} at ${c.nt}.`,
 scen:c=>c.pnn>0?K`What if: a win would take ${c.tm} to ${c.wp} points and up to ${c.wpos} place if other results stay the same. With a loss, ${c.pn} ${c.pnn===1?"team":"teams"} within three points below could pass them.`
  :K`What if: a win would take ${c.tm} to ${c.wp} points and up to ${c.wpos} place if other results stay the same. No team below is within three points.`,
 ppg:c=>K`Points per game: ${c.ppg}.`,
 close:(c,t)=>t==="fan"?K`Come on, ${c.tm}!`:t==="kids"?(c.won?K`Great job!`:K`They’ll try again next time!`):null,
 why:c=>c.in6?(c.cushn===0?K`${c.tm} are level on points with seventh place, so every point counts.`:K`${c.tm} have a ${c.cush}-point cushion over seventh place.`):(c.gapn===0?K`${c.tm} are level on points with sixth place.`:K`${c.tm} are ${c.gap} ${pE(c.gapn)} from the top six.`),
 pv:{title:(H,A)=>K`Preview: ${H} vs ${A}`,l1:(H,A,h,a,d,t)=>K`${H} (${h.pos}, ${h.pts} points) host ${A} (${a.pos}, ${a.pts} points) on ${d} at ${t}.`,l2:(H,A,h,a)=>K`Recent form: ${H} ${h.fstr}, ${A} ${a.fstr}.`,
  l3:(H,n,nn,w)=>K`They have met ${n} ${nn===1?"time":"times"} this season in our data; ${H} won ${w}.`,l4:(H,A,h,a)=>K`A win would take ${H} to ${h.wp} points and ${A} to ${a.wp}.`},
 lg:(w,pos)=>K`${w} are now ${pos} in the table.`,jlead:(t,p)=>K`${t} lead the table with ${p} points.`,
 week:(tm,n,nn,p,pn,pos)=>K`${tm} played ${n} ${nn===1?"game":"games"} this week and took ${p} ${pE(pn)}. They are ${pos} in the table.`},
fi:{head:(c,t)=>c.won?{fan:K`${c.tm} vei voiton! Vastassa oli ${c.opp}.`,neutral:K`Voitto: ${c.tm} – ${c.opp} ${c.score}`,analyst:K`${c.tm} – ${c.opp} ${c.score}: ${c.gp} ${pF(c.gpn)}`,kids:K`${c.tm} voitti! Vastassa oli ${c.opp}.`}[t]
  :{fan:K`Raskas ilta: ${c.tm} jäi tappiolle. Vastassa oli ${c.opp}.`,neutral:K`Tappio: ${c.tm} – ${c.opp} ${c.score}`,analyst:K`${c.tm} – ${c.opp} ${c.score}: ${c.gp} ${pF(c.gpn)}`,kids:K`${c.tm} hävisi tällä kertaa. Vastassa oli ${c.opp}.`}[t],
 res:(c,t)=>t==="kids"?K`Ottelu päättyi ${c.score}${xtF[c.x]||""}. ${c.tm} sai ${c.gp} ${pF(c.gpn)}.`:K`${c.date} pelatussa ottelussa ${c.tm} ${c.won?"voitti":"hävisi"} lukemin ${c.score}${xtF[c.x]||""}. Vastassa oli ${c.opp}, ja ottelusta tuli ${c.gp} ${pF(c.gpn)}.`,
 form:(c,t)=>t==="kids"?K`Viimeisistä ${c.fn} ottelusta ${c.tm} voitti ${c.fw}.`:K`Viimeisistä ${c.fn} ottelusta tuli ${c.fw} ${c.fwn===1?"voitto":"voittoa"} (${c.fstr}) ja ${c.fp}/${c.fmax} pistettä.`,
 streak:c=>K`${c.tm} on nyt ${c.won?"voittanut":"hävinnyt"} ${c.sk} ottelua peräkkäin.`,
 table:(c,t)=>t==="kids"?(c.in6?K`${c.tm} on sijalla ${c.pos}. Kuusi parasta pääsee suoraan pudotuspeleihin!`:K`${c.tm} on sijalla ${c.pos} ja yrittää nousta kuuden parhaan joukkoon.`)
  :c.in6?(c.cushn===0?K`${c.tm} on sarjataulukossa sijalla ${c.pos}, pisteitä ${c.pts}. Seitsemäs sija on samoissa pisteissä.`:K`${c.tm} on sarjataulukossa sijalla ${c.pos}, pisteitä ${c.pts}. Eroa seitsemänteen sijaan on ${c.cush} ${pF(c.cushn)}.`)
  :(c.gapn===0?K`${c.tm} on sijalla ${c.pos}, pisteitä ${c.pts}. Pisteet ovat tasan kuudennen sijan kanssa.`:K`${c.tm} on sijalla ${c.pos}, pisteitä ${c.pts}. Kuuden joukkoon on matkaa ${c.gap} ${pF(c.gapn)}.`),
 h2h:c=>K`Tällä kaudella joukkueet ovat kohdanneet aineistossamme ${c.hn} ${c.hnn===1?"kerran":"kertaa"}, ja ${c.tm} on voittanut ${c.hw}.`,
 next:c=>K`Seuraavaksi ${c.nhome?"kotiottelu":"vierasottelu"} ${c.nd} klo ${c.nt}. Vastassa on ${c.no} (sija ${c.nopos}).`,
 scen:c=>c.pnn>0?K`Entä jos: voitolla ${c.tm} nousisi ${c.wp} pisteeseen ja parhaimmillaan sijalle ${c.wpos}, jos muut tulokset pysyvät ennallaan. Tappion jälkeen ${c.pn} ${c.pnn===1?"joukkue":"joukkuetta"} kolmen pisteen sisällä alempana voisi mennä ohi.`
  :K`Entä jos: voitolla ${c.tm} nousisi ${c.wp} pisteeseen ja parhaimmillaan sijalle ${c.wpos}, jos muut tulokset pysyvät ennallaan. Yksikään alempi joukkue ei ole kolmen pisteen sisällä.`,
 ppg:c=>K`Pisteitä per ottelu: ${c.ppg}.`,
 close:(c,t)=>t==="fan"?K`Tsemppiä, ${c.tm}!`:t==="kids"?(c.won?K`Hienoa!`:K`Ensi kerralla uusi yritys!`):null,
 why:c=>c.in6?(c.cushn===0?K`${c.tm} on samoissa pisteissä seitsemännen sijan kanssa, joten jokainen piste ratkaisee.`:K`${c.tm} on ${c.cush} ${pF(c.cushn)} seitsemännen sijan edellä.`):(c.gapn===0?K`${c.tm} on pisteissä tasan kuudennen sijan kanssa.`:K`${c.tm} on ${c.gap} ${pF(c.gapn)} päässä kuuden joukosta.`),
 pv:{title:(H,A)=>K`Ennakko: ${H} – ${A}`,l1:(H,A,h,a,d,t)=>K`${H} (sija ${h.pos}, ${h.pts} pistettä) kohtaa kotonaan joukkueen ${A} (sija ${a.pos}, ${a.pts} pistettä) ${d} klo ${t}.`,l2:(H,A,h,a)=>K`Vire viime otteluissa: ${H} ${h.fstr}, ${A} ${a.fstr}.`,
  l3:(H,n,nn,w)=>K`Joukkueet ovat kohdanneet tällä kaudella aineistossamme ${n} ${nn===1?"kerran":"kertaa"}; ${H} on voittanut ${w}.`,l4:(H,A,h,a)=>K`Voitolla ${H} nousisi ${h.wp} pisteeseen ja ${A} ${a.wp} pisteeseen.`},
 lg:(w,pos)=>K`${w} on nyt sijalla ${pos}.`,jlead:(t,p)=>K`${t} johtaa sarjaa, pisteitä ${p}.`,
 week:(tm,n,nn,p,pn,pos)=>K`${tm} pelasi tällä viikolla ${n} ${nn===1?"ottelun":"ottelua"} ja sai ${p} ${pF(pn)}. Joukkue on sarjataulukossa sijalla ${pos}.`},
sv:{head:(c,t)=>c.won?{fan:K`${c.tm} tog segern mot ${c.opp}!`,neutral:K`${c.tm} slog ${c.opp} med ${c.score}`,analyst:K`${c.tm} ${c.score} ${c.opp}: ${c.gp} poäng`,kids:K`${c.tm} vann mot ${c.opp}!`}[t]
  :{fan:K`Tung kväll: ${c.tm} föll mot ${c.opp}`,neutral:K`${c.tm} förlorade med ${c.score} mot ${c.opp}`,analyst:K`${c.tm} ${c.score} ${c.opp}: ${c.gp} poäng`,kids:K`${c.tm} förlorade mot ${c.opp} den här gången`}[t],
 res:(c,t)=>t==="kids"?K`Matchen slutade ${c.score}${xtS[c.x]||""}. ${c.tm} fick ${c.gp} poäng.`:K`${c.tm} ${c.won?"vann":"förlorade"} mot ${c.opp} med ${c.score}${xtS[c.x]||""} den ${c.date}, vilket gav ${c.gp} poäng.`,
 form:(c,t)=>t==="kids"?K`Av de senaste ${c.fn} matcherna vann ${c.tm} ${c.fw}.`:K`Det blir ${c.fw} ${c.fwn===1?"seger":"segrar"} på de senaste ${c.fn} matcherna (${c.fstr}) och ${c.fp} av ${c.fmax} möjliga poäng.`,
 streak:c=>K`${c.tm} har nu ${c.won?"vunnit":"förlorat"} ${c.sk} matcher i rad.`,
 table:(c,t)=>t==="kids"?(c.in6?K`${c.tm} ligger på plats ${c.pos}. Topp sex går direkt till slutspelet!`:K`${c.tm} ligger på plats ${c.pos} och vill klättra till topp sex.`)
  :c.in6?(c.cushn===0?K`${c.tm} ligger på plats ${c.pos} med ${c.pts} poäng, lika med sjunde plats.`:K`${c.tm} ligger på plats ${c.pos} med ${c.pts} poäng, ${c.cush} poäng före sjunde plats.`)
  :(c.gapn===0?K`${c.tm} ligger på plats ${c.pos} med ${c.pts} poäng, lika med sjätte plats.`:K`${c.tm} ligger på plats ${c.pos} med ${c.pts} poäng, ${c.gap} poäng från topp sex.`),
 h2h:c=>K`Den här säsongen har lagen mötts ${c.hn} ${c.hnn===1?"gång":"gånger"} i vår data, och ${c.tm} har vunnit ${c.hw}.`,
 next:c=>K`Härnäst: ${c.nhome?"hemma mot":"borta mot"} ${c.no} (plats ${c.nopos}) den ${c.nd} kl. ${c.nt}.`,
 scen:c=>c.pnn>0?K`Tänk om: en seger skulle ta ${c.tm} till ${c.wp} poäng och som bäst plats ${c.wpos} om andra resultat står still. Vid en förlust kan ${c.pn} lag inom tre poäng nedanför gå förbi.`
  :K`Tänk om: en seger skulle ta ${c.tm} till ${c.wp} poäng och som bäst plats ${c.wpos} om andra resultat står still. Vid en förlust finns inget lag nedanför inom tre poäng.`,
 ppg:c=>K`Poäng per match: ${c.ppg}.`,
 close:(c,t)=>t==="fan"?K`Heja ${c.tm}!`:t==="kids"?(c.won?K`Bra jobbat!`:K`Nästa gång blir det bättre!`):null,
 why:c=>c.in6?(c.cushn===0?K`${c.tm} är lika på poäng med sjunde plats, så varje poäng räknas.`:K`${c.tm} har ${c.cush} poängs marginal till sjunde plats.`):(c.gapn===0?K`${c.tm} är lika på poäng med sjätte plats.`:K`${c.tm} är ${c.gap} poäng från topp sex.`),
 pv:{title:(H,A)=>K`Förhandstitt: ${H} – ${A}`,l1:(H,A,h,a,d,t)=>K`${H} (plats ${h.pos}, ${h.pts} poäng) tar emot ${A} (plats ${a.pos}, ${a.pts} poäng) den ${d} kl. ${t}.`,l2:(H,A,h,a)=>K`Form i de senaste matcherna: ${H} ${h.fstr}, ${A} ${a.fstr}.`,
  l3:(H,n,nn,w)=>K`Lagen har mötts ${n} ${nn===1?"gång":"gånger"} den här säsongen i vår data; ${H} har vunnit ${w}.`,l4:(H,A,h,a)=>K`En seger skulle ta ${H} till ${h.wp} poäng och ${A} till ${a.wp}.`},
 lg:(w,pos)=>K`${w} ligger nu på plats ${pos}.`,jlead:(t,p)=>K`${t} leder serien med ${p} poäng.`,
 week:(tm,n,nn,p,pn,pos)=>K`${tm} spelade ${n} ${nn===1?"match":"matcher"} den här veckan och tog ${p} poäng. Laget ligger på plats ${pos} i tabellen.`}};

/* ---------- story builder ---------- */
export function story(tm?,o={}):any{const L=o.lang||app.P.lang,len=o.len||"medium",tone=o.tone||"neutral";const c=ctx(tm,L,o.rid);if(!c)return null;const W=NL[L];
 const title=W.head(c,tone),body=[W.res(c,tone)];
 if(len!=="short"){body.push(W.form(c,tone));if(c.skn>=2&&tone!=="kids")body.push(W.streak(c));
  if(c.hasTable){body.push(W.table(c,tone));if(c.ng)body.push(W.next(c));if(tone==="analyst")body.push(W.ppg(c))}}
 if(len==="deep"){if(c.hnn>=2)body.push(W.h2h(c));if(c.hasTable)body.push(W.scen(c))}
 const cl=W.close(c,tone);if(cl&&len!=="short")body.push(cl);
 const why=c.hasTable?W.why(c):null;
 const toks=[...title,...body.flat(),...(why||[])];const claims=toks.filter(t=>t&&t.cl);
 return {id:"s:"+tm+":"+c.r.id,tm,c,title,body,why,claims,L,text:[plain(title),...body.map(plain),why?plain(why):""].join(" ")}}

export function preview(g?,L?):any{L=L||app.P.lang;const W=NL[L].pv;const h=ctx(g.h,L),a=ctx(g.a,L);if(!h||!a||!h.hasTable||!a.hasTable)return null;
 const H=C(g.h,"team",{gid:g.id}),A=C(g.a,"team",{gid:g.id}),d=C(fDate(g.d,L),"gdate",{gid:g.id,L}),t=C(g.t,"gtime",{gid:g.id});
 const body=[W.l1(H,A,h,a,d,t),W.l2(H,A,h,a)];
 const hh=teamRes(g.h).filter(z=>z.h===g.a||z.a===g.a);if(hh.length){const lr=teamRes(g.h).slice(-1)[0];body.push(W.l3(H,C(hh.length,"h2hN",{team:g.h,opp:g.a,rid:lr.id}),hh.length,C(hh.filter(z=>wonBy(z,g.h)).length,"h2hW",{team:g.h,opp:g.a,rid:lr.id})))}
 body.push(W.l4(H,A,h,a));
 const near=Math.abs(h.posn-6.5)<=Math.abs(a.posn-6.5)?h:a;const why=NL[L].why(near);
 const title=W.title(H,A);const toks=[...title,...body.flat(),...why];
 return {id:"p:"+g.id,title,body,why,claims:toks.filter(z=>z&&z.cl),L,text:[plain(title),...body.map(plain),plain(why)].join(" ")}}

export function leagueLine(r?,L?):any{const W=NL[L];const xt={en:xtE,fi:xtF,sv:xtS}[L][r.x]||"";const w=r.hs>r.as?r.h:r.a;
 const toks=[...K`${C(r.h,"team",{rid:r.id})} ${C(r.hs+"–"+r.as,"rscore",{rid:r.id})} ${C(r.a,"team",{rid:r.id})}${xt}. `,...W.lg(C(w,"team",{rid:r.id}),C(fOrd(posOf(w),L),"pos",{team:w,L}))];
 return {id:"l:"+r.id,toks,claims:toks.filter(z=>z&&z.cl),text:plain(toks)}}
export function juniorLine(r?,L?):any{const toks=K`${C(r.h,"team",{rid:r.id})} ${C(r.hs+"–"+r.as,"rscore",{rid:r.id})} ${C(r.a,"team",{rid:r.id})} · ${C(fDate(r.d,L),"date",{rid:r.id,L})}`;return {id:"j:"+r.id,toks,claims:toks.filter(z=>z&&z.cl),text:plain(toks)}}
export function juniorLead(L?):any{const st=demoStand();const toks=NL[L].jlead(C(st[0][0],"dlead",{}),C(st[0][1],"dleadPts",{}));return {toks,claims:toks.filter(z=>z&&z.cl),text:plain(toks)}}
export function weekStory(tm?,L?):any{const from=weekFrom();const rs=teamRes(tm).filter(r=>r.d>from);const p=rs.reduce((s2,r)=>s2+ptsFor(r,tm),0);
 const toks=NL[L].week(C(tm,"team",{st:1}),C(rs.length,"wkN",{team:tm,from}),rs.length,C(p,"wkP",{team:tm,from}),p,C(fOrd(posOf(tm),L),"pos",{team:tm,L}));
 return {rs,toks,claims:toks.filter(z=>z&&z.cl),text:plain(toks)}}

/* ---------- independent verifier ---------- */
export function verify(cl?):any{try{const f=cl.ref||{},v=cl.v;
 const R=id=>RESULTS.find(r=>r.id===id)||DEMO_R.find(r=>r.id===id),Gm=id=>GAMES.find(g=>g.id===id);
 const upto=(tm,id)=>{const o=[];for(const r of RESULTS)if(r.h===tm||r.a===tm)o.push(r);o.sort((a,b)=>a.d<b.d?-1:a.d>b.d?1:0);const j=o.findIndex(r=>r.id===id);return j<0?null:o.slice(0,j+1)};
 const Wn=(r,tm)=>(r.h===tm&&r.hs>r.as)||(r.a===tm&&r.as>r.hs);
 const P2=(r,tm)=>Wn(r,tm)?(r.x?2:3):(r.x?1:0);
 const si=tm=>{for(let i=0;i<STAND.length;i++)if(STAND[i][0]===tm)return i;return -1};
 const last5=()=>{const o=upto(f.team,f.rid);return o?o.slice(-5):null};
 switch(cl.k){
  case"team":{if(f.rid){const r=R(f.rid);return !!r&&(r.h===v||r.a===v)}if(f.gid){const g=Gm(f.gid);return !!g&&(g.h===v||g.a===v)}if(f.st)return si(v)>=0;return false}
  case"score":{const r=R(f.rid);if(!r)return false;const me=r.h===f.team?r.hs:r.a===f.team?r.as:null;if(me==null)return false;return v===me+"–"+(r.h===f.team?r.as:r.hs)}
  case"rscore":{const r=R(f.rid);return !!r&&v===r.hs+"–"+r.as}
  case"gpts":{const r=R(f.rid);return !!r&&v===String(P2(r,f.team))}
  case"date":{const r=R(f.rid);return !!r&&v===fDate(r.d,f.L)}
  case"formN":{const o=last5();return !!o&&v===String(o.length)}
  case"formW":{const o=last5();return !!o&&v===String(o.filter(r=>Wn(r,f.team)).length)}
  case"formP":{const o=last5();return !!o&&v===String(o.reduce((s2,r)=>s2+P2(r,f.team),0))}
  case"formMax":{const o=last5();return !!o&&v===String(o.length*3)}
  case"formStr":{const o=last5();const LT={en:["W","L"],fi:["V","H"],sv:["V","F"]}[f.L];return !!o&&v===o.map(r=>Wn(r,f.team)?LT[0]:LT[1]).join("-")}
  case"streak":{const o=upto(f.team,f.rid);if(!o||Wn(o[o.length-1],f.team)!==f.won)return false;let n=0;for(let i=o.length-1;i>=0&&Wn(o[i],f.team)===f.won;i--)n++;return v===String(n)}
  case"h2hN":{const o=upto(f.team,f.rid);return !!o&&v===String(o.filter(r=>r.h===f.opp||r.a===f.opp).length)}
  case"h2hW":{const o=upto(f.team,f.rid);return !!o&&v===String(o.filter(r=>(r.h===f.opp||r.a===f.opp)&&Wn(r,f.team)).length)}
  case"pos":{const i=si(f.team);return i>=0&&v===fOrd(i+1,f.L)}
  case"pts":{const i=si(f.team);return i>=0&&v===String(STAND[i][2])}
  case"ppg":{const i=si(f.team);return i>=0&&v===fNum(STAND[i][2]/STAND[i][1],f.L)}
  case"cushion":{const i=si(f.team);return i>=0&&i<6&&v===String(STAND[i][2]-STAND[6][2])}
  case"gap6":{const i=si(f.team);return i>=6&&v===String(STAND[5][2]-STAND[i][2])}
  case"winPts":{const i=si(f.team);return i>=0&&v===String(STAND[i][2]+3)}
  case"winPos":{const i=si(f.team);if(i<0)return false;const w=STAND[i][2]+3;let n=1;STAND.forEach((z,j)=>{if(j!==i&&z[2]>w)n++});return v===fOrd(n,f.L)}
  case"passN":{const i=si(f.team);if(i<0)return false;let n=0;for(let j=i+1;j<STAND.length;j++)if(STAND[j][2]>=STAND[i][2]-3)n++;return v===String(n)}
  case"gdate":{const g=Gm(f.gid);return !!g&&v===fDate(g.d,f.L)}
  case"gtime":{const g=Gm(f.gid);return !!g&&v===g.t}
  case"wkN":{let n=0;for(const r of RESULTS)if((r.h===f.team||r.a===f.team)&&r.d>f.from)n++;return v===String(n)}
  case"wkP":{let n=0;for(const r of RESULTS)if((r.h===f.team||r.a===f.team)&&r.d>f.from)n+=P2(r,f.team);return v===String(n)}
  case"dlead":{const st=demoStand();return st[0][0]===v}
  case"dleadPts":{const st=demoStand();return String(st[0][1])===v}
 }return false}catch(e){return false}}
export const ALLNAMES=()=>[...TEAMS.map(t=>t.name),...DEMO_T];
export function checkText(text?,claims?):any{const nums=z=>(z.match(/\d+(?:[.,]\d+)?/g)||[]);const ok=new Set();claims.forEach(c=>nums(c.v).forEach(n=>ok.add(n)));
 const bad=[];nums(text).forEach(n=>{if(!ok.has(n)&&!bad.includes(n))bad.push(n)});
 /* scores and ordinals must match a claim as a whole, not just digit by digit */
 const scs=z=>(z.match(/\d+\s*[–-]\s*\d+/g)||[]).map(y=>y.replace(/\s/g,"").replace("-","–"));const okS=new Set();claims.forEach(c=>scs(c.v).forEach(y=>okS.add(y)));
 scs(text).forEach(y=>{if(!okS.has(y)&&!bad.includes(y))bad.push(y)});
 const ords=z=>z.match(/\b\d+(?:st|nd|rd|th)\b/g)||[];const okO=new Set();claims.forEach(c=>ords(c.v).forEach(y=>okO.add(y)));
 ords(text).forEach(y=>{if(!okO.has(y)&&!bad.includes(y))bad.push(y)});
 const named=new Set(claims.map(c=>c.v));
 ALLNAMES().forEach(nm=>{const re=new RegExp("(^|[^\\p{L}\\p{N}])"+nm.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"(?![\\p{L}])","u");if(re.test(text)&&!named.has(nm)&&!bad.includes(nm))bad.push(nm)});
 return bad}
export function factCheck(st?):any{const wrong=st.claims.filter(c=>!verify(c));const unbacked=checkText(st.text,st.claims);return {n:st.claims.length,wrong,unbacked,ok:!wrong.length&&!unbacked.length}}

