"use strict";
// Paramètres : appareils, localisation, notifications

const TYPE_INFO = {
  tapo_plug:   { label: "Prise Tapo (P110/P115)", fields: ["host"] },
  tapo_bulb:   { label: "Ampoule Tapo", fields: ["host", "watts"] },
  tapo_clim:   { label: "Climatisation (sur prise Tapo)", fields: ["host"] },
  verisure:    { label: "Alarme Verisure", fields: ["giid"] },
  camera:      { label: "Caméra (Avidsen…)", fields: ["host", "rtsp_url", "snapshot_url"] },
  presence:    { label: "Téléphone (présence)", fields: ["host", "away_after_min"] },
  wol:         { label: "Ordinateur (Wake on LAN)", fields: ["host", "mac", "broadcast"] },
  qnap:        { label: "NAS QNAP", fields: ["host", "port", "https", "mac"] },
  terramaster: { label: "NAS TerraMaster", fields: ["host", "ssh_port", "web_port", "mac"] },
  linux:       { label: "Serveur Linux (SSH)", fields: ["host", "ssh_port", "mac"] },
  tplink_switch: { label: "Switch TP-Link Easy Smart (TL-SG1016DE…)", fields: ["host"] },
  sfr_box:     { label: "Box SFR", fields: ["host"] },
  hon:         { label: "Électroménager hOn (Candy, Haier, Hoover)", fields: ["mac", "host"] },
  brother:     { label: "Imprimante Brother", fields: ["host", "printer_type"] },
  livebox:     { label: "Orange Livebox", fields: ["host"] },
  proxmox:     { label: "Serveur Proxmox", fields: ["host", "port", "mac"] },
  elegoo:      { label: "Imprimante 3D Elegoo", fields: ["host", "protocol"] },
  tado:        { label: "Pièce tado° (chauffage / clim)", fields: ["home_id", "zone_id"] },
};
const FIELD_DEF = {
  host: { label: "Adresse IP", ph: "192.168.1.50" },
  printer_type: { label: "Type d'imprimante", type: "select", options: [["laser", "Laser (toner)"], ["ink", "Jet d'encre (cartouches)"]] },
  watts: { label: "Puissance de l'ampoule en W (sinon selon le modèle)", type: "number", ph: "8" },
  mac: { label: "Adresse MAC (pour l'allumer à distance)", ph: "AA:BB:CC:DD:EE:FF" },
  broadcast: { label: "Adresse de broadcast", ph: "255.255.255.255" },
  rtsp_url: { label: "URL RTSP", ph: "rtsp://${CAMERA_USER}:${CAMERA_PASSWORD}@192.168.1.70:554/live/ch0" },
  snapshot_url: { label: "URL d'image (snapshot)", ph: "http://192.168.1.70/snapshot.jpg" },
  port: { label: "Port", type: "number", ph: "8080" },
  web_port: { label: "Port de l'interface web", type: "number", ph: "5443" },
  ssh_port: { label: "Port SSH (TerraMaster : 9222, Linux : 22)", type: "number", ph: "22" },
  https: { label: "Connexion HTTPS", type: "checkbox" },
  protocol: { label: "Protocole", type: "select", options: [["sdcp", "SDCP (Centauri Carbon, Saturn, Mars)"], ["moonraker", "Moonraker / Klipper (Neptune 4)"]] },
  away_after_min: { label: "Absent après (minutes sans réponse)", type: "number", ph: "10" },
  giid: { label: "Identifiant d'installation (facultatif)", ph: "" },
  home_id: { label: "Logement tado° (identifiant)", type: "number" },
  zone_id: { label: "Pièce tado° (identifiant)", type: "number" },
};

const SET = { raw: [], settings: {} };

