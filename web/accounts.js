"use strict";
// Paramètres → Comptes connectés : tado° (connexion sur le site tado), Tapo (+ recherche), Verisure (+ code)

const ACC = { data: null, timer: null };

async function renderAccounts(box) {
  try { ACC.data = await api("/api/accounts"); } catch (e) { box.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; return; }
  const { tapo, tado, verisure } = ACC.data;
  box.innerHTML = `
    <div class="card-head"><h2>Comptes connectés</h2></div>
    <div class="acc-grid">

      <div class="acc ${tado.connected ? "ok" : ""}">
        <div class="acc-head"><span class="acc-logo tado">tado°</span><div><b>tado°</b><small>${tado.connected ? `Connecté${tado.email ? " · " + esc(tado.email) : ""}` : "Non connecté"}</small></div>
          ${tado.connected ? `<span class="pill on">Connecté</span>` : ""}</div>
        <div id="tado-body">${tadoBody(tado)}</div>
      </div>

      <div class="acc ${tapo.has_password ? "ok" : ""}">
        <div class="acc-head"><span class="acc-logo tapo">tapo</span><div><b>Tapo (TP-Link)</b><small>${tapo.email ? esc(tapo.email) : "Non configuré"}</small></div>
          ${tapo.has_password ? `<span class="pill on">Enregistré</span>` : ""}</div>
        <p class="muted small">Le même compte que dans l'appli Tapo. Les prises sont ensuite pilotées <b>directement sur ton Wi-Fi</b>.
          Dans l'appli Tapo, active <i>Moi → Services tiers → Compatibilité tiers</i>, sinon elles refusent la connexion.</p>
        <label class="field-label">E-mail<input class="input" id="tapo-user" autocomplete="username" placeholder="ton@email.fr"></label>
        <label class="field-label">Mot de passe<input class="input" id="tapo-pass" type="password" autocomplete="current-password" placeholder="${tapo.has_password ? "•••••••• (inchangé)" : ""}"></label>
        <div class="inline-form"><button class="btn primary" id="tapo-save">Enregistrer</button>
          <button class="btn" id="tapo-scan" ${tapo.has_password ? "" : "disabled"}>${icon("refresh")}Rechercher mes appareils</button></div>
        <div id="tapo-results"></div>
      </div>

      <div class="acc ${verisure.trusted ? "ok" : ""}">
        <div class="acc-head"><span class="acc-logo verisure">V</span><div><b>Verisure</b><small>${verisure.email ? esc(verisure.email) : "Non configuré"}</small></div>
          ${verisure.trusted ? `<span class="pill on">Connecté</span>` : ""}</div>
        <p class="muted small">Le compte de l'appli « My Verisure ». Si un code t'est envoyé par SMS ou e-mail, saisis-le ici : l'appareil sera ensuite reconnu.</p>
        <label class="field-label">E-mail<input class="input" id="vs-user" autocomplete="username"></label>
        <label class="field-label">Mot de passe<input class="input" id="vs-pass" type="password" autocomplete="current-password" placeholder="${verisure.has_password ? "•••••••• (inchangé)" : ""}"></label>
        <div id="vs-mfa" ${verisure.mfa_pending ? "" : "hidden"}><label class="field-label">Code reçu<input class="input" id="vs-code" inputmode="numeric" autocomplete="one-time-code"></label></div>
        <div class="inline-form"><button class="btn primary" id="vs-save">Se connecter</button>
          <button class="btn" id="vs-validate" ${verisure.mfa_pending ? "" : "hidden"}>Valider le code</button></div>
      </div>
    </div>
    <div class="acc ${ACC.data.hon?.has_password ? "ok" : ""}" style="margin-top:14px">
      <div class="acc-head"><span class="acc-logo" style="background:#00a1e4">hOn</span><div><b>hOn (Candy, Haier, Hoover)</b><small>${ACC.data.hon?.email ? esc(ACC.data.hon.email) : "Non configuré"}</small></div>
        ${ACC.data.hon?.has_password ? `<span class="pill on">Enregistré</span>` : ""}</div>
      <p class="muted small">Le compte de l'appli <b>hOn</b> (lave-linge Candy connecté). Les machines récentes n'ont pas d'accès local : tout passe par ce compte.</p>
      <div class="two-cols"><label class="field-label">E-mail<input class="input" id="hon-user" autocomplete="username"></label>
        <label class="field-label">Mot de passe<input class="input" id="hon-pass" type="password" autocomplete="current-password" placeholder="${ACC.data.hon?.has_password ? "•••••••• (inchangé)" : ""}"></label></div>
      <div class="inline-form"><button class="btn primary" id="hon-save">Se connecter et rechercher mes appareils</button></div>
      <div id="hon-results"></div>
    </div>
    <div class="acc others">
      <div class="acc-head"><span class="acc-logo misc">${icon("nas")}</span><div><b>NAS QNAP, Proxmox et caméras</b><small>Identifiants locaux (restent sur ce PC, dans .env)</small></div></div>
      <div class="others-grid">
        <div><b class="small">NAS QNAP</b>
          <label class="field-label">Utilisateur<input class="input" data-env="QNAP_USER" value="${esc(ACC.data.others.QNAP_USER)}"></label>
          <label class="field-label">Mot de passe<input class="input" type="password" data-env="QNAP_PASSWORD" placeholder="${ACC.data.others.QNAP_PASSWORD ? "•••••••• (inchangé)" : ""}" autocomplete="new-password"></label></div>
        <div><b class="small">NAS TerraMaster (SSH)</b> <span class="muted small">— compte admin de TOS</span>
          <label class="field-label">Utilisateur<input class="input" data-env="TERRAMASTER_USER" value="${esc(ACC.data.others.TERRAMASTER_USER)}"></label>
          <label class="field-label">Mot de passe<input class="input" type="password" data-env="TERRAMASTER_PASSWORD" placeholder="${ACC.data.others.TERRAMASTER_PASSWORD ? "•••••••• (inchangé)" : ""}" autocomplete="new-password"></label></div>
        <div><b class="small">Serveurs Linux (SSH)</b>
          <label class="field-label">Utilisateur<input class="input" data-env="LINUX_USER" value="${esc(ACC.data.others.LINUX_USER)}"></label>
          <label class="field-label">Mot de passe<input class="input" type="password" data-env="LINUX_PASSWORD" placeholder="${ACC.data.others.LINUX_PASSWORD ? "•••••••• (inchangé)" : ""}" autocomplete="new-password"></label></div>
        <div><b class="small">Proxmox</b> <span class="muted small">— jeton : Datacenter → Permissions → API Tokens</span>
          <label class="field-label">Utilisateur<input class="input" data-env="PROXMOX_USER" value="${esc(ACC.data.others.PROXMOX_USER)}" placeholder="root@pam"></label>
          <div class="two-cols"><label class="field-label">Nom du jeton<input class="input" data-env="PROXMOX_TOKEN_NAME" value="${esc(ACC.data.others.PROXMOX_TOKEN_NAME)}"></label>
          <label class="field-label">Secret du jeton<input class="input" type="password" data-env="PROXMOX_TOKEN_VALUE" placeholder="${ACC.data.others.PROXMOX_TOKEN_VALUE ? "•••••••• (inchangé)" : ""}" autocomplete="new-password"></label></div></div>
        <div><b class="small">Caméras</b>
          <label class="field-label">Utilisateur<input class="input" data-env="CAMERA_USER" value="${esc(ACC.data.others.CAMERA_USER)}"></label>
          <label class="field-label">Mot de passe<input class="input" type="password" data-env="CAMERA_PASSWORD" placeholder="${ACC.data.others.CAMERA_PASSWORD ? "•••••••• (inchangé)" : ""}" autocomplete="new-password"></label></div>
      </div>
      <div class="inline-form"><button class="btn primary" id="others-save">Enregistrer</button></div>
    </div>`;
  $("#hon-save").addEventListener("click", async (e) => {
    const btn = e.currentTarget, username = $("#hon-user").value.trim();
    if (!username) return toast("Saisis l'e-mail de ton compte hOn", true);
    btn.disabled = true;
    const res = $("#hon-results");
    res.innerHTML = `<p class="muted small"><span class="spinner"></span>Connexion à hOn…</p>`;
    try {
      const found = await api("/api/accounts/hon", { method: "PUT", body: JSON.stringify({ username, password: $("#hon-pass").value }) });
      foundList(res, found.map((a) => ({ key: a.mac, title: a.name, sub: [a.brand, a.model, a.type, a.mac].filter(Boolean).join(" · "),
        configured: a.configured_as, icon: "washer", device: { type: "hon", name: a.name, mac: a.mac } })), "Aucun appareil sur ce compte hOn.");
    } catch (err) { res.innerHTML = `<div class="error-box">${esc(err.message)}</div>`; }
    btn.disabled = false;
  });
  $("#others-save").addEventListener("click", async () => {
    const body = {};
    $$("[data-env]", box).forEach((el) => { body[el.dataset.env] = el.value; });
    try { await api("/api/accounts/others", { method: "PUT", body: JSON.stringify(body) }); toast("Identifiants enregistrés"); renderAccounts(box); }
    catch (err) { toast(err.message, true); }
  });

  bindTado();
  $("#tapo-save").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const username = $("#tapo-user").value.trim() || (ACC.data.tapo.email.includes("•") ? null : ACC.data.tapo.email);
    if (!username) return toast("Saisis l'e-mail de ton compte Tapo", true);
    btn.disabled = true;
    try {
      await api("/api/accounts/tapo", { method: "PUT", body: JSON.stringify({ username, password: $("#tapo-pass").value }) });
      toast("Compte Tapo enregistré");
      await renderAccounts(box);
      $("#tapo-scan").click();
    } catch (err) { toast(err.message, true); btn.disabled = false; }
  });
  $("#tapo-scan").addEventListener("click", scanTapo);
  $("#vs-save").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    const username = $("#vs-user").value.trim();
    if (!username) return toast("Saisis l'e-mail de ton compte Verisure", true);
    btn.disabled = true;
    try {
      const r = await api("/api/accounts/verisure", { method: "PUT", body: JSON.stringify({ username, password: $("#vs-pass").value }) });
      if (r.mfa) { $("#vs-mfa").hidden = false; $("#vs-validate").hidden = false; toast("Un code t'a été envoyé par Verisure"); $("#vs-code").focus(); }
      else { toast("Verisure connecté"); renderAccounts(box); }
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  });
  $("#vs-validate").addEventListener("click", async () => {
    try {
      await api("/api/accounts/verisure/mfa", { method: "POST", body: JSON.stringify({ code: $("#vs-code").value }) });
      toast("Verisure connecté");
      renderAccounts(box);
    } catch (err) { toast(err.message, true); }
  });
}

