"use strict";
// Page « Serveurs » : statistiques complètes des NAS, Proxmox et serveurs Linux

const SERVER_TYPES = ["qnap", "terramaster", "proxmox", "linux"];
const SRV = { range: "24h", hist: {}, timer: null };

const fmtBytes = (b) => {
  if (b == null) return "—";
  const u = ["o", "Ko", "Mo", "Go", "To", "Po"];
  let i = 0;
  while (b >= 1000 && i < u.length - 1) { b /= 1000; i++; }
  return `${nf(b, b < 10 && i > 2 ? 2 : b < 100 && i > 1 ? 1 : 0)} ${u[i]}`;
};
const fmtRate = (bps) => (bps == null ? "—" : `${fmtBytes(bps)}/s`);
const fmtUptime = (s) => {
  if (!s) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  return d ? `${d} j ${h} h` : `${h} h ${m} min`;
};
const pctColor = (p, warn = 75, crit = 90) => (p >= crit ? "var(--err)" : p >= warn ? "var(--warn)" : "var(--on)");

function gauge(label, value, max, text, color) {
  const pct = value == null ? 0 : Math.max(0, Math.min(1, value / max));
  const r = 34, c = 2 * Math.PI * r;
  return `<div class="gauge"><svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="${r}" class="g-bg"/>
    <circle cx="42" cy="42" r="${r}" class="g-fg" style="stroke:${color};stroke-dasharray:${c * pct} ${c}"/></svg>
    <div class="g-val"><b>${text}</b><small>${label}</small></div></div>`;
}

function serverCard(d) {
  const st = S.state[d.id] || {};
  const m = st.metrics;
  const c = stateOf(d.id);
  let h = `<div class="card server" id="srv-${d.id}" style="--c:${meta(d).color}">
    <div class="srv-head"><span class="dev-ico on">${icon(meta(d).icon)}</span>
      <div class="srv-title"><b>${esc(d.name)}</b><small>${esc([m?.info?.modèle, m?.info?.système || m?.info?.version, d.host].filter(Boolean).join(" · "))}</small></div>
      ${c === "on" ? `<span class="pill on">En ligne${m?.uptime_s ? " · " + fmtUptime(m.uptime_s) : ""}</span>` : c === "err" ? `<span class="pill err">Erreur</span>` : `<span class="pill">Hors ligne</span>`}
      <button class="icon-btn" data-open="${d.id}" title="Détails">${icon("external")}</button></div>`;
  return h + serverBody(d, "chart") + `</div>`;
}

