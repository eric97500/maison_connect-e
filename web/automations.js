"use strict";
// Automatisations et scènes : liste, éditeur visuel « Quand / Si / Alors »

const DAY_LABELS = ["L", "M", "M", "J", "V", "S", "D"];
const DAY_NAMES = ["lun", "mar", "mer", "jeu", "ven", "sam", "dim"];
const ALARM_OPTS = [["ARMED_AWAY", "armée (totale)"], ["ARMED_HOME", "armée (partiel)"], ["DISARMED", "désarmée"]];
const STATE_OPTS = [["on", "s'allume / devient actif"], ["off", "s'éteint / devient inactif"], ["offline", "se déconnecte"], ["online", "se reconnecte"]];
const IS_OPTS = [["on", "allumé / actif"], ["off", "éteint / inactif"], ["online", "en ligne"], ["offline", "hors ligne"]];
const ACTION_NAMES = { on: "Allumer", off: "Éteindre", toggle: "Inverser", wake: "Réveiller (Wake on LAN)", brightness: "Régler la luminosité",
  set_temperature: "Régler la température", resume_schedule: "Reprendre le planning", pause: "Mettre en pause", resume: "Reprendre", stop: "Arrêter" };
// Actions qui demandent une valeur
const VALUE_ACTIONS = { brightness: { unit: "%", def: 50, min: 1, max: 100 }, set_temperature: { unit: "°C", def: 20, min: 5, max: 30 } };

const ROW_TYPES = {
  triggers: {
    time: { label: "À une heure précise", icon: "clock", fields: [{ k: "at", type: "time", label: "Heure", def: "08:00" }, { k: "days", type: "days", label: "Jours" }] },
    sun: { label: "Lever / coucher du soleil", icon: "sunset", fields: [{ k: "event", type: "select", options: [["sunset", "Coucher du soleil"], ["sunrise", "Lever du soleil"]], def: "sunset" }, { k: "offset", type: "number", label: "Décalage (minutes, négatif = avant)", def: 0 }] },
    state: { label: "Un appareil change d'état", icon: "power", fields: [{ k: "device", type: "device" }, { k: "to", type: "select", options: STATE_OPTS, def: "on" }] },
    power: { label: "Consommation d'une prise", icon: "bolt", fields: [{ k: "device", type: "device", filter: "power" }, { k: "op", type: "select", options: [["above", "dépasse"], ["below", "passe sous"]], def: "above" }, { k: "watts", type: "number", label: "Watts", def: 1000 }, { k: "for_min", type: "number", label: "Pendant (minutes)", def: 5 }] },
    alarm: { label: "L'alarme change", icon: "shield", fields: [{ k: "to", type: "select", options: ALARM_OPTS, def: "ARMED_AWAY" }] },
    presence: { label: "Présence", icon: "person", fields: [{ k: "to", type: "select", options: [["all_away", "Tout le monde est parti"], ["someone_home", "Quelqu'un arrive"]], def: "all_away" }] },
    tariff: { label: "Heures creuses / pleines", icon: "bolt", fields: [{ k: "to", type: "select", options: [["hc", "Début des heures creuses"], ["hp", "Début des heures pleines"]], def: "hc" }] },
  },
  conditions: {
    time: { label: "Entre deux heures", icon: "clock", fields: [{ k: "after", type: "time", label: "Après", def: "18:00" }, { k: "before", type: "time", label: "Avant", def: "23:00" }] },
    days: { label: "Certains jours", icon: "clock", fields: [{ k: "days", type: "days", label: "Jours" }] },
    state: { label: "Un appareil est…", icon: "power", fields: [{ k: "device", type: "device" }, { k: "is", type: "select", options: IS_OPTS, def: "on" }] },
    alarm: { label: "L'alarme est…", icon: "shield", fields: [{ k: "is", type: "select", options: ALARM_OPTS, def: "DISARMED" }] },
    presence: { label: "Présence", icon: "person", fields: [{ k: "is", type: "select", options: [["home", "Quelqu'un est à la maison"], ["away", "Personne à la maison"]], def: "home" }] },
    sun: { label: "Jour / nuit", icon: "sun", fields: [{ k: "is", type: "select", options: [["night", "Il fait nuit"], ["day", "Il fait jour"]], def: "night" }] },
    tariff: { label: "Tarif électrique", icon: "bolt", fields: [{ k: "is", type: "select", options: [["hc", "Pendant les heures creuses"], ["hp", "Pendant les heures pleines"]], def: "hc" }] },
  },
  actions: {
    device: { label: "Piloter un appareil", icon: "power", fields: [{ k: "device", type: "device", filter: "actionable" }, { k: "action", type: "action" }] },
    scene: { label: "Lancer une scène", icon: "star", fields: [{ k: "scene", type: "scene" }] },
    notify: { label: "Envoyer une notification", icon: "bell", fields: [{ k: "title", type: "text", label: "Titre", def: "Maison" }, { k: "message", type: "text", label: "Message", def: "" }] },
    delay: { label: "Attendre", icon: "clock", fields: [{ k: "seconds", type: "number", label: "Secondes", def: 60 }] },
  },
};