async function renderSettings() {
  const body = $("#settings-body");
  body.innerHTML = `<p class="muted">Chargement…</p>`;
  try {
    [SET.raw, SET.settings] = await Promise.all([api("/api/devices/config"), api("/api/settings")]);
  } catch (e) { body.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; return; }
  const st = SET.settings;
  body.innerHTML = `
  <div class="settings-grid">
    <div class="card span-2" id="accounts-card"></div>
    <div class="card span-2">
      <div class="card-head"><h2>Appareils</h2><button class="btn primary small-btn" id="dev-add">${icon("plus")}Ajouter un appareil</button></div>
      <div class="table-wrap"><table class="data dev-table"><thead><tr><th>Appareil</th><th>Type</th><th>Adresse</th><th>Pièce</th><th></th></tr></thead>
      <tbody>${SET.raw.map((d, i) => {
        const m = TYPES[d.type] || {};
        const s = S.state[d.id] || {};
        return `<tr><td><span class="dev-cell" style="--c:${m.color || "#94a3b8"}"><span class="dev-ico mini-ico">${icon(m.icon || "plug")}</span>${esc(d.name)}</span></td>
          <td>${esc(TYPE_INFO[d.type]?.label || d.type)}</td>
          <td><span class="dot ${stateOf(d.id)}"></span>${esc(d.host || "—")}</td>
          <td>${esc(d.room || "—")}</td>
          <td class="row-btns"><button class="icon-btn" data-dev-edit="${i}" title="Modifier">${icon("edit")}</button>
            <button class="icon-btn" data-dev-del="${i}" title="Supprimer">${icon("trash")}</button></td></tr>`;
      }).join("")}</tbody></table></div>
      <p class="muted small" style="margin-top:12px">Les mots de passe restent dans le fichier <code>.env</code> (jamais dans l'interface). Dans une URL tu peux écrire <code>\${CAMERA_PASSWORD}</code>.</p>
    </div>

    <div class="card span-2" id="tariff-card"></div>
    <div class="card span-2" id="scan-card"></div>

    <div class="card" id="settings-loc">
      <div class="card-head"><h2>Localisation</h2></div>
      <p class="muted small">Sert à la météo et aux automatisations au lever / coucher du soleil.</p>
      <div class="inline-form"><input class="input" id="city-q" placeholder="Ta ville" value="${esc(st.city || "")}">
        <button class="btn" id="city-search">Chercher</button></div>
      <div id="city-results" class="city-results"></div>
      <p class="small" id="city-current">${st.latitude != null ? `${icon("home")} ${esc(st.city || "")} <span class="muted">(${(+st.latitude).toFixed(3)}, ${(+st.longitude).toFixed(3)})</span>` : `<span class="muted">Aucune ville choisie.</span>`}</p>
    </div>

    <div class="card" id="settings-notif">
      <div class="card-head"><h2>Notifications sur le téléphone</h2></div>
      <p class="muted small"><b>ntfy</b> (gratuit, sans compte) : installe l'appli « ntfy » sur ton téléphone, abonne-toi à un sujet secret (ex. <code>maison-${Math.random().toString(36).slice(2, 8)}</code>) et recopie-le ici.</p>
      <label class="field-label">Serveur ntfy<input class="input" id="s-ntfy-server" value="${esc(st.ntfy_server || "")}"></label>
      <label class="field-label">Sujet ntfy<input class="input" id="s-ntfy-topic" value="${esc(st.ntfy_topic || "")}" placeholder="maison-xxxxxx"></label>
      <details class="small"><summary>Ou par Telegram</summary>
        <label class="field-label">Jeton du bot<input class="input" id="s-tg-token" value="${esc(st.telegram_token || "")}" autocomplete="off"></label>
        <label class="field-label">Identifiant de conversation (chat id)<input class="input" id="s-tg-chat" value="${esc(st.telegram_chat_id || "")}"></label>
      </details>
      <label class="switch-label" style="margin:14px 0"><span class="switch"><input type="checkbox" id="s-offline" ${st.notify_offline ? "checked" : ""}><i></i></span><span>Me prévenir quand un appareil se déconnecte</span></label>
      <div class="inline-form"><button class="btn primary" id="s-save">Enregistrer</button><button class="btn ghost" id="s-test">${icon("bell")}Envoyer un test</button></div>
    </div>

    <div class="card span-2" id="system-card"></div>
  </div>`;

  renderAccounts($("#accounts-card"));
  renderScanCard($("#scan-card"));
  renderTariffCard($("#tariff-card"));
  renderSystem($("#system-card"));
  $("#dev-add").addEventListener("click", () => editDevice(null));
  $$("[data-dev-edit]").forEach((b) => b.addEventListener("click", () => editDevice(+b.dataset.devEdit)));
  $$("[data-dev-del]").forEach((b) => b.addEventListener("click", () => {
    const d = SET.raw[+b.dataset.devDel];
    if (!confirm(`Supprimer « ${d.name} » ? Son historique de consommation est conservé.`)) return;
    saveDevices(SET.raw.filter((x) => x !== d), "Appareil supprimé");
  }));
  $("#city-search").addEventListener("click", searchCity);
  $("#city-q").addEventListener("keydown", (e) => e.key === "Enter" && searchCity());
  $("#s-save").addEventListener("click", saveNotifSettings);
  $("#s-test").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    await saveNotifSettings();
    btn.disabled = true;
    try {
      const r = await api("/api/settings/test-notification", { method: "POST" });
      toast(r.sent.length ? `Test envoyé via ${r.sent.join(" et ")}` : "Aucun canal configuré : test visible dans la cloche uniquement");
      refreshNotifications();
    } catch (err) { toast(err.message, true); }
    finally { btn.disabled = false; }
  });
}

