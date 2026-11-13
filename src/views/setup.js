import { esc, field, sel, fmtMoney, scoreClass, fmtDateY, chip } from "../ui.js";
import { checkOption, toTripCurrency } from "../options.js";
import { KINDS, TRAVEL_MODES, LODGING, ORIGINS, TRIP_TYPES, criteriaFor, strictestLimits } from "../criteria.js";
import { tripLength, computePlan, isVisited } from "../compute.js";
import { score } from "../scoring.js";
import { describeTurn } from "../describe.js";
import { uid } from "../state.js";
import { liveChoice } from "../liveplan.js";


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
  return `${liveCard(ctx)}${chat(t, ctx)}${t.options?.length ? optionsCard(t) : fitIdeas(ctx, t)}
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

/* The one thread with the planner. On Build it is the plan chat (plan: true): same thread, its own wording. */
export function chat(t, ctx, title = "Describe the trip", { plan = false } = {}) {
  const msgs = t.brief || []; const live = ctx.liveStatus === "unlocked"; const busy = !!ctx.busyTrips?.has(t.id);
  const status = live && ctx.liveVia === "helper" ? `<p class="livestatus small">Live search is on, through Claude Code on this Mac (your Claude plan): Claude searches the web for options.</p>`
    : live ? `<p class="livestatus small">Live search is on: Claude searches the web for options. <button type="button" class="linklike" data-act="live-forget">Forget on this device</button></p>`
    : ctx.liveStatus === "locked" ? `<p class="muted small">Unlock live search above for real options from the web.</p>` : "";
  return `<section class="card chat">
    <h2>${esc(title)}</h2>${status}
    ${msgs.length || busy ? `<ol class="thread">${msgs.map(m => `<li class="msg ${m.who === "app" ? "app" : "you"}${m.error ? " err" : ""}">${esc(m.text)}</li>`).join("")}${busy ? `<li class="msg app busy" aria-live="polite">${busyText(t)}</li>` : ""}</ol>` : plan ? `<p class="muted">Ask for changes in your own words: another campsite, one more rest day, cheaper ferries. Claude updates the plan below and keeps what you marked booked.</p>` : `<p class="muted">Tell the planner about the trip in your own words; it fills in the form below${live ? ", searches the web for options that fit," : ""} and asks about what is missing.</p>`}
    <div class="chatin"><textarea id="chatText" rows="2" placeholder="${plan ? "e.g. Swap the second night for a hut" : msgs.length ? "Add more: a limit for someone, a change of dates, what to skip…" : "e.g. Four of us, ten days in May, from London, about £1,500 each, love the coast"}"></textarea><button type="button" data-act="chat-send" ${busy ? "disabled aria-busy=\"true\"" : ""}>Send</button></div>
  </section>`;
}
/* A plan someone has worked on: a booking past "idea", a confirmation number, or a done to-do. */
const hasPeoplesWork = p => (p.bookings || []).some(b => b.status !== "idea" || b.confirmation) || (p.todo || []).some(x => x.done);
/* What a running live turn is doing: a plan takes much longer than a shortlist. */
export const busyText = t => liveChoice(t) ? "Writing the plan… this can take a few minutes. Keep this tab open." : "Searching live… this can take a minute";
/* Shown only when a locked key is published and this device has not unlocked it. */
function liveCard(ctx) {
  if (ctx.liveStatus !== "locked") return "";
  return `<section class="card livecard">
    <h2>Live search</h2>
    <p class="muted">Uses Gabriel's Claude account to search the web for options. Ask him for the family password.</p>
    <div class="row"><input type="password" id="livePass" autocomplete="current-password" placeholder="Family password" aria-label="Family password" style="flex:1 1 220px;margin:0">
    <button type="button" data-act="live-unlock">Unlock</button></div>
    <label class="chk small"><input type="checkbox" id="liveRemember"> Remember on this device</label>
  </section>`;
}

const LODGING_LABEL = { camping: "Camping", hut: "Huts", hostel: "Hostels", guesthouse: "Guesthouses", hotel: "Hotels", apartment: "Apartments", other: "Other" };
const MODE_LABEL = { flight: "Flight", train: "Train", ferry: "Ferry", drive: "Drive", bus: "Bus" };
const link = s => s && /^https:\/\//.test(s.url) ? `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>` : "";
const seen = d => d ? ` <span class="muted">(seen ${esc(fmtDateY(d))})</span>` : "";
const range = (l, h, c) => l === null && h === null ? "" : l === h || h === null ? fmtMoney(l, c) : l === null ? `up to ${fmtMoney(h, c)}` : `${fmtMoney(l, c)}–${fmtMoney(h, c).replace(/^[^0-9]+/, "")}`;
/* An amount in its own currency, plus the trip currency when it differs and a rate is known. */
function money(n, c, t) { if (n === null || n === undefined) return ""; const tc = t.budget?.currency || "EUR"; const own = fmtMoney(n, c || tc); if (!c || c === tc) return own; const conv = toTripCurrency(n, c, t); return conv === null ? own : `${own} (≈ ${fmtMoney(conv, tc)})`; }

/* Live options from Claude: the pick first, each checked against the trip's limits by the app. */
function optionsCard(t) {
  const main = t.options.filter(o => !o.mention).sort((a, b) => (b.pick ? 1 : 0) - (a.pick ? 1 : 0));
  const mentions = t.options.filter(o => o.mention);
  const card = o => { const c = checkOption(o, t); const a = o.access || {}; const e = o.estimate || {};
    return `<article class="optcard${o.pick ? " pick" : ""}">
      <header><h3>${esc(o.name)}${o.pick ? ` <span class="pickbadge">Claude's pick</span>` : ""}</h3>${o.region ? `<span class="muted small">${esc(o.region)}</span>` : ""}</header>
      ${o.why ? `<p>${esc(o.why)}</p>` : ""}
      ${c.flags.length ? `<p class="chips">${c.flags.map(f => chip("crit", esc(f))).join(" ")}</p>` : ""}
      <dl class="optfacts">
        ${o.weather?.text || o.weather?.highC !== null ? `<dt>Weather</dt><dd>${esc(o.weather.text)}${o.weather.highC !== null ? ` · highs ~${esc(o.weather.highC)}°C` : ""} ${link(o.weather.source)}</dd>` : ""}
        ${o.activities?.length ? `<dt>Do</dt><dd>${o.activities.map(esc).join(" · ")}</dd>` : ""}
        ${a.from || a.time ? `<dt>Getting there</dt><dd>${esc(MODE_LABEL[a.mode] || "")} from ${esc(a.from)}${a.time ? `, ${esc(a.time)}` : ""}${a.connections ? ` (${esc(a.connections)})` : ""}${a.pricePP !== null ? ` · ${money(a.pricePP, a.currency, t)} pp${seen(a.seenOn)}` : ""} ${link(a.source)}</dd>` : ""}
        ${o.lodging?.length ? `<dt>Sleep</dt><dd>${o.lodging.map(l => `${esc(LODGING_LABEL[l.type] || l.type)}${range(l.low, l.high, l.currency || t.budget.currency) ? ` ${range(l.low, l.high, l.currency || t.budget.currency)}/night` : ""}`).join(" · ")}</dd>` : ""}
        ${e.perPerson !== null || e.group !== null ? `<dt>Estimate</dt><dd>${e.perPerson !== null ? `${money(e.perPerson, e.currency, t)} pp` : ""}${e.group !== null ? ` · ${money(e.group, e.currency, t)} for the group` : ""}${e.breakdown?.length ? `<details><summary class="small">Breakdown</summary><ul class="small">${e.breakdown.map(b => `<li>${esc(b.what)}: ${money(b.amount, e.currency, t)}</li>`).join("")}</ul></details>` : ""}</dd>` : ""}
        ${o.tradeOff ? `<dt>Trade-off</dt><dd>${esc(o.tradeOff)}</dd>` : ""}
      </dl>
      ${o.sources?.length ? `<p class="small muted">Sources: ${o.sources.map(s => link(s) + seen(s.seenOn)).join(" · ")}</p>` : ""}
      <footer class="row">${t.chosen === o.id ? `<span class="pill good">Chosen ✓</span> <a href="#build">See the plan →</a>` : `<button type="button" class="outline" data-act="choose-option" data-id="${esc(o.id)}">Choose</button>`}</footer>
    </article>`; };
  return `<section class="card">
    <h2>Options</h2>
    <p class="muted small">Found live by Claude with web search. Prices and weather are from the pages linked, on the date shown; the red flags are the app's own checks against everyone's limits.</p>
    <div class="optcards">${main.map(card).join("")}</div>
    ${mentions.length ? `<p class="optmentions small"><strong>Also considered:</strong> ${mentions.map(o => `${esc(o.name)}${o.mentionWhy ? ` — ${esc(o.mentionWhy)}` : ""}`).join("; ")}</p>` : ""}
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