const SECTION_TITLES = { triggers: ["Quand…", "Ce qui déclenche l'automatisation (un seul suffit)"],
  conditions: ["Seulement si…", "Toutes les conditions doivent être vraies (facultatif)"],
  actions: ["Alors…", "Exécutées dans l'ordre"] };

const usableActions = (d) => (d?.actions || []).filter((a) => ACTION_NAMES[a] && !(d.type === "verisure"));
const devName = (id) => device(id)?.name || id || "?";

// ------------------------------------------------------------------ résumé lisible
function describeRow(section, r) {
  switch (`${section}:${r.type}`) {
    case "triggers:time": return `à ${r.at || "?"}${r.days?.length && r.days.length < 7 ? " (" + r.days.map((d) => DAY_NAMES[d]).join(", ") + ")" : ""}`;
    case "triggers:sun": { const o = +r.offset || 0; return `${r.event === "sunrise" ? "au lever" : "au coucher"} du soleil${o ? ` ${o > 0 ? "+" : "−"}${Math.abs(o)} min` : ""}`; }
    case "triggers:state": return `${devName(r.device)} ${(STATE_OPTS.find((o) => o[0] === r.to) || [, r.to])[1]}`;
    case "triggers:power": return `${devName(r.device)} ${r.op === "below" ? "<" : ">"} ${r.watts} W pendant ${r.for_min} min`;
    case "triggers:alarm": return `l'alarme est ${(ALARM_OPTS.find((o) => o[0] === r.to) || [, r.to])[1]}`;
    case "triggers:presence": return r.to === "all_away" ? "tout le monde est parti" : "quelqu'un arrive";
    case "triggers:tariff": return r.to === "hc" ? "au début des heures creuses" : "au début des heures pleines";
    case "conditions:tariff": return r.is === "hc" ? "en heures creuses" : "en heures pleines";
    case "conditions:time": return `entre ${r.after} et ${r.before}`;
    case "conditions:days": return (r.days || []).map((d) => DAY_NAMES[d]).join(", ") || "aucun jour";
    case "conditions:state": return `${devName(r.device)} ${(IS_OPTS.find((o) => o[0] === r.is) || [, r.is])[1]}`;
    case "conditions:alarm": return `alarme ${(ALARM_OPTS.find((o) => o[0] === r.is) || [, r.is])[1]}`;
    case "conditions:presence": return r.is === "home" ? "quelqu'un est là" : "personne n'est là";
    case "conditions:sun": return r.is === "night" ? "il fait nuit" : "il fait jour";
    case "actions:device": return `${devName(r.device)} → ${(ACTION_NAMES[r.action] || r.action || "?").toLowerCase()}${VALUE_ACTIONS[r.action] ? ` ${r.params?.value ?? VALUE_ACTIONS[r.action].def} ${VALUE_ACTIONS[r.action].unit}` : ""}`;
    case "actions:scene": return `scène « ${(S.scenes || []).find((s) => s.id === r.scene)?.name || r.scene} »`;
    case "actions:notify": return `notification « ${r.title || ""} »`;
    case "actions:delay": return `attendre ${r.seconds} s`;
  }
  return r.type;
}