async function searchCity() {
  const q = $("#city-q").value.trim();
  if (!q) return;
  const box = $("#city-results");
  box.innerHTML = `<p class="muted small">Recherche…</p>`;
  try {
    const res = await api(`/api/geocode?q=${encodeURIComponent(q)}`);
    box.innerHTML = res.map((c, i) => `<button class="city" data-i="${i}">${esc(c.name)} <span class="muted">${esc([c.region, c.country].filter(Boolean).join(", "))}</span></button>`).join("")
      || `<p class="muted small">Aucune ville trouvée.</p>`;
    $$(".city", box).forEach((b) => b.addEventListener("click", async () => {
      const c = res[+b.dataset.i];
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ city: c.name, latitude: c.latitude, longitude: c.longitude }) });
      toast(`Ville enregistrée : ${c.name}`);
      loadWeather();
      renderSettings();
    }));
  } catch (e) { box.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; }
}

async function saveNotifSettings() {
  try {
    SET.settings = await api("/api/settings", { method: "PUT", body: JSON.stringify({
      ntfy_server: $("#s-ntfy-server").value.trim() || "https://ntfy.sh",
      ntfy_topic: $("#s-ntfy-topic").value.trim(),
      telegram_token: $("#s-tg-token").value.trim(),
      telegram_chat_id: $("#s-tg-chat").value.trim(),
      notify_offline: $("#s-offline").checked,
    }) });
    toast("Notifications enregistrées");
  } catch (e) { toast(e.message, true); }
}

const slug = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 36) || "appareil";

// Identifiants de connexion par type d'appareil (enregistrés dans .env, communs à tous les appareils du type)
const CRED_FIELDS = {
  qnap: [["QNAP_USER", "Utilisateur"], ["QNAP_PASSWORD", "Mot de passe", true]],
  terramaster: [["TERRAMASTER_USER", "Utilisateur (compte administrateur TOS)"], ["TERRAMASTER_PASSWORD", "Mot de passe", true]],
  linux: [["LINUX_USER", "Utilisateur SSH"], ["LINUX_PASSWORD", "Mot de passe", true]],
  proxmox: [["PROXMOX_USER", "Utilisateur (ex. root@pam)"], ["PROXMOX_TOKEN_NAME", "Nom du jeton"], ["PROXMOX_TOKEN_VALUE", "Secret du jeton", true]],
  camera: [["CAMERA_USER", "Utilisateur"], ["CAMERA_PASSWORD", "Mot de passe", true]],
  tplink_switch: [["SWITCH_USER", "Utilisateur (admin par défaut)"], ["SWITCH_PASSWORD", "Mot de passe", true]],
  sfr_box: [["SFR_USER", "Utilisateur (admin par défaut)"], ["SFR_PASSWORD", "Mot de passe de l'interface de la box", true]],
  livebox: [["LIVEBOX_USER", "Utilisateur (admin par défaut)"], ["LIVEBOX_PASSWORD", "Mot de passe administrateur (souvent les 8 premiers caractères de la clé Wi-Fi d'origine)", true]],
};
const CRED_HELP = {
  terramaster: "Connexion SSH (port 9222) en lecture seule : le même compte administrateur que pour l'interface web de TOS.",
  qnap: "Le compte utilisé pour te connecter à l'interface web du QNAP (un compte en lecture seule suffit).",
  sfr_box: "Le mot de passe de l'interface de la box (http://192.168.10.1), indiqué sur l'étiquette sous la box s'il n'a pas été changé. Lecture seule.",
  livebox: "Le mot de passe d'administration de la Livebox. Lecture seule.",
  tplink_switch: "Le compte de l'interface web du switch. Lecture seule : connexion, lecture de l'état des ports, déconnexion immédiate (le switch n'accepte qu'une session à la fois).",
  proxmox: "Jeton API : Datacenter → Permissions → API Tokens (décocher « Privilege Separation » ou lui donner le rôle PVEAuditor).",
};

