const VERSION = "8.2";
const DATA_KEY = "bahnpreis_tracker_v8_data";
const DRAFT_KEY = "bahnpreis_tracker_v8_drafts";
const OLD_KEYS = ["bahnpreis_tracker_v5_state", "bahnpreis_tracker_state"];
let state = null;
let currentShot = null;

const $ = id => document.getElementById(id);
const uid = () => crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

function escapeHtml(v=""){return String(v).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}
function euro(v){return v==null||Number.isNaN(Number(v))?"–":new Intl.NumberFormat("de-DE",{style:"currency",currency:"EUR"}).format(v)}
function dateDE(v){if(!v)return"–";const [y,m,d]=v.split("-");return `${d}.${m}.${y}`}
function dateTimeDE(v){if(!v)return"–";const d=new Date(v);return Number.isNaN(d.getTime())?v:new Intl.DateTimeFormat("de-DE",{day:"2-digit",month:"2-digit",hour:"2-digit",minute:"2-digit"}).format(d)}
function parsePrice(v){const s=String(v??"").replace(/\s/g,"").replace("€","").replace(",",".");if(!s)return null;const n=Number(s);return Number.isFinite(n)?n:null}

function observationTime(value){
  if(!value)return 0;
  const direct=Date.parse(value);
  if(Number.isFinite(direct))return direct;

  const m=String(value).match(/(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{4})(?:[,\s]+(\d{1,2}):(\d{2})(?::(\d{2}))?)?/);
  if(!m)return 0;
  return new Date(
    Number(m[3]), Number(m[2])-1, Number(m[1]),
    Number(m[4]||0), Number(m[5]||0), Number(m[6]||0)
  ).getTime();
}
function newestObservation(project,routeId){
  return (project.observations||[])
    .filter(o=>o.routeId===routeId)
    .reduce((latest,current)=>{
      if(!latest)return current;
      return observationTime(current.queriedAt)>=observationTime(latest.queriedAt)
        ? current : latest;
    },null);
}

async function loadState(){
  const current=localStorage.getItem(DATA_KEY);
  if(current){state=JSON.parse(current);return}
  for(const key of OLD_KEYS){
    const old=localStorage.getItem(key);
    if(old){state=JSON.parse(old);saveState();return}
  }
  state=await fetch("initial-data.json",{cache:"no-store"}).then(r=>r.json());
  saveState();
}
function saveState(){localStorage.setItem(DATA_KEY,JSON.stringify(state))}
function drafts(){try{return JSON.parse(localStorage.getItem(DRAFT_KEY)||"{}")}catch{return{}}}
function setDraft(projectId,routeId,value){const d=drafts();d[`${projectId}::${routeId}`]={...value,updatedAt:new Date().toISOString()};localStorage.setItem(DRAFT_KEY,JSON.stringify(d))}
function getDraft(projectId,routeId){return drafts()[`${projectId}::${routeId}`]||null}
function clearDraft(projectId,routeId){const d=drafts();delete d[`${projectId}::${routeId}`];localStorage.setItem(DRAFT_KEY,JSON.stringify(d))}
function activeProject(){return state.projects.find(p=>p.id===state.activeProjectId)||state.projects[0]}

function normalizeStation(v){
  const x=String(v||"").toLowerCase().replace(/[().,-]/g," ").replace(/\s+/g," ").trim();
  const map={
    "frankfurt flughafen":"Frankfurt(M) Flughafen Fernbf",
    "frankfurt m flughafen fernbf":"Frankfurt(M) Flughafen Fernbf",
    "frankfurt m flughafen fernbahnhof":"Frankfurt(M) Flughafen Fernbf",
    "frankfurt am main flughafen":"Frankfurt(M) Flughafen Fernbf",
    "kassel wilhelmshöhe":"Kassel-Wilhelmshöhe",
    "kassel wilhelmshoehe":"Kassel-Wilhelmshöhe"
  };
  return map[x]||v;
}

/* DB currently accepts prefilled fields via buchung/start#? with uppercase keys.
   HD is the local departure timestamp. */
function dbUrl(project,route){
  const q=new URLSearchParams();
  q.set("SO",normalizeStation(project.origin));
  q.set("ZO",normalizeStation(route.destination));
  q.set("HD",`${project.travelDate}T${route.time}:00`);
  q.set("HZA","D");
  q.set("AR","false");
  q.set("S","true");
  q.set("D","false");
  return `https://www.bahn.de/buchung/start#?${q.toString()}`;
}

function render(){
  const select=$("projectSelect");
  select.innerHTML=state.projects.map(p=>`<option value="${p.id}" ${p.id===state.activeProjectId?"selected":""}>${dateDE(p.travelDate)} · ${escapeHtml(p.origin)}</option>`).join("");
  const p=activeProject();
  if(!p)return;
  state.activeProjectId=p.id;saveState();
  $("travelDate").textContent=dateDE(p.travelDate);
  $("routes").innerHTML=p.routes.map(route=>routeHtml(p,route)).join("");
  bindCards(p);
}

