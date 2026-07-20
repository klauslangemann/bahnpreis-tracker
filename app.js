
const STORAGE_KEY = "bahnpreis_tracker_v5_state";
const DRAFT_KEY = "bahnpreis_tracker_v7_drafts";
const DRAFT_NOTE_KEY = "bahnpreis_tracker_v7_batch_note";

const DEFAULT_ROUTES = [
  { id: uid(), code: "HAM", destination: "Hamburg Hbf", time: "", train: "" },
  { id: uid(), code: "BER", destination: "Berlin Hbf", time: "", train: "" },
  { id: uid(), code: "MUC", destination: "München Hbf", time: "", train: "" },
  { id: uid(), code: "FRA", destination: "Frankfurt (M) Flughafen Fernbf", time: "", train: "" },
  { id: uid(), code: "HAJ", destination: "Hannover Hbf", time: "", train: "" }
];

const $ = id => document.getElementById(id);

let state = loadState();
let editingProjectId = null;

function uid() {
  return (crypto.randomUUID && crypto.randomUUID()) || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayISO() {
  const d = new Date();
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,"0"), String(d.getDate()).padStart(2,"0")].join("-");
}

function nowISO() {
  const d = new Date();
  return `${todayISO()}T${String(d.getHours()).padStart(2,"0")}:${String(d.getMinutes()).padStart(2,"0")}`;
}

function defaultState() {
  return { version: 7, activeProjectId: null, projects: [] };
}

function loadState() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return parsed && Array.isArray(parsed.projects) ? parsed : defaultState();
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function activeProject() {
  return state.projects.find(p => p.id === state.activeProjectId) || null;
}

function cloneDefaultRoutes() {
  return DEFAULT_ROUTES.map(r => ({ ...r, id: uid() }));
}

function formatDate(iso) {
  if (!iso) return "–";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("de-DE");
}

function formatDateTime(iso) {
  if (!iso) return "–";
  return new Date(iso).toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function formatPrice(value) {
  if (value === "" || value === null || value === undefined) return "–";
  return Number(value).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
}

function parsePrice(value) {
  const normalized = String(value || "").trim().replace(/\./g, "").replace(",", ".");
  if (!normalized) return null;
  const number = Number(normalized);
  return Number.isFinite(number) ? Number(number.toFixed(2)) : null;
}

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, c => ({
    "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#039;"
  }[c]));
}

function showToast(text) {
  const toast = $("toast");
  toast.textContent = text;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 1800);
}

function daysBetween(a, b) {
  const ms = new Date(`${b}T12:00:00`) - new Date(`${a}T12:00:00`);
  return Math.round(ms / 86400000);
}


function loadDrafts() {
  try {
    const value = JSON.parse(localStorage.getItem(DRAFT_KEY) || "{}");
    return value && typeof value === "object" ? value : {};
  } catch {
    return {};
  }
}

function draftId(projectId, routeId) {
  return `${projectId}::${routeId}`;
}

function getRouteDraft(projectId, routeId) {
  return loadDrafts()[draftId(projectId, routeId)] || null;
}