async function openDeviceEditor(id) {
  closeDrawer();
  try { SET.raw = await api("/api/devices/config"); } catch (e) { return toast(e.message, true); }
  const i = SET.raw.findIndex((x) => x.id === id);
  if (i < 0) return toast("Appareil introuvable", true);
  editDevice(i);
}

function credsHtml(type, others, isNew) {
  const fields = CRED_FIELDS[type];
  if (!fields) return "";
  return `<div class="cred-box"><b>${icon("lock")}Identifiants de connexion</b>
    <small class="muted">${esc(CRED_HELP[type] || "")} Enregistrés sur ce PC (fichier .env), communs à tous les appareils de ce type.</small>
    ${fields.map(([k, label, secret]) => `<label class="field-label">${label}<input class="input" data-cred="${k}" ${secret ? 'type="password" autocomplete="new-password"' : 'autocomplete="off"'}
      ${secret ? `placeholder="${others[k] ? "•••••••• (inchangé)" : ""}"` : `value="${esc(others[k] || "")}" placeholder="${/^(SWITCH|SFR|LIVEBOX)_USER$/.test(k) ? "admin" : ""}"`}></label>`).join("")}
    ${isNew ? "" : `<button type="button" class="btn small-btn" id="d-test">${icon("refresh")}Tester la connexion</button>`}
    <div id="d-test-res"></div></div>`;
}

async function saveCreds() {
  const body = {};
  $$("[data-cred]").forEach((el) => { if (el.value.trim()) body[el.dataset.cred] = el.value.trim(); });
  if (!Object.keys(body).length) return;
  await api("/api/accounts/others", { method: "PUT", body: JSON.stringify(body) });
}

