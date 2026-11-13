// The live plan's cards, shared by Build, Itinerary, Plan & book, Money and Share. Every value from Claude or a
// share link is escaped; links must be https. Numbers come from the plan's fields or from src/liveplan.js.
import { esc, fmtMoney, fmtDate, chip, empty } from "../ui.js";
import { checkOption, toTripCurrency } from "../options.js";
import { currentPlan, liveChoice, planTotals, planTodo, CATEGORY_LABEL, BOOKING_STATUSES } from "../liveplan.js";
import { uid } from "../state.js";
import { chat, actions as setupActions } from "./setup.js";

export const STATUS_LABEL = { idea: "Idea", decided: "Decided", booked: "Booked", "not-needed": "Not needed" };
const STATUS_CLASS = { idea: "", decided: "warn", booked: "good", "not-needed": "" };
const MODE_LABEL = { flight: "Flight", train: "Train", ferry: "Ferry", drive: "Drive", bus: "Bus", walk: "Walk" };
const NIGHT_LABEL = { camping: "Camping", hut: "Hut", hostel: "Hostel", guesthouse: "Guesthouse", hotel: "Hotel", apartment: "Apartment", other: "", none: "No night" };
const safeUrl = u => typeof u === "string" && /^https:\/\//.test(u) ? u : null;
const link = (url, label) => safeUrl(url) ? `<a href="${esc(url)}" target="_blank" rel="noopener">${esc(label)}</a>` : "";
const n = v => typeof v === "number" && Number.isFinite(v) ? v : null;
const pill = status => `<span class="pill ${STATUS_CLASS[status] || ""}">${esc(STATUS_LABEL[status] || status)}</span>`;
/* An amount in its own currency, plus the trip currency when it differs and a rate is known. */
function money(amount, currency, t) {
  if (n(amount) === null) return "";
  const tc = t.budget?.currency || "EUR"; const own = fmtMoney(amount, currency || tc);
  if (!currency || currency === tc) return own;
  const conv = toTripCurrency(amount, currency, t); return conv === null ? own : `${own} (≈ ${fmtMoney(conv, tc)})`;
}

/* ---------- Waiting for a plan ---------- */
export function waitingCard(t, ctx) {
  const o = liveChoice(t); const name = o ? o.name : "this destination";
  if (ctx.busyTrips?.has(t.id)) return `<section class="card"><p class="msg app busy" aria-live="polite">Writing the plan… this can take a few minutes</p></section>`;
  if (ctx.liveStatus === "unlocked") return `<section class="card">${empty("No plan yet.", `Ask Claude to write the days, bookings, gear and to-dos for ${esc(name)}.`, `<button type="button" data-act="ask-plan">Write the plan</button>`)}</section>`;
  return `<section class="card">${empty("No plan yet.", `<a href="#setup">Unlock live search in Setup to get the plan</a> for ${esc(name)}.`)}</section>`;
}

/* ---------- Build ---------- */
export function planChat(t, ctx) { return chat(t, ctx, "Change the plan", { plan: true }); }
export function flagsCard(t) {
  const o = liveChoice(t); if (!o) return "";
  const c = checkOption(o, t);
  return `<section class="card"><div class="row between"><div><span class="kind">${esc(o.region || "")}</span><h2>${esc(o.name)}</h2></div><a href="#setup" class="small">Other options →</a></div>
    ${c.flags.length ? `<div class="alert crit"><strong>Limits broken:</strong> ${c.flags.map(esc).join("; ")}.</div>` : ""}</section>`;
}