function routeHtml(p,r){
  const obs=(p.observations||[]).filter(o=>o.routeId===r.id).sort((a,b)=>observationTime(b.queriedAt)-observationTime(a.queriedAt));
  const last=newestObservation(p,r.id);
  const d=getDraft(p.id,r.id);
  const s=d?d.superPrice:(last?.superPrice??"");
  const sp=d?d.saverPrice:(last?.saverPrice??"");
  const load=d?d.load:(last?.load??"");
  const shownAt=d?.updatedAt||last?.queriedAt||null;
  const shownSuper=d?parsePrice(d.superPrice):last?.superPrice;
  const shownSaver=d?parsePrice(d.saverPrice):last?.saverPrice;
  return `<article class="route-card" data-card="${r.id}">
    <div class="route-head">
      <div class="route-title"><span class="code">${escapeHtml(r.code)}</span><h2>${escapeHtml(p.origin)} → ${escapeHtml(r.destination)}</h2><div class="route-meta">${escapeHtml(r.train)} · ${escapeHtml(r.time)} Uhr</div></div>
      <div class="card-buttons"><button class="db" data-db="${r.id}">DB öffnen</button><button data-shot="${r.id}">Screenshot</button><button data-history="${r.id}">Verlauf</button></div>
    </div>
    <div class="price-grid">
      <label class="field"><span>Super Sparpreis</span><input inputmode="decimal" data-super="${r.id}" value="${escapeHtml(String(s).replace(".",","))}" placeholder="29,99"></label>
      <label class="field"><span>Sparpreis</span><input inputmode="decimal" data-saver="${r.id}" value="${escapeHtml(String(sp).replace(".",","))}" placeholder="39,99"></label>
      <label class="field load"><span>Auslastung</span><select data-load="${r.id}"><option value="">–</option>${["gering","mittel","hoch","sehr hoch","ausgebucht"].map(v=>`<option ${load===v?"selected":""}>${v}</option>`).join("")}</select></label>
    </div>
    <div class="route-foot"><span data-last="${r.id}">Letzte Abfrage: ${shownAt?`${dateTimeDE(shownAt)} · ${euro(shownSuper)} / ${euro(shownSaver)}`:"noch keine"}</span><span class="saved" data-status="${r.id}">${d?"✓ automatisch gespeichert":""}</span></div>
  </article>`
}

function bindCards(p){
  document.querySelectorAll("[data-db]").forEach(b=>b.onclick=()=>{
    const r=p.routes.find(x=>x.id===b.dataset.db);saveVisibleDraft(p,r.id);window.open(dbUrl(p,r),"_blank","noopener,noreferrer");
  });
  document.querySelectorAll("[data-shot]").forEach(b=>b.onclick=()=>{
    const r=p.routes.find(x=>x.id===b.dataset.shot);currentShot={p,r};$("screenshotInput").click();
  });
  document.querySelectorAll("[data-history]").forEach(b=>b.onclick=()=>showHistory(p,p.routes.find(x=>x.id===b.dataset.history)));
  document.querySelectorAll(".route-card input,.route-card select").forEach(el=>{
    const id=el.dataset.super||el.dataset.saver||el.dataset.load;
    let timer;const fn=()=>{clearTimeout(timer);$("globalStatus").textContent="";timer=setTimeout(()=>saveVisibleDraft(p,id),250)};
    el.addEventListener("input",fn);el.addEventListener("change",fn);
  });
}
function saveVisibleDraft(p,id){
  const c=document.querySelector(`[data-card="${id}"]`);if(!c)return;
  const value={
    superPrice:c.querySelector(`[data-super="${id}"]`).value,
    saverPrice:c.querySelector(`[data-saver="${id}"]`).value,
    load:c.querySelector(`[data-load="${id}"]`).value
  };
  setDraft(p.id,id,value);
  const d=getDraft(p.id,id);
  const s=document.querySelector(`[data-status="${id}"]`);
  if(s)s.textContent="✓ automatisch gespeichert";
  const last=document.querySelector(`[data-last="${id}"]`);
  if(last)last.textContent=`Letzte Abfrage: ${dateTimeDE(d.updatedAt)} · ${euro(parsePrice(value.superPrice))} / ${euro(parsePrice(value.saverPrice))}`;
}

$("projectSelect").onchange=e=>{state.activeProjectId=e.target.value;saveState();render()};

$("completeBtn").onclick=()=>{
  const p=activeProject();let count=0;const now=new Date().toISOString();
  p.routes.forEach(r=>{
    saveVisibleDraft(p,r.id);const d=getDraft(p.id,r.id);if(!d)return;
    const superPrice=parsePrice(d.superPrice),saverPrice=parsePrice(d.saverPrice);
    if(superPrice==null&&saverPrice==null&&!d.load)return;
    const vals=[superPrice,saverPrice].filter(v=>v!=null),price=vals.length?Math.min(...vals):null;
    p.observations.push({id:uid(),queriedAt:now,travelDate:p.travelDate,routeId:r.id,code:r.code,origin:p.origin,destination:r.destination,time:r.time,train:r.train,superPrice,saverPrice,price,fareType:price===superPrice?"Super Sparpreis":price===saverPrice?"Sparpreis":"",load:d.load||"",note:""});
    clearDraft(p.id,r.id);count++;
  });
  p.updatedAt=now;saveState();$("globalStatus").textContent=count?`${count} Verbindungen in den Verlauf übernommen.`:"Keine Eingaben vorhanden.";render();
};

