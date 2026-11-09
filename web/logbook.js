"use strict";
// Journal : historique de tout ce qui se passe

const LOG_KIND = {
  state: { icon: "power", color: "var(--blue)" },
  action: { icon: "play", color: "var(--amber)" },
  automation: { icon: "cog", color: "var(--violet)" },
  scene: { icon: "star", color: "var(--pink)" },
  notification: { icon: "bell", color: "var(--cyan)" },
  system: { icon: "home", color: "var(--muted)" },
};

const LOG = { kind: "", entity: "", items: [] };

function logRows(items, withDays = false) {
  if (!items.length) return `<p class="muted small empty">Rien pour le moment.</p>`;
  let lastDay = "";
  return items.map((e) => {
    const k = LOG_KIND[e.kind] || LOG_KIND.system;
    const d = new Date(e.ts * 1000);
    const day = d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
    const head = withDays && day !== lastDay ? `<div class="log-day">${day.charAt(0).toUpperCase() + day.slice(1)}</div>` : "";
    lastDay = day;
    const dev = e.entity && device(e.entity);
    return `${head}<div class="log-row" style="--c:${dev ? meta(dev).color : k.color}">
      <span class="log-ico">${icon(dev ? meta(dev).icon : k.icon)}</span>
      <div class="log-text"><span>${esc(e.message)}</span>${e.source ? `<small>${esc(e.source)}</small>` : ""}</div>
      <time>${d.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}</time></div>`;
  }).join("");
}

async function loadLogbook(reset) {
  const sel = $("#log-device");
  if (reset) {
    LOG.items = [];
    sel.innerHTML = `<option value="">Tous les appareils</option>` + S.cfg.devices.map((d) => `<option value="${d.id}" ${d.id === LOG.entity ? "selected" : ""}>${esc(d.name)}</option>`).join("");
  }
  const before = LOG.items.length ? LOG.items.at(-1).ts : 0;
  const q = new URLSearchParams({ limit: 100, kind: LOG.kind, entity: LOG.entity, before });
  let rows;
  try { rows = await api(`/api/logbook?${q}`); } catch (e) { return toast(e.message, true); }
  LOG.items = reset ? rows : [...LOG.items, ...rows];
  $("#log-list").innerHTML = logRows(LOG.items, true);
  $("#log-more").hidden = rows.length < 100;
}

$$("#log-kinds button").forEach((b) => b.addEventListener("click", () => {
  LOG.kind = b.dataset.kind;
  $$("#log-kinds button").forEach((x) => x.classList.toggle("active", x === b));
  loadLogbook(true);
}));
$("#log-device").addEventListener("change", (e) => { LOG.entity = e.target.value; loadLogbook(true); });
$("#log-more").addEventListener("click", () => loadLogbook(false));
