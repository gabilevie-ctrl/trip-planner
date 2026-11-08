import { esc, empty, fmtDate } from "../ui.js";
import { planningSteps } from "../criteria.js";
import { computePlan, stays } from "../compute.js";
import { currentDest } from "./build.js";
import * as L from "../links.js";

export function render(ctx) {
  const t = ctx.trip; const d = ctx.dests.find(x => x.id === t.chosen) || null;
  const plan = d ? computePlan(d, t).plan : null;
  const steps = planningSteps(t, d, plan);
  const phases = [...new Set(steps.map(s => s.phase))];
  const done = steps.filter(s => t.steps[s.key]).length;
  const n = t.travellers.length || 1;
  const travelLinks = d ? travel(d, t, n) : "";
  const st = d ? stays(d, t) : [];
  return `
  <section class="card">
    <div class="row between"><h2>Steps to plan this trip</h2><span class="muted num">${done} of ${steps.length} done</span></div>
    ${!d ? `<div class="alert">No destination chosen yet: the list shows the generic steps. <a href="#destinations">Choose one</a> and the lodging, permit and route steps appear.</div>` : ""}
    <div class="grid2">${phases.map(ph => `<div><h4>${esc(ph)}</h4><ul class="steps">${steps.filter(s => s.phase === ph).map(s => `<li class="${t.steps[s.key] ? "done" : ""}"><label class="chk"><input type="checkbox" data-act="step" data-key="${esc(s.key)}" ${t.steps[s.key] ? "checked" : ""}> <span><strong>${esc(s.label)}</strong>${s.detail ? `<br><span class="muted small">${esc(s.detail)}</span>` : ""}</span></label></li>`).join("")}</ul></div>`).join("")}</div>
  </section>
  ${d ? `<section class="card">
    <h3>Travel</h3>
    <p class="muted small">Links open prefilled searches; nothing is booked from here.</p>
    ${travelLinks}
  </section>
  <section class="card">
    <h3>Lodging, night by night</h3>
    ${st.length ? `<div class="scroller"><table class="itin"><thead><tr><th>Dates</th><th>Stop</th><th>Where</th><th>Search</th><th>Booked?</th></tr></thead><tbody>${st.map(s => `<tr><td class="small">${esc(fmtDate(s.checkin))} → ${esc(fmtDate(s.checkout))}<br>${s.nights} night${s.nights > 1 ? "s" : ""}</td><td><strong>${esc(s.name)}</strong></td><td class="small">${s.hut ? "🛏 " + esc(s.hut.name) + (s.hut.bookAheadMonths ? ` · book ${s.hut.bookAheadMonths} mo ahead` : "") : esc(s.place)}${s.note ? `<br><span class="muted">${esc(s.note)}</span>` : ""}</td><td class="small">${s.hut ? `<a href="${s.hut.url ? esc(s.hut.url) : L.hutSearch(s.hut.name)}" target="_blank" rel="noopener">hut</a>` : `<a href="${L.booking(s.place || s.name, s.checkin, s.checkout, n, L.rooms(n))}" target="_blank" rel="noopener">Booking</a> · <a href="${L.airbnb(s.place || s.name, s.checkin, s.checkout, n)}" target="_blank" rel="noopener">Airbnb</a>`} · <a href="${L.mapsSearch(s.place || s.name)}" target="_blank" rel="noopener">map</a></td><td><input type="text" data-bind="lodgingBooked.${s.blockId}" value="${esc((t.lodgingBooked || {})[s.blockId] || "")}" placeholder="ref / who booked" aria-label="Booking reference"></td></tr>`).join("")}</tbody></table></div>` : empty("No nights yet", "Switch some blocks on in Build.")}
    ${t.kind !== "explore" ? `<p class="small muted">Hut portals: ${L.HUT_PORTALS.map(h => `<a href="${h.url}" target="_blank" rel="noopener">${esc(h.name)}</a>`).join(" · ")}</p>` : ""}
  </section>` : ""}
  <p class="row"><a href="#money" role="button">Next: money →</a></p>`;
}

function travel(d, t, n) {
  const c = computePlan(d, t); const a = c.access; const first = c.sel[0]; const dest = (first && (first.place || first.name)) || d.region;
  const origin = t.origin.city; const s = t.dates.start, e = t.dates.end; const mode = t.travel.mode;
  const rows = [];
  rows.push(`<p><strong>Route:</strong> ${esc(a.route)}${a.approx ? ` <span class="pill warn">estimate from ${esc(a.originCity || "default origin")}</span>` : ""}</p>`);
  if (mode === "drive") rows.push(`<p><a href="${L.rome2rio(origin, dest)}" target="_blank" rel="noopener">Rome2Rio: ${esc(origin)} → ${esc(dest)}</a> (driving time, tolls, alternatives) · <a href="${L.mapsSearch(dest)}" target="_blank" rel="noopener">map</a></p>`);
  else if (mode === "train" || a.mode !== "flight") rows.push(`<p><a href="${L.rome2rio(origin, dest)}" target="_blank" rel="noopener">Rome2Rio: ${esc(origin)} → ${esc(dest)}</a> · <a href="${L.trainline()}" target="_blank" rel="noopener">Trainline</a> · <a href="${L.seat61()}" target="_blank" rel="noopener">Seat61 (how to do it by train)</a></p>`);
  else rows.push(`<p><a href="${L.flights(origin, d.region.split(",")[0], s, e, n)}" target="_blank" rel="noopener">Google Flights: ${esc(origin)} → ${esc(d.region.split(",")[0])}, ${esc(s)} – ${esc(e)}, ${n} adults</a> · <a href="${L.rome2rio(origin, dest)}" target="_blank" rel="noopener">Rome2Rio</a></p>`);
  const internal = c.sel.filter(b => b.extraTransportCost);
  if (internal.length) rows.push(`<p><strong>Inside the trip:</strong> ${internal.map(b => `${esc(b.name)} (~${b.extraTransportCost} pp)`).join(", ")}.</p>`);
  return rows.join("");
}

export const actions = {
  "step": (el, ctx) => { ctx.trip.steps[el.dataset.key] = el.checked; ctx.commit(); }
};
