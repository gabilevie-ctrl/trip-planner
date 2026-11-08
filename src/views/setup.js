import { esc, field, sel } from "../ui.js";
import { KINDS, TRAVEL_MODES, LODGING, criteriaFor, strictestLimits } from "../criteria.js";
import { tripLength } from "../compute.js";
import { uid } from "../state.js";

const ORIGINS = [["Brussels", "europe-west"], ["London", "uk"], ["Paris", "europe-west"], ["Amsterdam", "europe-west"], ["Geneva", "europe-west"], ["Other", "europe-west"]];
const TYPE_TAGS = { cities: "Cities & museums", hike: "Mountains & walking", coast: "Coast & islands", wildlife: "Wildlife", history: "History", food: "Food & wine", festival: "A festival" };

export function render(ctx) {
  const t = ctx.trip; const kind = KINDS[t.kind];
  const crit = criteriaFor(t.kind);
  const lim = strictestLimits(t);
  const len = tripLength(t);
  const travellerRows = t.travellers.map((p, i) => `
    <tr data-pid="${p.id}">
      <td><input type="text" data-bind="travellers.${i}.name" value="${esc(p.name)}" placeholder="Name" aria-label="Traveller ${i + 1} name"></td>
      ${crit.map(c => `<td>${critInput(c, p.limits?.[c.key], `travellers.${i}.limits.${c.key}`)}</td>`).join("")}
      <td><button type="button" class="outline secondary small" data-act="remove-traveller" data-pid="${p.id}" aria-label="Remove traveller" ${t.travellers.length <= 1 ? "disabled" : ""}>✕</button></td>
    </tr>`).join("");
  const limitSummary = crit.map(c => lim[c.key] !== undefined ? `${c.label}: <strong>${fmtLimit(c, lim[c.key])}</strong>` : null).filter(Boolean).join(" · ") || "No limits set yet: everything will be offered, nothing flagged.";
  return `
  <section class="card">
    <h2>Basics</h2>
    <div class="grid2">
      ${field("Trip name", `<input type="text" data-bind="name" value="${esc(t.name)}" placeholder="e.g. Parents' 30th, Écrins week, January train trip">`)}
      ${field("Kind of trip", `<input type="text" value="${esc(kind.label)}" disabled>`, "Set when the trip was created. Start a new trip to change it.")}
      ${field("Leaving from", sel("origin", t.origin.city, ORIGINS.map(([c]) => [c, c]), `data-bind="origin.city" data-after="origin"`), "Access routes and costs are held per origin; Brussels and London are covered best.")}
      ${field("How we travel", sel("travel", t.travel.mode, Object.entries(TRAVEL_MODES).map(([k, v]) => [k, v.label]), `data-bind="travel.mode"`), esc(TRAVEL_MODES[t.travel.mode]?.blurb || ""))}
      ${field("Start date", `<input type="date" data-bind="dates.start" value="${esc(t.dates.start)}">`)}
      ${field("End date", `<input type="date" data-bind="dates.end" value="${esc(t.dates.end)}">`, len ? `${len} days` : "Pick both dates; the itinerary and the season scoring depend on them.")}
      ${field("Budget for the whole group", `<input type="number" min="0" step="100" data-bind="budget.total" data-type="number" value="${t.budget.total || ""}" placeholder="e.g. 15000">`, "Leave empty for no cap; destinations still show their estimate.")}
      ${field("Currency", sel("cur", t.budget.currency, [["EUR", "EUR €"], ["GBP", "GBP £"], ["CHF", "CHF"], ["USD", "USD $"]], `data-bind="budget.currency"`))}
      ${field("Lodging style", sel("lodging", t.lodging, Object.entries(LODGING).map(([k, v]) => [k, v.label]), `data-bind="lodging"`), "Drives the per-day rates: B&B/huts is the baseline; hotels add about 40%.")}
    </div>
  </section>

  <section class="card">
    <h2>Who is coming, and their limits</h2>
    <p class="muted">The strictest value across travellers is what the app applies. A destination or a day that breaks a limit is flagged, never hidden. Leave a cell empty if someone has no limit there.</p>
    <div class="scroller"><table class="people">
      <thead><tr><th>Name</th>${crit.map(c => `<th title="${esc(c.help || "")}">${esc(c.label)}${c.unit ? ` <small>(${c.unit})</small>` : ""}</th>`).join("")}<th></th></tr></thead>
      <tbody>${travellerRows}</tbody>
    </table></div>
    <button type="button" class="outline" data-act="add-traveller">Add a traveller</button>
    <p class="muted" style="margin-top:8px">Applied limits: ${limitSummary}</p>
  </section>

  ${t.kind === "explore" ? `<section class="card">
    <h2>What kind of trip</h2>
    <p class="muted">How much each of these matters. Used to score destinations; 0 means it does not count.</p>
    <div class="grid3">
      ${Object.entries(TYPE_TAGS).map(([k, l]) => `<label>${esc(l)} <span class="num muted">${["off", "a little", "yes", "a lot"][t.type[k] || 0]}</span><input type="range" min="0" max="3" step="1" data-bind="type.${k}" data-type="number" value="${t.type[k] || 0}"></label>`).join("")}
    </div>
  </section>` : ""}

  <section class="card">
    <h2>Already visited</h2>
    <p class="muted">Tick the places some of the group have already been to; they stay in the library but are hidden by default.</p>
    <div class="chips">${ctx.destsLite.filter(d => d.kind === t.kind).map(d => `<label class="chk"><input type="checkbox" data-act="toggle-visited" data-id="${d.id}" ${t.visited.includes(d.id) ? "checked" : ""}> ${esc(d.name)}</label>`).join("")}</div>
  </section>

  <section class="card">
    <h2>Notes</h2>
    <textarea rows="3" data-bind="notes" placeholder="Anything the group agreed that does not fit a field: who is paying, must-haves, dealbreakers.">${esc(t.notes || "")}</textarea>
  </section>
  <p><a href="#destinations" role="button">Next: destinations →</a></p>`;
}

function critInput(c, value, bind) {
  if (c.type === "number") return `<input type="number" data-bind="${bind}" data-type="number" value="${value ?? ""}" placeholder="${esc(c.placeholder || "")}" style="min-width:90px">`;
  if (c.type === "bool") return `<input type="checkbox" data-bind="${bind}" data-type="bool" ${value ? "checked" : ""}>`;
  return `<select data-bind="${bind}"><option value="">—</option>${c.options.map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
}
function fmtLimit(c, v) { if (c.type === "bool") return v ? "yes" : "no"; if (c.type === "select") { const o = c.options.find(([k]) => String(k) === String(v)); return o ? o[1] : v; } return `${Number(v).toLocaleString("en-GB")}${c.unit ? " " + c.unit : ""}`; }

export const actions = {
  "add-traveller": (el, ctx) => { ctx.trip.travellers.push({ id: uid("p"), name: "", limits: {} }); ctx.commit(); },
  "remove-traveller": (el, ctx) => { ctx.trip.travellers = ctx.trip.travellers.filter(p => p.id !== el.dataset.pid); ctx.commit(); },
  "toggle-visited": (el, ctx) => { const id = el.dataset.id; const v = ctx.trip.visited; const i = v.indexOf(id); if (el.checked && i < 0) v.push(id); if (!el.checked && i >= 0) v.splice(i, 1); ctx.commit(false); }
};