// ------------------------------------------------------------------ liste des automatisations
function renderAutomations() {
  const box = $("#automation-list");
  const list = S.automations || [];
  if (!list.length) {
    box.innerHTML = `<div class="card empty-state">${icon("cog")}<h2>Aucune automatisation</h2><p class="muted">Crée ta première règle : « au coucher du soleil, allume le séjour ».</p></div>`;
    return;
  }
  box.innerHTML = list.map((a) => {
    const last = S.lastRun?.[a.id];
    const trig = (a.triggers || []).map((r) => describeRow("triggers", r)).join(" ou ");
    const cond = (a.conditions || []).map((r) => describeRow("conditions", r)).join(" et ");
    const acts = (a.actions || []).map((r) => describeRow("actions", r)).join(", puis ");
    return `<div class="card auto-card ${a.enabled ? "" : "disabled"}">
      <div class="auto-main">
        <span class="auto-ico">${icon(ROW_TYPES.triggers[a.triggers?.[0]?.type]?.icon || "cog")}</span>
        <div class="auto-text">
          <b>${esc(a.name)}</b>
          <p><span class="kw">Quand</span> ${esc(trig)}${cond ? ` <span class="kw">si</span> ${esc(cond)}` : ""} <span class="kw">alors</span> ${esc(acts || "rien")}</p>
          <small class="muted">${last ? "Dernière exécution " + timeAgo(last) : "Jamais exécutée depuis le démarrage"}</small>
        </div>
        <label class="switch" title="Activer / désactiver"><input type="checkbox" data-enable="${esc(a.id)}" ${a.enabled ? "checked" : ""}><i></i></label>
      </div>
      <div class="auto-actions">
        <button class="btn ghost small-btn" data-run="${esc(a.id)}">${icon("play")}Exécuter</button>
        <button class="btn ghost small-btn" data-edit="${esc(a.id)}">${icon("edit")}Modifier</button>
        <button class="btn ghost small-btn danger" data-del="${esc(a.id)}">${icon("trash")}Supprimer</button>
      </div></div>`;
  }).join("");
  $$("[data-enable]", box).forEach((el) => el.addEventListener("change", () => {
    const a = S.automations.find((x) => x.id === el.dataset.enable);
    a.enabled = el.checked;
    saveAutomations(a.enabled ? `« ${a.name} » activée` : `« ${a.name} » désactivée`);
  }));
  $$("[data-run]", box).forEach((el) => el.addEventListener("click", async () => {
    try { await api(`/api/automations/${el.dataset.run}/run`, { method: "POST" }); toast("Automatisation lancée"); setTimeout(loadAndRenderAutos, 1200); }
    catch (e) { toast(e.message, true); }
  }));
  $$("[data-edit]", box).forEach((el) => el.addEventListener("click", () => editAutomation(S.automations.find((x) => x.id === el.dataset.edit))));
  $$("[data-del]", box).forEach((el) => el.addEventListener("click", () => {
    const a = S.automations.find((x) => x.id === el.dataset.del);
    if (!confirm(`Supprimer « ${a.name} » ?`)) return;
    S.automations = S.automations.filter((x) => x !== a);
    saveAutomations("Automatisation supprimée");
  }));
}

async function loadAndRenderAutos() {
  await loadAutomationData();
  if ($("#view-automations").classList.contains("active")) renderAutomations();
  if ($("#view-scenes").classList.contains("active")) renderScenes();
  renderSceneBar();
}

