"use strict";
// Baie de brassage : vue de face d'un rack 19", équipements reliés aux appareils de la maison

const UH = 30; // hauteur d'un U à l'écran (px)
const RACK_TYPES = {
  patch:    { label: "Panneau de brassage", h: 1, ports: 24 },
  switch:   { label: "Switch", h: 1, ports: 24 },
  router:   { label: "Box / routeur", h: 1 },
  firewall: { label: "Pare-feu", h: 1 },
  server:   { label: "Serveur", h: 2 },
  nas:      { label: "NAS", h: 2 },
  ups:      { label: "Onduleur", h: 2 },
  pdu:      { label: "Multiprise / PDU", h: 1 },
  shelf:    { label: "Étagère", h: 1 },
  cable:    { label: "Passe-câbles", h: 1 },
  blank:    { label: "Obturateur", h: 1 },
  other:    { label: "Autre", h: 1 },
};
const RACK_SIZES = [6, 9, 12, 15, 18, 22, 27, 32, 42];
// Modèles courants : choisir un modèle préremplit type, hauteur et nombre de ports
const RACK_MODELS = {
  "TL-SG1016DE": { brand: "TP-Link", type: "switch", h: 1, ports: 16, desc: "Switch 16 ports Gigabit Easy Smart (VLAN, QoS, IGMP)" },
  "TL-SG1016D": { brand: "TP-Link", type: "switch", h: 1, ports: 16, desc: "Switch 16 ports Gigabit non administrable" },
  "TL-SG1024DE": { brand: "TP-Link", type: "switch", h: 1, ports: 24, desc: "Switch 24 ports Gigabit Easy Smart" },
  "TL-SG2016P": { brand: "TP-Link", type: "switch", h: 1, ports: 16, desc: "Switch 16 ports Gigabit Smart, 8 PoE+" },
  "Livebox": { brand: "Orange", type: "router", h: 1, half: true, accent: "#ff7900", desc: "Box internet Orange" },
  "Box SFR": { brand: "SFR", type: "router", h: 1, half: true, accent: "#e2001a", desc: "Box internet SFR" },
  "Freebox": { brand: "Free", type: "router", h: 1, half: true, accent: "#cd1e25", desc: "Box internet Free" },
  "Bbox": { brand: "Bouygues", type: "router", h: 1, half: true, accent: "#009dcc", desc: "Box internet Bouygues Telecom" },
  "Panneau 24 ports Cat6": { brand: "", type: "patch", h: 1, ports: 24, desc: "Panneau de brassage RJ45" },
  "Panneau 12 ports Cat6": { brand: "", type: "patch", h: 1, ports: 12, desc: "Panneau de brassage RJ45" },
};
let PORT_SEL = null; // port en cours d'édition dans le formulaire
const RACK = { name: null, units: 12, items: [], sel: null, form: null };

async function openRack(name) {
  let data;
  try { data = await api("/api/rack"); } catch (e) { return toast(e.message, true); }
  const r = data.racks[name] || { units: 12, items: [] };
  Object.assign(RACK, { name, units: r.units, items: r.items, sel: null, form: null });
  openModal(name, "", [{ label: "Fermer", cls: "ghost", onClick: closeModal }]);
  $(".modal-box").classList.add("wide");
  renderRack();
}

// ------------------------------------------------------------------ dessin
function ledClass(it) {
  if (!it.device) return "led-off";
  const c = stateOf(it.device);
  return c === "on" ? "led-on" : c === "err" ? "led-err" : c === "unknown" ? "led-off" : "led-idle";
}

