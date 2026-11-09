"use strict";

const SVGNS = "http://www.w3.org/2000/svg";
const SERIES = ["#4f8cff", "#f5a524", "#22c55e", "#f472b6", "#22c3ee", "#9b7bff", "#fb7c3c", "#94a3b8"];

// Icônes (traits 24×24)
const ICONS = {
  plug: "M9 2v6M15 2v6M6 8h12v4a6 6 0 0 1-12 0zM12 18v4",
  bulb: "M9 18h6M10 22h4M12 2a7 7 0 0 0-4 12.7V17h8v-2.3A7 7 0 0 0 12 2z",
  snow: "M12 2v20M2 12h20M5 5l14 14M19 5L5 19M9 3l3 3 3-3M9 21l3-3 3 3M3 9l3 3-3 3M21 9l-3 3 3 3",
  shield: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10zM9 12l2 2 4-4",
  monitor: "M3 4h18v12H3zM8 20h8M12 16v4",
  camera: "M15 10l5-3v10l-5-3zM3 6h12v12H3z",
  nas: "M4 3h16v8H4zM4 13h16v8H4zM8 7h.01M8 17h.01M12 7h4M12 17h4",
  server: "M5 3h14v18H5zM9 7h6M9 11h6M12 17h.01",
  printer: "M4 4h16v4H4zM6 8v12M18 8v12M4 20h16M10 12h4l-2 4z",
  power: "M12 2v10M5.6 6.6a8 8 0 1 0 12.8 0",
  bolt: "M13 2L3 14h9l-1 8 10-12h-9l1-8z",
  refresh: "M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5",
  play: "M7 4l12 8-12 8z",
  pause: "M7 4h3v16H7zM14 4h3v16h-3z",
  stop: "M6 6h12v12H6z",
  lock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4",
  home: "M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  unlock: "M5 11h14v10H5zM8 11V7a4 4 0 0 1 7.5-2",
  sun: "M12 4V2M12 22v-2M4 12H2M22 12h-2M5.6 5.6L4.2 4.2M19.8 19.8l-1.4-1.4M5.6 18.4l-1.4 1.4M19.8 4.2l-1.4 1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z",
  external: "M14 4h6v6M20 4l-9 9M18 14v6H4V6h6",
  person: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
  network: "M3 14h18v6H3zM7 17h.01M11 17h.01M15 17h.01M12 4v10M8 7l4-3 4 3",
  office_printer: "M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6zM17 12h.01",
  washer: "M4 3h16v18H4zM4 7h16M7 5h.01M10 5h.01M12 10a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10 14.5c1.2-1 2.8 1 4 0",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z",
  thermo: "M14 14.8V4a2 2 0 1 0-4 0v10.8a4 4 0 1 0 4 0zM12 9v8",
  flame: "M12 22a7 7 0 0 0 7-7c0-4-3-6-4-10-2 2-3 4-3 6-1-1-2-2-2-4-2 2-5 5-5 8a7 7 0 0 0 7 7z",
  drop: "M12 3s7 7.5 7 12a7 7 0 0 1-14 0c0-4.5 7-12 7-12z",
  minus: "M5 12h14",
  calendar: "M4 5h16v16H4zM4 10h16M9 3v4M15 3v4",
  tv: "M3 6h18v12H3zM8 21h8",
  star: "M12 3l2.5 5.5L20 9l-4 4 1 6-5-3-5 3 1-6-4-4 5.5-.5z",
  plus: "M12 5v14M5 12h14",
  edit: "M4 20h4L19 9l-4-4L4 16zM14 6l4 4",
  trash: "M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3",
  clock: "M12 7v5l3 3M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z",
  bell: "M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0",
  cog: "M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM12 2v3M12 19v3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M2 12h3M19 12h3M4.9 19.1L7 17M17 7l2.1-2.1",
  cloud: "M7 18h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 18z",
  rain: "M7 14h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 14zM9 17l-1 3M13 17l-1 3M17 17l-1 3",
  storm: "M7 14h10a4 4 0 0 0 .6-8 6 6 0 0 0-11.4 1.6A3.3 3.3 0 0 0 7 14zM13 15l-2 3h3l-2 3",
  fog: "M4 9h16M4 13h16M6 17h12M7 5h10",
  partly: "M8 3v1M3.5 5.5l.7.7M2 10h1M12.5 5.5l-.7.7M5.5 10a2.5 2.5 0 0 1 4.6-1.4M8 19h9a3.5 3.5 0 0 0 .5-7 5 5 0 0 0-9.6 1.4A2.8 2.8 0 0 0 8 19z",
  sunrise: "M12 2v6M5.6 9.6L4.2 8.2M2 16h2M20 16h2M18.4 9.6l1.4-1.4M6 16a6 6 0 0 1 12 0M2 20h20M9 5l3-3 3 3",
  sunset: "M12 9V3M5.6 9.6L4.2 8.2M2 16h2M20 16h2M18.4 9.6l1.4-1.4M6 16a6 6 0 0 1 12 0M2 20h20M15 6l-3 3-3-3",
};

const TYPES = {
  tapo_plug:   { icon: "plug",    color: "#f5a524", group: "Prises & climatisation" },
  tapo_clim:   { icon: "snow",    color: "#22c3ee", group: "Prises & climatisation" },
  tapo_bulb:   { icon: "bulb",    color: "#facc15", group: "Éclairage" },
  verisure:    { icon: "shield",  color: "#22c55e", group: "Sécurité" },
  camera:      { icon: "camera",  color: "#f05252", group: "Sécurité" },
  wol:         { icon: "monitor", color: "#9b7bff", group: "Informatique" },
  qnap:        { icon: "nas",     color: "#4f8cff", group: "Informatique" },
  terramaster: { icon: "nas",     color: "#4f8cff", group: "Informatique" },
  proxmox:     { icon: "server",  color: "#fb7c3c", group: "Informatique" },
  elegoo:      { icon: "printer", color: "#f472b6", group: "Impression 3D" },
  presence:    { icon: "person",  color: "#22c55e", group: "Présence" },
  tado:        { icon: "thermo",  color: "#fb7c3c", group: "Chauffage & climatisation" },
  linux:       { icon: "server",  color: "#22c3ee", group: "Informatique" },
  tplink_switch: { icon: "network", color: "#34d399", group: "Informatique" },
  sfr_box:     { icon: "globe",   color: "#e2001a", group: "Informatique" },
  livebox:     { icon: "globe",   color: "#ff7900", group: "Informatique" },
  hon:         { icon: "washer",  color: "#38bdf8", group: "Électroménager" },
  brother:     { icon: "office_printer", color: "#0ea5e9", group: "Informatique" },
};
const GROUP_ORDER = ["Chauffage & climatisation", "Électroménager", "Prises & climatisation", "Éclairage", "Sécurité", "Présence", "Informatique", "Impression 3D"];
const IT_TYPES = ["brother", "sfr_box", "livebox", "proxmox", "qnap", "terramaster", "linux", "tplink_switch", "wol"];

const S = {
  cfg: null, state: {}, layout: {}, floor: null, editing: false,
  selected: null, range: "24h", hidden: new Set(), daily: [],
  drawerHist: null, snapUrl: {}, timers: {},
};

