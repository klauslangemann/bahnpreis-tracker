
const DEFAULT_ROUTES = [
  "Kassel-Wilhelmshöhe → Hamburg Hbf, 08:23",
  "Kassel-Wilhelmshöhe → Berlin Hbf, 09:26",
  "Kassel-Wilhelmshöhe → München Hbf, 10:18",
  "Kassel-Wilhelmshöhe → Frankfurt (M) Flughafen Fernbf, 08:37",
  "Kassel-Wilhelmshöhe → Hannover Hbf, 09:14"
];

const STORAGE_RECORDS = "bahnpreis_records_v3";
const STORAGE_ROUTES = "bahnpreis_routes_v3";

const routesContainer = document.getElementById("routes");
const recordsBody = document.getElementById("recordsBody");
const recordCount = document.getElementById("recordCount");
const travelDate = document.getElementById("travelDate");
const queryTime = document.getElementById("queryTime");
const batchNote = document.getElementById("batchNote");
const toast = document.getElementById("toast");
const settingsDialog = document.getElementById("settingsDialog");
const routesText = document.getElementById("routesText");
const stats = document.getElementById("stats");
const chartRoute = document.getElementById("chartRoute");
const canvas = document.getElementById("priceChart");
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
  } catch {
    return DEFAULT_ROUTES;
  }
}

function loadRecords() {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_RECORDS));
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

function saveRecords() {
  localStorage.setItem(STORAGE_RECORDS, JSON.stringify(records));
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function renderRoutes() {
  routesContainer.innerHTML = "";
  routes.forEach((route, index) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(route)}</td>
      <td><input inputmode="decimal" data-field="super" data-index="${index}" placeholder="29,99"></td>
      <td><input inputmode="decimal" data-field="spar" data-index="${index}" placeholder="39,99"></td>
      <td><input inputmode="decimal" data-field="flex" data-index="${index}" placeholder="112,00"></td>
      <td>
        <select data-field="load" data-index="${index}">
          <option value="">–</option>
          <option>gering</option>
          <option>mittel</option>
          <option>hoch</option>
          <option>sehr hoch</option>
          <option>ausgebucht</option>
        </select>
      </td>
    `;
    routesContainer.appendChild(row);
  });
  renderChartOptions();
}

function parsePrice(value) {
  const cleaned = value.trim().replace(/\./g, "").replace(",", ".");
  if (!cleaned) return "";
  const number = Number(cleaned);
  return Number.isFinite(number) ? number.toFixed(2) : "";
}

function formatPrice(value) {
  if (value === "" || value == null) return "–";
  return Number(value).toLocaleString("de-DE", {minimumFractionDigits: 2, maximumFractionDigits: 2}) + " €";
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function renderStats() {
  const uniqueDays = new Set(records.map(r => r.queryTime.slice(0,10))).size;
  const uniqueRoutes = new Set(records.map(r => r.route)).size;
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
      <td class="route-cell">${escapeHtml(record.route)}</td>
      <td>${formatPrice(record.super)}</td>
      <td>${formatPrice(record.spar)}</td>
      <td>${formatPrice(record.flex)}</td>
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

function renderChartOptions() {
  const selected = chartRoute.value;
  chartRoute.innerHTML = routes.map(r => `<option value="${escapeHtml(r)}">${escapeHtml(r)}</option>`).join("");
  if (routes.includes(selected)) chartRoute.value = selected;
}

function cheapest(record) {
  const values = [record.super, record.spar, record.flex]
    .filter(v => v !== "" && v != null)
    .map(Number)
    .filter(Number.isFinite);
  return values.length ? Math.min(...values) : null;
}

function drawChart() {
  const route = chartRoute.value || routes[0];
  const data = records
    .filter(r => r.route === route)
    .map(r => ({x: new Date(r.queryTime), y: cheapest(r)}))
    .filter(p => p.y !== null)
    .sort((a,b) => a.x - b.x);

  const ratio = window.devicePixelRatio || 1;
  const width = canvas.clientWidth || 800;
  const height = 250;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (data.length < 2) {
    ctx.font = "14px system-ui";
    ctx.fillStyle = "#6b7280";
    ctx.fillText("Für diese Verbindung liegen noch nicht genug Daten vor.", 20, 40);
    return;
  }

  const pad = {l: 48, r: 18, t: 18, b: 36};
  const ys = data.map(d => d.y);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = Math.max(1, maxY - minY);
  const minX = data[0].x.getTime();
  const maxX = data[data.length - 1].x.getTime();
  const rangeX = Math.max(1, maxX - minX);

  ctx.strokeStyle = "#d1d5db";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l, pad.t);
  ctx.lineTo(pad.l, height-pad.b);
  ctx.lineTo(width-pad.r, height-pad.b);
  ctx.stroke();

  ctx.font = "12px system-ui";
  ctx.fillStyle = "#6b7280";
  ctx.fillText(`${maxY.toFixed(0)} €`, 6, pad.t + 4);
  ctx.fillText(`${minY.toFixed(0)} €`, 6, height - pad.b + 4);
  ctx.fillText(data[0].x.toLocaleDateString("de-DE"), pad.l, height - 12);
  const lastLabel = data[data.length - 1].x.toLocaleDateString("de-DE");
  ctx.fillText(lastLabel, width - pad.r - 70, height - 12);

  ctx.strokeStyle = "#111827";
  ctx.lineWidth = 2;
  ctx.beginPath();
  data.forEach((d, i) => {
    const x = pad.l + ((d.x.getTime() - minX) / rangeX) * (width - pad.l - pad.r);
    const y = pad.t + (1 - ((d.y - minY) / rangeY)) * (height - pad.t - pad.b);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  ctx.fillStyle = "#111827";
  data.forEach(d => {
    const x = pad.l + ((d.x.getTime() - minX) / rangeX) * (width - pad.l - pad.r);
    const y = pad.t + (1 - ((d.y - minY) / rangeY)) * (height - pad.t - pad.b);
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

document.getElementById("entryForm").addEventListener("submit", event => {
  event.preventDefault();
  if (!travelDate.value) {
    alert("Bitte zuerst das Reisedatum eintragen.");
    return;
  }

  const inputs = [...document.querySelectorAll("[data-field]")];
  const batch = routes.map((route, index) => {
    const get = field => inputs.find(el => el.dataset.index == index && el.dataset.field === field)?.value ?? "";
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${index}`,
      queryTime: queryTime.value || localDateTimeValue(),
      travelDate: travelDate.value,
      route,
      super: parsePrice(get("super")),
      spar: parsePrice(get("spar")),
      flex: parsePrice(get("flex")),
      load: get("load"),
      note: batchNote.value.trim()
    };
  }).filter(x => x.super || x.spar || x.flex || x.load);

  if (!batch.length) {
    alert("Bitte mindestens einen Preis oder eine Auslastung eintragen.");
    return;
  }

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

