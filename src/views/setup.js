import { esc, field, sel, fmtMoney, scoreClass } from "../ui.js";
import { KINDS, TRAVEL_MODES, LODGING, ORIGINS, TRIP_TYPES, criteriaFor, strictestLimits } from "../criteria.js";
import { tripLength, computePlan, isVisited } from "../compute.js";
import { score } from "../scoring.js";
import { describeTurn } from "../describe.js";
import { uid } from "../state.js";


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
  return `${chat(t)}${fitIdeas(ctx, t)}
  <section class="card">
    <h2>Basics</h2>
    <div class="grid2">
      ${field("Trip name", `<input type="text" data-bind="name" value="${esc(t.name)}" placeholder="e.g. Parents' 30th, Écrins week, January train trip">`)}
      ${field("Trip owner", `<input type="text" data-bind="owner" value="${esc(t.owner || "")}" placeholder="Who keeps this plan (e.g. Gabriel)">`, "Shown on the trip card and in the shared summary.")}
      ${field("Kind of trip", `<input type="text" value="${esc(kind.label)}" disabled>`, "Set when the trip was created. Start a new trip to change it.")}
      ${field("Leaving from", sel("origin", t.origin.city, ORIGINS.map(([c]) => [c, c]), `data-bind="origin.city" data-after="origin"`), "Access routes and costs are held per origin; Brussels and London are covered best.")}
      ${field("How we travel", sel("travel", t.travel.mode, Object.entries(TRAVEL_MODES).map(([k, v]) => [k, v.label]), `data-bind="travel.mode"`), esc(TRAVEL_MODES[t.travel.mode]?.blurb || ""))}
      <div class="pair">${field("Start date", `<input type="date" data-bind="dates.start" value="${esc(t.dates.start)}">`)}
      ${field("End date", `<input type="date" data-bind="dates.end" value="${esc(t.dates.end)}">`, len ? `${len} days` : "Pick both dates; the itinerary and the season scoring depend on them.")}</div>
      <div class="pair">${field("Budget for the whole group", `<input type="number" min="0" step="100" data-bind="budget.total" data-type="number" value="${t.budget.total || ""}" placeholder="e.g. 15000">`, "Leave empty for no cap; destinations still show their estimate.")}
      ${field("Currency", sel("cur", t.budget.currency, [["EUR", "EUR €"], ["GBP", "GBP £"], ["CHF", "CHF"], ["USD", "USD $"]], `data-bind="budget.currency"`))}</div>
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
      ${Object.entries(TRIP_TYPES).map(([k, l]) => `<label>${esc(l)} <span class="num muted">${["off", "a little", "yes", "a lot"][t.type[k] || 0]}</span><input type="range" min="0" max="3" step="1" data-bind="type.${k}" data-type="number" value="${t.type[k] || 0}"></label>`).join("")}
    </div>
  </section>` : ""}

  <section class="card">
    <h2>Countries already visited</h2>
    <p class="muted">Tick the countries the group has been to. Destinations in those countries stay in the library but are hidden by default (a switch in Destinations shows them). Optional, like everything on this page.</p>
    ${countryPicker(ctx, t)}
  </section>

  <section class="card">
    <h2>Notes</h2>
    <textarea rows="3" data-bind="notes" placeholder="Anything the group agreed that does not fit a field: who is paying, must-haves, dealbreakers.">${esc(t.notes || "")}</textarea>
  </section>
  <p><a href="#destinations" role="button">Next: destinations →</a></p>`;
}

function chat(t) {
  const msgs = t.brief || [];
  return `<section class="card chat">
    <h2>Describe the trip</h2>
    ${msgs.length ? `<ol class="thread">${msgs.map(m => `<li class="msg ${m.who === "app" ? "app" : "you"}">${esc(m.text)}</li>`).join("")}</ol>` : `<p class="muted">Tell the planner about the trip in your own words; it fills in the form below and asks about what is missing.</p>`}
    <div class="chatin"><textarea id="chatText" rows="2" placeholder="${msgs.length ? "Add more: a limit for someone, a change of dates, what to skip…" : "e.g. Four of us, ten days in May, from London, about £1,500 each, love the coast"}"></textarea><button type="button" data-act="chat-send">Send</button></div>
  </section>`;
}
/* Step 1 brainstorm: the best three destinations for what is known so far. */
/* The best destinations for what is known so far; shared by the ideas card and the chat. */
export function topIdeas(ctx, t, n = 3) {
  if (!ctx.dests.length || ctx.dests[0].kind !== t.kind) return [];
  return ctx.dests.filter(d => !isVisited(d, t)).map(d => { const c = computePlan(d, t); return { d, c, s: score(d, t, c) }; }).sort((a, b) => b.s.score - a.s.score).slice(0, n);
}
export const suggestFor = ctx => t => topIdeas(ctx, t).map(({ d, c, s }) => ({ name: d.name, score: s.score, pp: c.pp, currency: t.budget.currency, reason: s.reason, flags: c.flags }));
function fitIdeas(ctx, t) {
  const top = topIdeas(ctx, t); if (!top.length) return "";
  return `<section class="card">
    <div class="row between"><h2>Ideas that fit so far</h2><a href="#destinations" class="small">See all ${ctx.dests.length} →</a></div>
    <p class="muted small">Ranked by your dates, budget, interests and limits; they change as you fill in more.</p>
    <ol class="fitideas">${top.map(({ d, c, s }) => `<li><span class="score ${scoreClass(s.score)}">${s.score}</span> <div><button type="button" class="linklike" data-act="see-dest" data-name="${esc(d.name)}"><strong>${esc(d.name)}</strong></button> <span class="muted small">${esc(d.region)} · ${fmtMoney(c.pp, t.budget.currency)} pp${c.flags.length ? ` · ${c.flags.length} thing${c.flags.length > 1 ? "s" : ""} flagged` : ""}</span><br><span class="small">${esc(s.reason)}.</span></div></li>`).join("")}</ol>
  </section>`;
}

const CONTS = ["Europe", "Asia", "Africa", "North America", "South America", "Oceania"];
function countryPicker(ctx, t) {
  const ui = t._ui = t._ui || {}; const q = (ui.cq || "").toLowerCase(); const cont = ui.ccont || "all";
  const vc = t.visitedCountries || [];
  const list = ctx.countries.filter(c => (cont === "all" || c.continent === cont) && (!q || c.name.toLowerCase().includes(q)));
  const picked = ctx.countries.filter(c => vc.includes(c.code));
  return `<div class="row"><input type="search" data-ui="cq" value="${esc(ui.cq || "")}" placeholder="Type a country…" aria-label="Search countries" style="flex:1 1 200px">
    <select data-ui="ccont" aria-label="Continent"><option value="all">All continents</option>${CONTS.map(c => `<option value="${c}" ${cont === c ? "selected" : ""}>${c}</option>`).join("")}</select></div>
    ${picked.length ? `<p class="chips" style="margin:8px 0">${picked.map(c => `<button type="button" class="chip good" data-act="toggle-country" data-code="${c.code}" title="Remove">${esc(c.name)} ✕</button>`).join("")}</p>` : `<p class="muted small" style="margin:8px 0">None ticked yet.</p>`}
    <div class="countries">${list.map(c => `<label class="chk"><input type="checkbox" data-act="toggle-country" data-code="${c.code}" ${vc.includes(c.code) ? "checked" : ""}> ${esc(c.name)}</label>`).join("")}</div>`;
}
function critInput(c, value, bind) {
  if (c.type === "number") return `<input type="number" data-bind="${bind}" data-type="number" value="${value ?? ""}" placeholder="${esc(c.placeholder || "")}" style="min-width:90px">`;
  if (c.type === "bool") return `<input type="checkbox" data-bind="${bind}" data-type="bool" ${value ? "checked" : ""}>`;
  return `<select data-bind="${bind}"><option value="">—</option>${c.options.map(([v, l]) => `<option value="${esc(v)}" ${String(value) === String(v) ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>`;
}
function fmtLimit(c, v) { if (Array.isArray(v)) return v.map(x => fmtLimit(c, x)).join(" and "); if (c.type === "bool") return v ? "yes" : "no"; if (c.type === "select") { const o = c.options.find(([k]) => String(k) === String(v)); return o ? o[1] : v; } return `${Number(v).toLocaleString("en-GB")}${c.unit ? " " + c.unit : ""}`; }

export const actions = {
  "chat-send": (el, ctx) => { const box = document.getElementById("chatText"); const r = describeTurn(ctx.trip, box.value, { countries: ctx.countries, suggest: suggestFor(ctx) }); if (!r) { ctx.toast("Write something first."); return; } ctx.commit(); },
  "see-dest": (el, ctx) => { const t = ctx.trip; t._ui = Object.assign(t._ui || {}, { q: el.dataset.name }); ctx.save(); ctx.nav("destinations"); },
  "add-traveller": (el, ctx) => { ctx.trip.travellers.push({ id: uid("p"), name: "", limits: {} }); ctx.commit(); },
  "remove-traveller": (el, ctx) => { ctx.trip.travellers = ctx.trip.travellers.filter(p => p.id !== el.dataset.pid); ctx.commit(); },
  "toggle-country": (el, ctx) => { const code = el.dataset.code; const v = ctx.trip.visitedCountries = ctx.trip.visitedCountries || []; const i = v.indexOf(code); const on = el.tagName === "INPUT" ? el.checked : false; if (on && i < 0) v.push(code); if (!on && i >= 0) v.splice(i, 1); ctx.commit(true); }
};