// ------------------------------------------------------------------ utilitaires
const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => [...root.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const nf = (v, d = 0) => v.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const fmtW = (w) => (w >= 1000 ? `${nf(w / 1000, 2)} kW` : `${nf(w)} W`);
const fmtKwh = (k) => (k > 0 && k < 1 ? `${nf(k * 1000)} Wh` : `${nf(k, k < 10 ? 2 : 1)} kWh`);
const fmtEur = (e) => e.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
const icon = (name, cls = "") => `<svg viewBox="0 0 24 24" class="${cls}"><path d="${ICONS[name]}"/></svg>`;
const meta = (d) => TYPES[d.type] || { icon: "plug", color: "#94a3b8", group: "Autres" };
const device = (id) => S.cfg.devices.find((d) => d.id === id);
const plugs = () => S.cfg.devices.filter((d) => d.capabilities.includes("power"));
const seriesColor = (id) => SERIES[plugs().findIndex((d) => d.id === id) % SERIES.length];

function svgEl(tag, attrs = {}, parent) {
  const n = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  if (parent) parent.appendChild(n);
  return n;
}

async function api(path, opts = {}) {
  const r = await fetch(path, { headers: { "Content-Type": "application/json" }, ...opts });
  if (!r.ok) {
    let msg = r.statusText;
    try { msg = (await r.json()).detail || msg; } catch {}
    throw new Error(msg);
  }
  return r.json();
}

function toast(msg, err = false) {
  const t = $("#toast");
  t.textContent = msg;
  t.className = "toast" + (err ? " err" : "");
  t.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(() => (t.hidden = true), 3200);
}

function stateOf(id) {
  const st = S.state[id];
  if (!st || st.online == null) return "unknown";
  if (st.error) return "err";
  return st.on ? "on" : "off";
}

function localDay(daysAgo) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function store(key, val) {
  try { if (val === undefined) return localStorage.getItem(key); localStorage.setItem(key, val); } catch { return null; }
}

// ------------------------------------------------------------------ démarrage
async function init() {
  applyTheme(store("theme") || (matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark"));
  S.cfg = await api("/api/config");
  S.layout = S.cfg.layout || {};
  S.floor = S.cfg.floors[0]?.id;
  $("#demo-badge").hidden = !S.cfg.demo;

  $$(".nav button").forEach((b) => b.addEventListener("click", () => showView(b.dataset.view)));
  $$("#range-tabs button").forEach((b) => b.addEventListener("click", () => {
    S.range = b.dataset.range;
    $$("#range-tabs button").forEach((x) => x.classList.toggle("active", x === b));
    $("#csv-link").href = `/api/power/export.csv?range=${S.range}`;
    loadEnergy();
  }));
  $("#edit-mode").addEventListener("change", (e) => {
    S.editing = e.target.checked;
    $("#edit-hint").hidden = !S.editing;
    $("#plan").classList.toggle("editing", S.editing);
  });
  $("#theme-btn").addEventListener("click", () => applyTheme(document.documentElement.dataset.theme === "light" ? "dark" : "light", true));
  $("#drawer-close").addEventListener("click", closeDrawer);
  $("#drawer-backdrop").addEventListener("click", closeDrawer);
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") { closeModal(); closeDrawer(); } });

  $("#modal-close").addEventListener("click", closeModal);
  $("#modal").addEventListener("click", (e) => { if (e.target.id === "modal") closeModal(); });
  $("#bell").addEventListener("click", toggleNotifPanel);
  $("#notif-read").addEventListener("click", markNotifRead);
  document.addEventListener("click", (e) => { if (!e.target.closest(".bell-wrap")) $("#notif-panel").hidden = true; });

  tickClock();
  setInterval(tickClock, 15000);
  setInterval(renderKpis, 60000); // bascule HP / HC dans l'en-tête
  await loadAutomationData();
  try { S.rackItems = Object.values((await api("/api/rack")).racks).flatMap((r) => r.items); } catch {}
  renderSceneBar();
  renderSetup();
  loadWeather();
  setInterval(loadWeather, 10 * 60000);
  refreshNotifications(true);
  setInterval(refreshNotifications, 10000);
  renderFloorTabs();
  renderPlan();
  await Promise.all([refreshState(), refreshDaily()]);
  setInterval(refreshState, 5000);
  setInterval(refreshDaily, 60000);
  startCamera();
}

function applyTheme(t, save = false) {
  document.documentElement.dataset.theme = t;
  $("#theme-btn").innerHTML = icon(t === "light" ? "moon" : "sun");
  if (save) store("theme", t);
  if (S.cfg) renderPlan(); // les filtres SVG (ombres) ne suivent pas toujours le changement de variables
}

function tickClock() {
  const now = new Date();
  const h = now.getHours();
  $("#greeting").textContent = h < 6 ? "Bonne nuit" : h < 18 ? "Bonjour" : "Bonsoir";
  const date = now.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  $("#clock").textContent = `${date.charAt(0).toUpperCase() + date.slice(1)} · ${now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`;
}

function showView(v) {
  $$(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  $$(".view").forEach((s) => s.classList.toggle("active", s.id === "view-" + v));
  clearInterval(S.timers.energy);
  if (v === "energy") { loadEnergy(); S.timers.energy = setInterval(loadEnergy, 60000); }
  if (v === "home") renderSetup();
  if (v === "devices") renderDevices();
  if (v === "servers") renderServers();
  if (v === "automations") renderAutomations();
  if (v === "scenes") renderScenes();
  if (v === "logbook") loadLogbook(true);
  if (v === "settings") renderSettings();
  window.scrollTo({ top: 0 });
}

async function refreshState() {
  try { S.state = await api("/api/state"); }
  catch (e) { return toast("Serveur injoignable : " + e.message, true); }
  renderAll();
}

async function refreshDaily() {
  try { S.daily = await api("/api/power/daily?days=30"); renderKpis(); } catch {}
}

function renderAll() {
  updatePlanDevices();
  renderKpis();
  renderQuick();
  renderIt();
  renderPrinter();
  if ($("#view-devices").classList.contains("active")) renderDevices();
  if (Date.now() - (S.lastSrvRender || 0) > 30000) { S.lastSrvRender = Date.now(); refreshServersView(); }
  if (S.selected) renderDrawer();
}

// ------------------------------------------------------------------ KPI en-tête
function renderKpis() {
  if (!S.cfg) return;
  const total = plugs().reduce((s, d) => s + (S.state[d.id]?.power_w || 0), 0);
  const today = S.daily.filter((r) => r.day === localDay(0)).reduce((s, r) => s + r.kwh, 0);
  $("#kpi-power b").textContent = fmtW(total);
  $("#kpi-today b").textContent = `${fmtKwh(today)} · ${fmtEur(costOf(S.daily.filter((r) => r.day === localDay(0))))}`;
  const tn = tariffNow();
  const small = $("#kpi-today small");
  small.innerHTML = tn ? `Aujourd'hui <span class="tariff-pill ${tn.hc ? "hc" : "hp"}" title="Change à ${tn.until}">${tn.hc ? "Heures creuses" : "Heures pleines"} → ${tn.until}</span>` : "Aujourd'hui";

  const alarm = S.cfg.devices.find((d) => d.type === "verisure");
  const k = $("#kpi-alarm");
  if (alarm) {
    const st = S.state[alarm.id] || {};
    k.querySelector("b").textContent = st.error ? "Erreur" : st.summary || "—";
    k.querySelector(".kpi-ico").className = "kpi-ico " + (st.error ? "red" : st.on ? "green" : "amber");
    k.querySelector(".kpi-ico").innerHTML = icon(st.on ? "lock" : "unlock");
    k.onclick = () => openDrawer(alarm.id);
    k.style.cursor = "pointer";
  } else k.hidden = true;

  const online = S.cfg.devices.filter((d) => S.state[d.id]?.online).length;
  $("#kpi-online b").textContent = `${online} / ${S.cfg.devices.length}`;
}

// ------------------------------------------------------------------ plan
function renderFloorTabs() {
  const box = $("#floor-tabs");
  box.innerHTML = "";
  for (const f of S.cfg.floors) {
    const b = document.createElement("button");
    b.textContent = f.name;
    b.classList.toggle("active", f.id === S.floor);
    b.addEventListener("click", () => { S.floor = f.id; renderFloorTabs(); renderPlan(); updatePlanDevices(); });
    box.appendChild(b);
  }
}

function roomCenter(floor, name) {
  const r = floor.rooms.find((r) => r.name === name);
  if (!r) return [floor.width / 2, floor.height / 2];
  return r.label || [r.x + r.w / 2, r.y + r.h / 2];
}

function devicePos(d, floor, idx) {
  const p = S.layout[d.id];
  if (p && p.floor === floor.id) return [p.x, p.y];
  const [cx, cy] = roomCenter(floor, d.room);
  return [cx + Math.cos(idx * 2.4) * 50 * Math.sqrt(idx), cy + Math.sin(idx * 2.4) * 50 * Math.sqrt(idx)];
}

function planDefs(defs) {
  const bs = svgEl("filter", { id: "bshadow", x: "-10%", y: "-10%", width: "120%", height: "125%" }, defs);
  svgEl("feDropShadow", { dx: 0, dy: 14, stdDeviation: 18, class: "fe-bshadow" }, bs);
  const ms = svgEl("filter", { id: "mshadow", x: "-50%", y: "-50%", width: "200%", height: "200%" }, defs);
  svgEl("feDropShadow", { dx: 0, dy: 2, stdDeviation: 2.5, class: "fe-mshadow" }, ms);
  const mk = svgEl("marker", { id: "arrowhead", viewBox: "0 0 10 10", refX: 6, refY: 5, markerWidth: 7, markerHeight: 7, orient: "auto-start-reverse" }, defs);
  svgEl("path", { d: "M0 0L10 5L0 10z", class: "stair-arrow-head" }, mk);
}

function renderPlan() {
  const svg = $("#plan");
  svg.innerHTML = "";
  const floor = S.cfg.floors.find((f) => f.id === S.floor);
  if (!floor) return;
  const pad = 26;
  svg.setAttribute("viewBox", `${-pad} ${-pad} ${floor.width + 2 * pad} ${floor.height + 2 * pad}`);
  planDefs(svgEl("defs", {}, svg));
  if (floor.background) svgEl("image", { href: floor.background, x: 0, y: 0, width: floor.width, height: floor.height }, svg);

  const rooms = floor.rooms.filter((r) => !r.stairs);
  const outer = rooms.filter((r) => r.wall !== "inner");

  // ombre portée du bâtiment
  const shadow = svgEl("g", { filter: "url(#bshadow)" }, svg);
  outer.forEach((r) => svgEl("rect", { x: r.x, y: r.y, width: r.w, height: r.h, class: "p-shadow" }, shadow));

  const g = svgEl("g", {}, svg);
  for (const r of rooms) drawFloor(g, r);
  for (const r of floor.rooms.filter((r) => r.stairs)) drawStairs(g, r);
  for (const f of floor.furniture || []) drawFurniture(g, f);
  // cloisons puis murs porteurs
  for (const r of rooms.filter((r) => r.wall === "inner")) svgEl("rect", { x: r.x, y: r.y, width: r.w, height: r.h, class: "wall-inner" }, g);
  for (const r of outer) svgEl("rect", { x: r.x, y: r.y, width: r.w, height: r.h, class: "wall-outer" }, g);
  for (const w of floor.windows || []) drawWindow(g, w);
  for (const r of rooms) {
    const [x, y] = r.label || [r.x + r.w / 2, r.y + 44];
    svgEl("text", { x, y, class: "room-label" }, g).textContent = r.name;
  }

  const layer = svgEl("g", { id: "devices" }, svg);
  const racks = (floor.furniture || []).filter((f) => f.kind === "it");
  S.cfg.devices.filter((d) => (S.layout[d.id]?.floor || d.floor || floor.id) === floor.id).forEach((d, i) => {
    const [x, y] = devicePos(d, floor, i);
    const m = meta(d);
    // posé sur la baie de brassage : mini-bulle (on peut en aligner plusieurs)
    const mini = racks.some((f) => x >= f.x && x <= f.x + f.w && y >= f.y && y <= f.y + f.h);
    const R = mini ? 11 : 18;
    const dg = svgEl("g", { class: "dev" + (mini ? " mini" : ""), "data-id": d.id, "data-mini": mini ? "1" : "", transform: `translate(${x} ${y})`, style: `--c:${m.color}` }, layer);
    svgEl("circle", { r: R + 8, class: "glow" }, dg);
    svgEl("circle", { r: R, class: "ring", filter: "url(#mshadow)" }, dg);
    const ic = svgEl("svg", { x: -R / 2, y: -R / 2, width: R, height: R, viewBox: "0 0 24 24" }, dg);
    svgEl("path", { d: ICONS[m.icon], class: "ico" }, ic);
    const tag = svgEl("g", { class: "tag", transform: "translate(0 31)", visibility: "hidden" }, dg);
    svgEl("rect", { x: -24, y: -9, width: 48, height: 18, rx: 9 }, tag);
    svgEl("text", {}, tag);
    svgEl("title", {}, dg).textContent = d.name;
    attachDrag(dg, d, floor);
  });
  updatePlanDevices();
}

// Sol dessiné lame par lame / carreau par carreau (pas de motif SVG : évite les raccords visibles)
function drawFloor(g, r) {
  svgEl("rect", { x: r.x, y: r.y, width: r.w, height: r.h, class: r.floor === "wood" ? "p-wood" : "p-tile" }, g);
  let d = "";
  if (r.floor === "wood") {
    const plank = 22, len = 150;
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    for (let y = r.y + plank, row = 0; y < r.y + r.h; y += plank, row++) d += `M${r.x},${y}H${r.x + r.w}`;
    for (let y = r.y, row = 0; y < r.y + r.h; y += plank, row++) {
      const yb = Math.min(y + plank, r.y + r.h);
      for (let x = r.x + 30 + rnd() * len; x < r.x + r.w - 10; x += len * (0.75 + rnd() * 0.5)) d += `M${x.toFixed(1)},${y}V${yb}`;
    }
    svgEl("path", { d, class: "p-wood-line" }, g);
  } else if (r.floor === "tile") {
    const t = 32;
    for (let x = r.x + t; x < r.x + r.w; x += t) d += `M${x},${r.y}V${r.y + r.h}`;
    for (let y = r.y + t; y < r.y + r.h; y += t) d += `M${r.x},${y}H${r.x + r.w}`;
    svgEl("path", { d, class: "p-tile-line" }, g);
  }
}

const ptsToD = (pts) => pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join("");

// Escalier quart tournant : marches rayonnantes autour d'un noyau, rampe et flèche de montée
function drawStairs(g, r) {
  const s = r.stairs;
  const H = Math.PI / 2;
  const P = (k, t) => [s.cx + s.rx * k * Math.sin(t), s.cy - s.ry * k * Math.cos(t)];
  const arc = (k, t0, t1, n = 24) => Array.from({ length: n + 1 }, (_, i) => P(k, t0 + ((t1 - t0) * i) / n));
  const target = S.cfg.floors.find((f) => f.id === s.to);
  const sg = svgEl("g", { class: "stairs" + (s.to ? " link" : "") }, g);
  svgEl("title", {}, sg).textContent = target ? `Escalier — aller au ${target.name}` : "Escalier — vers l'étage 2";

  for (let i = 0; i < s.steps; i++) {
    const t0 = (H * i) / s.steps, t1 = (H * (i + 1)) / s.steps;
    svgEl("path", { d: ptsToD([...arc(1, t0, t1, 6), ...arc(s.core, t1, t0, 3)]) + "Z", class: "tread" + (i % 2 ? " alt" : "") }, sg);
  }
  svgEl("path", { d: ptsToD([[s.cx, s.cy], ...arc(s.core, 0, H)]) + "Z", class: "stair-core" }, sg);
  svgEl("path", { d: ptsToD(arc(1, 0, H, 60)), class: "stair-rail" }, sg);
  svgEl("path", { d: ptsToD(arc(0.955, 0.02, H - 0.02, 60)), class: "stair-rail2" }, sg);

  // ligne de foulée : départ (rond) en bas, flèche vers le haut
  const mid = (1 + s.core) / 2 + 0.05;
  const [dx, dy] = P(mid, H * 0.94);
  svgEl("circle", { cx: dx, cy: dy, r: 4.5, class: "stair-arrow-dot" }, sg);
  svgEl("path", { d: ptsToD(arc(mid, H * 0.94, H * 0.1, 40)), class: "stair-arrow", "marker-end": "url(#arrowhead)" }, sg);

  const [lx, ly] = P(s.core * 0.5, H / 2);
  svgEl("text", { x: lx + 4, y: ly - 4, class: "stair-label" }, sg).textContent = "ÉTAGE";
  svgEl("text", { x: lx + 4, y: ly + 10, class: "stair-label big" }, sg).textContent = "2";

  sg.addEventListener("click", () => {
    if (S.editing) return;
    if (target) { S.floor = target.id; renderFloorTabs(); renderPlan(); }
    else toast("Le plan de l'étage 2 arrive bientôt");
  });
}

function drawFurniture(g, f) {
  const fg = svgEl("g", { class: "furn " + (f.kind || "") }, g);
  svgEl("title", {}, fg).textContent = f.name;
  const { x, y, w, h } = f;
  const cx = x + w / 2, cy = y + h / 2;
  const label = (txt, lx = cx, ly = cy, rot = false) => {
    const t = svgEl("text", { x: lx, y: ly, class: "furn-label" }, fg);
    if (rot) t.setAttribute("transform", `rotate(-90 ${lx} ${ly})`);
    t.textContent = txt;
  };
  switch (f.kind) {
    case "appliance":
      svgEl("rect", { x, y, width: w, height: h, rx: 6, class: "furn-body" }, fg);
      svgEl("line", { x1: x + 7, x2: x + w - 7, y1: y + h * 0.3, y2: y + h * 0.3, class: "furn-detail" }, fg);
      svgEl("line", { x1: x + w - 11, x2: x + w - 11, y1: y + h * 0.45, y2: y + h * 0.78, class: "furn-detail strong" }, fg);
      label(f.name, cx - 4, y + h * 0.64);
      break;
    case "ac":
      svgEl("rect", { x, y, width: w, height: h, rx: h / 2, class: "furn-body raised" }, fg);
      svgEl("line", { x1: x + 16, x2: x + w - 16, y1: y + h - 6, y2: y + h - 6, class: "furn-detail" }, fg);
      break;
    case "tv":
      svgEl("rect", { x, y: y + 10, width: w, height: h - 10, rx: 7, class: "furn-body" }, fg);
      svgEl("rect", { x: x + 22, y, width: w - 44, height: 7, rx: 3.5, class: "screen" }, fg);
      label(f.name, cx, y + 10 + (h - 10) / 2);
      break;
    case "desk": {
      svgEl("rect", { x, y, width: w, height: h, rx: 6, class: "furn-body" }, fg);
      svgEl("rect", { x: x + w - 13, y: cy - 30, width: 5, height: 60, rx: 2.5, class: "screen" }, fg);
      const cw = 28, ch = 32, chx = x - cw - 9, chy = cy - ch / 2;
      svgEl("rect", { x: chx, y: chy, width: cw, height: ch, rx: 9, class: "chair" }, fg);
      svgEl("line", { x1: chx + 5, x2: chx + 5, y1: chy + 6, y2: chy + ch - 6, class: "furn-detail strong" }, fg);
      label(f.name, x + w / 2 - 6, cy, true);
      break;
    }
    case "it": {
      fg.classList.add("clickable");
      fg.querySelector("title").textContent = `${f.name} — cliquer pour ouvrir la baie`;
      fg.addEventListener("click", (e) => { if (!S.editing && !e.target.closest(".dev")) openRack(f.name); });
      // armoire réseau vue de dessus : caisson, montants 19", porte perforée
      svgEl("rect", { x: x - 2, y: y - 2, width: w + 4, height: h + 4, rx: 7, class: "rack-shadow" }, fg);
      svgEl("rect", { x, y, width: w, height: h, rx: 6, class: "furn-body it" }, fg);
      svgEl("rect", { x: x + 5, y: y + 5, width: w - 10, height: h - 10, rx: 3, class: "rack-inner" }, fg);
      let perf = "";
      for (let px = x + 12; px < x + w - 8; px += 7) for (let py = y + 10; py < y + h - 8; py += 7) perf += `M${px},${py}h1.6`;
      svgEl("path", { d: perf, class: "rack-perf" }, fg);
      svgEl("line", { x1: x + 9, x2: x + 9, y1: y + 7, y2: y + h - 7, class: "rack-rail-line" }, fg);
      svgEl("line", { x1: x + w - 9, x2: x + w - 9, y1: y + 7, y2: y + h - 7, class: "rack-rail-line" }, fg);
      svgEl("text", { x: x + 12, y: y + h + 13, class: "furn-label it-label" }, fg).textContent = f.name.toUpperCase();
      break;
    }
    case "sofa": {
      // canapé : dossier côté « back », accoudoirs, coussins d'assise et coussins déco
      const vertical = h > w, back = f.back || (vertical ? "right" : "top");
      const bt = 20, at = 15;
      svgEl("rect", { x, y, width: w, height: h, rx: 12, class: "sofa-base" }, fg);
      const seat = { x, y, w, h };
      if (back === "right") { svgEl("rect", { x: x + w - bt, y, width: bt, height: h, rx: 10, class: "sofa-back" }, fg); seat.w -= bt; }
      if (back === "left") { svgEl("rect", { x, y, width: bt, height: h, rx: 10, class: "sofa-back" }, fg); seat.x += bt; seat.w -= bt; }
      if (back === "top") { svgEl("rect", { x, y, width: w, height: bt, rx: 10, class: "sofa-back" }, fg); seat.y += bt; seat.h -= bt; }
      if (back === "bottom") { svgEl("rect", { x, y: y + h - bt, width: w, height: bt, rx: 10, class: "sofa-back" }, fg); seat.h -= bt; }
      const along = back === "left" || back === "right";
      if (along) {
        svgEl("rect", { x: seat.x, y, width: seat.w, height: at, rx: 7, class: "sofa-arm" }, fg);
        svgEl("rect", { x: seat.x, y: y + h - at, width: seat.w, height: at, rx: 7, class: "sofa-arm" }, fg);
        seat.y += at; seat.h -= 2 * at;
      } else {
        svgEl("rect", { x, y: seat.y, width: at, height: seat.h, rx: 7, class: "sofa-arm" }, fg);
        svgEl("rect", { x: x + w - at, y: seat.y, width: at, height: seat.h, rx: 7, class: "sofa-arm" }, fg);
        seat.x += at; seat.w -= 2 * at;
      }
      const len = along ? seat.h : seat.w, n = Math.max(2, Math.min(4, Math.round(len / 85)));
      for (let i = 0; i < n; i++) {
        const c = along
          ? { x: seat.x + 3, y: seat.y + (seat.h / n) * i + 3, width: seat.w - 6, height: seat.h / n - 6 }
          : { x: seat.x + (seat.w / n) * i + 3, y: seat.y + 3, width: seat.w / n - 6, height: seat.h - 6 };
        svgEl("rect", { ...c, rx: 8, class: "sofa-cushion" }, fg);
      }
      // coussins déco contre le dossier
      for (const k of [0.22, 0.78]) {
        const p = along
          ? { x: back === "right" ? seat.x + seat.w - 16 : seat.x + 4, y: seat.y + seat.h * k - 12, width: 12, height: 24 }
          : { x: seat.x + seat.w * k - 12, y: back === "bottom" ? seat.y + seat.h - 16 : seat.y + 4, width: 24, height: 12 };
        svgEl("rect", { ...p, rx: 5, class: "sofa-pillow" }, fg);
      }
      label(f.name, seat.x + seat.w / 2, seat.y + seat.h / 2, along);
      break;
    }
    case "table": {
      // table + chaises sur les grands côtés
      const vertical = h >= w, cs = f.chairs === 0 ? 0 : 18, gap = f.chairs === 0 ? 0 : 6;
      const top = vertical ? { x: x + cs + gap, y: y + 4, width: w - 2 * (cs + gap), height: h - 8 }
                           : { x: x + 4, y: y + cs + gap, width: w - 8, height: h - 2 * (cs + gap) };
      const len = vertical ? top.height : top.width, n = f.chairs === 0 ? 0 : Math.max(1, Math.floor(len / 46));
      for (let i = 0; i < n; i++) {
        const t = (len / n) * (i + 0.5);
        const chairs = vertical
          ? [[x, top.y + t - cs / 2, "l"], [x + w - cs, top.y + t - cs / 2, "r"]]
          : [[top.x + t - cs / 2, y, "t"], [top.x + t - cs / 2, y + h - cs, "b"]];
        for (const [cxx, cyy, side] of chairs) {
          svgEl("rect", { x: cxx, y: cyy, width: cs, height: cs, rx: 5, class: "chair" }, fg);
          const b = { l: [cxx + 3, cyy + 3, cxx + 3, cyy + cs - 3], r: [cxx + cs - 3, cyy + 3, cxx + cs - 3, cyy + cs - 3],
                      t: [cxx + 3, cyy + 3, cxx + cs - 3, cyy + 3], b: [cxx + 3, cyy + cs - 3, cxx + cs - 3, cyy + cs - 3] }[side];
          svgEl("line", { x1: b[0], y1: b[1], x2: b[2], y2: b[3], class: "furn-detail strong" }, fg);
        }
      }
      svgEl("rect", { ...top, rx: 6, class: "wood-top" }, fg);
      svgEl("rect", { x: top.x + 4, y: top.y + 4, width: top.width - 8, height: top.height - 8, rx: 4, class: "wood-grain" }, fg);
      label(f.name, top.x + top.width / 2, top.y + top.height / 2, vertical && top.height > 80);
      break;
    }
    case "wardrobe": {
      // armoire : caisson bois, portes battantes, poignées
      const vertical = h > w, len = vertical ? h : w, n = Math.max(2, Math.min(5, Math.round(len / 65)));
      svgEl("rect", { x, y, width: w, height: h, rx: 4, class: "wood-top" }, fg);
      for (let i = 1; i < n; i++) {
        const p = (len / n) * i;
        if (vertical) svgEl("line", { x1: x + 3, x2: x + w - 3, y1: y + p, y2: y + p, class: "door-line" }, fg);
        else svgEl("line", { x1: x + p, x2: x + p, y1: y + 3, y2: y + h - 3, class: "door-line" }, fg);
      }
      for (let i = 0; i < n; i++) {
        const mid = (len / n) * (i + 0.5) + ((i % 2 ? -1 : 1) * len) / n / 3;
        if (vertical) svgEl("line", { x1: x + w * 0.3, x2: x + w * 0.3, y1: y + mid - 6, y2: y + mid + 6, class: "handle" }, fg);
        else svgEl("line", { x1: x + mid - 7, x2: x + mid + 7, y1: y + h * 0.3, y2: y + h * 0.3, class: "handle" }, fg);
      }
      label(f.name, cx, vertical ? cy : y + h * 0.65, vertical);
      break;
    }
    default:
      svgEl("rect", { x, y, width: w, height: h, rx: 6, class: "furn-body" }, fg);
      label(f.name, cx, cy, h > w * 1.5);
  }
}

function drawWindow(g, w) {
  const t = 11;
  const vertical = w.x1 === w.x2;
  const x = vertical ? w.x1 - t / 2 : Math.min(w.x1, w.x2);
  const y = vertical ? Math.min(w.y1, w.y2) : w.y1 - t / 2;
  const W = vertical ? t : Math.abs(w.x2 - w.x1);
  const Hh = vertical ? Math.abs(w.y2 - w.y1) : t;
  svgEl("rect", { x, y, width: W, height: Hh, class: "win-frame" }, g);
  if (vertical) svgEl("line", { x1: w.x1, x2: w.x1, y1: y + 2, y2: y + Hh - 2, class: "win-glass" }, g);
  else svgEl("line", { x1: x + 2, x2: x + W - 2, y1: w.y1, y2: w.y1, class: "win-glass" }, g);
}

function planLabel(d, st) {
  if (!st || st.error || !st.online) return "";
  if (d.type === "hon" && !st.on) return "";
  if (d.capabilities.includes("power") && st.power_w != null) return (st.power_estimated ? "≈" : "") + fmtW(st.power_w);
  if (d.type === "elegoo" && st.on) return `${Math.round(st.progress || 0)} %`;
  if (d.type === "tapo_bulb" && st.on) return `${st.brightness ?? 100} %`;
  if (d.type === "tado" && st.current_temp != null) return `${nf(st.current_temp, 1)}°`;
  return "";
}

function updatePlanDevices() {
  $$("#devices .dev").forEach((g) => {
    const d = device(g.dataset.id);
    const st = S.state[d.id];
    g.setAttribute("class", `dev ${stateOf(d.id)}${S.selected === d.id ? " selected" : ""}`);
    const label = planLabel(d, st);
    const tag = g.querySelector(".tag");
    tag.setAttribute("visibility", label && !g.dataset.mini ? "visible" : "hidden");
    tag.querySelector("text").textContent = label;
    const w = Math.max(38, label.length * 6.6 + 16);
    tag.querySelector("rect").setAttribute("x", -w / 2);
    tag.querySelector("rect").setAttribute("width", w);
    g.querySelector("title").textContent = `${d.name} — ${st?.summary || ""}${d.type === "tapo_bulb" ? " · clic : allumer / éteindre, appui long : réglages"
      : d.type === "wol" ? " · clic : réveiller (Wake on LAN), appui long : fiche" : ""}`;
  });
}

function attachDrag(g, d, floor) {
  const svg = $("#plan");
  let dragging = false;
  g.addEventListener("pointerdown", (e) => {
    if (!S.editing) return;
    e.preventDefault();
    g.setPointerCapture(e.pointerId);
    g.classList.add("dragging");
    dragging = true;
  });
  g.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const x = Math.round(Math.max(0, Math.min(floor.width, pt.x)));
    const y = Math.round(Math.max(0, Math.min(floor.height, pt.y)));
    g.setAttribute("transform", `translate(${x} ${y})`);
    S.layout[d.id] = { floor: floor.id, x, y };
  });
  g.addEventListener("pointerup", async () => {
    if (!dragging) return;
    dragging = false;
    g.classList.remove("dragging");
    try { await api("/api/layout", { method: "PUT", body: JSON.stringify(S.layout) }); }
    catch (e) { toast("Position non enregistrée : " + e.message, true); }
  });
  // Ampoules : un clic allume / éteint ; appui long ou clic droit = fiche. Autres appareils : un clic = fiche.
  const quickToggle = d.type === "tapo_bulb" || d.type === "wol";
  let longPress = null, longDone = false;
  if (quickToggle) {
    g.addEventListener("pointerdown", () => {
      if (S.editing) return;
      longDone = false;
      longPress = setTimeout(() => { longDone = true; openDrawer(d.id); }, 550);
    });
    ["pointerup", "pointerleave", "pointercancel"].forEach((ev) => g.addEventListener(ev, () => clearTimeout(longPress)));
    g.addEventListener("contextmenu", (e) => { e.preventDefault(); if (!S.editing) { longDone = true; openDrawer(d.id); } });
    g.querySelector("title").textContent = `${d.name} — clic : allumer / éteindre · appui long : réglages`;
  }
  g.addEventListener("click", () => {
    if (S.editing) return;
    if (!quickToggle) return openDrawer(d.id);
    if (longDone) { longDone = false; return; }
    const st = S.state[d.id] || {};
    if (d.type === "wol") {
      if (st.on) return openDrawer(d.id); // déjà allumé : on montre sa fiche
      g.classList.add("toggling");
      toast(`Réveil de ${d.name}… (Wake on LAN)`);
      return doAction(d.id, "wake").finally(() => g.classList.remove("toggling"));
    }
    if (!st.online || st.error) return openDrawer(d.id);
    // retour visuel immédiat, puis confirmation par l'appareil
    S.state[d.id] = { ...st, on: !st.on };
    updatePlanDevices();
    g.classList.add("toggling");
    doAction(d.id, st.on ? "off" : "on").finally(() => g.classList.remove("toggling"));
  });
}

// ------------------------------------------------------------------ colonne latérale
function deviceRow(d, right) {
  const st = S.state[d.id] || {};
  const cls = stateOf(d.id);
  return `<div class="row ${cls}" data-open="${d.id}" style="--c:${meta(d).color}">
    <span class="dev-ico">${icon(meta(d).icon)}</span>
    <div class="meta"><b>${esc(d.name)}</b><small>${esc(st.error ? "Erreur de connexion" : st.summary || "…")}</small></div>
    ${right}</div>`;
}

function bindRows(box) {
  $$("[data-open]", box).forEach((r) => r.addEventListener("click", (e) => {
    if (e.target.closest(".switch")) return;
    openDrawer(r.dataset.open);
  }));
  $$("[data-toggle]", box).forEach((inp) => inp.addEventListener("change", () => {
    doAction(inp.dataset.toggle, inp.checked ? "on" : "off", {}, inp);
  }));
}

function switchHtml(d) {
  const st = S.state[d.id] || {};
  const disabled = !st.online || st.error ? "disabled" : "";
  return `<label class="switch" title="Allumer / éteindre"><input type="checkbox" data-toggle="${d.id}" ${st.on ? "checked" : ""} ${disabled}><i></i></label>`;
}

function renderQuick() {
  const box = $("#quick-controls");
  if (box.contains(document.activeElement)) return;
  const list = S.cfg.devices.filter((d) => d.capabilities.includes("switch"));
  const total = plugs().reduce((s, d) => s + (S.state[d.id]?.power_w || 0), 0);
  $("#quick-total").textContent = `${fmtW(total)} au total`;
  box.innerHTML = list.map((d) => deviceRow(d, switchHtml(d))).join("");
  bindRows(box);
}

function renderIt() {
  const box = $("#it-list");
  const list = S.cfg.devices.filter((d) => IT_TYPES.includes(d.type));
  const rackName = S.cfg.floors.flatMap((f) => f.furniture || []).find((f) => f.kind === "it")?.name;
  const head = box.parentElement.querySelector(".card-head");
  if (rackName && !head.querySelector("#open-rack")) {
    head.querySelector("h2").textContent = rackName;
    head.insertAdjacentHTML("beforeend", `<button class="btn small-btn" id="open-rack">${icon("server")}Ouvrir la baie</button>`);
    head.querySelector("#open-rack").addEventListener("click", () => openRack(rackName));
  }
  box.innerHTML = list.map((d) => {
    const c = stateOf(d.id);
    const pill = c === "on" ? `<span class="pill on">En ligne</span>` : c === "err" ? `<span class="pill err">Erreur</span>` : `<span class="pill">Éteint</span>`;
    return deviceRow(d, pill);
  }).join("");
  bindRows(box);
}

function renderPrinter() {
  const d = S.cfg.devices.find((x) => x.type === "elegoo");
  const card = $("#printer-card");
  if (!d) return;
  const st = S.state[d.id] || {};
  card.hidden = false;
  card.style.setProperty("--c", meta(d).color);
  const p = st.progress || 0;
  card.innerHTML = `<div class="card-head"><h2>Impression 3D</h2>${st.on ? `<span class="pill on">${nf(p)} %</span>` : ""}</div>
    ${deviceRow(d, "")}
    ${st.on ? `<div class="bar"><div style="width:${p}%"></div></div>
      <p class="muted small" style="margin-top:8px">${esc(st.details?.fichier || "")}</p>` : ""}`;
  bindRows(card);
}

function startCamera() {
  const d = S.cfg.devices.find((x) => x.type === "camera");
  if (!d) return;
  const card = $("#cam-card");
  card.hidden = false;
  card.innerHTML = `<div class="card-head"><h2>${esc(d.name)}</h2><span class="live">Direct</span></div><img alt="Caméra ${esc(d.name)}">`;
  card.querySelector("img").addEventListener("click", () => openDrawer(d.id));
  const tick = async () => {
    if (document.hidden || !$("#view-home").classList.contains("active")) return;
    const url = await loadSnapshot(d.id);
    if (url) card.querySelector("img").src = url;
  };
  tick();
  setInterval(tick, 5000);
}

async function loadSnapshot(id) {
  try {
    const r = await fetch(`/api/camera/${id}/snapshot?t=${Date.now()}`);
    if (!r.ok) return null;
    const url = URL.createObjectURL(await r.blob());
    if (S.snapUrl[id]) setTimeout((old) => URL.revokeObjectURL(old), 10000, S.snapUrl[id]);
    S.snapUrl[id] = url;
    return url;
  } catch { return null; }
}

// ------------------------------------------------------------------ appareils
function renderDevices() {
  const groups = {};
  for (const d of S.cfg.devices) (groups[meta(d).group] ||= []).push(d);
  const order = [...GROUP_ORDER, ...Object.keys(groups).filter((g) => !GROUP_ORDER.includes(g))];
  $("#device-groups").innerHTML = order.filter((g) => groups[g]).map((g) => `
    <div class="group"><h2>${esc(g)}</h2><div class="tiles">${groups[g].map((d) => {
      const st = S.state[d.id] || {};
      const c = stateOf(d.id);
      const pill = c === "on" ? `<span class="pill on">Actif</span>` : c === "err" ? `<span class="pill err">Erreur</span>`
        : c === "unknown" ? `<span class="pill">…</span>` : `<span class="pill">Inactif</span>`;
      return `<div class="tile ${c}" data-open="${d.id}" style="--c:${meta(d).color}">
        <div class="head"><span class="dev-ico">${icon(meta(d).icon)}</span>${pill}</div>
        <div class="name">${esc(d.name)}</div>
        <div class="sum">${esc(st.error ? "Erreur de connexion" : st.summary || "…")}${d.host ? " · " + esc(d.host) : ""}</div></div>`;
    }).join("")}</div></div>`).join("");
  bindRows($("#device-groups"));
}

// ------------------------------------------------------------------ panneau détail
async function openDrawer(id) {
  S.selected = id;
  S.drawerHist = null;
  $("#drawer").classList.toggle("wide", ["qnap", "terramaster", "proxmox", "linux"].includes(device(id)?.type));
  $("#drawer").classList.add("open");
  $("#drawer").setAttribute("aria-hidden", "false");
  $("#drawer-backdrop").hidden = false;
  updatePlanDevices();
  renderDrawer();
  clearInterval(S.timers.drawer);
  const d = device(id);
  S.drawerLog = null;
  const extra = async () => {
    if (S.selected !== id) return;
    try { S.drawerLog = await api(`/api/logbook?entity=${id}&limit=8`); } catch {}
    if (d.capabilities.includes("power")) {
      try { S.drawerHist = (await api(`/api/power/history?range=24h&devices=${id}`))[id]; } catch {}
    }
    if (d.type === "camera") await loadSnapshot(id);
    if (S.selected === id) renderDrawer();
  };
  extra();
  S.timers.drawer = setInterval(extra, d.type === "camera" ? 3000 : 60000);
}

function closeDrawer() {
  S.selected = null;
  clearInterval(S.timers.drawer);
  $("#drawer").classList.remove("open");
  $("#drawer").setAttribute("aria-hidden", "true");
  $("#drawer-backdrop").hidden = true;
  updatePlanDevices();
}

async function doAction(id, name, params = {}, ctrl) {
  if (ctrl) ctrl.disabled = true;
  try {
    const r = await api(`/api/devices/${id}/action/${name}`, { method: "POST", body: JSON.stringify(params) });
    S.state[id] = r.state;
    toast(r.message && r.message !== "(démo)" ? r.message : "C'est fait");
  } catch (e) {
    toast(e.message, true);
  } finally {
    if (ctrl) ctrl.disabled = false;
    if (S.selected === id) {
      try { S.drawerLog = await api(`/api/logbook?entity=${id}&limit=8`); } catch {}
    }
    renderAll();
  }
}

function kvTable(details) {
  const rows = Object.entries(details || {}).filter(([, v]) => v != null && v !== "" && v !== "None");
  if (!rows.length) return "";
  return `<div class="d-section">Informations</div><table class="kv">${rows.map(([k, v]) => {
    const s = String(v);
    const val = /^https?:\/\//.test(s) ? `<a href="${esc(s)}" target="_blank" rel="noopener">${esc(s)}</a>` : esc(s);
    return `<tr><td>${esc(k.charAt(0).toUpperCase() + k.slice(1))}</td><td>${val}</td></tr>`;
  }).join("")}</table>`;
}

function renderDrawer() {
  const d = device(S.selected);
  if (!d) return;
  const body = $("#drawer-body");
  const active = document.activeElement;
  if (body.contains(active) && active.matches("input:not([type=checkbox])")) return; // saisie en cours
  const st = S.state[d.id] || {};
  const m = meta(d);
  const c = stateOf(d.id);
  const statusTxt = c === "on" ? "Actif" : c === "err" ? "Erreur" : c === "unknown" ? "En attente" : "Inactif";
  let h = `<div class="d-head" style="--c:${m.color}"><span class="dev-ico ${c === "on" ? "on" : ""}">${icon(m.icon)}</span>
    <div><h2>${esc(d.name)}</h2><p><span class="dot ${c}"></span>${statusTxt}${d.host ? " · " + esc(d.host) : ""}</p></div></div>`;
  if (S.cfg.demo) h += `<div class="demo-box">${icon("bolt")}<div><b>Mode démo</b> : les commandes sont simulées, rien n'est envoyé à l'appareil.
    <a href="#" id="go-real">Passer en mode réel</a></div></div>`;
  if (st.error) h += `<div class="error-box">${esc(st.error)}</div>`;
  else if (!S.cfg.demo && d.type === "tado" && st.online === false) h += `<div class="error-box">tado° signale cet appareil <b>hors ligne</b> : ses commandes ne lui parviendront pas. Vérifie son boîtier tado° (alimentation, Wi-Fi) dans l'appli tado°.</div>`;

  const acts = new Set(d.actions);
  const canSwitch = acts.has("toggle");
  if (canSwitch) {
    h += `<div class="power-btn"><div><b>${st.on ? "Allumé" : "Éteint"}</b><div class="muted small">Interrupteur</div></div>${switchHtml(d)}</div>`;
  }

  switch (d.type) {
    case "tapo_plug":
    case "tapo_clim": {
      const today = S.daily.filter((r) => r.device_id === d.id && r.day === localDay(0)).reduce((s, r) => s + r.kwh, 0);
      const kwhToday = st.energy_today_kwh ?? today;
      h += `<div class="d-hero"><div class="sub">Puissance instantanée</div><div class="big">${fmtW(st.power_w || 0)}</div>
        <div class="sub">Aujourd'hui : ${fmtKwh(kwhToday)} · ${fmtEur(costOf(S.daily.filter((r) => r.device_id === d.id && r.day === localDay(0))))}</div>
        <div class="chart" id="mini-chart" style="margin-top:12px"></div></div>`;
      break;
    }
    case "tapo_bulb": {
      const today = st.energy_today_kwh ?? S.daily.filter((r) => r.device_id === d.id && r.day === localDay(0)).reduce((s, r) => s + r.kwh, 0);
      h += `<div class="d-hero"><div class="sub">Luminosité</div><div class="big"><span id="bri-val">${st.brightness ?? 100}</span> %</div>
        <input type="range" min="1" max="100" value="${st.brightness ?? 100}" id="bri" ${st.on ? "" : "disabled"}></div>
        <div class="d-hero"><div class="sub">Consommation <span class="pill">estimée</span></div><div class="big">≈ ${fmtW(st.power_w || 0)}</div>
        <div class="sub">Aujourd'hui : ${fmtKwh(today || 0)} · ${fmtEur(costOf(S.daily.filter((r) => r.device_id === d.id && r.day === localDay(0))))}</div>
        <div class="chart" id="mini-chart" style="margin-top:12px"></div>
        <p class="muted small" style="margin:8px 0 0">L'ampoule n'a pas de wattmètre : puissance estimée d'après sa luminosité, consommation du jour calculée par Tapo.</p></div>`;
      break;
    }
    case "tado": {
      const ac = st.zone_type === "AIR_CONDITIONING";
      const step = ac ? 1 : 0.5;
      const tgt = st.target_temp ?? (ac ? 22 : 20);
      h += `<div class="d-hero tado-hero"><div class="sub">Température de la pièce</div>
        <div class="big">${st.current_temp != null ? nf(st.current_temp, 1) + " °C" : "—"}</div>
        <div class="sub">${st.humidity != null ? `Humidité ${nf(st.humidity)} %` : ""}${st.manual ? " · réglage manuel" : " · suit le planning"}</div></div>`;
      if (st.zone_type !== "HOT_WATER") {
        h += `<div class="thermostat"><button class="icon-btn big-btn" data-temp="${tgt - step}" aria-label="Baisser">${icon("minus")}</button>
          <div><small>Consigne</small><b>${st.on ? nf(tgt, ac ? 0 : 1) + " °C" : "Éteint"}</b></div>
          <button class="icon-btn big-btn" data-temp="${tgt + step}" aria-label="Monter">${icon("plus")}</button></div>`;
      }
      if (ac) {
        const modes = [["COOL", "Froid", "snow"], ["HEAT", "Chaud", "flame"], ["DRY", "Déshum.", "drop"], ["FAN", "Ventil.", "refresh"], ["AUTO", "Auto", "star"]];
        h += `<div class="mode-row">${modes.map(([m, l, ic]) => `<button class="btn ${st.on && st.mode === m ? "primary" : ""}" data-mode="${m}">${icon(ic)}${l}</button>`).join("")}</div>`;
      }
      if (st.manual) h += `<div class="d-actions"><button class="btn full" data-act="resume_schedule">${icon("calendar")}Reprendre le planning</button></div>`;
      break;
    }
    case "verisure":
      h += `<div class="d-hero" style="--c:${st.on ? "var(--on)" : "var(--warn)"}"><div class="sub">État de l'alarme</div>
        <div class="big" style="font-size:28px">${esc(st.summary || "—")}</div></div>
        <input type="password" class="field" id="alarm-code" placeholder="Code" inputmode="numeric" autocomplete="off">
        <div class="d-actions three">
          <button class="btn" data-alarm="arm_home">${icon("home")}Partiel</button>
          <button class="btn primary" data-alarm="arm_away">${icon("lock")}Total</button>
          <button class="btn danger" data-alarm="disarm">${icon("unlock")}Désarmer</button></div>
        <p class="muted small">Le code n'est jamais enregistré.</p>`;
      break;
    case "camera":
      h += `<img class="snapshot" alt="Image de la caméra" ${S.snapUrl[d.id] ? `src="${S.snapUrl[d.id]}"` : ""}>`;
      break;
    case "elegoo":
      h += `<div class="d-hero"><div class="sub">${esc(st.details?.fichier || "Aucune impression")}</div>
        <div class="big">${nf(st.progress || 0)} %</div><div class="bar"><div style="width:${st.progress || 0}%"></div></div></div>
        <div class="d-actions three">
          <button class="btn" data-act="pause">${icon("pause")}Pause</button>
          <button class="btn" data-act="resume">${icon("play")}Reprendre</button>
          <button class="btn danger" data-act="stop" data-confirm="Arrêter l'impression en cours ?">${icon("stop")}Arrêter</button></div>`;
      break;
    case "proxmox":
      if (st.guests) {
        h += `<div class="d-hero"><div class="sub">Machines virtuelles actives</div><div class="big">${esc(st.summary)}</div></div>
          <div class="d-section">VM et conteneurs</div>` + st.guests.map((g) => `
          <div class="guest"><div><span class="dot ${g.status === "running" ? "on" : ""}"></span><b>${esc(g.vmid)}</b> ${esc(g.name)}
            <br><small>${g.kind === "lxc" ? "Conteneur" : "VM"} · ${g.status === "running" ? `CPU ${nf(g.cpu, 1)} %${g.mem_pct != null ? ` · RAM ${g.mem_pct} %` : ""}` : "arrêtée"}</small></div>
            ${g.status === "running"
              ? `<button class="btn" data-vm="vm_shutdown" data-node="${esc(g.node)}" data-vmid="${g.vmid}" data-kind="${g.kind}">${icon("power")}Arrêter</button>`
              : `<button class="btn" data-vm="vm_start" data-node="${esc(g.node)}" data-vmid="${g.vmid}" data-kind="${g.kind}">${icon("play")}Démarrer</button>`}</div>`).join("");
      }
      break;
  }
  if (d.type === "presence") {
    h += `<div class="d-hero" style="--c:var(--on)"><div class="sub">Présence</div><div class="big" style="font-size:28px">${esc(st.summary || "—")}</div></div>`;
    if (S.cfg.demo) h += `<div class="d-actions"><button class="btn" data-act="on">${icon("home")}Simuler l'arrivée</button><button class="btn" data-act="off">${icon("external")}Simuler le départ</button></div>`;
  }
  if (d.type === "tplink_switch") {
    h += st.ports ? switchPortsHtml(d.id, st.ports) : st.hint ? `<div class="srv-hint">${icon("lock")}<div><b>État des ports indisponible</b><p class="muted small">${esc(st.hint)}</p>
      <button class="btn small-btn primary" onclick="openDeviceEditor('${d.id}')">${icon("lock")}Saisir le mot de passe</button></div></div>` : "";
    h += `<div class="d-actions"><button class="btn" onclick="openDeviceEditor('${d.id}')">${icon("cog")}Configuration et identifiants</button></div>`;
  }
  if (d.type === "brother" && st.pages) {
    const pg = st.pages;
    h += `<div class="d-hero"><div class="sub">${esc(st.printer_status || "")}</div>
      <div class="big">${pg.total ?? "—"} <span style="font-size:16px;font-weight:600">pages</span></div>
      <div class="sub">${[pg.bw != null ? `${pg.bw} noir et blanc` : null, pg.color != null ? `${pg.color} couleur` : null, pg.duplex != null ? `${pg.duplex} recto-verso` : null].filter(Boolean).join(" · ")}</div>
      <div class="chart" id="pages-chart" style="margin-top:10px"></div></div>`;
    if (st.inks?.length) {
      h += `<div class="d-section">Toners</div><div class="toners">${st.inks.map((i) => `<div class="toner ${i.pct <= 10 ? "low" : ""}">
        <div class="toner-tube"><div style="height:${Math.max(2, i.pct)}%;background:${i.color}"></div></div>
        <b>${i.pct} %</b><small>${esc(i.label)}</small></div>`).join("")}</div>`;
    }
    if (st.parts?.length) {
      h += `<div class="d-section">Consommables</div>` + st.parts.map((p) => `<div class="vol"><div class="top"><b>${esc(p.label)}</b>
        <span>${p.pct} %${p.pages_left != null ? ` · ~${nf(p.pages_left)} pages restantes` : ""}</span></div>
        <div class="bar"><div style="width:${p.pct}%;background:${p.pct <= 10 ? "var(--err)" : p.pct <= 25 ? "var(--warn)" : "var(--on)"}"></div></div></div>`).join("");
    }
  }
  if (d.type === "hon") {
    const run = st.on;
    h += `<div class="d-hero" style="--c:var(--cyan)"><div class="sub">${esc(st.program || "Programme")}</div>
      <div class="big" style="font-size:28px">${esc(st.mode || st.summary || "—")}</div>
      <div class="sub">${st.remaining_min ? `Reste ${st.remaining_min} min` : ""}</div>
      ${run && st.remaining_min ? `<div class="bar" style="margin-top:8px"><div style="width:${Math.max(3, 100 - st.remaining_min)}%"></div></div>` : ""}</div>`;
    if (!st.remote_ok && st.online) h += `<div class="demo-box">${icon("lock")}<div>Pour démarrer à distance, active la <b>commande à distance</b> sur la machine (linge chargé, porte fermée).</div></div>`;
    h += `<div class="d-actions three">
      ${st.mode === "En pause" ? `<button class="btn primary" data-act="resume">${icon("play")}Reprendre</button>` : `<button class="btn" data-act="pause" ${run ? "" : "disabled"}>${icon("pause")}Pause</button>`}
      <button class="btn danger" data-act="stop" data-confirm="Arrêter le programme en cours ?" ${run ? "" : "disabled"}>${icon("stop")}Arrêter</button>
      <button class="btn ${run ? "" : "primary"}" id="hon-start" ${run ? "disabled" : ""}>${icon("play")}Démarrer</button></div>`;
    if (st.programs?.length && !run) {
      h += `<label class="field-label">Programme à lancer<select class="select" id="hon-prog">${st.programs.map((p) => `<option value="${esc(p.key)}" ${p.key === st.program_key ? "selected" : ""}>${esc(p.label)}</option>`).join("")}</select></label>`;
    }
    const rowsToday = S.daily.filter((r) => r.device_id === d.id && r.day === localDay(0));
    h += `<div class="d-hero"><div class="sub">Consommation <span class="pill">estimée</span></div><div class="big">≈ ${fmtW(st.power_w || 0)}</div>
      <div class="sub">Aujourd'hui : ${fmtKwh(st.energy_today_kwh ?? rowsToday.reduce((a, r) => a + r.kwh, 0))} · ${fmtEur(costOf(rowsToday))}</div>
      <div class="chart" id="mini-chart" style="margin-top:12px"></div>
      <p class="muted small" style="margin:8px 0 0">Puissance moyenne calculée sur 10 min d'après le compteur hOn de la machine (précision 10 Wh).</p></div>`;
  }
  if (d.type === "sfr_box" || d.type === "livebox") {
    if (st.sections) {
      h += `<div class="d-hero" style="--c:${st.internet ? "var(--on)" : "var(--err)"}"><div class="sub">Connexion Internet</div>
        <div class="big" style="font-size:26px;color:${st.internet ? "var(--on)" : "var(--err)"}">${st.internet ? "Connectée" : "Coupée"}</div>
        <div class="sub">${esc([st.wan_ip ? "IP publique " + st.wan_ip : null, st.optical_rx != null ? "signal fibre " + st.optical_rx + " dBm" : null].filter(Boolean).join(" · "))}</div></div>`;
      if (st.hosts?.length) {
        h += `<div class="d-section">Appareils connectés (${st.hosts.length})</div><div class="table-wrap"><table class="data hosts-table"><thead><tr><th>Nom</th><th>IP</th><th>Liaison</th></tr></thead><tbody>
          ${st.hosts.map((x) => `<tr><td>${esc(x.name)}</td><td>${esc(x.ip || "—")}</td><td>${esc(x.link || "—")}</td></tr>`).join("")}</tbody></table></div>`;
      }
      for (const sec of st.sections) {
        if (!sec.rows.length) continue;
        h += `<details class="box-sec"><summary>${esc(sec.title)}</summary><table class="kv">${sec.rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join("")}</table></details>`;
      }
    } else if (st.hint) {
      h += `<div class="srv-hint">${icon("lock")}<div><b>Détails indisponibles</b><p class="muted small">${esc(st.hint)}</p>
        <button class="btn small-btn primary" onclick="openDeviceEditor('${d.id}')">${icon("lock")}Saisir le mot de passe</button></div></div>`;
    }
    h += `<div class="d-actions"><button class="btn" onclick="openDeviceEditor('${d.id}')">${icon("cog")}Configuration et identifiants</button></div>`;
  }
  const isServer = ["qnap", "terramaster", "proxmox", "linux"].includes(d.type);
  if (isServer) {
    h += `<div class="drawer-server">${serverBody(d, "dchart").replace(/<div class="error-box">.*?<\/div>/, "")}</div>
      <div class="d-actions"><button class="btn" onclick="openDeviceEditor('${d.id}')">${icon("cog")}Configuration et identifiants</button></div>`;
  }
  if (acts.has("wake")) {
    h += `<div class="d-actions"><button class="btn ${st.on ? "" : "primary"} full" data-act="wake">${icon("power")}Allumer (Wake on LAN)</button></div>`;
  }
  h += kvTable(st.details);
  h += `<div class="d-section">Historique</div><div class="log-list compact" id="drawer-log">${S.drawerLog ? logRows(S.drawerLog) : '<p class="muted small">Chargement…</p>'}</div>`;
  h += `<div class="updated"><span>${st.updated ? "Mis à jour à " + new Date(st.updated * 1000).toLocaleTimeString("fr-FR") : ""}</span>
    <button class="btn ghost" id="refresh-btn">${icon("refresh")}Actualiser</button></div>`;
  body.innerHTML = h;

  bindRows(body);
  $$("[data-act]", body).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.confirm && !confirm(b.dataset.confirm)) return;
    doAction(d.id, b.dataset.act, {}, b);
  }));
  $("#hon-start")?.addEventListener("click", (e) => {
    const program = $("#hon-prog")?.value;
    const label = $("#hon-prog")?.selectedOptions?.[0]?.textContent;
    if (!confirm(`Démarrer ${label ? "« " + label + " »" : "le programme"} sur ${d.name} ?`)) return;
    doAction(d.id, "start", program ? { program } : {}, e.currentTarget);
  });
  $$("[data-temp]", body).forEach((b) => b.addEventListener("click", () => doAction(d.id, "set_temperature", { value: +b.dataset.temp }, b)));
  $$("[data-mode]", body).forEach((b) => b.addEventListener("click", () => doAction(d.id, "set_mode", { value: b.dataset.mode }, b)));
  $$("[data-alarm]", body).forEach((b) => b.addEventListener("click", () => {
    const code = $("#alarm-code").value;
    if (!code) return toast("Saisis le code de l'alarme", true);
    $("#alarm-code").value = "";
    $("#alarm-code").blur();
    doAction(d.id, b.dataset.alarm, { code }, b);
  }));
  $$("[data-vm]", body).forEach((b) => b.addEventListener("click", () => {
    if (b.dataset.vm !== "vm_start" && !confirm(`Arrêter la machine ${b.dataset.vmid} ?`)) return;
    doAction(d.id, b.dataset.vm, { node: b.dataset.node, vmid: b.dataset.vmid, kind: b.dataset.kind }, b);
  }));
  const bri = $("#bri");
  if (bri) {
    bri.addEventListener("input", () => ($("#bri-val").textContent = bri.value));
    bri.addEventListener("change", () => { bri.blur(); doAction(d.id, "brightness", { value: +bri.value }); });
  }
  $("#refresh-btn").addEventListener("click", async (e) => {
    const b = e.currentTarget;
    b.disabled = true;
    try { S.state[d.id] = await api(`/api/devices/${d.id}/refresh`, { method: "POST" }); renderAll(); }
    catch (err) { toast(err.message, true); b.disabled = false; }
  });
  $("#go-real")?.addEventListener("click", (e) => { e.preventDefault(); goReal(); });
  if (isServer) loadServerChart(d, `dchart-${d.id}`);
  if (d.type === "brother") loadPagesChart(d.id);
  const mini = $("#mini-chart");
  if (mini && S.drawerHist) lineChart(mini, [{ id: d.id, name: d.name, color: m.color, points: S.drawerHist }], 380, 130, true);
}