async function editDevice(index) {
  let others = {};
  try { others = (await api("/api/accounts")).others || {}; } catch {}
  const orig = index == null ? null : SET.raw[index];
  const draft = orig ? { ...orig } : { type: "tapo_plug", name: "", floor: S.cfg.floors[0]?.id, room: S.cfg.floors[0]?.rooms[0]?.name };
  const render = () => {
    const floor = S.cfg.floors.find((f) => f.id === draft.floor) || S.cfg.floors[0];
    const info = TYPE_INFO[draft.type] || { fields: [] };
    $("#modal-body").innerHTML = `
      <label class="field-label">Type<select class="select" id="d-type" ${orig ? "disabled" : ""}>${Object.entries(TYPE_INFO).map(([k, t]) => `<option value="${k}" ${k === draft.type ? "selected" : ""}>${t.label}</option>`).join("")}</select></label>
      <label class="field-label">Nom<input class="input" id="d-name" value="${esc(draft.name)}" placeholder="Ex. : Prise lave-linge"></label>
      <div class="two-cols">
        <label class="field-label">Étage<select class="select" id="d-floor">${S.cfg.floors.map((f) => `<option value="${f.id}" ${f.id === draft.floor ? "selected" : ""}>${esc(f.name)}</option>`).join("")}</select></label>
        <label class="field-label">Pièce<select class="select" id="d-room">${(floor?.rooms || []).map((r) => `<option ${r.name === draft.room ? "selected" : ""}>${esc(r.name)}</option>`).join("")}</select></label>
      </div>
      ${info.fields.map((k) => {
        const f = FIELD_DEF[k];
        if (f.type === "checkbox") return `<label class="switch-label" style="margin:6px 0 12px"><span class="switch"><input type="checkbox" data-k="${k}" ${draft[k] ? "checked" : ""}><i></i></span><span>${f.label}</span></label>`;
        if (f.type === "select") return `<label class="field-label">${f.label}<select class="select" data-k="${k}">${f.options.map(([v, l]) => `<option value="${v}" ${v === (draft[k] || f.options[0][0]) ? "selected" : ""}>${l}</option>`).join("")}</select></label>`;
        return `<label class="field-label">${f.label}<input class="input" data-k="${k}" ${f.type === "number" ? 'type="number"' : ""} value="${esc(draft[k] ?? "")}" placeholder="${esc(f.ph || "")}"></label>`;
      }).join("")}
      ${credsHtml(draft.type, others, !orig)}
      ${orig ? `<p class="muted small">Identifiant : <code>${esc(orig.id)}</code></p>` : ""}`;
    $("#d-test")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget, res = $("#d-test-res");
      btn.disabled = true;
      res.innerHTML = `<p class="muted small"><span class="spinner"></span>Connexion en cours…</p>`;
      try {
        await saveCreds();
        const st = await api(`/api/devices/${orig.id}/refresh`, { method: "POST" });
        S.state[orig.id] = st;
        res.innerHTML = st.error ? `<div class="error-box">${esc(st.error)}</div>`
          : st.metrics ? `<div class="ok-box">${icon("shield")}Connexion réussie : ${esc(st.summary)}</div>`
          : `<div class="demo-box">${icon("lock")}<div>${esc(st.hint || st.summary || "Pas de statistiques")}</div></div>`;
        $$("[data-cred]").forEach((el) => { if (el.type === "password" && el.value) { el.value = ""; el.placeholder = "•••••••• (inchangé)"; } });
        renderAll();
      } catch (err) { res.innerHTML = `<div class="error-box">${esc(err.message)}</div>`; }
      btn.disabled = false;
    });
    const keep = () => {
      draft.name = $("#d-name").value;
      $$("[data-k]").forEach((el) => {
        const f = FIELD_DEF[el.dataset.k];
        draft[el.dataset.k] = f.type === "checkbox" ? el.checked : f.type === "number" ? (el.value === "" ? undefined : Number(el.value)) : el.value.trim();
      });
      draft.floor = $("#d-floor").value;
      draft.room = $("#d-room").value;
    };
    const macInput = $("[data-k=mac]");
    if (macInput) {
      macInput.insertAdjacentHTML("afterend", `<button type="button" class="btn small-btn ghost mac-find">${icon("refresh")}Trouver l'adresse MAC (appareil allumé)</button>`);
      $(".mac-find").addEventListener("click", async (e) => {
        const ip = ($("[data-k=host]")?.value || "").trim();
        if (!ip) return toast("Indique d'abord l'adresse IP", true);
        e.currentTarget.disabled = true;
        try { const r = await api(`/api/mac?ip=${encodeURIComponent(ip)}`); macInput.value = r.mac; toast(`Adresse MAC trouvée : ${r.mac}`); }
        catch (err) { toast(err.message, true); }
        e.target.disabled = false;
      });
    }
    $("#d-type").addEventListener("change", (e) => { keep(); draft.type = e.target.value; render(); });
    $("#d-floor").addEventListener("change", () => { keep(); draft.room = undefined; render(); });
    draft._keep = keep;
  };
  openModal(orig ? `Modifier « ${orig.name} »` : "Ajouter un appareil", "", [
    { label: "Annuler", cls: "ghost", onClick: closeModal },
    { label: "Enregistrer", cls: "primary", onClick: async (btn) => {
      draft._keep();
      const d = { ...draft };
      delete d._keep;
      d.name = d.name.trim();
      if (!d.name) return toast("Donne un nom à l'appareil", true);
      if ((TYPE_INFO[d.type].fields.includes("host")) && !d.host) return toast("L'adresse IP est nécessaire", true);
      if (!orig) {
        let id = slug(d.name), n = 2;
        while (SET.raw.some((x) => x.id === id)) id = `${slug(d.name)}_${n++}`;
        d.id = id;
      }
      for (const k of Object.keys(d)) if (d[k] === undefined || d[k] === "" || d[k] === false) delete d[k];
      const list = orig ? SET.raw.map((x) => (x === orig ? d : x)) : [...SET.raw, d];
      btn.disabled = true;
      try { await saveCreds(); } catch (e) { btn.disabled = false; return toast(e.message, true); }
      if (await saveDevices(list, orig ? "Appareil modifié" : "Appareil ajouté")) closeModal();
      btn.disabled = false;
    } },
  ]);
  render();
}

async function saveDevices(list, msg) {
  try {
    await api("/api/devices/config", { method: "PUT", body: JSON.stringify(list) });
  } catch (e) { toast(e.message, true); return false; }
  toast(msg);
  await reloadConfig();
  renderSettings();
  return true;
}

async function reloadConfig() {
  S.cfg = await api("/api/config");
  S.layout = S.cfg.layout || {};
  renderPlan();
  await refreshState();
}


