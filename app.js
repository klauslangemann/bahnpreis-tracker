
const DEFAULT_ROUTES = [
  {code:"HAM", name:"Hamburg Hbf", time:"08:23"},
  {code:"BER", name:"Berlin Hbf", time:"09:26"},
  {code:"MUC", name:"München Hbf", time:"10:18"},
  {code:"FRA", name:"Frankfurt (M) Flughafen Fernbf", time:"08:37"},
  {code:"HAJ", name:"Hannover Hbf", time:"09:14"}
];

const STORAGE_RECORDS = "bahnpreis_records_v4";
const STORAGE_ROUTES = "bahnpreis_routes_v4";

const $ = id => document.getElementById(id);
const routesContainer = $("routes");
const recordsBody = $("recordsBody");
const recordCount = $("recordCount");
const travelDate = $("travelDate");
const queryTime = $("queryTime");
const batchNote = $("batchNote");
const toast = $("toast");
const settingsDialog = $("settingsDialog");
const routesText = $("routesText");
const stats = $("stats");
const chartRoute = $("chartRoute");
const canvas = $("priceChart");
const ctx = canvas.getContext("2d");

let routes = loadRoutes();
let records = loadRecords();

function localDateTimeValue(date = new Date()) {
  const pad = n => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}
queryTime.value = localDateTimeValue();

function loadRoutes() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_ROUTES));
    return Array.isArray(value) && value.length ? value : DEFAULT_ROUTES;
  } catch { return DEFAULT_ROUTES; }
}
function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_RECORDS));
    return Array.isArray(value) ? value : [];
  } catch { return []; }
}
function saveRecords() { localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records)); }
function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}
function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"
  }[c]));
}
function parsePrice(value) {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  if (!cleaned) return "";
  const number = Number(cleaned);
  return Number.isFinite(number) ? number.toFixed(2) : "";
}
function formatPrice(value) {
  if (value === "" || value == null) return "–";
  return Number(value).toLocaleString("de-DE", {minimumFractionDigits:2, maximumFractionDigits:2}) + " €";
}


function buildDbSearchUrl(route) {
  const selectedDate = travelDate.value;
  const selectedTime = route.time || "08:00";
  const departure = selectedDate
    ? `${selectedDate}T${selectedTime}:00`
    : "";

  const params = new URLSearchParams();
  params.set("SO", "Kassel-Wilhelmshöhe");
  params.set("ZO", route.name);
  if (departure) params.set("HD", departure);
  params.set("D", "true");

  return `https://www.bahn.de/buchung/start#?${params.toString()}`;
}

function openDbSearch(route) {
  if (!travelDate.value) {
    alert("Bitte zuerst das Reisedatum auswählen.");
    travelDate.focus();
    return;
  }
  const url = buildDbSearchUrl(route);
  window.open(url, "_blank", "noopener,noreferrer");
}

function renderRoutes() {
  routesContainer.innerHTML = "";
  routes.forEach((route, index) => {
    const card = document.createElement("section");
    card.className = "route-card";
    card.innerHTML = `
      <div class="route-head">
        <span class="route-code">${escapeHtml(route.code)}</span>
        <span class="route-name">${escapeHtml(route.name)}</span>
        <span class="route-time">${escapeHtml(route.time)}</span>
      </div>
      <div class="route-fields">
        <label>Günstigster Preis (€)
          <input inputmode="decimal" data-field="price" data-index="${index}" placeholder="z. B. 29,99">
        </label>
        <label>Preisart
          <select data-field="type" data-index="${index}">
            <option value="">–</option>
            <option>Super Sparpreis</option>
            <option>Sparpreis</option>
            <option>Flexpreis</option>
          </select>
        </label>
        <label>Auslastung
          <select data-field="load" data-index="${index}">
            <option value="">–</option>
            <option>gering</option>
            <option>mittel</option>
            <option>hoch</option>
            <option>sehr hoch</option>
            <option>ausgebucht</option>
          </select>
        </label>
      </div>
      <div class="route-actions">
        <button class="db-search-button" type="button" data-db-index="${index}">
          Bei DB suchen
        </button>
      </div>
    `;
    routesContainer.appendChild(card);
  });
  renderChartOptions();
}

function renderChartOptions() {
  const selected = chartRoute.value;
  chartRoute.innerHTML = routes.map(r => `<option value="${escapeHtml(r.code)}">${escapeHtml(r.code)} – ${escapeHtml(r.name)}</option>`).join("");
  if (routes.some(r => r.code === selected)) chartRoute.value = selected;
}