// ------------------------------------------------------------------ tarif HP / HC
const TF = () => S.cfg.tariff || { mode: "base", price_base: S.cfg.price_per_kwh, hc_ranges: [] };
const isHPHC = () => TF().mode === "hphc";
const hmMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

function isHC(date) {
  if (!isHPHC()) return false;
  const cur = date.getHours() * 60 + date.getMinutes();
  return TF().hc_ranges.some(([a, b]) => { a = hmMin(a); b = hmMin(b); return a < b ? cur >= a && cur < b : cur >= a || cur < b; });
}

function tariffNow() {
  if (!isHPHC()) return null;
  const now = new Date(), hc = isHC(now), p = new Date(now);
  p.setSeconds(0, 0);
  for (let i = 0; i < 1441; i++) { p.setMinutes(p.getMinutes() + 1); if (isHC(p) !== hc) break; }
  return { hc, until: p.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" }) };
}

// Coût d'un ensemble de lignes journalières (kwh, kwh_hp, kwh_hc)
function costOf(rows) {
  const t = TF();
  if (t.mode !== "hphc") return rows.reduce((s, r) => s + r.kwh, 0) * t.price_base;
  return rows.reduce((s, r) => s + (r.kwh_hp ?? r.kwh) * t.price_hp + (r.kwh_hc || 0) * t.price_hc, 0);
}

// Bandes grisées des heures creuses entre deux instants (pour les courbes)
function hcBands(t0, t1) {
  if (!isHPHC() || t1 - t0 > 40 * 86400) return [];
  const bands = [];
  let start = null;
  const step = 300;
  for (let t = t0; t <= t1; t += step) {
    const hc = isHC(new Date(t * 1000));
    if (hc && start === null) start = t;
    if (!hc && start !== null) { bands.push([start, t]); start = null; }
  }
  if (start !== null) bands.push([start, t1]);
  return bands;
}

// ------------------------------------------------------------------ énergie
async function loadEnergy() {
  let hist;
  try {
    [hist, S.daily] = await Promise.all([api(`/api/power/history?range=${S.range}`), api(`/api/power/daily?days=30`)]);
  } catch (e) { return toast(e.message, true); }
  const ps = plugs();
  const sum = (pred) => S.daily.filter(pred).reduce((s, r) => s + r.kwh, 0);
  const cost = (pred) => costOf(S.daily.filter(pred));
  const now = ps.reduce((s, d) => s + (S.state[d.id]?.power_w || 0), 0);
  const today = sum((r) => r.day === localDay(0));
  const week = sum((r) => r.day >= localDay(6));
  const month = sum(() => true);
  $("#energy-kpis").innerHTML = [
    ["Maintenant", fmtW(now), `${ps.filter((d) => (S.state[d.id]?.power_w || 0) > 5).length} prise(s) active(s)`],
    ["Aujourd'hui", fmtKwh(today), fmtEur(cost((r) => r.day === localDay(0)))],
    ["7 derniers jours", fmtKwh(week), fmtEur(cost((r) => r.day >= localDay(6)))],
    ["30 derniers jours", fmtKwh(month), `${fmtEur(cost(() => true))} · ~${fmtEur((cost(() => true) / 30) * 365)}/an`],
  ].map(([l, v, s]) => `<div class="stat"><small>${l}</small><b>${v}</b><span>${s}</span></div>`).join("");

  const legend = $("#legend");
  legend.innerHTML = "";
  for (const p of ps) {
    const b = document.createElement("button");
    b.innerHTML = `<span class="sw" style="background:${seriesColor(p.id)}"></span>${esc(p.name)}`;
    b.classList.toggle("off", S.hidden.has(p.id));
    b.addEventListener("click", () => { S.hidden.has(p.id) ? S.hidden.delete(p.id) : S.hidden.add(p.id); loadEnergy(); });
    legend.appendChild(b);
  }
  const visible = ps.filter((p) => !S.hidden.has(p.id));
  lineChart($("#power-chart"), visible.map((p) => ({ id: p.id, name: p.name, color: seriesColor(p.id), points: hist[p.id] || [] })), 1100, 320);
  dailyChart($("#daily-chart"), visible);
  hphcCard(visible);
  shareBars(ps, month);
  energyTable(ps);
}

function niceMax(v) {
  if (v <= 0) return 1;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  return [1, 2, 2.5, 5, 10].map((m) => m * p).find((m) => m >= v);
}

function showTip(e, text) {
  const t = $("#tooltip");
  t.textContent = text;
  t.hidden = false;
  const x = e.clientX + 16 + t.offsetWidth > innerWidth ? e.clientX - t.offsetWidth - 12 : e.clientX + 16;
  t.style.left = Math.max(8, x) + "px";
  t.style.top = Math.min(e.clientY + 16, innerHeight - t.offsetHeight - 8) + "px";
}
const hideTip = () => ($("#tooltip").hidden = true);

function lineChart(box, series, W, H, compact = false, fmt = fmtW) {
  box.innerHTML = "";
  const pad = { l: compact ? 44 : 56, r: 8, t: 10, b: 26 };
  const all = series.flatMap((s) => s.points);
  if (!all.length) { box.innerHTML = `<p class="muted small">Pas encore de mesures — l'archive se remplit chaque minute.</p>`; return; }
  const t0 = Math.min(...all.map((p) => p.t)), t1 = Math.max(...all.map((p) => p.t));
  const span = Math.max(1, t1 - t0);
  const ymax = niceMax(Math.max(...all.map((p) => p.w)) * 1.08);
  const x = (t) => pad.l + ((t - t0) / span) * (W - pad.l - pad.r);
  const y = (w) => H - pad.b - (w / ymax) * (H - pad.t - pad.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` }, box);
  const defs = svgEl("defs", {}, svg);
  if (fmt === fmtW) {
    for (const [a, b] of hcBands(t0, t1)) {
      svgEl("rect", { x: x(a), y: pad.t, width: Math.max(1, x(b) - x(a)), height: H - pad.t - pad.b, class: "hc-band" }, svg);
    }
  }
  const axis = svgEl("g", { class: "axis" }, svg);
  const yTicks = compact ? 2 : 4;
  for (let i = 0; i <= yTicks; i++) {
    const v = (ymax / yTicks) * i;
    svgEl("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: "grid-line" }, axis);
    svgEl("text", { x: pad.l - 8, y: y(v) + 4, "text-anchor": "end" }, axis).textContent = fmt(v);
  }
  const xTicks = compact ? 3 : 6;
  for (let i = 0; i <= xTicks; i++) {
    const t = t0 + (span * i) / xTicks;
    const dt = new Date(t * 1000);
    const lbl = span > 2 * 86400 ? dt.toLocaleDateString("fr-FR", { day: "2-digit", month: "short" })
      : dt.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });
    svgEl("text", { x: x(t), y: H - 6, "text-anchor": i === 0 ? "start" : i === xTicks ? "end" : "middle" }, axis).textContent = lbl;
  }
  series.forEach((s, i) => {
    if (!s.points.length) return;
    const gid = `grad-${box.id}-${i}`;
    const grad = svgEl("linearGradient", { id: gid, x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    svgEl("stop", { offset: "0%", "stop-color": s.color, "stop-opacity": series.length > 2 ? 0.12 : 0.3 }, grad);
    svgEl("stop", { offset: "100%", "stop-color": s.color, "stop-opacity": 0 }, grad);
    const d = s.points.map((p, j) => `${j ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.w).toFixed(1)}`).join("");
    svgEl("path", { d: `${d}L${x(s.points.at(-1).t)},${y(0)}L${x(s.points[0].t)},${y(0)}Z`, fill: `url(#${gid})`, stroke: "none" }, svg);
    svgEl("path", { d, fill: "none", stroke: s.color, "stroke-width": compact ? 2 : 1.8, "stroke-linejoin": "round" }, svg);
  });
  const cursor = svgEl("line", { y1: pad.t, y2: H - pad.b, stroke: "var(--muted)", opacity: 0, "stroke-dasharray": "3 3" }, svg);
  const dots = series.map((s) => svgEl("circle", { r: 4, fill: s.color, stroke: "var(--surface)", "stroke-width": 2, opacity: 0 }, svg));
  const hit = svgEl("rect", { x: pad.l, y: pad.t, width: W - pad.l - pad.r, height: H - pad.t - pad.b, fill: "transparent", stroke: "none" }, svg);
  hit.addEventListener("pointermove", (e) => {
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(svg.getScreenCTM().inverse());
    const t = t0 + ((pt.x - pad.l) / (W - pad.l - pad.r)) * span;
    cursor.setAttribute("x1", pt.x); cursor.setAttribute("x2", pt.x); cursor.setAttribute("opacity", 0.6);
    const lines = [new Date(t * 1000).toLocaleString("fr-FR", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })
      + (fmt === fmtW && isHPHC() ? (isHC(new Date(t * 1000)) ? "  · heures creuses" : "  · heures pleines") : "")];
    series.forEach((s, i) => {
      if (!s.points.length) return;
      const p = s.points.reduce((a, b) => (Math.abs(b.t - t) < Math.abs(a.t - t) ? b : a));
      dots[i].setAttribute("cx", x(p.t)); dots[i].setAttribute("cy", y(p.w)); dots[i].setAttribute("opacity", 1);
      lines.push(`● ${s.name} : ${fmt(p.w)}${p.max > p.w * 1.2 ? `  (pic ${fmt(p.max)})` : ""}`);
    });
    showTip(e, lines.join("\n"));
  });
  hit.addEventListener("pointerleave", () => { cursor.setAttribute("opacity", 0); dots.forEach((d) => d.setAttribute("opacity", 0)); hideTip(); });
}