async function saveAutomations(msg) {
  try {
    const r = await api("/api/automations", { method: "PUT", body: JSON.stringify(S.automations) });
    S.automations = r.automations;
    toast(msg || "Enregistré");
    return true;
  } catch (e) {
    toast(e.message, true);
    await loadAutomationData();
    return false;
  } finally {
    renderAutomations();
  }
}

$("#new-automation").addEventListener("click", () => editAutomation(null));

// ------------------------------------------------------------------ éditeur (automatisations et scènes)
function editAutomation(a) {
  const draft = a ? structuredClone(a) : { name: "", enabled: true, triggers: [newRow("triggers", "time")], conditions: [], actions: [newRow("actions", "device")] };
  const render = () => {
    $("#modal-body").innerHTML = `
      <label class="field-label">Nom<input class="input" id="ed-name" value="${esc(draft.name)}" placeholder="Ex. : Lumière au coucher du soleil"></label>
      ${["triggers", "conditions", "actions"].map((sec) => sectionHtml(sec, draft[sec])).join("")}`;
    bindEditor(draft, render);
  };
  openModal(a ? "Modifier l'automatisation" : "Nouvelle automatisation", "", [
    { label: "Annuler", cls: "ghost", onClick: closeModal },
    { label: "Enregistrer", cls: "primary", onClick: async () => {
      draft.name = $("#ed-name").value.trim();
      if (!draft.name) return toast("Donne un nom à l'automatisation", true);
      if (!draft.triggers.length) return toast("Ajoute au moins un déclencheur", true);
      if (a) S.automations[S.automations.findIndex((x) => x.id === a.id)] = draft;
      else S.automations = [...S.automations, draft];
      if (await saveAutomations("Automatisation enregistrée")) closeModal();
    } },
  ]);
  render();
}

function newRow(section, type) {
  const r = { type };
  for (const f of ROW_TYPES[section][type].fields) {
    if (f.def !== undefined) r[f.k] = f.def;
    if (f.type === "days") r[f.k] = [0, 1, 2, 3, 4, 5, 6];
    if (f.type === "device") {
      const d = deviceOptions(f.filter)[0];
      r[f.k] = d?.id;
    }
    if (f.type === "action") r.action = usableActions(device(r.device))[0] || "on";
    if (f.type === "scene") r.scene = S.scenes?.[0]?.id;
  }
  return r;
}

function deviceOptions(filter) {
  return S.cfg.devices.filter((d) => filter === "power" ? d.capabilities.includes("power")
    : filter === "actionable" ? usableActions(d).length : true);
}

function sectionHtml(sec, rows) {
  const [title, sub] = SECTION_TITLES[sec];
  const types = ROW_TYPES[sec];
  return `<div class="ed-section" data-sec="${sec}">
    <div class="ed-head"><div><b>${title}</b><small>${sub}</small></div></div>
    ${rows.map((r, i) => `<div class="ed-row">
      <span class="ed-ico">${icon(types[r.type]?.icon || "cog")}</span>
      <div class="ed-fields">
        <select class="select" data-type="${sec}:${i}">${Object.entries(types).map(([k, t]) => `<option value="${k}" ${k === r.type ? "selected" : ""}>${t.label}</option>`).join("")}</select>
        ${(types[r.type]?.fields || []).map((f) => fieldHtml(sec, i, f, r)).join("")}
      </div>
      <button class="icon-btn" data-remove="${sec}:${i}" title="Retirer">${icon("trash")}</button></div>`).join("")}
    <button class="btn ghost small-btn" data-add="${sec}">${icon("plus")}Ajouter</button></div>`;
}

