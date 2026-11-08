import { esc, fmtDate, empty } from "../ui.js";
import { itinerary, stays } from "../compute.js";
import { currentDest } from "./build.js";
import * as L from "../links.js";

const KIND_LABEL = { travel: "Travel", city: "City", hike: "Outdoors", beach: "Coast", wildlife: "Wildlife", stage: "Stage", rest: "Rest", spare: "Spare" };

export function render(ctx) {
  const t = ctx.trip; const d = currentDest(ctx);
  if (!d) return `<section class="card">${empty("Nothing to show yet", "Build a destination first.", `<a href="#build" role="button">Go to build</a>`)}</section>`;
  const noDates = !t.dates.start;
  const days = itinerary(d, t); const st = stays(d, t); const n = t.travellers.length || 1;
  const byDate = Object.fromEntries(st.map(s => [s.checkin, s]));
  return `
  <section class="card">
    <div class="row between"><h2>${esc(d.name)}: day by day</h2>${t.chosen !== d.id ? `<span class="pill warn">not the chosen destination</span>` : ""}</div>
    ${noDates ? `<div class="alert">No dates yet: days are numbered, not dated. <a href="#setup">Add dates</a> to get a calendar and prefilled lodging searches.</div>` : ""}
    <p class="muted">Generated from the build; notes are yours and stay with the trip. Lodging rows link to searches prefilled with the dates and ${n} guest${n > 1 ? "s" : ""}.</p>
    <div class="scroller"><table class="itin">
      <thead><tr><th>Day</th><th>Date</th><th>What</th><th>Where you sleep</th><th>Notes</th></tr></thead>
      <tbody>${days.map(day => {
        const s = byDate[day.date];
        const lodging = noDates ? (day.block ? `<span class="muted">${esc(day.block.hut ? day.block.hut.name : (day.block.place || ""))}</span>` : "") : s ? `${s.hut ? "🛏 " + esc(s.hut.name) : esc(s.place || s.name)}${s.nights > 1 ? ` <span class="muted">(${s.nights} nights)</span>` : ""}<br><span class="small">${s.hut ? `<a href="${s.hut.url ? esc(s.hut.url) : L.hutSearch(s.hut.name)}" target="_blank" rel="noopener">book the hut</a>` : `<a href="${L.booking(s.place || s.name, s.checkin, s.checkout, n, L.rooms(n))}" target="_blank" rel="noopener">Booking</a> · <a href="${L.airbnb(s.place || s.name, s.checkin, s.checkout, n)}" target="_blank" rel="noopener">Airbnb</a>`} · <a href="${L.mapsSearch(s.place || s.name)}" target="_blank" rel="noopener">map</a></span>` : (day.block ? `<span class="muted">as above</span>` : "");
        return `<tr class="${day.kind}"><td class="num">${day.n}</td><td>${noDates ? "—" : fmtDate(day.date)}</td><td><span class="tag ${day.kind}">${KIND_LABEL[day.kind] || day.kind}</span> ${esc(day.label)}${day.route ? `<br><span class="muted small">${esc(day.route)}</span>` : ""}${day.block?.hours ? `<br><span class="muted small">${day.block.hours} h · ↗ ${day.block.ascentM} m · ${esc(day.block.difficulty || "")}</span>` : ""}</td><td>${lodging}</td><td><input type="text" data-bind="dayNotes.${day.date}" value="${esc(t.dayNotes[day.date] || "")}" placeholder="…" aria-label="Note for ${day.date}"></td></tr>`;
      }).join("")}</tbody>
    </table></div>
  </section>
  <p class="row"><a href="#plan" role="button">Next: plan & book →</a></p>`;
}
export const actions = {};