function dailyChart(box, ps) {
  box.innerHTML = "";
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(localDay(i));
  const by = {};
  for (const r of S.daily) (by[r.day] ||= {})[r.device_id] = r.kwh;
  const totals = days.map((d) => ps.reduce((s, p) => s + (by[d]?.[p.id] || 0), 0));
  if (!totals.some((v) => v > 0)) { box.innerHTML = `<p class="muted small">Pas encore de données journalières.</p>`; return; }
  const W = 700, H = 260, pad = { l: 40, r: 4, t: 10, b: 26 };
  const ymax = niceMax(Math.max(...totals) * 1.08);
  const bw = (W - pad.l - pad.r) / days.length;
  const y = (v) => H - pad.b - (v / ymax) * (H - pad.t - pad.b);
  const svg = svgEl("svg", { viewBox: `0 0 ${W} ${H}` }, box);
  const axis = svgEl("g", { class: "axis" }, svg);
  for (let i = 0; i <= 4; i++) {
    const v = (ymax / 4) * i;
    svgEl("line", { x1: pad.l, x2: W - pad.r, y1: y(v), y2: y(v), class: "grid-line" }, axis);
    svgEl("text", { x: pad.l - 8, y: y(v) + 4, "text-anchor": "end" }, axis).textContent = nf(v, v < 10 && v % 1 ? 1 : 0);
  }
  days.forEach((day, i) => {
    let acc = 0;
    const gx = pad.l + i * bw;
    const g = svgEl("g", {}, svg);
    ps.forEach((p) => {
      const v = by[day]?.[p.id] || 0;
      if (!v) return;
      svgEl("rect", { x: gx + bw * 0.18, y: y(acc + v), width: bw * 0.64, height: Math.max(0.5, y(acc) - y(acc + v) - 1), rx: 2, fill: seriesColor(p.id), stroke: "none" }, g);
      acc += v;
    });
    if (i % 5 === 4 || i === days.length - 1) {
      svgEl("text", { x: gx + bw / 2, y: H - 6, "text-anchor": "middle" }, axis).textContent = `${day.slice(8)}/${day.slice(5, 7)}`;
    }
    const hit = svgEl("rect", { x: gx, y: pad.t, width: bw, height: H - pad.t - pad.b, fill: "transparent", stroke: "none" }, svg);
    hit.addEventListener("pointermove", (e) => {
      g.setAttribute("opacity", 0.8);
      const lines = [new Date(day + "T12:00").toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })];
      for (const p of ps) if (by[day]?.[p.id]) lines.push(`● ${p.name} : ${fmtKwh(by[day][p.id])}`);
      const dayRows = S.daily.filter((r) => r.day === day && ps.some((p) => p.id === r.device_id));
      const hcK = dayRows.reduce((s, r) => s + (r.kwh_hc || 0), 0);
      lines.push(`Total : ${fmtKwh(totals[i])} · ${fmtEur(costOf(dayRows))}` + (isHPHC() && totals[i] ? `  (${nf((100 * hcK) / totals[i])} % en heures creuses)` : ""));
      showTip(e, lines.join("\n"));
    });
    hit.addEventListener("pointerleave", () => { g.removeAttribute("opacity"); hideTip(); });
  });
}