// Contenu complet des statistiques (page Serveurs et fiche de l'appareil)
function serverBody(d, chartPrefix) {
  const st = S.state[d.id] || {};
  const m = st.metrics;
  let h = "";
  if (st.error) h += `<div class="error-box">${esc(st.error)}</div>`;
  if (!m) {
    return h + (st.online ? `<div class="srv-hint">${icon("lock")}<div><b>Statistiques indisponibles</b><p class="muted small">${esc(st.hint || "Identifiants de connexion à saisir.")}</p>
      <button class="btn small-btn primary" onclick="openDeviceEditor('${d.id}')">${icon("lock")}Saisir les identifiants</button></div></div>` : "");
  }
  const memPct = m.mem?.total ? (100 * m.mem.used) / m.mem.total : null;
  h += `<div class="gauges">
    ${gauge("Processeur", m.cpu_pct, 100, m.cpu_pct != null ? `${nf(m.cpu_pct)} %` : "—", pctColor(m.cpu_pct ?? 0))}
    ${gauge("Mémoire", memPct, 100, memPct != null ? `${nf(memPct)} %` : "—", pctColor(memPct ?? 0, 80, 92))}
    ${gauge("Température", m.cpu_temp, 100, m.cpu_temp != null ? `${nf(m.cpu_temp)} °C` : "—", pctColor(m.cpu_temp ?? 0, 65, 80))}
    <div class="net-box"><small>Réseau</small><div>↓ <b>${fmtRate(m.net?.rx_bps)}</b></div><div>↑ <b>${fmtRate(m.net?.tx_bps)}</b></div>
      ${m.load?.length ? `<small>Charge ${m.load.map((x) => nf(x, 2)).join(" · ")}</small>` : ""}</div></div>`;
  h += `<div class="srv-sub">${esc([m.cpu_model, m.cores ? `${m.cores} cœurs` : null, m.mem?.total ? `${fmtBytes(m.mem.total)} de RAM` : null,
    m.swap?.total ? `swap ${fmtBytes(m.swap.used)} / ${fmtBytes(m.swap.total)}` : null].filter(Boolean).join(" · "))}</div>`;
  h += `<div class="srv-chart" id="${chartPrefix}-${d.id}"><p class="muted small">Historique en cours de constitution (un point toutes les 5 min)…</p></div>`;

  if (m.volumes?.length) {
    const data = m.volumes.filter((v) => !v.system);
    const used = data.reduce((s, v) => s + (v.used || 0), 0), total = data.reduce((s, v) => s + (v.total || 0), 0);
    h += `<div class="d-section">Occupation des disques</div>
      <div class="vol-total"><b>${total ? nf((100 * used) / total) : 0} %</b><span>${fmtBytes(used)} utilisés sur ${fmtBytes(total)} · ${fmtBytes(total - used)} libres</span></div>`
      + m.volumes.map((v) => {
        const p = v.total ? (100 * v.used) / v.total : 0;
        const disks = (v.disks || []).map((n) => m.disks?.find((k) => k.name === n)).filter(Boolean);
        return `<div class="vol ${v.system ? "sys" : ""}"><div class="top"><b>${esc(v.name)}</b><span>${fmtBytes(v.used)} / ${fmtBytes(v.total)} · <b style="color:${pctColor(p, 80, 92)}">${nf(p)} %</b></span></div>
          <div class="bar"><div style="width:${p}%;background:${pctColor(p, 80, 92)}"></div></div>
          <small class="muted">${fmtBytes(v.total - v.used)} libres${v.raid ? " · " + esc(v.raid) : ""}${disks.length ? " · " + disks.map((k) => esc(k.model || k.name)).join(" + ") : ""}${v.status && v.status !== "ok" ? " · " + esc(v.status) : ""}</small></div>`;
      }).join("");
  }
  if (m.raid?.length) {
    h += `<div class="d-section">RAID</div><div class="chips">${[...m.raid].sort((a, b) => (a.system ? 1 : 0) - (b.system ? 1 : 0) || String(a.volume).localeCompare(String(b.volume))).map((r) =>
      `<span class="pill ${r.status !== "sain" ? "err" : r.system ? "" : "on"}" title="${esc(r.name)}">${r.volume ? esc(r.volume) + " · " : ""}${esc(r.level)}${r.devices > 1 ? ` · ${r.devices} disques` : ""} · ${esc(r.status)}${r.progress ? " · " + esc(r.progress) : ""}</span>`).join("")}</div>`;
  }
  if (m.disks?.length) {
    const anyVol = m.disks.some((k) => k.volume);
    h += `<div class="d-section">Disques</div><div class="table-wrap"><table class="data disks"><thead><tr><th>Disque</th><th>Modèle</th><th>Taille</th>${anyVol ? "<th>Volume · occupation</th>" : ""}<th>Temp.</th><th>État</th></tr></thead><tbody>
      ${m.disks.map((k) => `<tr><td>${esc(k.name)}${k.type ? ` <span class="muted small">${k.type === "ssd" ? "SSD" : "HDD"}</span>` : ""}</td><td>${esc(k.model || "—")}</td><td>${k.size ? fmtBytes(k.size) : esc(k.size_text || "—")}</td>
        ${anyVol ? `<td>${k.volume ? `${esc(k.volume)} · <b style="color:${pctColor(k.volume_pct ?? 0, 80, 92)}">${nf(k.volume_pct ?? 0)} %</b>` : `<span class="muted small">système</span>`}</td>` : ""}
        <td>${k.temp != null ? `<span style="color:${pctColor(k.temp, 45, 55)}">${k.temp} °C</span>` : "—"}</td>
        <td>${k.health ? `<span class="pill ${k.health === "OK" ? "on" : "err"}">${esc(k.health)}</span>` : `<span class="muted small">non lu</span>`}${k.wearout != null ? ` <span class="muted small">usure ${100 - k.wearout} %</span>` : ""}</td></tr>`).join("")}
      </tbody></table></div>`;
  }
  const temps = Object.entries(m.temps || {});
  const fans = Object.entries(m.fans || {});
  if (temps.length || fans.length) {
    h += `<div class="d-section">Capteurs</div><div class="chips">${temps.map(([k, v]) => `<span class="pill">${icon("thermo")}${esc(k)} : ${nf(v)} °C</span>`).join("")}
      ${fans.map(([k, v]) => `<span class="pill">${icon("refresh")}${esc(k)} : ${v} tr/min</span>`).join("")}</div>`;
  }
  if (st.guests?.length) {
    const run = st.guests.filter((g) => g.status === "running");
    h += `<div class="d-section">Machines virtuelles (${run.length}/${st.guests.length} actives)</div><div class="chips">${st.guests.map((g) =>
      `<span class="pill ${g.status === "running" ? "on" : ""}">${esc(g.vmid)} ${esc(g.name)}${g.status === "running" ? ` · ${nf(g.cpu, 1)} %` : ""}</span>`).join("")}</div>`;
  }
  return h;
}