let unlocking = false;
export const actions = {
  "chat-send": async (el, ctx) => {
    const box = document.getElementById("chatText"); const text = box.value.trim();
    if (!text) { ctx.toast("Write something first."); return; }
    if (ctx.busyTrips?.has(ctx.trip.id)) return;
    if (ctx.liveStatus === "unlocked") { await ctx.runLive(ctx.trip, text); return; }
    describeTurn(ctx.trip, text, { countries: ctx.countries, suggest: suggestFor(ctx) }); ctx.commit();
  },
  "live-unlock": async (el, ctx) => {
    if (unlocking) return; // a double click tries the password once
    unlocking = true; let r;
    try { r = await ctx.vault.unlock(document.getElementById("livePass").value, { remember: document.getElementById("liveRemember").checked }); } finally { unlocking = false; }
    if (!r.ok) { ctx.toast(r.reason === "no-lock" ? "Live search is not set up on this site." : "That password doesn't unlock live search."); return; }
    ctx.rerender();
  },
  "live-forget": async (el, ctx) => { await ctx.vault.forget(); ctx.toast("Live search is locked again on this device."); ctx.rerender(); },
  /* Choosing a live option asks Claude for its plan; a plan written for another option goes to this device's history. */
  "choose-option": async (el, ctx) => {
    const t = ctx.trip; const o = (t.options || []).find(x => x.id === el.dataset.id && !x.mention); if (!o) return;
    if (ctx.busyTrips?.has(t.id)) { ctx.toast("Wait for the current answer first."); return; }
    const old = t.livePlan && t.livePlan.optionId !== o.id ? t.livePlan : null;
    if (old && hasPeoplesWork(old)) {
      const was = (t.options || []).find(x => x.id === old.optionId)?.name || "the current choice";
      if (!ctx.confirm(`The plan for ${was} has bookings marked booked or decided, confirmation numbers or done to-dos. Choosing ${o.name} puts that plan aside on this device: it comes back if you choose ${was} again, but it isn't in share links. Continue?`)) return;
    }
    t.chosen = o.id;
    t._local = t._local || { optionHistory: [], lastSynced: null };
    const hist = t._local.planHistory = (t._local.planHistory || []);
    if (old) { hist.push({ at: new Date().toISOString(), plan: old }); t.livePlan = null; }
    // Choosing an option again brings back its last plan instead of asking Claude for a new one.
    const back = old || !t.livePlan ? hist.map(h => h.plan).filter(p => p && p.optionId === o.id).at(-1) : null;
    if (back) { hist.splice(hist.findIndex(h => h.plan === back), 1); t.livePlan = back; }
    t._local.planHistory = hist.slice(-3);
    ctx.commit(false); ctx.nav("build");
    if (ctx.liveStatus === "unlocked" && !t.livePlan) await ctx.runLive(t, `Write the full plan for ${o.name}.`, { fromApp: true });
  },
  "see-dest": (el, ctx) => { const t = ctx.trip; t._ui = Object.assign(t._ui || {}, { q: el.dataset.name }); ctx.save(); ctx.nav("destinations"); },
  "add-traveller": (el, ctx) => { ctx.trip.travellers.push({ id: uid("p"), name: "", limits: {} }); ctx.commit(); },
  "remove-traveller": (el, ctx) => { ctx.trip.travellers = ctx.trip.travellers.filter(p => p.id !== el.dataset.pid); ctx.commit(); },
  "toggle-country": (el, ctx) => { const code = el.dataset.code; const v = ctx.trip.visitedCountries = ctx.trip.visitedCountries || []; const i = v.indexOf(code); const on = el.tagName === "INPUT" ? el.checked : false; if (on && i < 0) v.push(code); if (!on && i >= 0) v.splice(i, 1); ctx.commit(true); }
};