function shareBars(ps, month) {
  const rows = ps.map((p) => ({ p, kwh: S.daily.filter((r) => r.device_id === p.id).reduce((s, r) => s + r.kwh, 0) }))
    .sort((a, b) => b.kwh - a.kwh);
  $("#share").innerHTML = rows.map(({ p, kwh }) => {
    const pct = month ? (100 * kwh) / month : 0;
    return `<div class="share-row" style="--c:${seriesColor(p.id)}"><div class="top"><b>${esc(p.name)}${S.state[p.id]?.power_estimated ? " (estimé)" : ""}</b>
      <span>${fmtKwh(kwh)} · ${nf(pct)} %</span></div><div class="bar"><div style="width:${pct}%"></div></div></div>`;
  }).join("") || `<p class="muted small">Aucune donnée.</p>`;
}

function energyTable(ps) {
  const hphc = isHPHC(), t = TF();
  const sel = (id, pred) => S.daily.filter((r) => r.device_id === id && pred(r));
  const sum = (rows, k = "kwh") => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const rows = ps.map((p) => {
    const m = sel(p.id, () => true);
    return { p, now: S.state[p.id]?.power_w || 0, t: sum(sel(p.id, (r) => r.day === localDay(0))), w: sum(sel(p.id, (r) => r.day >= localDay(6))),
      m: sum(m), mhc: sum(m, "kwh_hc"), cost: costOf(m), peak: Math.max(0, ...m.map((r) => r.max_w || 0)) };
  });
  const tot = rows.reduce((a, r) => ({ now: a.now + r.now, t: a.t + r.t, w: a.w + r.w, m: a.m + r.m, mhc: a.mhc + r.mhc, cost: a.cost + r.cost }),
    { now: 0, t: 0, w: 0, m: 0, mhc: 0, cost: 0 });
  const hcCell = (r) => (hphc ? `<td>${fmtKwh(r.mhc)} <span class="muted small">${r.m ? nf((100 * r.mhc) / r.m) : 0} %</span></td>` : "");
  $("#energy-table").innerHTML = `<table class="data"><thead><tr><th>Prise</th><th>Maintenant</th><th>Aujourd'hui</th>
    <th>7 jours</th><th>30 jours</th>${hphc ? "<th>dont heures creuses</th>" : ""}<th>Coût 30 j</th><th>Pic</th></tr></thead><tbody>
    ${rows.map((r) => `<tr><td><span class="dot" style="background:${seriesColor(r.p.id)}"></span>${esc(r.p.name)}${S.state[r.p.id]?.power_estimated ? ' <span class="pill">estimé</span>' : ""}</td>
      <td>${fmtW(r.now)}</td><td>${fmtKwh(r.t)}</td><td>${fmtKwh(r.w)}</td><td>${fmtKwh(r.m)}</td>${hcCell(r)}
      <td>${fmtEur(r.cost)}</td><td>${fmtW(r.peak)}</td></tr>`).join("")}
    <tr class="total"><td>Total</td><td>${fmtW(tot.now)}</td><td>${fmtKwh(tot.t)}</td><td>${fmtKwh(tot.w)}</td>
      <td>${fmtKwh(tot.m)}</td>${hcCell(tot)}<td>${fmtEur(tot.cost)}</td><td></td></tr></tbody></table>
    <p class="muted small" style="margin-top:12px">${hphc
      ? `Heures pleines : ${nf(t.price_hp, 4)} €/kWh · heures creuses : ${nf(t.price_hc, 4)} €/kWh (${t.hc_ranges.map((r) => r.join("–")).join(" et ")})`
      : `Prix : ${nf(t.price_base, 4)} €/kWh`} — modifiable dans Paramètres → Tarif électricité · Totaux journaliers conservés indéfiniment · Export détaillé via le bouton CSV.</p>`;
}

