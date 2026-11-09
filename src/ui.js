// Small rendering helpers shared by the views.
export const esc = t => String(t ?? "").replace(/[&<>"']/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch]));
export const fmtMoney = (n, cur = "EUR") => { const sym = { EUR: "€", GBP: "£", USD: "$", CHF: "CHF " }[cur] || esc(cur) + " "; return sym + Math.round(n || 0).toLocaleString("en-GB"); };
export const fmtDate = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }); };
export const fmtDateY = iso => { if (!iso) return ""; const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }); };
export const hrs = h => (Math.round(h * 2) / 2).toString().replace(".5", "½") + " h";
export const chip = (cls, label, title) => `<span class="chip ${cls || ""}"${title ? ` title="${esc(title)}"` : ""}>${label}</span>`;
export const altClass = (a, ceiling) => ceiling ? (a > ceiling ? "crit" : a > ceiling * 0.85 ? "warn" : "good") : (a > 4250 ? "crit" : a > 3500 ? "warn" : "good");
// A traveller's floor or ceiling replaces the generic 28/33 °C thresholds; within 3–4 °C of a limit is a warning.
export const tempClass = (t, ceiling, floor) => {
  if (floor !== undefined && floor !== null && t < floor) return "crit";
  const hot = ceiling ? (t > ceiling ? "crit" : t > ceiling - 4 ? "warn" : "good") : (t > 33 ? "crit" : t > 28 ? "warn" : "good");
  if (hot !== "good") return hot;
  return floor !== undefined && floor !== null && t < floor + 3 ? "warn" : "good";
};
export const hrsClass = h => h > 30 ? "crit" : h > 20 ? "warn" : "good";
export const CROWD = { low: ["good", "Few visitors"], med: ["warn", "Some visitors"], high: ["crit", "Crowded"] };
export const scoreClass = v => v >= 70 ? "good" : v >= 50 ? "warn" : "crit";
export const field = (label, control, help) => `<label>${esc(label)}${control}${help ? `<small>${help}</small>` : ""}</label>`;
export const sel = (name, value, options, attrs = "") => `<select name="${name}" ${attrs}>${options.map(([v, l]) => `<option value="${esc(v)}" ${String(v) === String(value) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
export const empty = (title, body, action) => `<div class="empty"><h3>${esc(title)}</h3><p>${body}</p>${action || ""}</div>`;
export function splitBar(c, len) { const L = Math.max(len || c.len || 1, 1); const w = v => Math.max(0, v) / L * 100; return `<div class="split"><i class="ci" style="width:${w(c.city)}%"></i><i class="hi" style="width:${w(c.outdoor)}%"></i><i class="re" style="width:${w(c.rest)}%"></i><i class="fr" style="width:${w(c.free)}%"></i></div>`; }
export const step = (act, data, value, minus, plus, label) => `<span class="step"><button type="button" class="outline secondary" data-act="${act}" data-d="-1" ${data} ${minus ? "" : "disabled"} aria-label="${esc(label)} fewer">−</button><span class="n num">${value}</span><button type="button" class="outline secondary" data-act="${act}" data-d="1" ${data} ${plus ? "" : "disabled"} aria-label="${esc(label)} more">+</button></span>`;
// Copies each column's header onto its cells (data-label) so CSS can stack rows as cards on phones.
export function labelCells(root) {
  for (const table of root.querySelectorAll("table.itin, table.ledger, table.log, table.people")) {
    const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
    for (const tr of table.querySelectorAll("tbody tr")) [...tr.children].forEach((td, i) => { if (heads[i]) td.dataset.label = heads[i]; });
  }
}