function fieldHtml(sec, i, f, r) {
  const id = `${sec}:${i}:${f.k}`;
  const lab = f.label ? `<span>${f.label}</span>` : "";
  switch (f.type) {
    case "time": return `<label class="mini">${lab}<input class="input" type="time" data-f="${id}" value="${esc(r[f.k] || "")}"></label>`;
    case "number": return `<label class="mini">${lab}<input class="input" type="number" data-f="${id}" value="${esc(r[f.k] ?? "")}"></label>`;
    case "text": return `<label class="mini grow">${lab}<input class="input" data-f="${id}" value="${esc(r[f.k] || "")}"></label>`;
    case "select": return `<select class="select" data-f="${id}">${f.options.map(([v, l]) => `<option value="${v}" ${v === r[f.k] ? "selected" : ""}>${l}</option>`).join("")}</select>`;
    case "device": return `<select class="select" data-f="${id}">${deviceOptions(f.filter).map((d) => `<option value="${d.id}" ${d.id === r[f.k] ? "selected" : ""}>${esc(d.name)}</option>`).join("")}</select>`;
    case "scene": return `<select class="select" data-f="${id}">${(S.scenes || []).map((s) => `<option value="${s.id}" ${s.id === r[f.k] ? "selected" : ""}>${esc(s.name)}</option>`).join("")}</select>`;
    case "days": return `<div class="days" data-days="${id}">${DAY_LABELS.map((l, d) => `<button type="button" class="day ${(r[f.k] || []).includes(d) ? "on" : ""}" data-day="${d}" title="${DAY_NAMES[d]}">${l}</button>`).join("")}</div>`;
    case "action": {
      const acts = usableActions(device(r.device));
      return `<select class="select" data-f="${id}">${acts.map((a) => `<option value="${a}" ${a === r.action ? "selected" : ""}>${ACTION_NAMES[a]}</option>`).join("")}</select>`
        + (VALUE_ACTIONS[r.action] ? `<label class="mini"><span>${VALUE_ACTIONS[r.action].unit}</span><input class="input" type="number" step="0.5" min="${VALUE_ACTIONS[r.action].min}" max="${VALUE_ACTIONS[r.action].max}" data-bri="${sec}:${i}" value="${r.params?.value ?? VALUE_ACTIONS[r.action].def}"></label>` : "");
    }
  }
  return "";
}

function bindEditor(draft, render) {
  const body = $("#modal-body");
  const keep = () => { const n = $("#ed-name"); if (n) draft.name = n.value; };
  $$("[data-type]", body).forEach((el) => el.addEventListener("change", () => {
    keep();
    const [sec, i] = el.dataset.type.split(":");
    draft[sec][+i] = newRow(sec, el.value);
    render();
  }));
  $$("[data-f]", body).forEach((el) => el.addEventListener("change", () => {
    keep();
    const [sec, i, k] = el.dataset.f.split(":");
    const row = draft[sec][+i];
    row[k] = el.type === "number" ? Number(el.value) : el.value;
    if (k === "device" && row.type === "device") { row.action = usableActions(device(row.device))[0]; delete row.params; render(); }
    if (k === "action") { if (VALUE_ACTIONS[row.action]) row.params = { value: VALUE_ACTIONS[row.action].def }; else delete row.params; render(); }
  }));
  $$("[data-bri]", body).forEach((el) => el.addEventListener("change", () => {
    const [sec, i] = el.dataset.bri.split(":");
    const v = VALUE_ACTIONS[draft[sec][+i].action] || VALUE_ACTIONS.brightness;
    draft[sec][+i].params = { value: Math.max(v.min, Math.min(v.max, +el.value || v.def)) };
  }));
  $$("[data-days] .day", body).forEach((el) => el.addEventListener("click", () => {
    const [sec, i, k] = el.parentElement.dataset.days.split(":");
    const row = draft[sec][+i];
    const d = +el.dataset.day;
    row[k] = row[k].includes(d) ? row[k].filter((x) => x !== d) : [...row[k], d].sort();
    el.classList.toggle("on");
  }));
  $$("[data-remove]", body).forEach((el) => el.addEventListener("click", () => {
    keep();
    const [sec, i] = el.dataset.remove.split(":");
    draft[sec].splice(+i, 1);
    render();
  }));
  $$("[data-add]", body).forEach((el) => el.addEventListener("click", () => {
    keep();
    const sec = el.dataset.add;
    draft[sec].push(newRow(sec, Object.keys(ROW_TYPES[sec])[sec === "conditions" ? 0 : 0]));
    render();
  }));
}

