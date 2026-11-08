import { esc, fmtMoney, chip, altClass, tempClass, CROWD, hrs, splitBar, step, empty, fmtDate } from "../ui.js";
import { computePlan, rebalance, climateFor } from "../compute.js";
import { KINDS, selectedBlocks, LODGING } from "../criteria.js";
import { seasonFit } from "../scoring.js";

export function currentDest(ctx) {
  const t = ctx.trip; const id = t._ui?.buildId || t.chosen || (ctx.dests[0] && ctx.dests[0].id);
  return ctx.dests.find(d => d.id === id) || ctx.dests[0] || null;
}

export function render(ctx) {
  const t = ctx.trip; const d = currentDest(ctx);
  if (!d) return `<section class="card">${empty("No destinations for this kind yet", "Add one to the library.")}</section>`;
  const c = computePlan(d, t); const plan = c.plan; const cur = t.budget.currency; const kind = KINDS[t.kind];
  const cl = climateFor(d, t); const sf = seasonFit(d, t);
  const picker = `<select data-act-change="pick-dest" aria-label="Destination">${ctx.dests.map(x => `<option value="${x.id}" ${x.id === d.id ? "selected" : ""}>${esc(x.name)}${t.chosen === x.id ? " ✓" : ""}</option>`).join("")}</select>`;
  const groups = t.kind === "explore" ? [["city", kind.groups.city], ["hike", kind.groups.hike], ["beach", kind.groups.beach], ["wildlife", kind.groups.wildlife]] : [["stage", kind.groups.stage], ["city", kind.groups.city]];
  const alerts = [];
  for (const w of c.warnings) alerts.push(/days planned in a/.test(w)
    ? `<div class="alert crit row between"><span>${esc(w)} Drop ${c.alloc - c.len} or change the dates.</span><button type="button" class="small" data-act="fit-dates">Fit to my dates</button></div>`
    : `<div class="alert">${esc(w)}</div>`);
  if (c.flags.length) alerts.push(`<div class="alert crit"><strong>Limits broken:</strong> ${c.flags.map(esc).join("; ")}.</div>`);
  if (!alerts.length && c.len) alerts.push(`<div class="alert ok">${Math.max(c.free, 0)} travel day${c.free === 1 ? "" : "s"} left, nothing flagged.</div>`);

  const stageList = t.kind !== "explore";
  const blocksHtml = stageList ? orderedList(d, plan, c, t) : groups.filter(([g]) => d.blocks.some(b => b.type === g)).map(([g, label]) => `<div class="col"><h4>${esc(label)} <span class="muted num">${d.blocks.filter(b => b.type === g && plan.picks[b.id].on).reduce((a, b) => a + plan.picks[b.id].days, 0)} d</span></h4>${d.blocks.filter(b => b.type === g).map(b => blockRow(b, plan, c, t)).join("")}</div>`).join("");

  return `
  <section class="card">
    <div class="row between"><div><span class="kind">${esc(d.region)}</span><h2>${esc(d.name)}</h2></div><div class="row">${picker}${t.chosen === d.id ? `<span class="pill good">chosen</span>` : `<button type="button" class="outline" data-act="choose-here" data-id="${d.id}">Choose this one</button>`}</div></div>
    <p class="muted">${esc(d.tagline)}</p>
    <div class="row presets"><span class="muted">Itinerary:</span>${d.presets.map((p, i) => `<button type="button" class="outline secondary small" data-act="preset" data-id="${d.id}" data-i="${i}" aria-pressed="${plan.presetIdx === i}">${esc(p.name)}</button>`).join("")}<button type="button" class="outline secondary small" data-act="clear-plan" data-id="${d.id}">Start empty</button></div>
    <div class="row splitctl">
      ${t.kind === "explore" ? `<span><i class="sw ci"></i>Cities</span>${step("days-group", `data-id="${d.id}" data-g="city"`, c.city + " d", c.city > 0, c.alloc < c.len, "City days")}
      <span><i class="sw hi"></i>Outdoors</span>${step("days-group", `data-id="${d.id}" data-g="outdoor"`, c.outdoor + " d", c.outdoor > 0, c.alloc < c.len, "Outdoor days")}` : ""}
      <span><i class="sw re"></i>Rest / spare</span>${step("rest", `data-id="${d.id}"`, c.rest + " d", c.rest > 0, c.alloc < c.len, "Rest days")}
      <span class="muted">${Math.max(c.free, 0)} d travel</span>
      ${stageList ? `<label class="chk"><input type="checkbox" data-act="guided" data-id="${d.id}" ${plan.guided ? "checked" : ""}> With a guide (+${fmtMoney((d.rates.guide || 0), cur)} pp per stage day)</label>` : ""}
    </div>
    ${splitBar(c)}
  </section>
  <section class="card">${stageList ? blocksHtml : `<div class="cols">${blocksHtml}</div>`}</section>
  <section class="card grid2">
    <div>
      <h3>Days: ${c.city} ${t.kind === "explore" ? "in cities" : "in town"} · ${c.outdoor} ${t.kind === "explore" ? "outdoors" : "on stages"} · ${c.rest} rest · ${Math.max(c.free, 0)} travel</h3>
      ${alerts.join("")}
      ${stageList ? `<p class="muted num">Total ascent ${c.totalAscent.toLocaleString("en-GB")} m · hardest day ${esc(c.maxGradeLabel || "—")}, ${c.maxAscent} m, ${c.maxHours} h · highest ${c.maxAlt.toLocaleString("en-GB")} m</p>` : ""}
      <h4>Weather and season for ${fmtDate(t.dates.start)} – ${fmtDate(t.dates.end)}</h4>
      ${cl ? `<p>${esc(cl.place)}: days around <strong>${cl.high}°C</strong>, nights <strong>${cl.low}°C</strong>, about <strong>${cl.rainDays}</strong> rain days a month${cl.snow ? ", <strong>snow</strong> likely on the ground or falling" : ""}. Season fit <strong>${sf.score}/100</strong>.</p>` : ""}
      <ul class="muted small">${(d.season.notes || []).map(n => `<li>${esc(n)}</li>`).join("")}${sf.events.map(e => `<li><strong>${esc(e.name)}</strong> falls in your dates${e.note ? ": " + esc(e.note) : ""}.</li>`).join("")}</ul>
    </div>
    <div>
      <h3>Budget per person</h3>
      <table class="budget num">
        <tr><td>${c.access.mode === "flight" ? "Flights" : c.access.mode === "train" ? "Trains" : c.access.mode === "ferry" ? "Train + ferry" : "Getting there"} from ${esc(t.origin.city)} <span class="muted small">(${esc(c.access.route)})</span></td><td>${fmtMoney(c.accessCost, cur)}</td></tr>
        ${c.extra ? `<tr><td>Transport inside the trip</td><td>${fmtMoney(c.extra, cur)}</td></tr>` : ""}
        ${c.city ? `<tr><td>${t.kind === "explore" ? "City days" : "Town days"} (${c.city} × ~${fmtMoney((d.rates.city ?? d.rates.transit) * (LODGING[t.lodging]?.factor || 1), cur)})</td><td>${fmtMoney(c.cityCost, cur)}</td></tr>` : ""}
        <tr><td>${t.kind === "explore" ? "Outdoor days: guide or outfitter, lodging, food, van" : `Stage days: hut half board, lunches${plan.guided ? ", guide" : ""}`}</td><td>${fmtMoney(c.outdoorCost, cur)}</td></tr>
        <tr><td>Rest and travel days (${c.rest + Math.max(c.free, 0)} × ${fmtMoney((d.rates.transit || 0) * (LODGING[t.lodging]?.factor || 1), cur)})</td><td>${fmtMoney(c.transitCost, cur)}</td></tr>
        <tr><td>Contingency 8%</td><td>${fmtMoney(c.cont, cur)}</td></tr>
        <tr class="total"><td>Per person</td><td>${fmtMoney(c.pp, cur)}</td></tr>
        <tr class="total"><td>Group of ${c.n}${t.budget.total ? ` · ${c.fits ? fmtMoney(-c.over, cur) + " under the cap" : fmtMoney(c.over, cur) + " over the cap"}` : ""}</td><td>${fmtMoney(c.total, cur)}</td></tr>
      </table>
      <p class="muted small">${esc(d.lodgingAssumption || "")}. Figures are ±25% planning numbers.</p>
    </div>
  </section>
  <p class="row"><a href="#itinerary" role="button">Next: itinerary →</a> <a href="#plan" role="button" class="outline">Plan & book</a></p>`;
}