function face(it) {
  const led = `<span class="r-led ${ledClass(it)}"></span>`;
  const label = `<span class="r-label">${esc(it.name || RACK_TYPES[it.type].label)}</span>`;
  const ports = (n, cls = "") => `<span class="r-ports ${cls}">${Array.from({ length: Math.min(n, 48) }, (_, i) => {
    const p = (it.port_map || {})[String(i + 1)];
    const live = it.device && S.state[it.device]?.ports?.[i];
    let c;
    if (live) c = !live.enabled ? "p-dis" : !live.up ? "" : live.speed === 1000 ? "p-on" : "p-off";
    else {
      const st = p?.device ? stateOf(p.device) : null;
      c = !p ? "" : st === "on" ? "p-on" : st === "err" ? "p-err" : st ? "p-off" : "p-used";
    }
    return `<i class="${c}" title="Port ${i + 1}${live ? " — " + esc(live.link) : ""}${p ? " — " + esc(p.label || device(p.device)?.name || "") : ""}"></i>`;
  }).join("")}</span>`;
  const model = it.model ? `<span class="r-model">${esc(it.model)}</span>` : "";
  switch (it.type) {
    case "patch": return `${label}${ports(it.ports || 24, "rj45")}`;
    case "switch": return `${led}${label}${model}${ports(it.ports || 24, "rj45")}`;
    case "router": case "firewall": {
      const accent = RACK_MODELS[it.model]?.accent;
      return `${accent ? `<span class="r-brand" style="background:${accent}"></span>` : ""}${led}${label}<span class="r-leds">${"<i></i>".repeat(it.side ? 3 : 5)}</span>`;
    }
    case "nas": return `${led}${label}<span class="r-bays">${Array.from({ length: it.h * 2 }, () => `<i><b></b></i>`).join("")}</span>`;
    case "server": return `${led}${label}<span class="r-vents"></span>`;
    case "ups": {
      const st = it.device && S.state[it.device];
      return `${led}${label}<span class="r-lcd">${esc(st?.summary || "100 %")}</span>`;
    }
    case "pdu": return `${label}<span class="r-outlets">${"<i></i>".repeat(8)}</span>`;
    case "shelf": return `${label}<span class="r-tray"></span>`;
    case "cable": return `<span class="r-brush"></span>${label}`;
    case "blank": return "";
    default: return `${led}${label}`;
  }
}

const SIDE_TXT = { left: " gauche", right: " droite" };

function occupancy() {
  const occ = {}; // U → { left: bool, right: bool }
  RACK.items.forEach((it) => {
    for (let u = it.u; u < it.u + it.h; u++) {
      occ[u] = occ[u] || {};
      if (it.side) occ[u][it.side] = true;
      else occ[u].left = occ[u].right = true;
    }
  });
  return occ;
}

function renderRack() {
  const N = RACK.units;
  const occ = occupancy();
  const rails = Array.from({ length: N }, (_, i) => `<span>${N - i}</span>`).join("");
  const slots = Array.from({ length: N }, (_, i) => {
    const u = N - i, o = occ[u] || {};
    if (o.left && o.right) return "";
    if (!o.left && !o.right) return `<div class="rack-slot" data-u="${u}" style="top:${i * UH}px" title="U${u} libre — cliquer pour ajouter"><span>+ U${u}</span></div>`;
    const side = o.left ? "right" : "left";
    return `<div class="rack-slot half ${side}" data-u="${u}" data-side="${side}" style="top:${i * UH}px" title="Moitié ${side === "left" ? "gauche" : "droite"} de U${u} libre"><span>+ U${u}</span></div>`;
  }).join("");
  const items = RACK.items.map((it) => `<div class="rack-item t-${it.type} ${it.side ? "half " + it.side : ""} ${RACK.sel === it.id ? "sel" : ""}" data-id="${esc(it.id)}"
      style="top:${(N - (it.u + it.h - 1)) * UH + 1}px;height:${it.h * UH - 2}px" title="${esc(it.name)} — U${it.u}${it.h > 1 ? "-" + (it.u + it.h - 1) : ""}${SIDE_TXT[it.side] || ""}">
      ${it.side !== "right" ? `<span class="r-ear"></span>` : ""}<div class="r-face">${face(it)}</div>${it.side !== "left" ? `<span class="r-ear"></span>` : ""}</div>`).join("");
  const free = Object.values(occ).reduce((s, o) => s - (o.left && o.right ? 1 : o.left || o.right ? 0.5 : 0), N);
  $("#modal-body").innerHTML = `<div class="rack-layout">
    <div class="rack-col">
      <div class="rack-tools"><label class="muted small">Hauteur <select class="select small-select" id="rack-units">
        ${RACK_SIZES.map((s) => `<option value="${s}" ${s === N ? "selected" : ""}>${s}U</option>`).join("")}</select></label>
        <span class="muted small">${nf(free, free % 1 ? 1 : 0)} U libre${free > 1 ? "s" : ""}</span></div>
      <div class="rack" style="height:${N * UH + 24}px">
        <div class="rack-rail">${rails}</div>
        <div class="rack-body" id="rack-body" style="height:${N * UH}px">${slots}${items}</div>
        <div class="rack-rail right">${rails}</div>
      </div>
    </div>
    <div class="rack-side" id="rack-side">${sidePanel()}</div></div>`;
  bindRack();
}