// ------------------------------------------------------------------ tado°
function tadoBody(t) {
  if (t.pending) {
    return `<div class="tado-login">
      <p class="small">1. Ouvre la page de connexion tado° et connecte-toi avec ton compte.<br>2. Vérifie que le code affiché est bien :</p>
      <div class="user-code">${esc(t.user_code)}</div>
      <a class="btn primary full" href="${esc(t.url)}" target="_blank" rel="noopener">${icon("external")}Ouvrir la connexion tado°</a>
      <p class="muted small waiting"><span class="spinner"></span>En attente de ta connexion sur le site tado°…</p></div>`;
  }
  if (!t.connected) {
    return `<p class="muted small">La connexion se fait <b>sur le site officiel de tado°</b> : ton mot de passe n'est jamais saisi ici.</p>
      ${t.error ? `<div class="error-box">${esc(t.error)}</div>` : ""}
      <button class="btn primary" id="tado-login">${icon("external")}Se connecter à tado°</button>`;
  }
  return `<p class="muted small">Logement : ${esc(t.homes.join(", ") || "—")}</p>
    <label class="field-label">Actualisation<select class="select" id="tado-poll">
      ${[[300, "Toutes les 5 min"], [600, "Toutes les 10 min"], [900, "Toutes les 15 min (conseillé)"], [1800, "Toutes les 30 min"]]
        .map(([v, l]) => `<option value="${v}" ${v === t.poll_seconds ? "selected" : ""}>${l}</option>`).join("")}</select></label>
    <p class="muted small">tado° limite le nombre d'appels par jour (100 sans abonnement Auto-Assist). L'actualisation s'espace d'elle-même pour ne jamais dépasser le quota, en gardant une réserve pour tes commandes.</p>
    ${t.quota?.remaining != null ? `<p class="small">Appels restants aujourd'hui : <b>${t.quota.remaining}${t.quota.limit ? " / " + t.quota.limit : ""}</b>
      ${t.quota.reset_at ? ` · remise à zéro à ${new Date(t.quota.reset_at * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}` : ""}
      · actualisation réelle : toutes les ${Math.round(t.effective_interval / 60)} min</p>` : ""}
    ${t.blocked_until ? `<div class="error-box">Quota atteint : appels suspendus jusqu'à ${new Date(t.blocked_until * 1000).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}. Le dernier état connu reste affiché.</div>` : ""}
    <div class="inline-form"><button class="btn" id="tado-zones">${icon("refresh")}Rechercher mes pièces</button>
      <button class="btn ghost danger" id="tado-logout">Déconnecter</button></div>
    <div id="tado-results"></div>`;
}

function bindTado() {
  clearInterval(ACC.timer);
  const t = ACC.data.tado;
  $("#tado-login")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try {
      const r = await api("/api/accounts/tado/login", { method: "POST" });
      window.open(r.url, "_blank", "noopener");
      await refreshTado();
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
  $("#tado-logout")?.addEventListener("click", async () => {
    if (!confirm("Déconnecter le compte tado° ?")) return;
    await api("/api/accounts/tado/logout", { method: "POST" });
    refreshTado();
  });
  $("#tado-poll")?.addEventListener("change", async (e) => {
    await api("/api/accounts/tado/settings", { method: "PUT", body: JSON.stringify({ poll_seconds: +e.target.value }) });
    toast("Fréquence d'actualisation enregistrée");
  });
  $("#tado-zones")?.addEventListener("click", scanTado);
  if (t.pending) ACC.timer = setInterval(refreshTado, 3000);
}

async function refreshTado() {
  const was = ACC.data?.tado?.pending;
  try { ACC.data = await api("/api/accounts"); } catch { return; }
  const body = $("#tado-body");
  if (!body) return clearInterval(ACC.timer);
  body.innerHTML = tadoBody(ACC.data.tado);
  bindTado();
  if (was && ACC.data.tado.connected) {
    toast("tado° connecté 🎉");
    const acc = body.closest(".acc");
    acc.classList.add("ok");
    acc.querySelector("small").textContent = "Connecté" + (ACC.data.tado.email ? " · " + ACC.data.tado.email : "");
    scanTado();
  }
}

async function scanTado() {
  const box = $("#tado-results");
  box.innerHTML = `<p class="muted small"><span class="spinner"></span>Recherche des pièces…</p>`;
  let zones;
  try { zones = await api("/api/accounts/tado/zones"); } catch (e) { box.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; return; }
  const ZT = { HEATING: ["Chauffage", "flame"], AIR_CONDITIONING: ["Climatisation", "snow"], HOT_WATER: ["Eau chaude", "drop"] };
  foundList(box, zones.map((z) => ({
    key: `${z.home_id}-${z.zone_id}`, title: z.name, sub: `${ZT[z.zone_type]?.[0] || z.zone_type} · ${z.home}`,
    configured: z.configured_as, icon: z.zone_type === "AIR_CONDITIONING" ? "snow" : "thermo",
    device: { type: "tado", name: z.name, home_id: z.home_id, zone_id: z.zone_id, zone_type: z.zone_type },
  })), "Aucune pièce tado° trouvée.");
}

// ------------------------------------------------------------------ Tapo
async function scanTapo() {
  const box = $("#tapo-results");
  box.innerHTML = `<p class="muted small"><span class="spinner"></span>Recherche sur le réseau Wi-Fi (quelques secondes)…</p>`;
  let found;
  try { found = await api("/api/accounts/tapo/discover", { method: "POST" }); } catch (e) { box.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; return; }
  foundList(box, found.map((f) => ({
    key: f.host, title: f.alias || f.model, sub: `${f.model} · ${f.host}${f.energy ? " · mesure la consommation" : ""}`,
    configured: f.configured_as, icon: f.type === "tapo_bulb" ? "bulb" : "plug", note: f.note,
    device: f.type ? { type: f.type, name: f.alias || f.model, host: f.host } : null,
  })), "Aucun appareil Tapo trouvé. Vérifie que ce PC est sur le même Wi-Fi que tes prises.",
  found.some((f) => f.auth_error) ? "Certains appareils refusent tes identifiants : vérifie le mot de passe et la « Compatibilité tiers » dans l'appli Tapo." : "");
}

// ------------------------------------------------------------------ liste « trouvés → ajouter »
const CLIMATE_TYPES = ["tado", "tapo_clim"];

function replaceSelect(dev, n) {
  const same = (S.cfg.devices || []).filter((d) => d.type === dev.type || (CLIMATE_TYPES.includes(d.type) && CLIMATE_TYPES.includes(dev.type)));
  if (!same.length) return "";
  return `<select class="select small-select" data-replace="${n}" title="Ajouter comme nouvel appareil ou remplacer un appareil existant">
    <option value="">Nouvel appareil</option>${same.map((d) => `<option value="${esc(d.id)}">Remplace « ${esc(d.name)} »</option>`).join("")}</select>`;
}
function foundList(box, items, emptyMsg, warning = "") {
  if (!items.length) { box.innerHTML = `<p class="muted small">${emptyMsg}</p>`; return; }
  const addable = items.filter((i) => i.device && !i.configured);
  box.innerHTML = `${warning ? `<div class="error-box">${esc(warning)}</div>` : ""}
    <div class="found-list">${items.map((i, n) => `<div class="found">
      <span class="mini-ico" style="--c:var(--accent)">${icon(i.icon)}</span>
      <div class="found-txt"><b>${esc(i.title)}</b><small>${esc(i.sub)}${i.note ? " · " + esc(i.note) : ""}</small></div>
      ${i.configured ? `<span class="pill on">Déjà ajouté</span>` : i.device ? `${replaceSelect(i.device, n)}<button class="btn small-btn" data-found="${n}">${icon("plus")}Ajouter</button>` : ""}
    </div>`).join("")}</div>
    ${addable.length > 1 ? `<button class="btn primary small-btn" data-found-all>${icon("plus")}Tout ajouter (${addable.length})</button>` : ""}`;
  const add = async (list) => {
    const raw = await api("/api/devices/config");
    const floor = S.cfg.floors[0];
    for (const it of list) {
      const target = it._replace && raw.find((x) => x.id === it._replace);
      if (target) {
        const { name, ...fields } = it.device;
        const keep = { id: target.id, name: target.name, floor: target.floor, room: target.room };
        raw[raw.indexOf(target)] = fields.type === target.type ? { ...target, ...fields } : { ...keep, ...fields };
        continue;
      }
      let id = slug(it.device.name), k = 2;
      while (raw.some((x) => x.id === id)) id = `${slug(it.device.name)}_${k++}`;
      raw.push({ id, ...it.device, floor: floor?.id, room: floor?.rooms?.[0]?.name });
    }
    SET.raw = raw;
    await saveDevices(raw, list.length > 1 ? `${list.length} appareils ajoutés` : "Appareil ajouté — place-le sur le plan avec « Déplacer »");
    if (S.cfg.demo) setTimeout(goReal, 600); // un vrai appareil ajouté en mode démo ne serait que simulé
  };
  $$("[data-replace]", box).forEach((sel) => sel.addEventListener("change", () => {
    items[+sel.dataset.replace]._replace = sel.value || null;
    box.querySelector(`[data-found="${sel.dataset.replace}"]`).innerHTML = sel.value ? `${icon("refresh")}Remplacer` : `${icon("plus")}Ajouter`;
  }));
  $$("[data-found]", box).forEach((b) => b.addEventListener("click", () => add([items[+b.dataset.found]])));
  $("[data-found-all]", box)?.addEventListener("click", () => add(addable));
}