// ------------------------------------------------------------------ tarif électricité (Base / HP-HC)
function renderTariffCard(box) {
  const t = structuredClone(S.cfg.tariff || { mode: "base", price_base: S.cfg.price_per_kwh, hc_ranges: [["22:00", "06:00"]] });
  if (!t.hc_ranges?.length) t.hc_ranges = [["22:00", "06:00"]];
  const draw = () => {
    const now = tariffNow();
    box.innerHTML = `<div class="card-head"><h2>${icon("bolt")} Tarif électricité</h2>
        ${now ? `<span class="tariff-pill ${now.hc ? "hc" : "hp"}">${now.hc ? "Heures creuses" : "Heures pleines"} jusqu'à ${now.until}</span>` : ""}</div>
      <div class="seg" id="tf-mode"><button data-m="base" class="${t.mode !== "hphc" ? "active" : ""}">Base (prix unique)</button>
        <button data-m="hphc" class="${t.mode === "hphc" ? "active" : ""}">Heures pleines / heures creuses</button></div>
      <div class="tariff-grid">
        ${t.mode === "hphc" ? `
          <label class="field-label">Prix heures pleines (€/kWh TTC)<input class="input" type="number" step="0.0001" id="tf-hp" value="${t.price_hp ?? ""}" placeholder="ex. 0,2700"></label>
          <label class="field-label">Prix heures creuses (€/kWh TTC)<input class="input" type="number" step="0.0001" id="tf-hc" value="${t.price_hc ?? ""}" placeholder="ex. 0,2068"></label>
          <div class="field-label span-all">Plages d'heures creuses (indiquées sur ta facture ou ton espace client)
            <div class="hc-ranges">${t.hc_ranges.map(([a, b], i) => `<div class="hc-range">
              <input class="input" type="time" data-r="${i}" data-k="0" value="${a}"><span>→</span><input class="input" type="time" data-r="${i}" data-k="1" value="${b}">
              ${t.hc_ranges.length > 1 ? `<button class="icon-btn" data-del="${i}" title="Retirer">${icon("trash")}</button>` : ""}</div>`).join("")}
              ${t.hc_ranges.length < 4 ? `<button class="btn ghost small-btn" id="tf-add">${icon("plus")}Ajouter une plage</button>` : ""}</div></div>`
        : `<label class="field-label">Prix du kWh (€/kWh TTC)<input class="input" type="number" step="0.0001" id="tf-base" value="${t.price_base ?? ""}"></label>`}
      </div>
      <div class="inline-form"><button class="btn primary" id="tf-save">Enregistrer</button>
        <span class="muted small">L'historique déjà archivé est recalculé avec ces heures.</span></div>`;
    const keep = () => {
      if ($("#tf-hp")) { t.price_hp = $("#tf-hp").value === "" ? null : +$("#tf-hp").value; t.price_hc = $("#tf-hc").value === "" ? null : +$("#tf-hc").value; }
      if ($("#tf-base")) t.price_base = $("#tf-base").value === "" ? null : +$("#tf-base").value;
      $$("[data-r]", box).forEach((el) => { t.hc_ranges[+el.dataset.r][+el.dataset.k] = el.value; });
    };
    $$("#tf-mode button", box).forEach((b) => b.addEventListener("click", () => { keep(); t.mode = b.dataset.m; draw(); }));
    $("#tf-add")?.addEventListener("click", () => { keep(); t.hc_ranges.push(["12:00", "14:00"]); draw(); });
    $$("[data-del]", box).forEach((b) => b.addEventListener("click", () => { keep(); t.hc_ranges.splice(+b.dataset.del, 1); draw(); }));
    $("#tf-save").addEventListener("click", async (e) => {
      keep();
      if (t.mode === "hphc" && (t.price_hp == null || t.price_hc == null)) return toast("Indique les deux prix (heures pleines et creuses)", true);
      e.currentTarget.disabled = true;
      try {
        const r = await api("/api/tariff", { method: "PUT", body: JSON.stringify(t) });
        S.cfg.tariff = r;
        toast(`Tarif enregistré${r.recomputed_days ? ` — ${r.recomputed_days} jour(s) d'historique recalculé(s)` : ""}`);
        await refreshDaily();
        renderKpis();
        draw();
      } catch (err) { toast(err.message, true); e.target.disabled = false; }
    });
  };
  draw();
}