// Carte « Heures pleines / heures creuses » (30 jours)
function hphcCard(ps) {
  const card = $("#hphc-card");
  if (!card) return;
  card.hidden = !isHPHC();
  if (!isHPHC()) return;
  const t = TF();
  const rows = S.daily.filter((r) => ps.some((p) => p.id === r.device_id));
  const hp = rows.reduce((s, r) => s + (r.kwh_hp ?? r.kwh), 0), hc = rows.reduce((s, r) => s + (r.kwh_hc || 0), 0);
  const total = hp + hc, pct = total ? (100 * hc) / total : 0;
  const days = [];
  for (let i = 29; i >= 0; i--) days.push(localDay(i));
  const per = days.map((d) => { const r = rows.filter((x) => x.day === d); return [r.reduce((s, x) => s + (x.kwh_hp ?? x.kwh), 0), r.reduce((s, x) => s + (x.kwh_hc || 0), 0)]; });
  const max = niceMax(Math.max(0.001, ...per.map(([a, b]) => a + b)) * 1.08);
  const W = 700, H = 150, bw = W / days.length;
  const bars = per.map(([a, b], i) => {
    const ha = (a / max) * (H - 18), hb = (b / max) * (H - 18), x0 = i * bw + bw * 0.18;
    return `<rect x="${x0}" y="${H - 14 - ha - hb}" width="${bw * 0.64}" height="${Math.max(0, hb)}" class="bar-hc"><title>${days[i]} — HC ${fmtKwh(b)}</title></rect>
      <rect x="${x0}" y="${H - 14 - ha}" width="${bw * 0.64}" height="${Math.max(0, ha)}" class="bar-hp"><title>${days[i]} — HP ${fmtKwh(a)}</title></rect>`;
  }).join("");
  card.innerHTML = `<div class="card-head"><h2>Heures pleines / heures creuses</h2><span class="muted small">30 jours</span></div>
    <div class="hphc-stats">
      <div><small><i class="sw-hp"></i>Heures pleines</small><b>${fmtKwh(hp)}</b><span>${fmtEur(hp * t.price_hp)} · ${nf(t.price_hp, 4)} €/kWh</span></div>
      <div><small><i class="sw-hc"></i>Heures creuses</small><b>${fmtKwh(hc)}</b><span>${fmtEur(hc * t.price_hc)} · ${nf(t.price_hc, 4)} €/kWh</span></div>
      <div><small>Part en heures creuses</small><b>${nf(pct)} %</b><span>économie vs tout en HP : ${fmtEur(hc * (t.price_hp - t.price_hc))}</span></div>
    </div>
    <div class="bar hphc-bar"><div style="width:${pct}%"></div></div>
    <svg viewBox="0 0 ${W} ${H}" class="hphc-chart">${bars}</svg>
    <p class="muted small">Heures creuses : ${t.hc_ranges.map((r) => r.join("–")).join(" et ")}. Astuce : lance lave-linge, chauffe-eau ou recharges en heures creuses (automatisation « début des heures creuses »).</p>`;
}