function saveRouteDraft(projectId, routeId, values) {
  const drafts = loadDrafts();
  drafts[draftId(projectId, routeId)] = {
    ...values,
    updatedAt: new Date().toISOString()
  };
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function clearRouteDraft(projectId, routeId) {
  const drafts = loadDrafts();
  delete drafts[draftId(projectId, routeId)];
  localStorage.setItem(DRAFT_KEY, JSON.stringify(drafts));
}

function hasDraftValues(draft) {
  return !!draft && (
    String(draft.superPrice || "").trim() !== "" ||
    String(draft.saverPrice || "").trim() !== "" ||
    String(draft.load || "").trim() !== ""
  );
}

function normalizeStationName(value) {
  const raw = String(value || "").trim();
  const compact = raw.toLowerCase()
    .replace(/[().,-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const aliases = new Map([
    ["frankfurt flughafen", "Frankfurt(M) Flughafen Fernbf"],
    ["frankfurt am main flughafen", "Frankfurt(M) Flughafen Fernbf"],
    ["frankfurt main flughafen", "Frankfurt(M) Flughafen Fernbf"],
    ["frankfurt airport", "Frankfurt(M) Flughafen Fernbf"],
    ["frankfurt flughafen fernbahnhof", "Frankfurt(M) Flughafen Fernbf"],
    ["frankfurt m flughafen fernbahnhof", "Frankfurt(M) Flughafen Fernbf"],
    ["frankfurt m flughafen fernbf", "Frankfurt(M) Flughafen Fernbf"],
    ["kassel wilhelmshöhe", "Kassel-Wilhelmshöhe"],
    ["kassel wilhelmshoehe", "Kassel-Wilhelmshöhe"]
  ]);

  return aliases.get(compact) || raw;
}

function debounce(fn, delay = 350) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function renderAll() {
  renderProjectHeader();
  renderRoutes();
  renderAnalysisSelector();
  renderAnalysis();
  renderHistory();
  renderProjectList();
  $("queryTimestampLabel").textContent = new Date().toLocaleString("de-DE", { dateStyle: "short", timeStyle: "short" });
}

function renderProjectHeader() {
  const project = activeProject();
  if (!project) {
    $("projectTitle").textContent = "Kein Projekt";
    $("projectMeta").textContent = "Bitte ein Projekt anlegen.";
    $("studyStartLabel").textContent = "–";
    $("travelDateLabel").textContent = "–";
    $("daysRemainingLabel").textContent = "–";
    $("progressBar").style.width = "0%";
    ["metricObservations","metricDays","metricLast","metricAverage"].forEach((id, i) => $(id).textContent = i === 3 ? "0,0" : i === 2 ? "–" : "0");
    return;
  }

  $("projectTitle").textContent = formatDate(project.travelDate);
  $("projectMeta").textContent = `${project.origin} · ${project.routes.length} Verbindungen`;
  $("studyStartLabel").textContent = formatDate(project.studyStart);
  $("travelDateLabel").textContent = formatDate(project.travelDate);

  const remaining = daysBetween(todayISO(), project.travelDate);
  $("daysRemainingLabel").textContent = remaining >= 0 ? `Noch ${remaining} Tage` : `${Math.abs(remaining)} Tage vergangen`;

  const totalDuration = Math.max(1, daysBetween(project.studyStart, project.travelDate));
  const elapsed = Math.max(0, daysBetween(project.studyStart, todayISO()));
  const progress = Math.max(0, Math.min(100, (elapsed / totalDuration) * 100));
  $("progressBar").style.width = `${progress}%`;

  const observations = project.observations || [];
  const uniqueDays = new Set(observations.map(o => o.queriedAt.slice(0,10))).size;
  const last = [...observations].sort((a,b) => b.queriedAt.localeCompare(a.queriedAt))[0];
  $("metricObservations").textContent = observations.length;
  $("metricDays").textContent = uniqueDays;
  $("metricLast").textContent = last ? formatDateTime(last.queriedAt) : "–";
  $("metricAverage").textContent = uniqueDays ? (observations.length / uniqueDays).toLocaleString("de-DE", {minimumFractionDigits:1, maximumFractionDigits:1}) : "0,0";
}

function renderRoutes() {
  const container = $("routesContainer");
  const project = activeProject();
  if (!project) {
    container.innerHTML = `<div class="helper-text">Lege zuerst ein Projekt an.</div>`;
    return;
  }

  const pending = getPendingScreenshotRoute();

  container.innerHTML = project.routes.map(route => {
    const last = [...(project.observations || [])]
      .filter(o => o.routeId === route.id)
      .sort((a,b) => b.queriedAt.localeCompare(a.queriedAt))[0];

    const draft = getRouteDraft(project.id, route.id);
    const superValue = draft ? draft.superPrice ?? "" :
      (last?.superPrice != null ? String(last.superPrice).replace(".", ",") : "");
    const saverValue = draft ? draft.saverPrice ?? "" :
      (last?.saverPrice != null ? String(last.saverPrice).replace(".", ",") : "");
    const loadValue = draft ? draft.load ?? "" : (last?.load || "");
    const pendingHere = pending?.project?.id === project.id && pending?.route?.id === route.id;

    const lastText = last
      ? `${formatDateTime(last.queriedAt)} · SSP ${formatPrice(last.superPrice)} · SP ${formatPrice(last.saverPrice)}`
      : "Noch keine Beobachtung gespeichert";

    const draftText = hasDraftValues(draft)
      ? `✓ Entwurf automatisch gesichert${draft.updatedAt ? ` · ${formatDateTime(draft.updatedAt)}` : ""}`
      : "";

    return `
      <article class="monitor-card ${pendingHere ? "is-pending" : ""}" data-monitor-card="${route.id}">
        <div class="monitor-head">
          <div class="monitor-route">
            <span class="version-badge">${escapeHtml(route.code)}</span>
            <h3>${escapeHtml(project.origin)} → ${escapeHtml(route.destination)}</h3>
            <div class="monitor-meta">
              ${formatDate(project.travelDate)} · ${escapeHtml(route.time || "Zeit fehlt")}
              ${route.train ? ` · ${escapeHtml(route.train)}` : ""}
            </div>
          </div>
          <div class="monitor-actions">
            <button type="button" class="button button-light button-small" data-db-route-id="${route.id}">Bei DB öffnen</button>
            <button type="button" class="button button-primary button-small" data-shot-route-id="${route.id}">Screenshot importieren</button>
          </div>
        </div>

        ${pendingHere ? `<div class="monitor-pending-note">Zuletzt bei DB geöffnet. Der nächste Screenshot wird automatisch dieser Verbindung zugeordnet.</div>` : ""}

        <div class="monitor-prices">
          <label class="field">
            <span>Super Sparpreis</span>
            <input inputmode="decimal" data-entry-super="${route.id}" value="${escapeHtml(superValue)}" placeholder="z. B. 29,99">
          </label>
          <label class="field">
            <span>Sparpreis</span>
            <input inputmode="decimal" data-entry-saver="${route.id}" value="${escapeHtml(saverValue)}" placeholder="z. B. 39,99">
          </label>
          <label class="field load-field">
            <span>Auslastung</span>
            <select data-entry-load="${route.id}">
              <option value="">–</option>
              ${["gering","mittel","hoch","sehr hoch","ausgebucht"].map(v => `<option ${loadValue === v ? "selected" : ""}>${v}</option>`).join("")}
            </select>
          </label>
        </div>

        <div class="monitor-last">
          <span>Letzte abgeschlossene Abfrage: <strong>${lastText}</strong></span>
          <span class="autosave-status" data-dirty-label="${route.id}">${draftText}</span>
        </div>
      </article>`;
  }).join("");

  container.querySelectorAll("[data-db-route-id]").forEach(button => {
    button.addEventListener("click", () => {
      const route = project.routes.find(r => r.id === button.dataset.dbRouteId);
      if (!route) return;
      if (!route.time) {
        alert("Bitte zuerst eine Abfahrtszeit eintragen.");
        return;
      }
      persistCardDraft(project, route.id, true);
      localStorage.setItem("bahnpreis_tracker_pending_route", JSON.stringify({
        projectId: project.id,
        routeId: route.id,
        openedAt: new Date().toISOString()
      }));

      try {
        const dbUrl = buildDbUrl(project, route);
        window.open(dbUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        alert(error.message || "Der DB-Link konnte nicht erstellt werden.");
      }
    });
  });

  container.querySelectorAll("[data-shot-route-id]").forEach(button => {
    button.addEventListener("click", () => {
      const route = project.routes.find(r => r.id === button.dataset.shotRouteId);
      if (!route) return;
      persistCardDraft(project, route.id, true);
      localStorage.setItem("bahnpreis_tracker_pending_route", JSON.stringify({
        projectId: project.id,
        routeId: route.id,
        openedAt: new Date().toISOString()
      }));
      currentOcrRoute = { project, route, pending: { projectId: project.id, routeId: route.id } };
      $("screenshotFileInput").click();
    });
  });

  const autosave = debounce((routeId) => persistCardDraft(project, routeId), 300);

  container.querySelectorAll("input,select").forEach(control => {
    const routeId = control.dataset.entrySuper || control.dataset.entrySaver || control.dataset.entryLoad;
    const markAndSave = () => {
      control.classList.add("changed");
      const label = document.querySelector(`[data-dirty-label="${routeId}"]`);
      if (label) label.textContent = "Wird automatisch gesichert …";
      autosave(routeId);
    };
    control.addEventListener("input", markAndSave);
    control.addEventListener("change", markAndSave);
  });
}

function persistCardDraft(project, routeId, immediate = false) {
  const card = document.querySelector(`[data-monitor-card="${routeId}"]`);
  if (!card || !project) return;

  const values = {
    superPrice: card.querySelector(`[data-entry-super="${routeId}"]`)?.value || "",
    saverPrice: card.querySelector(`[data-entry-saver="${routeId}"]`)?.value || "",
    load: card.querySelector(`[data-entry-load="${routeId}"]`)?.value || ""
  };

  saveRouteDraft(project.id, routeId, values);

  const label = document.querySelector(`[data-dirty-label="${routeId}"]`);
  if (label) {
    label.textContent = immediate
      ? "✓ Entwurf gesichert"
      : "✓ Automatisch gesichert";
  }
}

function buildDbUrl(project, route) {
  const origin = normalizeStationName(project.origin);
  const destination = normalizeStationName(route.destination);
  const date = String(project.travelDate || "").trim();
  const time = String(route.time || "").trim();

  if (!date || !time) {
    throw new Error("Reisedatum oder Abfahrtszeit fehlt.");
  }

  // DB expects the requested departure as an ISO-like local timestamp
  // inside the URL fragment, for example 2026-09-21T08:37:00.
  const departure = `${date}T${time}:00`;

  const values = [
    ["sts", "true"],
    ["so", origin],
    ["zo", destination],
    ["kl", "2"],
    ["sot", "ST"],
    ["zot", "ST"],
    ["hd", departure],
    ["hza", "D"],
    ["ar", "false"],
    ["s", "true"],
    ["d", "false"],
    ["hz", "[]"],
    ["fm", "false"],
    ["bp", "false"]
  ];

  // Encode individual values, while keeping the DB timestamp separators
  // readable. This avoids the date being discarded by the DB page.
  const fragment = values.map(([key, value]) => {
    let encoded = encodeURIComponent(value);
    if (key === "hd") {
      encoded = encoded
        .replace(/%3A/gi, ":")
        .replace(/%2D/gi, "-");
    }
    return `${key}=${encoded}`;
  }).join("&");

  return `https://www.bahn.de/buchung/fahrplan/suche#${fragment}`;
}

$("saveObservationBtn").addEventListener("click", () => {
  const project = activeProject();
  if (!project) {
    alert("Bitte zuerst ein Projekt anlegen.");
    return;
  }

  // Make sure the currently visible values are in the draft store.
  for (const route of project.routes) {
    persistCardDraft(project, route.id, true);
  }

  const queriedAt = nowISO();
  const note = $("batchNote").value.trim();
  const added = [];

  for (const route of project.routes) {
    const draft = getRouteDraft(project.id, route.id);
    if (!hasDraftValues(draft)) continue;

    const superPrice = parsePrice(draft.superPrice);
    const saverPrice = parsePrice(draft.saverPrice);
    const load = draft.load || "";
    const prices = [superPrice, saverPrice].filter(v => v !== null);
    const price = prices.length ? Math.min(...prices) : null;

    if (prices.length || load) {
      added.push({
        id: uid(),
        queriedAt,
        travelDate: project.travelDate,
        routeId: route.id,
        code: route.code,
        origin: project.origin,
        destination: route.destination,
        time: route.time,
        train: route.train,
        superPrice,
        saverPrice,
        price,
        fareType: price === superPrice ? "Super Sparpreis" : price === saverPrice ? "Sparpreis" : "",
        load,
        note
      });
    }
  }

  if (!added.length) {
    alert("Es sind keine Preise oder Auslastungen als Entwurf vorhanden.");
    return;
  }

  project.observations.push(...added);
  project.updatedAt = new Date().toISOString();

  for (const route of project.routes) {
    clearRouteDraft(project.id, route.id);
  }

  localStorage.removeItem(DRAFT_NOTE_KEY);
  saveState();
  $("batchNote").value = "";
  renderAll();
  showToast(`${added.length} Verbindung${added.length === 1 ? "" : "en"} abgeschlossen`);
});

function renderAnalysisSelector() {
  const select = $("analysisRouteSelect");
  const project = activeProject();
  const current = select.value;
  if (!project) {
    select.innerHTML = "";
    return;
  }
  select.innerHTML = project.routes.map(r => `<option value="${r.id}">${escapeHtml(r.code)} – ${escapeHtml(r.destination)}</option>`).join("");
  if (project.routes.some(r => r.id === current)) select.value = current;
}

$("analysisRouteSelect").addEventListener("change", renderAnalysis);
$("analysisFareSelect")?.addEventListener("change", renderAnalysis);

function renderAnalysis() {
  const project = activeProject();
  const routeId = $("analysisRouteSelect").value;
  const statsContainer = $("routeStats");
  const canvas = $("priceChart");
  const ctx = canvas.getContext("2d");

  if (!project || !routeId) {
    statsContainer.innerHTML = "";
    ctx.clearRect(0,0,canvas.width,canvas.height);
    return;
  }

  const fareKey = $("analysisFareSelect")?.value || "cheapest";
  const values = project.observations
    .filter(o => o.routeId === routeId)
    .map(o => {
      let selectedPrice = null;
      if (fareKey === "cheapest") {
        const candidates = [
          o.superPrice ?? null,
          o.saverPrice ?? null,
          o.price ?? null
        ].filter(v => v !== null && v !== undefined);
        selectedPrice = candidates.length ? Math.min(...candidates.map(Number)) : null;
      } else {
        selectedPrice = o[fareKey] ?? null;
      }
      return { ...o, price: selectedPrice };
    })
    .filter(o => o.price !== null)
    .sort((a,b) => a.queriedAt.localeCompare(b.queriedAt));

  const prices = values.map(v => Number(v.price));
  const min = prices.length ? Math.min(...prices) : null;
  const max = prices.length ? Math.max(...prices) : null;
  const avg = prices.length ? prices.reduce((a,b) => a+b,0) / prices.length : null;
  const current = prices.length ? prices[prices.length-1] : null;

  statsContainer.innerHTML = `
    <div class="route-stat"><span>Aktuell</span><strong>${formatPrice(current)}</strong></div>
    <div class="route-stat"><span>Minimum</span><strong>${formatPrice(min)}</strong></div>
    <div class="route-stat"><span>Maximum</span><strong>${formatPrice(max)}</strong></div>
    <div class="route-stat"><span>Durchschnitt</span><strong>${formatPrice(avg)}</strong></div>
  `;

  drawChart(values);
}

function drawChart(values) {
  const canvas = $("priceChart");
  const ctx = canvas.getContext("2d");
  const width = canvas.clientWidth || 800;
  const height = 260;
  const ratio = window.devicePixelRatio || 1;
  canvas.width = width * ratio;
  canvas.height = height * ratio;
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,width,height);

  if (values.length < 2) {
    ctx.fillStyle = "#6b7280";
    ctx.font = "14px system-ui";
    ctx.fillText("Noch nicht genug Daten für einen Preisverlauf.", 18, 38);
    return;
  }

  const pad = { l: 48, r: 18, t: 20, b: 38 };
  const ys = values.map(v => Number(v.price));
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const rangeY = Math.max(1, maxY - minY);
  const times = values.map(v => new Date(v.queriedAt).getTime());
  const minX = Math.min(...times);
  const maxX = Math.max(...times);
  const rangeX = Math.max(1, maxX - minX);

  ctx.strokeStyle = "#d7dce5";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(pad.l,pad.t);
  ctx.lineTo(pad.l,height-pad.b);
  ctx.lineTo(width-pad.r,height-pad.b);
  ctx.stroke();

  ctx.fillStyle = "#6b7280";
  ctx.font = "12px system-ui";
  ctx.fillText(`${maxY.toFixed(0)} €`, 5, pad.t+4);
  ctx.fillText(`${minY.toFixed(0)} €`, 5, height-pad.b+4);

  ctx.strokeStyle = "#172033";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  values.forEach((v, i) => {
    const x = pad.l + ((new Date(v.queriedAt).getTime()-minX)/rangeX)*(width-pad.l-pad.r);
    const y = pad.t + (1-((Number(v.price)-minY)/rangeY))*(height-pad.t-pad.b);
    if (i === 0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
  });
  ctx.stroke();

  ctx.fillStyle = "#172033";
  values.forEach(v => {
    const x = pad.l + ((new Date(v.queriedAt).getTime()-minX)/rangeX)*(width-pad.l-pad.r);
    const y = pad.t + (1-((Number(v.price)-minY)/rangeY))*(height-pad.t-pad.b);
    ctx.beginPath();
    ctx.arc(x,y,3.5,0,Math.PI*2);
    ctx.fill();
  });
}

window.addEventListener("resize", renderAnalysis);

function renderHistory() {
  const container = $("historyList");
  const project = activeProject();
  if (!project || !project.observations.length) {
    container.innerHTML = `<div class="helper-text">Noch keine Erfassungen vorhanden.</div>`;
    return;
  }

  const grouped = new Map();
  [...project.observations].sort((a,b) => b.queriedAt.localeCompare(a.queriedAt)).forEach(o => {
    if (!grouped.has(o.queriedAt)) grouped.set(o.queriedAt, []);
    grouped.get(o.queriedAt).push(o);
  });

  container.innerHTML = [...grouped.entries()].slice(0, 12).map(([time, items]) => `
    <div class="history-item">
      <div>
        <strong>${formatDateTime(time)}</strong>
        <span>${escapeHtml(items[0]?.note || "Keine Bemerkung")}</span>
      </div>
      <div class="history-prices">
        ${items.map(i => `${escapeHtml(i.code)} · SSP ${formatPrice(i.superPrice)} · SP ${formatPrice(i.saverPrice)}`).join("<br>")}
      </div>
    </div>
  `).join("");
}

function renderProjectList() {
  const container = $("projectList");
  if (!state.projects.length) {
    container.innerHTML = `<div class="helper-text">Noch kein Projekt vorhanden.</div>`;
    return;
  }

  container.innerHTML = [...state.projects]
    .sort((a,b) => a.travelDate.localeCompare(b.travelDate))
    .map(project => `
      <div class="project-list-item ${project.id === state.activeProjectId ? "active" : ""}">
        <button type="button" class="project-select-button" data-select-project="${project.id}">
          <strong>${formatDate(project.travelDate)}</strong><br>
          <span>${project.observations.length} Beobachtungen</span>
        </button>
        <button type="button" class="button button-light button-small" data-edit-project="${project.id}">Bearbeiten</button>
        <button type="button" class="button button-danger button-small" data-delete-project="${project.id}">Löschen</button>
      </div>
    `).join("");
}

$("openProjectDialogBtn").addEventListener("click", () => {
  renderProjectList();
  $("projectDialog").showModal();
});

$("projectList").addEventListener("click", event => {
  const selectId = event.target.closest("[data-select-project]")?.dataset.selectProject;
  const editId = event.target.closest("[data-edit-project]")?.dataset.editProject;
  const deleteId = event.target.closest("[data-delete-project]")?.dataset.deleteProject;

  if (selectId) {
    state.activeProjectId = selectId;
    saveState();
    $("projectDialog").close();
    renderAll();
  }

  if (editId) {
    openProjectEditor(editId);
  }

  if (deleteId) {
    const project = state.projects.find(p => p.id === deleteId);
    if (project && confirm(`Projekt ${formatDate(project.travelDate)} wirklich löschen?`)) {
      state.projects = state.projects.filter(p => p.id !== deleteId);
      if (state.activeProjectId === deleteId) state.activeProjectId = state.projects[0]?.id || null;
      saveState();
      renderAll();
    }
  }
});

$("newProjectBtn").addEventListener("click", () => openProjectEditor(null));
$("editProjectBtn").addEventListener("click", () => {
  if (!activeProject()) openProjectEditor(null);
  else openProjectEditor(activeProject().id);
});

function openProjectEditor(projectId) {
  editingProjectId = projectId;
  const project = state.projects.find(p => p.id === projectId);
  $("projectEditHeading").textContent = project ? "Projekt bearbeiten" : "Neues Projekt";
  $("editTravelDate").value = project?.travelDate || "";
  $("editStudyStart").value = project?.studyStart || todayISO();
  $("editOrigin").value = project?.origin || "Kassel-Wilhelmshöhe";
  renderRoutesEditor(project?.routes || cloneDefaultRoutes());
  $("projectEditDialog").showModal();
}

function renderRoutesEditor(routes) {
  $("routesEditor").innerHTML = routes.map(route => `
    <div class="route-editor-row" data-route-editor-id="${route.id}">
      <label>Code<input data-route-prop="code" value="${escapeHtml(route.code)}" maxlength="5"></label>
      <label>Ziel<input data-route-prop="destination" value="${escapeHtml(route.destination)}"></label>
      <label>Abfahrt<input data-route-prop="time" type="time" value="${escapeHtml(route.time || "")}"></label>
      <label class="wide-mobile">Zugnummer<input data-route-prop="train" value="${escapeHtml(route.train || "")}" placeholder="z. B. ICE 787"></label>
      <button type="button" class="remove-route-button" data-remove-route>×</button>
    </div>
  `).join("");
}

$("addRouteBtn").addEventListener("click", () => {
  const current = collectRoutesFromEditor();
  current.push({ id: uid(), code: "", destination: "", time: "", train: "" });
  renderRoutesEditor(current);
});

$("routesEditor").addEventListener("click", event => {
  if (!event.target.closest("[data-remove-route]")) return;
  const row = event.target.closest("[data-route-editor-id]");
  row?.remove();
});

function collectRoutesFromEditor() {
  return [...document.querySelectorAll("[data-route-editor-id]")].map(row => {
    const get = prop => row.querySelector(`[data-route-prop="${prop}"]`)?.value.trim() || "";
    return {
      id: row.dataset.routeEditorId || uid(),
      code: get("code").toUpperCase(),
      destination: get("destination"),
      time: get("time"),
      train: get("train")
    };
  });
}

$("projectEditForm").addEventListener("submit", event => {
  event.preventDefault();

  const routes = collectRoutesFromEditor().filter(r => r.code && r.destination);
  if (!routes.length) {
    alert("Bitte mindestens eine Verbindung eintragen.");
    return;
  }

  const travelDate = $("editTravelDate").value;
  const studyStart = $("editStudyStart").value;
  if (!travelDate || !studyStart) {
    alert("Bitte Reisedatum und Studienbeginn eintragen.");
    return;
  }

  if (studyStart > travelDate) {
    alert("Der Studienbeginn darf nicht nach dem Reisedatum liegen.");
    return;
  }

  const existing = state.projects.find(p => p.id === editingProjectId);
  if (existing) {
    existing.travelDate = travelDate;
    existing.studyStart = studyStart;
    existing.origin = $("editOrigin").value.trim();
    existing.routes = routes;
    existing.updatedAt = new Date().toISOString();
  } else {
    const project = {
      id: uid(),
      travelDate,
      studyStart,
      origin: $("editOrigin").value.trim(),
      routes,
      observations: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    state.projects.push(project);
    state.activeProjectId = project.id;
  }

  saveState();
  $("projectEditDialog").close();
  $("projectDialog").close();
  renderAll();
  showToast("Projekt gespeichert");
});

["closeProjectEditBtn","cancelProjectEditBtn"].forEach(id => {
  $(id).addEventListener("click", () => $("projectEditDialog").close());
});

$("deleteProjectDataBtn").addEventListener("click", () => {
  const project = activeProject();
  if (!project || !project.observations.length) return;
  if (confirm("Alle Preisbeobachtungen dieses Projekts löschen? Das Projekt selbst bleibt erhalten.")) {
    project.observations = [];
    project.updatedAt = new Date().toISOString();
    saveState();
    renderAll();
    showToast("Projektdaten gelöscht");
  }
});

function csvEscape(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

$("exportProjectCsvBtn").addEventListener("click", () => {
  const project = activeProject();
  if (!project) {
    alert("Kein Projekt ausgewählt.");
    return;
  }

  const header = ["Projekt_Reisedatum","Abfragezeit","Code","Start","Ziel","Abfahrt","Zugnummer","Super_Sparpreis_EUR","Sparpreis_EUR","Günstigster_Preis_EUR","Günstigster_Tarif","Auslastung","Bemerkung"];
  const rows = project.observations.map(o => [
    project.travelDate, o.queriedAt, o.code, o.origin, o.destination, o.time, o.train,
    o.superPrice ?? "", o.saverPrice ?? "", o.price ?? "", o.fareType, o.load, o.note
  ]);
  const csv = "\uFEFF" + [header, ...rows].map(row => row.map(csvEscape).join(";")).join("\n");
  downloadBlob(csv, `bahnpreise_${project.travelDate}.csv`, "text/csv;charset=utf-8");
});

$("exportAllJsonBtn").addEventListener("click", () => {
  const backup = JSON.stringify({ exportedAt: new Date().toISOString(), ...state }, null, 2);
  downloadBlob(backup, `bahnpreis_tracker_backup_${todayISO()}.json`, "application/json");
});

$("importBackupInput").addEventListener("change", async event => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    const parsed = JSON.parse(await file.text());
    if (!Array.isArray(parsed.projects)) throw new Error("Ungültiges Backup");
    if (!confirm("Das aktuelle lokale Backup durch die ausgewählte Datei ersetzen?")) return;
    state = {
      version: parsed.version || 5,
      activeProjectId: parsed.activeProjectId || parsed.projects[0]?.id || null,
      projects: parsed.projects
    };
    saveState();
    renderAll();
    showToast("Backup wiederhergestellt");
  } catch {
    alert("Die Datei ist kein gültiges Bahnpreis-Tracker-Backup.");
  } finally {
    event.target.value = "";
  }
});

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}


function pad2(value) {
  return String(value).padStart(2, "0");
}

function toIcsLocalDateTime(date, time) {
  const [year, month, day] = date.split("-");
  const [hour, minute] = time.split(":");
  return `${year}${month}${day}T${hour}${minute}00`;
}

function icsEscape(text) {
  return String(text || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcsLine(line) {
  const limit = 73;
  if (line.length <= limit) return line;
  const chunks = [];
  let rest = line;
  while (rest.length > limit) {
    chunks.push(rest.slice(0, limit));
    rest = " " + rest.slice(limit);
  }
  chunks.push(rest);
  return chunks.join("\r\n");
}

function createReminderIcs(times) {
  const project = activeProject();
  const startDate = todayISO();
  const stamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const until = project?.travelDate
    ? project.travelDate.replace(/-/g, "") + "T235959"
    : null;

  const timezone = [
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Berlin",
    "X-LIC-LOCATION:Europe/Berlin",
    "BEGIN:DAYLIGHT",
    "TZOFFSETFROM:+0100",
    "TZOFFSETTO:+0200",
    "TZNAME:CEST",
    "DTSTART:19700329T020000",
    "RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=-1SU",
    "END:DAYLIGHT",
    "BEGIN:STANDARD",
    "TZOFFSETFROM:+0200",
    "TZOFFSETTO:+0100",
    "TZNAME:CET",
    "DTSTART:19701025T030000",
    "RRULE:FREQ=YEARLY;BYMONTH=10;BYDAY=-1SU",
    "END:STANDARD",
    "END:VTIMEZONE"
  ];

  const events = times.map((time, index) => {
    const uid = `bahnpreis-${time.replace(":", "")}-${Date.now()}-${index}@bahnpreis-tracker`;
    const rrule = until ? `RRULE:FREQ=DAILY;UNTIL=${until}` : "RRULE:FREQ=DAILY";
    return [
      "BEGIN:VEVENT",
      `UID:${uid}`,
      `DTSTAMP:${stamp}`,
      `DTSTART;TZID=Europe/Berlin:${toIcsLocalDateTime(startDate, time)}`,
      rrule,
      "SUMMARY:Bahnpreise prüfen",
      `DESCRIPTION:${icsEscape("Günstigsten Preis für alle Verbindungen im Bahnpreis-Tracker erfassen.")}`,
      "STATUS:CONFIRMED",
      "TRANSP:OPAQUE",
      "BEGIN:VALARM",
      "TRIGGER:-PT5M",
      "ACTION:DISPLAY",
      "DESCRIPTION:Bahnpreise prüfen",
      "END:VALARM",
      "END:VEVENT"
    ];
  });

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bahnpreis Tracker//Version 5//DE",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    ...timezone,
    ...events.flat(),
    "END:VCALENDAR"
  ];

  return lines.map(foldIcsLine).join("\r\n") + "\r\n";
}

const reminderButton = $("createCalendarRemindersBtn");
if (reminderButton) {
  reminderButton.addEventListener("click", () => {
    const times = [
      $("reminderTime1").value,
      $("reminderTime2").value,
      $("reminderTime3").value
    ].filter(Boolean);

    if (!times.length) {
      alert("Bitte mindestens eine Uhrzeit eintragen.");
      return;
    }

    const uniqueTimes = [...new Set(times)].sort();
    const ics = createReminderIcs(uniqueTimes);
    const filename = activeProject()
      ? `Bahnpreis-Erinnerungen-${activeProject().travelDate}.ics`
      : "Bahnpreis-Erinnerungen.ics";
    downloadBlob(ics, filename, "text/calendar;charset=utf-8");
    showToast("Kalenderdatei erstellt");
  });
}


let currentOcrRoute = null;
let currentOcrImageUrl = null;

function getPendingScreenshotRoute() {
  try {
    const pending = JSON.parse(localStorage.getItem("bahnpreis_tracker_pending_route"));
    if (!pending) return null;
    const project = state.projects.find(p => p.id === pending.projectId);
    const route = project?.routes.find(r => r.id === pending.routeId);
    if (!project || !route) return null;
    return { pending, project, route };
  } catch {
    return null;
  }
}

function renderScreenshotPanel() {
  const panel = $("screenshotImportPanel");
  if (!panel) return;
  const item = currentOcrRoute || getPendingScreenshotRoute();
  if (!item || item.project.id !== state.activeProjectId) {
    panel.hidden = true;
    return;
  }
  panel.hidden = false;
  $("pendingScreenshotRoute").textContent =
    `${item.route.code} – ${item.route.destination} · ${item.route.train || "ohne Zugnummer"} · ${item.route.time || "ohne Zeit"}`;
}

$("chooseScreenshotBtn")?.addEventListener("click", () => {
  const item = currentOcrRoute || getPendingScreenshotRoute();
  if (!item) {
    alert("Bitte zuerst bei einer Verbindung auf „Bei DB suchen“ tippen.");
    return;
  }
  $("screenshotFileInput").click();
});

$("screenshotFileInput")?.addEventListener("change", async event => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;

  const item = currentOcrRoute || getPendingScreenshotRoute();
  if (!item) {
    alert("Die zuletzt geöffnete Verbindung konnte nicht mehr ermittelt werden.");
    return;
  }

  currentOcrRoute = item;
  if (currentOcrImageUrl) URL.revokeObjectURL(currentOcrImageUrl);
  currentOcrImageUrl = URL.createObjectURL(file);

  $("screenshotDialog").showModal();
  $("ocrProgressBox").hidden = false;
  $("ocrResultBox").hidden = true;
  $("ocrProgressBar").style.width = "2%";
  $("ocrProgressTitle").textContent = "Screenshot wird gelesen …";
  $("ocrProgressText").textContent = "Beim ersten Mal werden die OCR-Sprachdaten geladen.";
  $("ocrPreviewImage").src = currentOcrImageUrl;
  $("ocrAssignedRoute").textContent =
    `${item.route.code} – ${item.route.destination} · ${item.route.time || "Zeit fehlt"}`;

  try {
    if (!window.Tesseract) {
      throw new Error("Die OCR-Bibliothek konnte nicht geladen werden. Bitte Internetverbindung prüfen.");
    }

    const result = await Tesseract.recognize(file, "deu", {
      logger: message => {
        const progress = Math.round((message.progress || 0) * 100);
        $("ocrProgressBar").style.width = `${Math.max(3, progress)}%`;
        const labels = {
          "loading tesseract core": "OCR-Modul wird geladen",
          "initializing tesseract": "OCR wird initialisiert",
          "loading language traineddata": "Deutsche Sprachdaten werden geladen",
          "initializing api": "Texterkennung wird vorbereitet",
          "recognizing text": "Text und Preise werden erkannt"
        };
        $("ocrProgressText").textContent = `${labels[message.status] || message.status || "Verarbeitung"}${progress ? ` · ${progress} %` : ""}`;
      }
    });

    const text = result?.data?.text || "";
    const parsed = parseDbScreenshotText(text, item.route);
    $("ocrRawText").textContent = text || "Kein Text erkannt.";
    $("ocrSuperPrice").value = parsed.superPrice !== null ? parsed.superPrice.toFixed(2).replace(".", ",") : "";
    $("ocrSaverPrice").value = parsed.saverPrice !== null ? parsed.saverPrice.toFixed(2).replace(".", ",") : "";
    renderOcrValidation(parsed, item.route);

    $("ocrProgressBox").hidden = true;
    $("ocrResultBox").hidden = false;
  } catch (error) {
    $("ocrProgressTitle").textContent = "Screenshot konnte nicht gelesen werden";
    $("ocrProgressText").textContent = error?.message || "Unbekannter Fehler";
    $("ocrProgressBar").style.width = "0%";
  }
});

function parseDbScreenshotText(text, route) {
  const normalized = String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/[Oo](?=\s*[,.]\s*\d{2}\s*€)/g, "0");

  const priceRegex = /(?:ab\s*)?(\d{1,3}(?:[.,]\d{2}))\s*€/gi;
  const allMatches = [...normalized.matchAll(priceRegex)]
    .map(match => ({
      value: Number(match[1].replace(",", ".")),
      index: match.index
    }))
    .filter(item => Number.isFinite(item.value) && item.value > 0 && item.value < 500);

  const uniqueOrdered = [];
  for (const item of allMatches) {
    if (!uniqueOrdered.some(existing => existing.value === item.value)) uniqueOrdered.push(item);
  }

  function nearestPriceToLabel(labelRegex) {
    const match = labelRegex.exec(normalized);
    labelRegex.lastIndex = 0;
    if (!match || !uniqueOrdered.length) return null;
    const center = match.index + match[0].length / 2;
    const nearby = uniqueOrdered
      .map(p => ({...p, distance: Math.abs(p.index - center)}))
      .filter(p => p.distance < 220)
      .sort((a,b) => a.distance - b.distance);
    return nearby[0]?.value ?? null;
  }

  let superPrice = nearestPriceToLabel(/super\s*sparpreis/i);
  let saverPrice = nearestPriceToLabel(/(?<!super\s)\bsparpreis\b/i);

  const orderedValues = uniqueOrdered.map(p => p.value);

  // Fallback: DB usually displays the three fares in the same visual order.
  if (superPrice === null && orderedValues.length >= 1) superPrice = orderedValues[0];
  if (saverPrice === null && orderedValues.length >= 2) saverPrice = orderedValues[1];

  // If OCR order is odd, use ascending order as a second plausibility fallback.
  const assigned = [superPrice, saverPrice].filter(v => v !== null);
  if (assigned.length === 2 && superPrice > saverPrice) {
    [superPrice, saverPrice] = [saverPrice, superPrice];
  }

  const routeWords = route.destination
    .toLowerCase()
    .replace(/[()[\],.-]/g, " ")
    .split(/\s+/)
    .filter(word => word.length >= 4);
  const lower = normalized.toLowerCase();
  const destinationHits = routeWords.filter(word => lower.includes(word)).length;
  const destinationMatch = routeWords.length ? destinationHits >= 1 : false;
  const timeMatch = route.time ? lower.includes(route.time) : null;
  const trainMatch = route.train
    ? lower.replace(/\s/g, "").includes(route.train.toLowerCase().replace(/\s/g, ""))
    : null;

  return {
    superPrice,
    saverPrice,
    uniquePrices: orderedValues,
    destinationMatch,
    timeMatch,
    trainMatch
  };
}

function renderOcrValidation(parsed, route) {
  const messages = [];
  let warnings = 0;

  const detectedCount = [parsed.superPrice, parsed.saverPrice].filter(v => v !== null).length;
  if (detectedCount) {
    messages.push(`✓ ${detectedCount} von 2 Tarifpreisen erkannt.`);
    messages.push(`Super Sparpreis: ${formatPrice(parsed.superPrice)} · Sparpreis: ${formatPrice(parsed.saverPrice)}`);
  } else {
    messages.push("⚠ Keine eindeutigen Euro-Preise erkannt. Bitte manuell eintragen.");
    warnings++;
  }

  if (parsed.uniquePrices.length > 2) {
    messages.push(`Hinweis: Insgesamt ${parsed.uniquePrices.length} unterschiedliche Euro-Beträge gefunden. Bitte Zuordnung prüfen.`);
    warnings++;
  }

  if (parsed.destinationMatch) messages.push(`✓ Ziel passt zu ${route.destination}.`);
  else {
    messages.push(`⚠ Ziel „${route.destination}“ wurde im Text nicht eindeutig gefunden.`);
    warnings++;
  }

  if (parsed.timeMatch === true) messages.push(`✓ Abfahrtszeit ${route.time} wurde gefunden.`);
  if (parsed.timeMatch === false) {
    messages.push(`⚠ Abfahrtszeit ${route.time} wurde nicht gefunden.`);
    warnings++;
  }

  if (parsed.trainMatch === true) messages.push(`✓ Zugnummer ${route.train} wurde gefunden.`);
  if (parsed.trainMatch === false) {
    messages.push(`Hinweis: Zugnummer ${route.train} wurde nicht eindeutig gefunden.`);
  }

  const box = $("ocrValidation");
  box.innerHTML = messages.join("<br>");
  box.className = `ocr-validation ${warnings ? "warning" : "good"}`;
}

$("applyOcrBtn")?.addEventListener("click", () => {
  if (!currentOcrRoute) return;
  const routeId = currentOcrRoute.route.id;
  const superInput = document.querySelector(`[data-entry-super="${routeId}"]`);
  const saverInput = document.querySelector(`[data-entry-saver="${routeId}"]`);
  if (!superInput || !saverInput) {
    alert("Die Eingabemaske für diese Verbindung wurde nicht gefunden.");
    return;
  }

  superInput.value = $("ocrSuperPrice").value.trim();
  saverInput.value = $("ocrSaverPrice").value.trim();
  superInput.classList.add("changed");
  saverInput.classList.add("changed");
  const dirty = document.querySelector(`[data-dirty-label="${routeId}"]`);
  if (dirty) dirty.textContent = "Screenshot übernommen – wird gesichert …";
  persistCardDraft(project, routeId, true);
  superInput.scrollIntoView({ behavior: "smooth", block: "center" });
  superInput.focus();
  $("screenshotDialog").close();
  showToast(`Screenshot ${currentOcrRoute.route.code} zugeordnet`);
});

function closeOcrDialog() {
  $("screenshotDialog")?.close();
}
$("closeScreenshotDialogBtn")?.addEventListener("click", closeOcrDialog);
$("cancelOcrBtn")?.addEventListener("click", closeOcrDialog);

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderRoutes();
});
window.addEventListener("focus", renderRoutes);

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js"));
}


const batchNoteInput = $("batchNote");
if (batchNoteInput) {
  batchNoteInput.value = localStorage.getItem(DRAFT_NOTE_KEY) || "";
  batchNoteInput.addEventListener("input", debounce(() => {
    localStorage.setItem(DRAFT_NOTE_KEY, batchNoteInput.value);
  }, 300));
}

renderAll();

if (!state.projects.length) {
  openProjectEditor(null);
}