document.getElementById("clearInputsBtn").addEventListener("click", clearInputs);

recordsBody.addEventListener("click", event => {
  const id = event.target.dataset.delete;
  if (!id) return;
  records = records.filter(r => r.id !== id);
  saveRecords();
  renderRecords();
});

document.getElementById("deleteAllBtn").addEventListener("click", () => {
  if (!records.length) return;
  if (confirm("Wirklich alle gespeicherten Abfragen löschen?")) {
    records = [];
    saveRecords();
    renderRecords();
    showToast("Alle Daten gelöscht");
  }
});

document.getElementById("settingsBtn").addEventListener("click", () => {
  routesText.value = routes.join("\n");
  settingsDialog.showModal();
});

document.getElementById("saveRoutesBtn").addEventListener("click", event => {
  const newRoutes = routesText.value.split("\n").map(s => s.trim()).filter(Boolean);
  if (!newRoutes.length) {
    event.preventDefault();
    alert("Bitte mindestens eine Verbindung eintragen.");
    return;
  }
  routes = newRoutes;
  localStorage.setItem(STORAGE_ROUTES, JSON.stringify(routes));
  renderRoutes();
  drawChart();
  showToast("Verbindungen gespeichert");
});

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

document.getElementById("exportBtn").addEventListener("click", () => {
  if (!records.length) {
    alert("Es sind noch keine Daten vorhanden.");
    return;
  }
  const header = ["Abfragezeit","Reisedatum","Verbindung","Super_Sparpreis_EUR","Sparpreis_EUR","Flexpreis_EUR","Auslastung","Bemerkung"];
  const rows = records.map(r => [
    r.queryTime, r.travelDate, r.route, r.super, r.spar, r.flex, r.load, r.note
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(row => row.map(csvEscape).join(";")).join("\n");
  const blob = new Blob([csv], {type: "text/csv;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `bahnpreise_${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
});

document.getElementById("importInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  const text = await file.text();
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return;

  const parseLine = line => {
    const out = [];
    let current = "", quoted = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (quoted && line[i+1] === '"') { current += '"'; i++; }
        else quoted = !quoted;
      } else if (c === ";" && !quoted) {
        out.push(current); current = "";
      } else current += c;
    }
    out.push(current);
    return out;
  };

  const imported = lines.slice(1).map((line, index) => {
    const [qt, td, route, superP, sparP, flexP, load, note] = parseLine(line);
    return {
      id: crypto.randomUUID ? crypto.randomUUID() : `import-${Date.now()}-${index}`,
      queryTime: qt,
      travelDate: td,
      route,
      super: superP,
      spar: sparP,
      flex: flexP,
      load,
      note
    };
  }).filter(r => r.queryTime && r.route);

  records.push(...imported);
  saveRecords();
  renderRecords();
  event.target.value = "";
  showToast(`${imported.length} Datensätze importiert`);
});

chartRoute.addEventListener("change", drawChart);
window.addEventListener("resize", drawChart);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}

renderRoutes();
renderRecords();
