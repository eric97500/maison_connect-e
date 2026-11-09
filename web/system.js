"use strict";
// Mise en service (assistant), carte Système et recherche des appareils sur le réseau

// ------------------------------------------------------------------ assistant de mise en service
async function renderSetup() {
  const box = $("#setup-card");
  if (!box) return;
  let sys, acc, st;
  try { [sys, acc, st] = await Promise.all([api("/api/system"), api("/api/accounts"), api("/api/settings")]); } catch { return; }
  const steps = [
    ["accounts-card", "Connecter le compte tado°", acc.tado.connected],
    ["accounts-card", "Compte Tapo et recherche des prises / ampoules", acc.tapo.has_password],
    ["accounts-card", "Connecter l'alarme Verisure", acc.verisure.trusted],
    ["scan-card", "Trouver NAS, Proxmox, imprimante, caméras, PC", st.network_scanned],
    ["settings-loc", "Choisir ta ville (météo, soleil)", st.latitude != null],
    ["settings-notif", "Recevoir les notifications sur le téléphone", !!(st.ntfy_topic || st.telegram_chat_id)],
    ["system-card", "Protéger l'interface par un mot de passe", sys.password],
    ["system-card", "Démarrage automatique", !sys.autostart.supported || sys.autostart.enabled],
    ["system-card", "Passer en mode réel", !sys.demo],
  ];
  const done = steps.filter((s) => s[2]).length;
  let hidden = false;
  try { hidden = localStorage.getItem("setup-hidden") === "1"; } catch {}
  if (done === steps.length || hidden) { box.innerHTML = ""; return; }
  box.innerHTML = `<div class="card setup">
    <div class="card-head"><div><h2>Mise en service</h2><p class="muted small">${done} étape(s) sur ${steps.length} — clique sur une étape pour la faire.</p></div>
      <button class="btn ghost small-btn" id="setup-hide">Masquer</button></div>
    <div class="bar"><div style="width:${(100 * done) / steps.length}%"></div></div>
    <div class="setup-steps">${steps.map(([target, label, ok], i) => `<button class="setup-step ${ok ? "ok" : ""}" data-goto="${target}">
      <span class="check">${ok ? "✓" : i + 1}</span>${esc(label)}</button>`).join("")}</div></div>`;
  $("#setup-hide").addEventListener("click", () => { try { localStorage.setItem("setup-hidden", "1"); } catch {} box.innerHTML = ""; });
  $$("[data-goto]", box).forEach((b) => b.addEventListener("click", async () => {
    showView("settings");
    for (let i = 0; i < 20 && !document.getElementById(b.dataset.goto); i++) await new Promise((r) => setTimeout(r, 100));
    document.getElementById(b.dataset.goto)?.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

// ------------------------------------------------------------------ carte Système
function fmtDuration(s) {
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} j ${h} h` : h ? `${h} h ${m} min` : `${m} min`;
}

async function renderSystem(box) {
  let sys;
  try { sys = await api("/api/system"); } catch (e) { box.innerHTML = `<div class="error-box">${esc(e.message)}</div>`; return; }
  box.innerHTML = `
    <div class="card-head"><h2>Système</h2><span class="muted small">Version ${esc(sys.version)} · démarré depuis ${fmtDuration(sys.uptime)}</span></div>
    <div class="sys-grid">
      <div class="sys-item">
        <div><b>Mode réel</b><small>${sys.demo ? "Actuellement en démo : les appareils sont simulés." : "Les vrais appareils sont pilotés."}</small></div>
        <label class="switch"><input type="checkbox" id="sys-real" ${sys.demo ? "" : "checked"}><i></i></label></div>
      <div class="sys-item">
        <div><b>Démarrage automatique</b><small>${sys.autostart.supported ? "Lance Maison connectée à l'ouverture de ta session Windows, en arrière-plan." : esc(sys.autostart.hint)}</small></div>
        ${sys.autostart.supported ? `<label class="switch"><input type="checkbox" id="sys-auto" ${sys.autostart.enabled ? "checked" : ""}><i></i></label>` : ""}</div>
      <div class="sys-item col">
        <div><b>Mot de passe de l'interface</b><small>${sys.password ? "Activé : il est demandé à l'ouverture (identifiant libre)." : "Aucun : toute personne sur ton Wi-Fi peut ouvrir le tableau de bord."}</small></div>
        <div class="inline-form"><input class="input" type="password" id="sys-pw" placeholder="${sys.password ? "Nouveau mot de passe" : "6 caractères minimum"}" autocomplete="new-password">
          <button class="btn" id="sys-pw-save">${sys.password ? "Changer" : "Activer"}</button>
          ${sys.password ? `<button class="btn ghost danger" id="sys-pw-del">Retirer</button>` : ""}</div></div>
      <div class="sys-item col">
        <div><b>Sauvegardes</b><small>Automatique chaque nuit en mode réel (7 gardées). Le fichier <code>.env</code> (mots de passe) n'est pas inclus : garde-le de côté.</small></div>
        <div class="inline-form"><button class="btn primary" id="sys-backup">${icon("external")}Télécharger une sauvegarde</button>
          <label class="btn ghost">Restaurer…<input type="file" id="sys-restore" accept=".zip" hidden></label></div>
        ${sys.backups.length ? `<div class="backup-list">${sys.backups.slice(0, 5).map((b) => `<a href="/api/system/backups/${encodeURIComponent(b.name)}">${esc(b.name)}</a><span class="muted small">${(b.size / 1024).toFixed(0)} Ko</span>`).join("")}</div>` : ""}</div>
    </div>
    <table class="kv" style="margin-top:14px">
      <tr><td>Appareils</td><td>${sys.devices} configurés · ${sys.online} en ligne</td></tr>
      <tr><td>Caméras (ffmpeg)</td><td>${sys.ffmpeg ? `<span class="pill on">Installé</span>` : `<span class="pill warn">Absent</span> — nécessaire pour les flux RTSP : <a href="https://www.gyan.dev/ffmpeg/builds/" target="_blank" rel="noopener">télécharger ffmpeg</a> et l'ajouter au PATH`}</td></tr>
      <tr><td>Système</td><td>${esc(sys.os)} · Python ${esc(sys.python)}</td></tr>
      <tr><td>Accès depuis le téléphone</td><td><code>${esc(sys.lan_url || location.origin)}</code> puis « Ajouter à l'écran d'accueil »</td></tr>
    </table>
    <details class="logs"><summary>Journal technique (diagnostic)</summary><pre id="sys-logs">Chargement…</pre></details>
    <div class="inline-form" style="margin-top:12px"><button class="btn ghost" id="sys-restart">${icon("refresh")}Redémarrer le service</button></div>`;

  $("#sys-real").addEventListener("change", async (e) => {
    const real = e.target.checked;
    if (real && !confirm("Passer en mode réel ? Les appareils de config seront contactés pour de vrai. Vérifie d'abord leurs adresses (Comptes connectés et Recherche réseau).")) { e.target.checked = false; return; }
    e.target.disabled = true;
    toast(real ? "Passage en mode réel…" : "Retour au mode démo…");
    try {
      await api("/api/system/mode", { method: "PUT", body: JSON.stringify({ demo: !real }) });
      await reloadConfig();
      $("#demo-badge").hidden = !S.cfg.demo;
      toast(real ? "Mode réel activé" : "Mode démo activé");
      renderSettings();
    } catch (err) { toast(err.message, true); e.target.checked = !real; e.target.disabled = false; }
  });
  $("#sys-auto")?.addEventListener("change", async (e) => {
    try {
      await api("/api/system/autostart", { method: "PUT", body: JSON.stringify({ enabled: e.target.checked }) });
      toast(e.target.checked ? "Démarrage automatique activé" : "Démarrage automatique désactivé");
    } catch (err) { toast(err.message, true); e.target.checked = !e.target.checked; }
  });
  const setPw = async (password) => {
    try {
      await api("/api/system/password", { method: "PUT", body: JSON.stringify({ password }) });
      toast(password ? "Mot de passe activé : ton navigateur va le demander" : "Mot de passe retiré");
      setTimeout(() => location.reload(), 1200);
    } catch (err) { toast(err.message, true); }
  };
  $("#sys-pw-save").addEventListener("click", () => {
    const pw = $("#sys-pw").value;
    if (pw.length < 6) return toast("6 caractères minimum", true);
    setPw(pw);
  });
  $("#sys-pw-del")?.addEventListener("click", () => confirm("Retirer le mot de passe ?") && setPw(""));
  $("#sys-backup").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    try {
      const r = await fetch("/api/system/backup", { method: "POST" });
      if (!r.ok) throw new Error("Sauvegarde impossible");
      const name = (r.headers.get("content-disposition") || "").match(/filename="(.+)"/)?.[1] || "maison.zip";
      const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(await r.blob()), download: name });
      a.click();
      toast("Sauvegarde créée");
      renderSystem(box);
    } catch (err) { toast(err.message, true); }
    btn.disabled = false;
  });
  $("#sys-restore").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f || !confirm(`Restaurer « ${f.name} » ? La configuration actuelle sera remplacée (une sauvegarde est faite avant).`)) return;
    try {
      const r = await fetch("/api/system/restore", { method: "POST", body: f });
      if (!r.ok) throw new Error((await r.json()).detail || "Restauration impossible");
      toast("Sauvegarde restaurée");
      setTimeout(() => location.reload(), 1000);
    } catch (err) { toast(err.message, true); }
  });
  $("#sys-restart").addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    try { await api("/api/system/restart", { method: "POST" }); toast("Service redémarré"); await reloadConfig(); } catch (err) { toast(err.message, true); }
    e.target.disabled = false;
  });
  $("details.logs", box).addEventListener("toggle", async (e) => {
    if (!e.target.open) return;
    try {
      const { lines } = await api("/api/system/logs?lines=300");
      const pre = $("#sys-logs");
      pre.textContent = lines.join("") || "Journal vide.";
      pre.scrollTop = pre.scrollHeight;
    } catch (err) { $("#sys-logs").textContent = err.message; }
  });
}

// ------------------------------------------------------------------ recherche réseau
function renderScanCard(box) {
  box.innerHTML = `<div class="card-head"><h2>Recherche des appareils sur le réseau</h2>
      <button class="btn primary small-btn" id="scan-go">${icon("refresh")}Lancer la recherche</button></div>
    <p class="muted small">Trouve automatiquement tes NAS QNAP / TerraMaster, ton serveur Proxmox, ton imprimante Elegoo, tes caméras et tes PC
      (avec leur adresse MAC pour le Wake on LAN). Un appareil trouvé peut <b>remplacer</b> un appareil d'exemple : il garde sa place sur le plan et ses automatisations.</p>
    <div id="scan-results"></div>`;
  $("#scan-go").addEventListener("click", async (e) => {
    const btn = e.currentTarget;
    btn.disabled = true;
    const res = $("#scan-results");
    res.innerHTML = `<p class="muted small"><span class="spinner"></span>Analyse du réseau en cours (10 à 30 secondes)…</p>`;
    try {
      const r = await api("/api/scan");
      await api("/api/settings", { method: "PUT", body: JSON.stringify({ network_scanned: true }) });
      const icons = { proxmox: "server", qnap: "nas", terramaster: "nas", elegoo: "printer", camera: "camera", wol: "monitor" };
      res.innerHTML = `<p class="muted small">Réseau analysé : ${esc(r.network)} (ce PC : ${esc(r.me)})</p><div id="scan-list"></div>`;
      foundList($("#scan-list"), r.found.map((f) => ({
        key: f.host, title: f.label, sub: [f.host, f.hostname, f.mac].filter(Boolean).join(" · "),
        configured: f.configured_as, icon: icons[f.kind] || "plug",
        device: f.device ? { name: f.label, ...f.device } : null,
      })), "Rien trouvé. Vérifie que ce PC est bien sur le même réseau que tes appareils (et qu'ils sont allumés).");
    } catch (err) { res.innerHTML = `<div class="error-box">${esc(err.message)}</div>`; }
    btn.disabled = false;
  });
}