export function daysCard(t) {
  const p = currentPlan(t); if (!p) return "";
  const bookings = new Map((p.bookings || []).map(b => [b.id, b]));
  const rows = (p.days || []).map((d, i) => {
    const facts = [n(d.km) !== null ? `${esc(d.km)} km` : "", n(d.ascentM) !== null ? `↗ ${esc(d.ascentM)} m` : "", n(d.descentM) !== null ? `↘ ${esc(d.descentM)} m` : "", n(d.hours) !== null ? `${esc(d.hours)} h` : ""].filter(Boolean).join(" · ");
    const nb = d.night?.bookingId ? bookings.get(d.night.bookingId) : null;
    const legs = (d.legs || []).map(l => `<li>${esc(MODE_LABEL[l.mode] || "")} ${esc(l.from)}${l.to ? ` → ${esc(l.to)}` : ""}${l.time ? `, ${esc(l.time)}` : ""}${l.bookingId && bookings.get(l.bookingId) ? " " + pill(bookings.get(l.bookingId).status) : ""}${l.note ? ` <span class="muted">${esc(l.note)}</span>` : ""}</li>`).join("");
    return `<tr><td class="num">${i + 1}</td><td>${d.date ? esc(fmtDate(d.date)) : "—"}</td>
      <td>${esc(d.move)}${facts ? `<br><span class="muted small">${facts}</span>` : ""}${legs ? `<ul class="small legs">${legs}</ul>` : ""}</td>
      <td>${esc(d.night?.name || "")}${NIGHT_LABEL[d.night?.type] ? ` <span class="muted small">${esc(NIGHT_LABEL[d.night.type])}</span>` : ""}${nb ? " " + pill(nb.status) : ""}</td>
      <td class="small">${esc(d.fallback)}</td></tr>`;
  }).join("");
  return `<section class="card"><h3>Day by day</h3>
    ${rows ? `<div class="scroller"><table class="itin daytable"><thead><tr><th>Day</th><th>Date</th><th>What</th><th>Night</th><th>Fallback</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">The plan has no days yet. Ask for them in the chat above.</p>`}
  </section>`;
}

export function gearCard(t) {
  const p = currentPlan(t); if (!p) return "";
  const people = t.travellers || [];
  const rows = (p.gear || []).map((g, i) => `<tr><td><strong>${esc(g.name)}</strong>${g.note ? `<br><span class="muted small">${esc(g.note)}</span>` : ""}</td>${people.map(pp => `<td><input type="text" data-bind="livePlan.gear.${i}.per.${esc(pp.id)}" value="${esc(g.per?.[pp.id] || "")}" placeholder="has / brings / buys" aria-label="${esc(g.name)}: ${esc(pp.name || "traveller")}"></td>`).join("")}</tr>`).join("");
  return `<section class="card"><h3>Gear</h3>
    <p class="muted small">Write who has, brings or buys each thing.</p>
    ${rows ? `<div class="scroller"><table class="itin geartable"><thead><tr><th>Gear</th>${people.map(pp => `<th>${esc(pp.name || "Traveller")}</th>`).join("")}</tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">No gear listed yet.</p>`}
    <form class="row" data-form="gear-add"><input name="name" required placeholder="Add gear (e.g. head torch)" aria-label="Gear to add" style="flex:1 1 200px;margin:0"><button type="submit" class="outline">Add</button></form>
    ${p.food ? `<h4>Food</h4><p>${esc(p.food)}</p>` : ""}
  </section>`;
}

/* ---------- Plan & book ---------- */
export function bookingsCard(t) {
  const p = currentPlan(t); if (!p) return "";
  const rows = (p.bookings || []).map((b, i) => `<tr class="${b.status === "not-needed" ? "muted" : ""}">
    <td><strong>${esc(b.what)}</strong> <span class="muted small">${esc(CATEGORY_LABEL[b.category] || "")}</span>${b.pick ? `<br><span class="small">${esc(b.pick)}</span>` : ""}${b.alternative ? `<br><span class="muted small">Or: ${esc(b.alternative)}</span>` : ""}${b.details ? `<br><span class="muted small">Enter: ${esc(b.details)}</span>` : ""}</td>
    <td class="num">${n(b.price) !== null ? money(b.price, b.currency, t) : `<span class="muted">no price</span>`}${b.seenOn && n(b.price) !== null ? `<br><span class="muted small">seen ${esc(fmtDate(b.seenOn))}</span>` : ""}${b.source ? `<br><span class="small">${link(b.source.url, b.source.name)}</span>` : ""}</td>
    <td class="small">${b.bookBy ? esc(fmtDate(b.bookBy)) : ""}</td>
    <td>${link(b.link, "Book →")}</td>
    <td><select data-bind="livePlan.bookings.${i}.status" aria-label="Status of ${esc(b.what)}">${BOOKING_STATUSES.map(s => `<option value="${s}" ${b.status === s ? "selected" : ""}>${STATUS_LABEL[s]}</option>`).join("")}</select></td>
    <td><input type="text" data-bind="livePlan.bookings.${i}.confirmation" value="${esc(b.confirmation || "")}" placeholder="confirmation no." aria-label="Confirmation for ${esc(b.what)}"></td></tr>`).join("");
  return `<section class="card"><h3>Bookings</h3>
    <p class="muted small">Prices are for the whole group, from the page linked on the date shown. Links open the booking site prefilled where it allows; nothing is booked from here.</p>
    ${rows ? `<div class="scroller"><table class="itin booktable"><thead><tr><th>What</th><th>Price</th><th>Book by</th><th>Link</th><th>Status</th><th>Confirmation</th></tr></thead><tbody>${rows}</tbody></table></div>` : `<p class="muted">Nothing to book yet.</p>`}
  </section>`;
}

export function permitsCard(t) {
  const p = currentPlan(t); if (!p) return "";
  const permits = (p.permits || []).map(x => `<li><strong>${esc(x.what)}</strong>${x.who?.length ? ` <span class="muted small">for ${x.who.map(esc).join(", ")}</span>` : ""}${x.how ? `<br><span class="small">${esc(x.how)}</span>` : ""}${x.leadTime || x.bookBy ? `<br><span class="muted small">${x.leadTime ? esc(x.leadTime) + " ahead" : ""}${x.bookBy ? `${x.leadTime ? " · " : ""}apply by ${esc(fmtDate(x.bookBy))}` : ""}</span>` : ""}${x.note ? `<br><span class="muted small">${esc(x.note)}</span>` : ""}</li>`).join("");
  const admin = p.admin || {};
  const who = [...(t.travellers || []).map(pp => [pp.id, pp.name || "Traveller"]), ["group", "Everyone"]].filter(([id]) => (admin[id] || []).length);
  return `<section class="card"><h3>Permits and admin</h3>
    ${permits ? `<ul class="steps">${permits}</ul>` : `<p class="muted">No permits needed, as far as Claude found.</p>`}
    ${who.map(([id, name]) => `<h4>${esc(name)}</h4><ul class="steps">${admin[id].map(a => `<li class="${a.status === "done" ? "done" : ""}">${esc(a.what)}${a.note ? ` <span class="muted small">${esc(a.note)}</span>` : ""}</li>`).join("")}</ul>`).join("")}
  </section>`;
}

export function todoCard(t) {
  const p = currentPlan(t); if (!p) return "";
  const own = new Map((p.todo || []).map((x, i) => [x.id, i]));
  const items = planTodo(p).map(x => `<li class="${x.done ? "done" : ""}">${x.from === "todo"
    ? `<label class="chk"><input type="checkbox" data-bind="livePlan.todo.${own.get(x.id)}.done" data-type="bool" ${x.done ? "checked" : ""}> <span>${esc(x.what)}</span></label>`
    : `<span>${x.done ? "✓ " : ""}${esc(x.what)} <span class="muted small">(${x.from === "booking" ? "status in Bookings above" : "permit above"})</span></span>`}
    ${x.date ? ` <span class="muted small">by ${esc(fmtDate(x.date))}</span>` : ""}</li>`).join("");
  return `<section class="card"><h3>To do</h3>${items ? `<ul class="steps todolist">${items}</ul>` : `<p class="muted">Nothing to do yet.</p>`}</section>`;
}

export function sourcesCard(t) {
  const p = currentPlan(t); if (!p) return "";
  const s = (p.sources || []).filter(x => safeUrl(x.url));
  return s.length ? `<section class="card"><h3>Sources</h3><ul class="small">${s.map(x => `<li>${link(x.url, x.name)} <span class="muted">(seen ${esc(fmtDate(x.seenOn))})</span></li>`).join("")}</ul></section>` : "";
}

/* ---------- Money ---------- */
export function totalsFacts(t) {
  const p = currentPlan(t); const cur = t.budget?.currency || "EUR";
  if (!p) return { fact: `<div class="fact"><span class="k">Plan total</span><span class="v num">no plan yet</span></div>`, notes: "", total: null };
  const r = planTotals(p, t);
  const notes = `${Object.keys(r.byCategory).length ? `<p class="small">${Object.entries(r.byCategory).map(([k, v]) => `${esc(k)} ${fmtMoney(v, cur)}`).join(" · ")}</p>` : ""}
    ${r.missing.length ? `<p class="small alert">No exchange rate yet, so left out of the plan total: ${r.missing.map(m => `${esc(m.what)} (${esc(m.currency || "no currency")})`).join(", ")}.</p>` : ""}`;
  return { fact: `<div class="fact"><span class="k">Plan total (${esc(liveChoice(t)?.name || "")}, ${fmtMoney(r.perPerson, cur)} pp)</span><span class="v num ${r.overBudget ? "crit" : ""}">${fmtMoney(r.total, cur)}</span></div>`, notes, total: r.total };
}

/* ---------- Share ---------- */
export function summaryLines(t) {
  const o = liveChoice(t); if (!o) return [];
  const p = currentPlan(t); const cur = t.budget?.currency || "EUR";
  const lines = ["", `Destination: ${o.name}${o.region ? " (" + o.region + ")" : ""}`];
  if (!p) return lines.concat("No plan yet.");
  const r = planTotals(p, t);
  lines.push(`Plan total ${fmtMoney(r.total, cur)}, ${fmtMoney(r.perPerson, cur)} pp${t.budget?.total ? (r.overBudget ? " (over budget)" : " (within budget)") : ""}${r.missing.length ? `; not counted (no rate): ${r.missing.map(m => m.what).join(", ")}` : ""}`);
  lines.push("", "Day by day:");
  (p.days || []).forEach((d, i) => lines.push(`  ${i + 1}. ${d.date || ""}  ${d.move}${d.night?.name ? " — " + d.night.name : ""}`));
  if ((p.bookings || []).length) { lines.push("", "Bookings:"); for (const b of p.bookings) lines.push(`  [${STATUS_LABEL[b.status] || b.status}] ${b.what}${n(b.price) !== null ? " — " + fmtMoney(b.price, b.currency || cur) : ""}${b.confirmation ? " · " + b.confirmation : ""}`); }
  const open = planTodo(p).filter(x => !x.done);
  if (open.length) { lines.push("", "To do:"); for (const x of open.slice(0, 12)) lines.push(`  [ ] ${x.what}${x.date ? " (by " + x.date + ")" : ""}`); }
  return lines;
}

/* ---------- Actions shared by the tabs that show the plan ---------- */
export const actions = {
  "chat-send": setupActions["chat-send"],
  "ask-plan": async (el, ctx) => { const o = liveChoice(ctx.trip); if (o && ctx.liveStatus === "unlocked") await ctx.runLive(ctx.trip, `Write the full plan for ${o.name}.`); }
};
export const forms = {
  "gear-add": (data, ctx) => {
    const p = currentPlan(ctx.trip); const name = String(data.name || "").trim(); if (!p || !name) return;
    p.gear = p.gear || []; p.gear.push({ id: uid("g"), name, note: "", per: {} }); ctx.commit();
  }
};