async function goReal() {
  if (!confirm("Passer en mode réel ? Les commandes seront envoyées à tes vrais appareils.")) return;
  try {
    await api("/api/system/mode", { method: "PUT", body: JSON.stringify({ demo: false }) });
    await reloadConfig();
    $("#demo-badge").hidden = !S.cfg.demo;
    toast("Mode réel activé");
    if (S.selected) renderDrawer();
  } catch (e) { toast(e.message, true); }
}

// ------------------------------------------------------------------ ports d'un switch (fiche)
const portClass = (p) => (!p.enabled ? "p-dis" : !p.up ? "" : p.speed === 1000 ? "p-on" : "p-off");

function rackPortLabels(devId) {
  const it = (S.rackItems || []).find((x) => x.device === devId && x.port_map);
  return it?.port_map || {};
}

function switchPortsHtml(devId, ports) {
  const labels = rackPortLabels(devId);
  const half = Math.ceil(ports.length / 2);
  return `<div class="d-section">Ports</div>
    <div class="port-grid live" style="--cols:${half}">${ports.map((p) => `<span class="port ${portClass(p)}" title="Port ${p.port} — ${esc(p.link)}${labels[p.port]?.label ? " — " + esc(labels[p.port].label) : ""}">${p.port}</span>`).join("")}</div>
    <div class="port-legend"><span><i class="port p-on"></i>1 Gbit/s</span><span><i class="port p-off"></i>10/100 Mbit/s</span><span><i class="port"></i>Libre</span><span><i class="port p-dis"></i>Désactivé</span></div>
    <div class="table-wrap"><table class="data ports-table"><thead><tr><th>Port</th><th>Branché sur</th><th>Liaison</th><th>Activité</th><th>Erreurs</th></tr></thead><tbody>
    ${ports.map((p) => `<tr class="${p.up ? "" : "muted-row"}"><td><b>${p.port}</b></td><td>${esc(labels[p.port]?.label || (labels[p.port]?.device && device(labels[p.port].device)?.name) || "—")}</td>
      <td>${p.up ? `<span class="pill ${p.speed === 1000 ? "on" : "warn"}">${esc(p.link)}</span>` : `<span class="muted small">${p.enabled ? "déconnecté" : "désactivé"}</span>`}</td>
      <td>${p.pps != null && p.up ? `${nf(p.pps)} paq/s` : "—"}</td><td>${p.tx_err + p.rx_err ? `<span style="color:var(--err)">${p.tx_err + p.rx_err}</span>` : "0"}</td></tr>`).join("")}
    </tbody></table></div>`;
}