function sidePanel() {
  if (RACK.form) return rackForm();
  if (!RACK.items.length) {
    return `<div class="empty-state small-empty">${icon("server")}<h2>Baie vide</h2>
      <p class="muted">Clique sur un emplacement <b>+ U</b> pour ajouter un équipement : panneau de brassage, switch, box, NAS, onduleur…</p></div>`;
  }
  return `<h2>Contenu</h2><p class="muted small">Clique sur un équipement pour le modifier, fais-le glisser pour le déplacer.</p>
    <div class="rack-list">${RACK.items.map((it) => {
      const d = it.device && device(it.device);
      const st = d && S.state[d.id];
      return `<button class="rack-row" data-pick="${esc(it.id)}"><span class="r-led ${ledClass(it)}"></span>
        <div><b>${esc(it.name || RACK_TYPES[it.type].label)}</b><small>${RACK_TYPES[it.type].label} · U${it.u}${it.h > 1 ? "–" + (it.u + it.h - 1) : ""}${SIDE_TXT[it.side] || ""}${d ? " · " + esc(st?.summary || d.name) : ""}</small></div></button>`;
    }).join("")}</div>`;
}

function rackForm() {
  const f = RACK.form;
  const t = RACK_TYPES[f.type];
  const d = f.device && device(f.device);
  const st = d && S.state[d.id];
  const m = st?.metrics;
  let stats = "";
  if (d) {
    stats = `<div class="d-hero"><div class="sub"><span class="r-led ${ledClass(f)}"></span>${esc(d.name)}</div><div class="big" style="font-size:20px">${esc(st?.summary || "…")}</div>
      ${m ? `<div class="mini-stats"><span><small>CPU</small><b>${m.cpu_pct != null ? nf(m.cpu_pct) + " %" : "—"}</b></span>
        <span><small>RAM</small><b>${m.mem?.total ? nf((100 * m.mem.used) / m.mem.total) + " %" : "—"}</b></span>
        <span><small>Temp.</small><b>${m.cpu_temp != null ? nf(m.cpu_temp) + " °C" : "—"}</b></span></div>` : ""}
      <button class="btn small-btn" style="margin-top:10px" id="rf-open">${icon("external")}Ouvrir la fiche</button></div>`;
  }
  const models = Object.entries(RACK_MODELS);
  return `<h2>${f.id ? "Modifier l'équipement" : `Ajouter en U${f.u}${SIDE_TXT[f.side] || ""}`}</h2>
    <label class="field-label">Modèle (préremplit les caractéristiques)<select class="select" id="rf-model">
      <option value="">Autre / personnalisé</option>${models.map(([k, v]) => `<option value="${esc(k)}" ${k === f.model ? "selected" : ""}>${esc([v.brand, k].filter(Boolean).join(" "))} — ${esc(v.desc)}</option>`).join("")}</select></label>
    <label class="field-label">Type<select class="select" id="rf-type">${Object.entries(RACK_TYPES).map(([k, v]) => `<option value="${k}" ${k === f.type ? "selected" : ""}>${v.label}</option>`).join("")}</select></label>
    <label class="field-label">Nom<input class="input" id="rf-name" value="${esc(f.name)}" placeholder="${esc(t.label)}"></label>
    <div class="two-cols">
      <label class="field-label">Position (U du bas)<input class="input" type="number" id="rf-u" min="1" max="${RACK.units}" value="${f.u}"></label>
      <label class="field-label">Hauteur (U)<input class="input" type="number" id="rf-h" min="1" max="10" value="${f.h}"></label></div>
    <label class="field-label">Largeur<select class="select" id="rf-side">
      <option value="" ${!f.side ? "selected" : ""}>Pleine largeur (19")</option>
      <option value="left" ${f.side === "left" ? "selected" : ""}>Moitié gauche</option>
      <option value="right" ${f.side === "right" ? "selected" : ""}>Moitié droite</option></select></label>
    ${"ports" in t ? `<label class="field-label">Nombre de ports<input class="input" type="number" id="rf-ports" min="1" max="48" value="${f.ports || t.ports}"></label>` : ""}
    <label class="field-label">Relier à un appareil (voyant et statistiques en direct)<select class="select" id="rf-device">
      <option value="">Aucun</option>${S.cfg.devices.map((x) => `<option value="${x.id}" ${x.id === f.device ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select></label>
    ${"ports" in t && f.ports ? portsEditor(f) : ""}
    <label class="field-label">Notes<input class="input" id="rf-notes" value="${esc(f.notes || "")}" placeholder="Ex. : ports 1-8 = bureau, 9-12 = salon"></label>
    ${stats}
    <div class="inline-form"><button class="btn primary" id="rf-save">Enregistrer</button>
      ${f.id ? `<button class="btn ghost danger" id="rf-del">${icon("trash")}Retirer</button>` : ""}
      <button class="btn ghost" id="rf-cancel">Annuler</button></div>`;
}

function portsEditor(f) {
  const map = f.port_map || {};
  const n = Math.min(f.ports, 48);
  const used = Object.keys(map).length;
  let h = `<div class="ports-box"><div class="ports-head"><b>Ports</b><span class="muted small">${used}/${n} renseigné(s) — clique sur un port</span></div>
    <div class="port-grid" style="--cols:${Math.min(n, n > 24 ? 24 : n % 2 ? n : n / 2)}">${Array.from({ length: n }, (_, i) => {
      const k = String(i + 1), p = map[k];
      const live = f.device && S.state[f.device]?.ports?.[i];
      const st = p?.device ? stateOf(p.device) : null;
      const c = live ? (!live.enabled ? "p-dis" : !live.up ? (p ? "p-used" : "") : live.speed === 1000 ? "p-on" : "p-off")
        : !p ? "" : st === "on" ? "p-on" : st === "err" ? "p-err" : st ? "p-off" : "p-used";
      return `<button type="button" class="port ${c} ${PORT_SEL === k ? "sel" : ""}" data-port="${k}" title="${p ? esc(p.label || device(p.device)?.name || "") : "libre"}">${k}</button>`;
    }).join("")}</div>`;
  if (PORT_SEL) {
    const p = map[PORT_SEL] || {};
    h += `<div class="port-edit"><b>Port ${PORT_SEL}</b>
      <input class="input" id="pe-label" placeholder="Ce qui est branché (ex. Bureau Éric, Box, Salon…)" value="${esc(p.label || "")}">
      <select class="select" id="pe-device"><option value="">Aucun appareil lié</option>${S.cfg.devices.map((x) => `<option value="${x.id}" ${x.id === p.device ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>
      <div class="inline-form"><button type="button" class="btn small-btn primary" id="pe-ok">OK</button>
        ${map[PORT_SEL] ? `<button type="button" class="btn small-btn ghost danger" id="pe-clear">Libérer le port</button>` : ""}</div></div>`;
  }
  const rows = Object.entries(map).sort((a, b) => a[0] - b[0]);
  if (rows.length) {
    h += `<div class="port-list">${rows.map(([k, p]) => `<span><b>${k}</b> ${esc(p.label || device(p.device)?.name || "")}${p.device && p.label ? ` <i class="muted">(${esc(device(p.device)?.name || p.device)})</i>` : ""}</span>`).join("")}</div>`;
  }
  return h + `</div>`;
}

// ------------------------------------------------------------------ interactions
function fits(u, h, ignoreId, side = null) {
  if (u < 1 || u + h - 1 > RACK.units) return false;
  return !RACK.items.some((it) => it.id !== ignoreId && u <= it.u + it.h - 1 && it.u <= u + h - 1
    && (!side || !it.side || side === it.side));
}

function freeSide(u, h, ignoreId) {
  return fits(u, h, ignoreId, "left") ? "left" : fits(u, h, ignoreId, "right") ? "right" : null;
}

async function saveRack(items, units = RACK.units, msg) {
  try {
    const r = await api(`/api/rack/${encodeURIComponent(RACK.name)}`, { method: "PUT", body: JSON.stringify({ units, items }) });
    RACK.items = r.items;
    RACK.units = r.units;
    try { S.rackItems = Object.values((await api("/api/rack")).racks).flatMap((x) => x.items); } catch {}
    if (msg) toast(msg);
    return true;
  } catch (e) {
    toast(e.message, true);
    return false;
  } finally {
    renderRack();
  }
}

function readForm() {
  const f = RACK.form;
  f.type = $("#rf-type").value;
  f.name = $("#rf-name").value.trim();
  f.u = Math.max(1, +$("#rf-u").value || f.u);
  f.h = Math.max(1, Math.min(10, +$("#rf-h").value || f.h));
  f.ports = $("#rf-ports") ? +$("#rf-ports").value : null;
  f.device = $("#rf-device").value || null;
  f.notes = $("#rf-notes").value;
  f.model = $("#rf-model").value || null;
  f.side = $("#rf-side").value || null;
}

function bindRack() {
  $("#rack-units").addEventListener("change", (e) => saveRack(RACK.items, +e.target.value, "Hauteur de la baie modifiée"));
  $$(".rack-slot").forEach((s) => s.addEventListener("click", () => {
    const u = +s.dataset.u;
    let h = 1;
    RACK.form = { type: "switch", name: "", u, h, ports: 24, device: null, notes: "", side: s.dataset.side || null };
    RACK.sel = null;
    renderRack();
  }));
  $$("[data-pick]").forEach((b) => b.addEventListener("click", () => selectItem(b.dataset.pick)));
  if (RACK.form) {
    $("#rf-type").addEventListener("change", () => {
      readForm();
      const t = RACK_TYPES[RACK.form.type];
      if (!RACK.form.id) RACK.form.h = t.h;
      if (t.ports && !RACK.form.ports) RACK.form.ports = t.ports;
      renderRack();
    });
    $("#rf-device").addEventListener("change", () => { readForm(); renderRack(); });
    $("#rf-model").addEventListener("change", () => {
      readForm();
      const mdl = RACK_MODELS[RACK.form.model];
      if (mdl) {
        Object.assign(RACK.form, { type: mdl.type, h: mdl.h, ports: mdl.ports });
        if (mdl.half && !RACK.form.side) RACK.form.side = freeSide(RACK.form.u, mdl.h, RACK.form.id) || null;
        if (!RACK.form.name || Object.keys(RACK_MODELS).some((k) => RACK.form.name.includes(k))) RACK.form.name = [mdl.brand, RACK.form.model].filter(Boolean).join(" ");
      }
      renderRack();
    });
    $$("[data-port]").forEach((b) => b.addEventListener("click", () => { readForm(); PORT_SEL = PORT_SEL === b.dataset.port ? null : b.dataset.port; renderRack(); }));
    $("#pe-ok")?.addEventListener("click", () => {
      readForm();
      const label = $("#pe-label").value.trim(), dev = $("#pe-device").value || null;
      RACK.form.port_map = { ...(RACK.form.port_map || {}) };
      if (label || dev) RACK.form.port_map[PORT_SEL] = { label, device: dev };
      else delete RACK.form.port_map[PORT_SEL];
      PORT_SEL = null;
      renderRack();
    });
    $("#pe-clear")?.addEventListener("click", () => { readForm(); delete RACK.form.port_map[PORT_SEL]; PORT_SEL = null; renderRack(); });
    $("#rf-open")?.addEventListener("click", () => { const id = RACK.form.device; closeModal(); openDrawer(id); });
    $("#rf-cancel").addEventListener("click", () => { RACK.form = null; RACK.sel = null; PORT_SEL = null; renderRack(); });
    $("#rf-del")?.addEventListener("click", () => {
      if (!confirm(`Retirer « ${RACK.form.name || RACK_TYPES[RACK.form.type].label} » de la baie ?`)) return;
      const id = RACK.form.id;
      RACK.form = null;
      RACK.sel = null;
      saveRack(RACK.items.filter((x) => x.id !== id), RACK.units, "Équipement retiré");
    });
    $("#rf-save").addEventListener("click", async () => {
      readForm();
      const f = RACK.form;
      if (!fits(f.u, f.h, f.id, f.side)) return toast(`Pas assez de place à partir de U${f.u}${SIDE_TXT[f.side] || ""} (${f.h}U)`, true);
      const item = { id: f.id, name: f.name || RACK_TYPES[f.type].label, type: f.type, u: f.u, h: f.h,
        ports: RACK_TYPES[f.type].ports ? f.ports : null, device: f.device, notes: f.notes,
        model: f.model || null, side: f.side || null, port_map: RACK_TYPES[f.type].ports ? (f.port_map || {}) : {} };
      PORT_SEL = null;
      const list = f.id ? RACK.items.map((x) => (x.id === f.id ? item : x)) : [...RACK.items, item];
      RACK.form = null;
      if (await saveRack(list, RACK.units, f.id ? "Équipement modifié" : "Équipement ajouté")) RACK.sel = null;
    });
  }
  // glisser-déposer vertical, avec aimantation sur les U
  $$(".rack-item").forEach((el) => {
    let start = null;
    el.addEventListener("pointerdown", (e) => {
      start = { y: e.clientY, top: parseFloat(el.style.top), moved: false };
      el.setPointerCapture(e.pointerId);
    });
    el.addEventListener("pointermove", (e) => {
      if (!start) return;
      const dy = e.clientY - start.y;
      if (Math.abs(dy) > 4) start.moved = true;
      if (!start.moved) return;
      const it = RACK.items.find((x) => x.id === el.dataset.id);
      const top = Math.max(0, Math.min((RACK.units - it.h) * UH, start.top + dy));
      const snapped = Math.round(top / UH) * UH + 1;
      const u = RACK.units - Math.round(top / UH) - it.h + 1;
      el.style.top = snapped + "px";
      el.classList.add("dragging");
      el.classList.toggle("blocked", !fits(u, it.h, it.id, it.side));
      start.u = u;
    });
    el.addEventListener("pointerup", () => {
      if (!start) return;
      const s = start;
      start = null;
      el.classList.remove("dragging");
      if (!s.moved) return selectItem(el.dataset.id);
      const it = RACK.items.find((x) => x.id === el.dataset.id);
      if (s.u == null || s.u === it.u) return renderRack();
      if (!fits(s.u, it.h, it.id, it.side)) { toast("Emplacement déjà occupé", true); return renderRack(); }
      saveRack(RACK.items.map((x) => (x.id === it.id ? { ...x, u: s.u } : x)), RACK.units, `Déplacé en U${s.u}`);
    });
  });
}

function selectItem(id) {
  const it = RACK.items.find((x) => x.id === id);
  if (!it) return;
  RACK.sel = id;
  PORT_SEL = null;
  RACK.form = { ...it, port_map: { ...(it.port_map || {}) } };
  renderRack();
}

// rafraîchit les voyants si la baie est ouverte
setInterval(() => {
  if (RACK.name && !$("#modal").hidden && $(".rack-layout") && !document.activeElement?.closest?.(".rack-side")) renderRack();
}, 10000);