function blockRow(b, plan, c, t) {
  const p = plan.picks[b.id]; const lim = c.limits;
  return `<div class="block ${p.on ? "on" : ""}">
    <div class="blockrow">
      <input type="checkbox" id="chk-${b.id}" data-act="toggle-block" data-id="${b.id}" ${p.on ? "checked" : ""} aria-label="Include ${esc(b.name)}">
      <label for="chk-${b.id}"><div class="name">${esc(b.name)}</div><div class="muted small">${esc(b.place || "")}</div></label>
      ${step("days", `data-id="${b.id}"`, p.on ? p.days + " d" : "—", p.on && p.days > b.minDays, p.on && p.days < b.maxDays, "Days")}
    </div>
    <div class="chips">
      ${b.maxAltitudeM >= 800 || b.type !== "city" ? chip(altClass(b.maxAltitudeM, lim.maxAltitudeM), "↑ " + b.maxAltitudeM.toLocaleString("en-GB") + " m") : ""}
      ${typeof b.dayHighC === "number" ? chip(tempClass(b.dayHighC, lim.maxDayHighC, lim.minDayHighC), "~" + b.dayHighC + "°C") : ""}
      ${chip(CROWD[b.crowd][0], CROWD[b.crowd][1])}
      ${b.transitHours ? chip("", "⏱ " + hrs(b.transitHours) + " to get there") : ""}
      ${b.history ? chip("", "History: " + esc(b.history)) : ""}
      ${b.guidebookPick ? chip("gb", "Guidebook pick") : ""}
      ${b.extraTransportCost ? chip("warn", "+" + fmtMoney(b.extraTransportCost, t.budget.currency) + " transport") : ""}
    </div>
    ${b.see?.length ? `<details><summary>What you'd see</summary><ul>${b.see.map(s => `<li>${esc(s)}</li>`).join("")}</ul></details>` : ""}
    ${b.note ? `<p class="muted small">${esc(b.note)}</p>` : ""}
  </div>`;
}

function orderedList(d, plan, c, t) {
  const lim = c.limits; const order = plan.order || d.blocks.map(b => b.id); const byId = Object.fromEntries(d.blocks.map(b => [b.id, b]));
  let dayNo = 1;
  return `<ol class="stages">${order.map((id, idx) => { const b = byId[id]; if (!b) return ""; const p = plan.picks[b.id]; const label = p.on ? `Day ${dayNo}${p.days > 1 ? "–" + (dayNo + p.days - 1) : ""}` : ""; if (p.on) dayNo += p.days;
    return `<li class="block ${p.on ? "on" : ""} ${b.type}">
      <div class="blockrow">
        <input type="checkbox" id="chk-${b.id}" data-act="toggle-block" data-id="${b.id}" ${p.on ? "checked" : ""} aria-label="Include ${esc(b.name)}">
        <label for="chk-${b.id}"><div class="name">${label ? `<span class="dayno">${label}</span> ` : ""}${esc(b.name)}</div><div class="muted small">${esc(b.place || "")}${b.hut ? ` · 🛏 ${esc(b.hut.name)}` : ""}</div></label>
        <span class="row">
          ${step("days", `data-id="${b.id}"`, p.on ? p.days + " d" : "—", p.on && p.days > b.minDays, p.on && p.days < b.maxDays, "Days")}
          <button type="button" class="outline secondary small" data-act="move" data-id="${b.id}" data-d="-1" ${idx === 0 ? "disabled" : ""} aria-label="Move up">↑</button><button type="button" class="outline secondary small" data-act="move" data-id="${b.id}" data-d="1" ${idx === order.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
        </span>
      </div>
      <div class="chips">
        ${b.type === "stage" ? chip(b.difficulty && lim[t.kind === "skitour" ? "maxGradeSki" : "maxGradeHike"] && c.flags.some(f => f.startsWith(b.name + " is")) ? "crit" : "", esc(b.difficulty || "")) : ""}
        ${b.ascentM !== undefined ? chip(lim.maxDailyAscentM && b.ascentM > lim.maxDailyAscentM ? "crit" : "", `↗ ${b.ascentM} m ↘ ${b.descentM ?? 0} m`) : ""}
        ${b.hours ? chip(lim.maxDailyHours && b.hours > lim.maxDailyHours ? "crit" : "", b.hours + " h") : ""}
        ${b.distanceKm ? chip("", b.distanceKm + " km") : ""}
        ${chip(altClass(b.maxAltitudeM, lim.maxAltitudeM), "↑ " + b.maxAltitudeM.toLocaleString("en-GB") + " m")}
        ${typeof b.dayHighC === "number" ? chip("", "~" + b.dayHighC + "°C") : ""}
        ${chip(CROWD[b.crowd][0], CROWD[b.crowd][1])}
        ${b.transitHours ? chip("", "⏱ " + hrs(b.transitHours)) : ""}
        ${b.hut?.bookAheadMonths ? chip("warn", `book ${b.hut.bookAheadMonths} mo ahead`) : ""}
      </div>
      ${b.see?.length ? `<details><summary>Notes and highlights</summary><ul>${b.see.map(s => `<li>${esc(s)}</li>`).join("")}</ul></details>` : ""}
      ${b.note ? `<p class="muted small">${esc(b.note)}</p>` : ""}
    </li>`; }).join("")}</ol>`;
}

export const actions = {
  "pick-dest": (el, ctx) => { ctx.trip._ui = ctx.trip._ui || {}; ctx.trip._ui.buildId = el.value; ctx.commit(); },
  "choose-here": (el, ctx) => { ctx.trip.chosen = el.dataset.id; ctx.commit(); },
  "fit-dates": (el, ctx) => { const d = currentDest(ctx); if (ctx.compute.fitToDates(d, ctx.trip)) { ctx.commit(); ctx.toast("Trimmed to fit your dates; adjust the days below."); } },
  "preset": (el, ctx) => { const d = currentDest(ctx); ctx.trip.plans[d.id] = ctx.compute.applyPreset(d, +el.dataset.i); ctx.commit(); },
  "clear-plan": (el, ctx) => { const d = currentDest(ctx); const p = ctx.compute.applyPreset(d, -1); p.rest = 0; ctx.trip.plans[d.id] = p; ctx.commit(); },
  "toggle-block": (el, ctx) => { const d = currentDest(ctx); const p = ctx.compute.ensurePlan(ctx.trip, d); p.picks[el.dataset.id].on = el.checked; p.presetIdx = -1; ctx.commit(); },
  "days": (el, ctx) => { const d = currentDest(ctx); const p = ctx.compute.ensurePlan(ctx.trip, d); const b = d.blocks.find(x => x.id === el.dataset.id); const pk = p.picks[b.id]; pk.days = Math.min(b.maxDays, Math.max(b.minDays, pk.days + (+el.dataset.d))); p.presetIdx = -1; ctx.commit(); },
  "days-group": (el, ctx) => { const d = currentDest(ctx); const c = computePlan(d, ctx.trip); const cur = el.dataset.g === "city" ? c.city : c.outdoor; rebalance(d, c.plan, el.dataset.g, cur + (+el.dataset.d)); ctx.commit(); },
  "rest": (el, ctx) => { const d = currentDest(ctx); const p = ctx.compute.ensurePlan(ctx.trip, d); p.rest = Math.max(0, (p.rest || 0) + (+el.dataset.d)); ctx.commit(); },
  "guided": (el, ctx) => { const d = currentDest(ctx); const p = ctx.compute.ensurePlan(ctx.trip, d); p.guided = el.checked; ctx.commit(); },
  "move": (el, ctx) => { const d = currentDest(ctx); const p = ctx.compute.ensurePlan(ctx.trip, d); const o = p.order = p.order && p.order.length ? p.order : d.blocks.map(b => b.id); const i = o.indexOf(el.dataset.id); const j = i + (+el.dataset.d); if (i < 0 || j < 0 || j >= o.length) return; [o[i], o[j]] = [o[j], o[i]]; ctx.commit(); }
};