// Pages imprimées par jour (différence des compteurs journaliers)
async function loadPagesChart(id) {
  const box = $("#pages-chart");
  if (!box) return;
  let rows;
  try { rows = await api(`/api/counters?device=${id}&days=31`); } catch { return; }
  const perDay = rows.slice(1).map((r, i) => ({ day: r.day, n: Math.max(0, r.value - rows[i].value) }));
  if (!perDay.length) { box.innerHTML = `<p class="muted small">Pages par jour : l'historique se constitue (un relevé par jour).</p>`; return; }
  const max = Math.max(1, ...perDay.map((p) => p.n)), W = 360, H = 70, bw = W / perDay.length;
  box.innerHTML = `<small class="muted">Pages imprimées par jour</small><svg viewBox="0 0 ${W} ${H}">${perDay.map((p, i) =>
    `<rect x="${i * bw + bw * 0.15}" y="${H - (p.n / max) * (H - 4)}" width="${bw * 0.7}" height="${Math.max(1, (p.n / max) * (H - 4))}" rx="2" fill="var(--accent)"><title>${p.day} : ${p.n} page(s)</title></rect>`).join("")}</svg>`;
}

// ------------------------------------------------------------------ fenêtre modale
function openModal(title, body, buttons = []) {
  $("#modal-title").textContent = title;
  $("#modal-body").innerHTML = body;
  const foot = $("#modal-foot");
  foot.innerHTML = "";
  for (const b of buttons) {
    const el = document.createElement("button");
    el.className = "btn " + (b.cls || "");
    el.innerHTML = (b.icon ? icon(b.icon) : "") + esc(b.label);
    el.addEventListener("click", () => b.onClick(el));
    foot.appendChild(el);
  }
  $("#modal").hidden = false;
  document.body.classList.add("no-scroll");
}

function closeModal() {
  $("#modal").hidden = true;
  $(".modal-box").classList.remove("wide");
  if (typeof RACK !== "undefined") RACK.name = null;
  document.body.classList.remove("no-scroll");
}

// ------------------------------------------------------------------ notifications
S.notifSeen = 0;
async function refreshNotifications(first = false) {
  let n;
  try { n = await api("/api/notifications"); } catch { return; }
  const badge = $("#bell-badge");
  badge.hidden = !n.unread;
  badge.textContent = n.unread > 9 ? "9+" : n.unread;
  const newest = n.items[0]?.id || 0;
  if (!first && newest > S.notifSeen && n.items[0] && !n.items[0].read) toast(`🔔 ${n.items[0].title}`);
  S.notifSeen = Math.max(S.notifSeen, newest);
  S.notifs = n.items;
  if (!$("#notif-panel").hidden) renderNotifs();
}

function renderNotifs() {
  const items = S.notifs || [];
  $("#notif-list").innerHTML = items.length ? items.slice(0, 20).map((x) => `
    <div class="notif ${x.read ? "" : "unread"}"><span class="notif-dot"></span><div>
      <b>${esc(x.title)}</b>${x.message ? `<p>${esc(x.message)}</p>` : ""}<small>${timeAgo(x.ts)}</small></div></div>`).join("")
    : `<p class="muted small empty">Aucune notification.</p>`;
}

function toggleNotifPanel() {
  const p = $("#notif-panel");
  p.hidden = !p.hidden;
  if (!p.hidden) renderNotifs();
}

async function markNotifRead() {
  await api("/api/notifications/read", { method: "POST" });
  refreshNotifications();
}

function timeAgo(ts) {
  const s = Date.now() / 1000 - ts;
  if (s < 60) return "à l'instant";
  if (s < 3600) return `il y a ${Math.floor(s / 60)} min`;
  if (s < 86400) return `il y a ${Math.floor(s / 3600)} h`;
  return new Date(ts * 1000).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

// ------------------------------------------------------------------ météo
const WEATHER = (code, day = true) => {
  if (code === 0) return ["Ensoleillé", day ? "sun" : "moon"];
  if (code <= 2) return ["Éclaircies", "partly"];
  if (code === 3) return ["Couvert", "cloud"];
  if (code <= 48) return ["Brouillard", "fog"];
  if (code <= 67 || (code >= 80 && code <= 82)) return ["Pluie", "rain"];
  if (code <= 77 || code === 85 || code === 86) return ["Neige", "snow"];
  return ["Orage", "storm"];
};

async function loadWeather() {
  const card = $("#weather-card");
  let w, sun;
  try { [w, sun] = await Promise.all([api("/api/weather"), api("/api/sun")]); }
  catch { card.innerHTML = `<p class="muted small">Météo indisponible pour le moment.</p>`; return; }
  if (!w.configured) {
    card.innerHTML = `<div class="weather-empty">${icon("partly")}<div><b>Météo</b><p class="muted small">Indique ta ville dans Paramètres pour la météo et les automatisations au lever/coucher du soleil.</p>
      <button class="btn small-btn" onclick="showView('settings')">Choisir ma ville</button></div></div>`;
    return;
  }
  const c = w.current;
  const [label, ic] = WEATHER(c.weather_code, c.is_day);
  const days = w.daily.time.slice(1, 5).map((t, i) => {
    const [, dic] = WEATHER(w.daily.weather_code[i + 1]);
    return `<div class="wday"><small>${new Date(t + "T12:00").toLocaleDateString("fr-FR", { weekday: "short" })}</small>${icon(dic)}
      <b>${Math.round(w.daily.temperature_2m_max[i + 1])}°</b><span>${Math.round(w.daily.temperature_2m_min[i + 1])}°</span></div>`;
  }).join("");
  card.innerHTML = `<div class="weather-now"><div class="w-ico">${icon(ic)}</div>
      <div><div class="w-temp">${Math.round(c.temperature_2m)}°</div><div class="muted small">${label} · ressenti ${Math.round(c.apparent_temperature)}°</div></div>
      <div class="w-meta"><b>${esc(w.city || "")}</b><span>${icon("sunrise")}${sun.sunrise || "—"}</span><span>${icon("sunset")}${sun.sunset || "—"}</span></div></div>
    <div class="w-days">${days}</div>`;
}

// ------------------------------------------------------------------ scènes (barre du tableau de bord)
const SCENE_ICONS = ["star", "tv", "moon", "sun", "power", "home", "monitor", "bulb", "snow", "lock", "bolt", "person"];

async function loadAutomationData() {
  try {
    const [a, sc] = await Promise.all([api("/api/automations"), api("/api/scenes")]);
    S.automations = a.automations;
    S.lastRun = a.last_run;
    S.scenes = sc;
  } catch (e) { toast(e.message, true); }
}

function renderSceneBar() {
  const bar = $("#scene-bar");
  const scenes = S.scenes || [];
  bar.innerHTML = scenes.map((sc) => `<button class="scene-chip" data-scene="${esc(sc.id)}">${icon(sc.icon || "star")}<span>${esc(sc.name)}</span></button>`).join("")
    + `<button class="scene-chip add" onclick="showView('scenes')" title="Gérer les scènes">${icon("plus")}</button>`;
  $$("[data-scene]", bar).forEach((b) => b.addEventListener("click", () => runScene(b.dataset.scene, b)));
}

async function runScene(id, btn) {
  const sc = S.scenes.find((x) => x.id === id);
  if (btn) { btn.classList.add("running"); setTimeout(() => btn.classList.remove("running"), 1500); }
  try {
    await api(`/api/scenes/${id}/run`, { method: "POST" });
    toast(`Scène « ${sc?.name || id} » lancée`);
    setTimeout(refreshState, 1500);
  } catch (e) { toast(e.message, true); }
}

window.addEventListener("DOMContentLoaded", () => init().catch((e) => {
  document.querySelector(".content").insertAdjacentHTML("afterbegin", `<div class="error-box">Erreur de démarrage : ${esc(e.message)}</div>`);
}));