// ------------------------------------------------------------------ scènes
function renderScenes() {
  const grid = $("#scene-grid");
  const list = S.scenes || [];
  grid.innerHTML = list.map((sc) => `<div class="card scene-card">
      <button class="scene-run" data-scene-run="${esc(sc.id)}">${icon(sc.icon || "star")}</button>
      <div class="scene-info"><b>${esc(sc.name)}</b><small class="muted">${(sc.actions || []).length} action(s) · ${esc((sc.actions || []).slice(0, 2).map((r) => describeRow("actions", r)).join(", "))}${(sc.actions || []).length > 2 ? "…" : ""}</small></div>
      <div class="scene-btns">
        <button class="icon-btn" data-scene-edit="${esc(sc.id)}" title="Modifier">${icon("edit")}</button>
        <button class="icon-btn" data-scene-del="${esc(sc.id)}" title="Supprimer">${icon("trash")}</button></div></div>`).join("")
    || `<div class="card empty-state">${icon("star")}<h2>Aucune scène</h2><p class="muted">Une scène regroupe plusieurs actions : « Soirée TV », « Je pars »…</p></div>`;
  $$("[data-scene-run]", grid).forEach((b) => b.addEventListener("click", () => runScene(b.dataset.sceneRun, b)));
  $$("[data-scene-edit]", grid).forEach((b) => b.addEventListener("click", () => editScene(S.scenes.find((x) => x.id === b.dataset.sceneEdit))));
  $$("[data-scene-del]", grid).forEach((b) => b.addEventListener("click", () => {
    const sc = S.scenes.find((x) => x.id === b.dataset.sceneDel);
    if (!confirm(`Supprimer la scène « ${sc.name} » ?`)) return;
    S.scenes = S.scenes.filter((x) => x !== sc);
    saveScenes("Scène supprimée");
  }));
}

async function saveScenes(msg) {
  try {
    const r = await api("/api/scenes", { method: "PUT", body: JSON.stringify(S.scenes) });
    S.scenes = r.scenes;
    toast(msg || "Enregistré");
    return true;
  } catch (e) {
    toast(e.message, true);
    await loadAutomationData();
    return false;
  } finally {
    renderScenes();
    renderSceneBar();
  }
}

$("#new-scene").addEventListener("click", () => editScene(null));

function editScene(sc) {
  const draft = sc ? structuredClone(sc) : { name: "", icon: "star", actions: [newRow("actions", "device")] };
  const render = () => {
    $("#modal-body").innerHTML = `
      <label class="field-label">Nom<input class="input" id="ed-name" value="${esc(draft.name)}" placeholder="Ex. : Soirée TV"></label>
      <div class="field-label">Icône<div class="icon-pick">${SCENE_ICONS.map((i) => `<button type="button" class="icon-btn ${i === draft.icon ? "on" : ""}" data-icon="${i}">${icon(i)}</button>`).join("")}</div></div>
      ${sectionHtml("actions", draft.actions)}`;
    bindEditor(draft, render);
    $$("[data-icon]").forEach((b) => b.addEventListener("click", () => { draft.name = $("#ed-name").value; draft.icon = b.dataset.icon; render(); }));
  };
  openModal(sc ? "Modifier la scène" : "Nouvelle scène", "", [
    { label: "Annuler", cls: "ghost", onClick: closeModal },
    { label: "Enregistrer", cls: "primary", onClick: async () => {
      draft.name = $("#ed-name").value.trim();
      if (!draft.name) return toast("Donne un nom à la scène", true);
      if (sc) S.scenes[S.scenes.findIndex((x) => x.id === sc.id)] = draft;
      else S.scenes = [...S.scenes, draft];
      if (await saveScenes("Scène enregistrée")) closeModal();
    } },
  ]);
  render();
}