async function renderServers() {
  const box = $("#server-list");
  const list = S.cfg.devices.filter((d) => SERVER_TYPES.includes(d.type));
  if (!list.length) {
    box.innerHTML = `<div class="card empty-state">${icon("server")}<h2>Aucun serveur</h2>
      <p class="muted">Ajoute tes NAS, Proxmox ou serveurs Linux depuis Paramètres → Recherche des appareils sur le réseau.</p>
      <button class="btn primary" onclick="showView('settings')">Ouvrir les paramètres</button></div>`;
    return;
  }
  box.innerHTML = list.map(serverCard).join("");
  bindRows(box);
  for (const d of list) loadServerChart(d);
}

async function loadServerChart(d, elId = `chart-${d.id}`) {
  const el = document.getElementById(elId);
  if (!el) return;
  const key = `${d.id}|${SRV.range}`;
  const cached = SRV.hist[key];
  if (!cached || Date.now() - cached.at > 60000) {
    try { SRV.hist[key] = { at: Date.now(), pts: await api(`/api/servers/history?device=${d.id}&range=${SRV.range}`) }; } catch { return; }
  }
  const pts = SRV.hist[key].pts;
  if (pts.length < 2) return;
  const series = [
    { id: "cpu", name: "Processeur", color: "#4f8cff", points: pts.filter((p) => p.cpu != null).map((p) => ({ t: p.t, w: p.cpu })) },
    { id: "mem", name: "Mémoire", color: "#9b7bff", points: pts.filter((p) => p.mem != null).map((p) => ({ t: p.t, w: p.mem })) },
    { id: "temp", name: "Température (°C)", color: "#fb7c3c", points: pts.filter((p) => p.temp != null).map((p) => ({ t: p.t, w: p.temp })) },
  ].filter((s) => s.points.length);
  el.innerHTML = `<div class="legend">${series.map((s) => `<span class="lg-item"><span class="sw" style="background:${s.color}"></span>${s.name}</span>`).join("")}</div><div class="chart"></div>`;
  lineChart($(".chart", el), series, 900, 200, false, (v) => nf(v));
}

function refreshServersView() {
  if (!$("#view-servers").classList.contains("active")) return;
  // mise à jour légère : on ne redessine que si l'utilisateur ne survole pas un graphique
  if (!document.querySelector("#server-list .chart:hover")) {
    const scroll = window.scrollY;
    renderServers().then(() => window.scrollTo({ top: scroll }));
  }
}

$$("#srv-range button").forEach((b) => b.addEventListener("click", () => {
  SRV.range = b.dataset.range;
  $$("#srv-range button").forEach((x) => x.classList.toggle("active", x === b));
  S.cfg.devices.filter((d) => SERVER_TYPES.includes(d.type)).forEach(loadServerChart);
}));