$("backupBtn").onclick=()=>{
  const out={exportedAt:new Date().toISOString(),version:8,activeProjectId:state.activeProjectId,projects:state.projects};
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([JSON.stringify(out,null,2)],{type:"application/json"}));a.download=`bahnpreis_tracker_backup_${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(a.href);
};
$("restoreBtn").onclick=()=>$("restoreInput").click();
$("restoreInput").onchange=async e=>{
  try{const x=JSON.parse(await e.target.files[0].text());if(!Array.isArray(x.projects))throw new Error();state={...x,version:8};saveState();localStorage.removeItem(DRAFT_KEY);render();$("globalStatus").textContent="Backup erfolgreich wiederhergestellt."}
  catch{$("globalStatus").textContent="Das Backup konnte nicht gelesen werden."}
  e.target.value="";
};

$("screenshotInput").onchange=async e=>{
  const file=e.target.files[0];if(!file||!currentShot)return;
  const {p,r}=currentShot;$("globalStatus").textContent="Screenshot wird gelesen …";
  try{
    const result=await Tesseract.recognize(file,"deu");
    const text=result.data.text.replace(/\n/g," ");
    const prices=[...text.matchAll(/(\d{1,3}[,.]\d{2})\s*€/g)].map(m=>m[1]);
    const card=document.querySelector(`[data-card="${r.id}"]`);
    if(prices[0])card.querySelector(`[data-super="${r.id}"]`).value=prices[0];
    if(prices[1])card.querySelector(`[data-saver="${r.id}"]`).value=prices[1];
    const low=text.toLowerCase();
    const load=["ausgebucht","sehr hoch","hoch","mittel","gering"].find(v=>low.includes(v));
    if(load)card.querySelector(`[data-load="${r.id}"]`).value=load;
    saveVisibleDraft(p,r.id);
    $("globalStatus").textContent=prices.length?`Screenshot erkannt: ${prices.slice(0,2).join(" / ")} €`:"Keine Preise sicher erkannt.";
  }catch{$("globalStatus").textContent="Screenshot konnte nicht gelesen werden."}
  e.target.value="";
};

function showHistory(p,r){
  const rows=(p.observations||[]).filter(o=>o.routeId===r.id).sort((a,b)=>observationTime(a.queriedAt)-observationTime(b.queriedAt));
  $("historyTitle").textContent=`${r.destination} · Preisverlauf`;
  $("historyTable").innerHTML=rows.length?`<table><thead><tr><th>Zeitpunkt</th><th>Super Sparpreis</th><th>Sparpreis</th><th>Auslastung</th></tr></thead><tbody>${rows.slice().reverse().map(o=>`<tr><td>${dateTimeDE(o.queriedAt)}</td><td>${euro(o.superPrice)}</td><td>${euro(o.saverPrice)}</td><td>${escapeHtml(o.load||"–")}</td></tr>`).join("")}</tbody></table>`:"Noch keine Daten.";
  drawChart(rows);$("historyDialog").showModal();
}
function drawChart(rows){
  const c=$("historyChart"),ctx=c.getContext("2d");ctx.clearRect(0,0,c.width,c.height);
  const vals=rows.flatMap(o=>[o.superPrice,o.saverPrice]).filter(v=>v!=null);
  if(!vals.length){ctx.fillText("Noch keine Preisdaten",20,40);return}
  const min=Math.min(...vals),max=Math.max(...vals),pad=45,w=c.width-pad*2,h=c.height-pad*2;
  ctx.strokeStyle="#ccd3db";ctx.beginPath();ctx.moveTo(pad,pad);ctx.lineTo(pad,pad+h);ctx.lineTo(pad+w,pad+h);ctx.stroke();
  [["superPrice","#17202b"],["saverPrice","#6d7b8c"]].forEach(([key,color])=>{ctx.strokeStyle=color;ctx.lineWidth=3;ctx.beginPath();rows.forEach((o,i)=>{if(o[key]==null)return;const x=pad+(rows.length===1?w/2:i*w/(rows.length-1));const y=pad+h-(o[key]-min)/(max-min||1)*h;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)});ctx.stroke()});
  ctx.fillStyle="#17202b";ctx.fillText(`${max.toFixed(2)} €`,4,pad+5);ctx.fillText(`${min.toFixed(2)} €`,4,pad+h);
}
$("closeHistory").onclick=()=>$("historyDialog").close();

if("serviceWorker"in navigator)navigator.serviceWorker.register("service-worker.js");
loadState().then(render);
