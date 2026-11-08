import { esc, fmtDate, empty } from "../ui.js";
import { itinerary } from "../compute.js";
import { strictestLimits } from "../criteria.js";
import { currentDest } from "./build.js";

const DANGER = ["", "1 low", "2 moderate", "3 considerable", "4 high", "5 very high"];

export function render(ctx) {
  const t = ctx.trip; const d = ctx.dests.find(x => x.id === t.chosen) || currentDest(ctx);
  if (!d) return `<section class="card">${empty("No destination", "Choose a destination first.")}</section>`;
  const lim = strictestLimits(t); const maxDanger = lim.maxDanger ? +lim.maxDanger : null;
  const days = t.dates.start ? itinerary(d, t) : [];
  const bulletins = d.bulletins || [];
  const byType = { avalanche: [], weather: [], conditions: [], huts: [], webcam: [] };
  for (const b of bulletins) (byType[b.type] || (byType[b.type] = [])).push(b);
  const logByDate = Object.fromEntries((t.log || []).map(l => [l.date, l]));
  const skitour = t.kind === "skitour";
  return `
  <section class="card">
    <h2>Conditions: ${esc(d.name)}</h2>
    <p class="muted">The app cannot fetch bulletins (cross-site requests are blocked where it runs), so these are the pages to open every evening. The log below is the group's record of what the bulletin said and what you decided.</p>
    <div class="grid3">
      ${skitour ? `<div><h4>Avalanche bulletin</h4>${list(byType.avalanche)}${maxDanger ? `<p class="small">Group limit: danger level <strong>${maxDanger}</strong>. At or above it, the day is a no-go or needs terrain under 30° with no overhead hazard.</p>` : `<p class="small muted">No danger-level limit set in Setup.</p>`}</div>` : ""}
      <div><h4>Weather</h4>${list(byType.weather)}</div>
      <div><h4>${skitour || t.kind === "hike" ? "Huts and route conditions" : "Local conditions"}</h4>${list([...byType.conditions, ...byType.huts, ...byType.webcam])}</div>
    </div>
  </section>
  <section class="card">
    <h3>Daily log</h3>
    ${days.length ? `<table class="log"><thead><tr><th>Day</th><th>Plan</th>${skitour ? "<th>Danger</th>" : ""}<th>Weather</th><th>Decision</th><th>Note</th></tr></thead><tbody>
      ${days.filter(x => x.kind !== "travel").map(x => { const l = logByDate[x.date] || {}; const bad = skitour && maxDanger && l.danger && +l.danger >= maxDanger;
        return `<tr class="${bad ? "nogo" : ""}"><td class="small">${fmtDate(x.date)}</td><td class="small">${esc(x.label)}</td>
          ${skitour ? `<td><select data-log="${x.date}" data-k="danger"><option value="">—</option>${[1, 2, 3, 4, 5].map(v => `<option value="${v}" ${String(l.danger) === String(v) ? "selected" : ""}>${DANGER[v]}</option>`).join("")}</select>${bad ? `<br><span class="pill crit">at or above the group limit</span>` : ""}</td>` : ""}
          <td><input type="text" data-log="${x.date}" data-k="weather" value="${esc(l.weather || "")}" placeholder="wind, temp, visibility"></td>
          <td><select data-log="${x.date}" data-k="decision"><option value="">—</option>${["go", "modified", "rest day", "no-go"].map(v => `<option ${l.decision === v ? "selected" : ""}>${v}</option>`).join("")}</select></td>
          <td><input type="text" data-log="${x.date}" data-k="note" value="${esc(l.note || "")}" placeholder="aspects avoided, who decided"></td></tr>`; }).join("")}
    </tbody></table>` : empty("No dates yet", "Set the dates to get one row per day.")}
  </section>`;
}
const list = arr => arr.length ? `<ul class="small">${arr.map(b => `<li><a href="${esc(b.url)}" target="_blank" rel="noopener">${esc(b.name)}</a></li>`).join("")}</ul>` : `<p class="muted small">None recorded for this destination.</p>`;

export const actions = {};
export function onLogChange(el, ctx) {
  const date = el.dataset.log, k = el.dataset.k; const t = ctx.trip; t.log = t.log || [];
  let l = t.log.find(x => x.date === date); if (!l) { l = { date }; t.log.push(l); }
  l[k] = el.value; ctx.commit(k === "danger" || k === "decision");
}