function renderStats() {
  const uniqueDays = new Set(records.map(r => r.queryTime.slice(0,10))).size;
  const uniqueRoutes = new Set(records.map(r => r.code)).size;
  stats.innerHTML = `
    <div class="stat"><strong>${records.length}</strong><span>Preisbeobachtungen</span></div>
    <div class="stat"><strong>${uniqueDays}</strong><span>Abfragetage</span></div>
    <div class="stat"><strong>${uniqueRoutes}</strong><span>Verbindungen</span></div>
  `;
}

function renderRecords() {
  recordsBody.innerHTML = "";
  const sorted = [...records].sort((a,b) => b.queryTime.localeCompare(a.queryTime));
  for (const record of sorted) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${new Date(record.queryTime).toLocaleString("de-DE")}</td>
      <td>${record.travelDate ? new Date(record.travelDate + "T12:00").toLocaleDateString("de-DE") : "–"}</td>
      <td>${escapeHtml(record.code)}</td>
      <td>${formatPrice(record.price)}</td>
      <td>${escapeHtml(record.type || "–")}</td>
      <td>${escapeHtml(record.load || "–")}</td>
      <td class="note-cell">${escapeHtml(record.note || "–")}</td>
      <td><button class="danger icon-button" data-delete="${record.id}">×</button></td>
    `;
    recordsBody.appendChild(row);
  }
  recordCount.textContent = `${records.length} Datensatz${records.length === 1 ? "" : "sätze"}`;
  renderStats();
  drawChart();
}

function drawChart() {
  const code = chartRoute.value || routes[0]?.code;
  const data = records
    .filter(r => r.code === code && r.price !== "")
    .map(r => ({x:new Date(r.queryTime), y:Number(r.price)}))
    .filter(p => Number.isFinite(p.y))
    .sort((a,b) => a.x - b.x);

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 800;
  const height = 250;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,width,height);

  if (data.length < 2) {
    ctx.font = "14px system-ui";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Noch nicht genug Daten für eine Grafik.", 20, 40);
    return;
  }

  const pad = {l:48,r:18,t:18,b:36};
  const ys = data.map(d => d.y);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  const rangeY = Math.max(1, maxY-minY);
  const minX = data[0].x.getTime(), maxX = data[data.length-1].x.getTime();
  const rangeX = Math.max(1, maxX-minX);

  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t);
  ctx.lineTo(pad.l,height-pad.b);
  ctx.lineTo(width-pad.r,height-pad.b);
  ctx.stroke();

  ctx.font = "12px system-ui";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`${maxY.toFixed(0)} €`, 6, pad.t+4);
  ctx.fillText(`${minY.toFixed(0)} €`, 6, height-pad.b+4);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d,i) => {
    const x = pad.l + ((d.x.getTime()-minX)/rangeX)*(width-pad.l-pad.r);
    const y = pad.t + (1-((d.y-minY)/rangeY))*(height-pad.t-pad.b);
    if (i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle = "#111827";
  data.forEach(d => {
    const x = pad.l + ((d.x.getTime()-minX)/rangeX)*(width-pad.l-pad.r);
    const y = pad.t + (1-((d.y-minY)/rangeY))*(height-pad.t-pad.b);
    ctx.beginPath(); ctx.arc(x,y,3,0,Math.PI*2); ctx.fill();
  });
}

$("entryForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!travelDate.value) { alert("Bitte Reisedatum eintragen."); return; }

  const inputs = [...document.querySelectorAll("[data-field]")];
  const batch = routes.map((route,index) => {
    const get = field => inputs.find(el => el.dataset.index == index && el.dataset.field === field)?.value ?? "";
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
      queryTime: queryTime.value || localDateTimeValue(),
      travelDate: travelDate.value,
      code: route.code,
      route: route.name,
      time: route.time,
      price: parsePrice(get("price")),
      type: get("type"),
      load: get("load"),
      note: batchNote.value.trim()
    };
  }).filter(x => x.price || x.type || x.load);

  if (!batch.length) { alert("Bitte mindestens einen Preis eintragen."); return; }

  records.push(...batch);
  saveRecords();
  renderRecords();
  clearInputs();
  queryTime.value = localDateTimeValue();
  showToast(`${batch.length} Verbindung${batch.length === 1 ? "" : "en"} gespeichert`);
});

function clearInputs() {
  document.querySelectorAll("[data-field]").forEach(el => el.value = "");
  batchNote.value = "";
}

$("clearInputsBtn").addEventListener("click", clearInputs);

routesContainer.addEventListener("click", event => {
  const button = event.target.closest("[data-db-index]");
  if (!button) return;
  const index = Number(button.dataset.dbIndex);
  const route = routes[index];
  if (route) openDbSearch(route);
});


recordsBody.addEventListener("click", event => {
  const id = event.target.dataset.delete;
  if (!id) return;
  records = records.filter(r => r.id !== id);
  saveRecords();
  renderRecords();
});

$("deleteAllBtn").addEventListener("click", () => {
  if (!records.length) return;
  if (confirm("Wirklich alle Daten löschen?")) {
    records = [];
    saveRecords();
    renderRecords();
    showToast("Alle Daten gelöscht");
  }
});

$("settingsBtn").addEventListener("click", () => {
  routesText.value = routes.map(r => `${r.code}|${r.name}|${r.time}`).join("\\n");
  settingsDialog.showModal();
});

$("saveRoutesBtn").addEventListener("click", event => {
  const parsed = routesText.value.split("\\n").map(line => {
    const [code,name,time] = line.split("|").map(x => (x||"").trim());
    return {code,name,time};
  }).filter(r => r.code && r.name);
  if (!parsed.length) {
    event.preventDefault();
    alert("Bitte mindestens eine Verbindung eintragen.");
    return;
  }
  routes = parsed;
  localStorage.setItem(STORAGE_ROUTES, JSON.stringify(routes));
  renderRoutes();
  drawChart();
  showToast("Verbindungen gespeichert");
});

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g,'""')}"`;
}
$("exportBtn").addEventListener("click", () => {
  if (!records.length) { alert("Noch keine Daten vorhanden."); return; }
  const header = ["Abfragezeit","Reisedatum","Code","Verbindung","Uhrzeit","Preis_EUR","Preisart","Auslastung","Bemerkung"];
  const rows = records.map(r => [r.queryTime,r.travelDate,r.code,r.route,r.time,r.price,r.type,r.load,r.note]);
  const csv = "\\uFEFF" + [header,...rows].map(row => row.map(csvEscape).join(";")).join("\\n");
  const blob = new Blob([csv], {type:"text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bahnpreise_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

$("importInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.replace(/^\\uFEFF/,"").split(/\\r?\\n/).filter(Boolean);
  const parseLine = line => {
    const out=[]; let current="", quoted=false;
    for (let i=0;i<line.length;i++) {
      const c=line[i];
      if (c === '"') {
        if (quoted && line[i+1] === '"') { current+='"'; i++; }
        else quoted=!quoted;
      } else if (c === ";" && !quoted) { out.push(current); current=""; }
      else current+=c;
    }
    out.push(current); return out;
  };
  const imported = lines.slice(1).map((line,index) => {
    const [qt,td,code,route,time,price,type,load,note] = parseLine(line);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}-${index}`,
      queryTime:qt, travelDate:td, code, route, time, price, type, load, note
    };
  }).filter(r => r.queryTime && r.code);
  records.push(...imported);
  saveRecords();
  renderRecords();
  event.target.value="";
  showToast(`${imported.length} Datensätze importiert`);
});

$("calendarBtn").addEventListener("click", () => {
  const times = [$("reminder1").value,$("reminder2").value,$("reminder3").value].filter(Boolean);
  if (!times.length) return;

  const today = new Date();
  const pad = n => String(n).padStart(2,"0");
  const dateStamp = `${today.getUTCFullYear()}${pad(today.getUTCMonth()+1)}${pad(today.getUTCDate())}T${pad(today.getUTCHours())}${pad(today.getUTCMinutes())}00Z`;

  const events = times.map((time,i) => {
    const [h,m] = time.split(":").map(Number);
    const start = new Date(today.getFullYear(),today.getMonth(),today.getDate(),h,m,0);
    if (start <= today) start.setDate(start.getDate()+1);
    const local = `${start.getFullYear()}${pad(start.getMonth()+1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
    return [
      "BEGIN:VEVENT",
      `UID:bahnpreis-${i}-${Date.now()}@bahnpreis-tracker`,
      `DTSTAMP:${dateStamp}`,
      `DTSTART:${local}`,
      "RRULE:FREQ=DAILY",
      "SUMMARY:Bahnpreise prüfen",
      "DESCRIPTION:Bitte die beobachteten Bahnverbindungen im Bahnpreis-Tracker erfassen.",
      "BEGIN:VALARM",
      "TRIGGER:-PT0M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Bahnpreise prüfen",
      "END:VALARM",
      "END:VEVENT"
    ].join("\\r\\n");
  });

  const ics = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//Bahnpreis Tracker//DE",...events,"END:VCALENDAR"].join("\\r\\n");
  const blob = new Blob([ics], {type:"text/calendar;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "bahnpreis-erinnerungen.ics";
  a.click();
  URL.revokeObjectURL(url);
  showToast("Kalenderdatei erstellt");
});

chartRoute.addEventListener("change", drawChart);
window.addEventListener("resize", drawChart);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

renderRoutes();
renderRecords();
