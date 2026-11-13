// The live plan Claude writes for a chosen option: the two tools it calls, cleaning their input, merging a
// rewrite by id while keeping what people edited, and the app's own totals and to-do list.
// Pure module: no DOM, no network.
import { uid } from "./state.js";
import { MODES, LODGING_TYPES, obj, S, N, NN, B, SN, SOURCE, MAYBE_SOURCE, isObj, str, num, day, cur, https, source, list } from "./clean.js";
import { toTripCurrency } from "./options.js";

export const BOOKING_STATUSES = ["idea", "decided", "booked", "not-needed"];
export const BOOKING_CATEGORIES = ["transport", "lodging", "permit", "activity", "gear", "other"];
export const ADMIN_STATUSES = ["open", "done"];
const NIGHT_TYPES = [...LODGING_TYPES, "none"];
const LEG_MODES = [...MODES, "walk"];
const POINT_KINDS = ["night", "start", "end", "sight", "transport"];
// The plan's collections, in the order the tools list them; rates go to trip.rates, not into the plan.
export const COLLECTIONS = ["days", "bookings", "permits", "admin", "gear", "food", "todo", "otherCosts", "sources"];

/* ---------- The tools Claude calls ---------- */
const arr = items => ({ type: "array", items });
const en = values => ({ type: "string", enum: values });
const DAY = obj({
  id: { type: "string", description: "d_ then a short name, e.g. d_1" }, date: { type: "string", description: "YYYY-MM-DD" }, move: S,
  km: NN, ascentM: NN, descentM: NN, hours: NN,
  night: obj({ name: S, type: en(NIGHT_TYPES), bookingId: SN }), fallback: S,
  legs: arr(obj({ id: { type: "string", description: "l_ prefix" }, mode: en(LEG_MODES), from: S, to: S, time: S, bookingId: SN, note: S })),
  points: arr(obj({ name: S, lat: NN, lon: NN, kind: en(POINT_KINDS) }))
});
const BOOKING = obj({
  id: { type: "string", description: "b_ prefix" }, what: S, category: en(BOOKING_CATEGORIES), pick: S, alternative: S,
  price: { type: ["number", "null"], description: "for the whole group, in its own currency" }, currency: S, seenOn: S,
  status: en(BOOKING_STATUSES), link: SN, bookBy: SN, details: S, source: MAYBE_SOURCE
});
const PROPS = {
  days: arr(DAY),
  bookings: arr(BOOKING),
  permits: arr(obj({ id: { type: "string", description: "p_ prefix" }, what: S, who: { type: "array", items: S, description: "traveller names, or \"all\"" }, how: S, leadTime: S, bookBy: SN, note: S })),
  admin: arr(obj({ id: { type: "string", description: "a_ prefix" }, traveller: { type: "string", description: "a traveller's name, or \"group\"" }, what: S, note: S })),
  gear: arr(obj({ id: { type: "string", description: "g_ prefix" }, name: S, note: S })),
  food: S,
  todo: arr(obj({ id: { type: "string", description: "t_ prefix" }, date: SN, what: S })),
  otherCosts: arr(obj({ id: { type: "string", description: "c_ prefix" }, what: S, amount: N, currency: S, seenOn: S })),
  sources: arr(SOURCE),
  rates: arr(obj({ currency: S, toTrip: N, seenOn: S, source: MAYBE_SOURCE }))
};
const MONEY_NOTE = "A booking price is for the whole group, in its own currency; give a rate to the trip currency for every other currency used. Never write totals: the app computes them.";
export const WRITE_PLAN_TOOL = {
  name: "write_plan",
  description: "Save the whole plan for the chosen option: days, bookings, permits, admin per traveller, gear, food, to-dos, other costs (food and local costs that aren't booked) and sources. The app shows it in its tabs and keeps what people marked. " + MONEY_NOTE + " Ids use a fixed prefix per collection: d_ day, l_ leg, b_ booking, p_ permit, a_ admin, g_ gear, t_ to-do, c_ other cost.",
  strict: true,
  input_schema: obj(PROPS)
};
export const UPDATE_PLAN_TOOL = {
  name: "update_plan",
  description: "Change the current plan. Send only the collections that change, each in full (null for the others); items are matched by id, so keep existing ids and give new items a new id with the right prefix. " + MONEY_NOTE,
  strict: true,
  input_schema: obj(Object.fromEntries(Object.entries(PROPS).map(([k, v]) => [k, { anyOf: [v, { type: "null" }] }])))
};

/* ---------- Cleaning ---------- */
const date = v => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : null;
const oneOf = (v, values, fallback) => values.includes(v) ? v : fallback;
// Ids keep Claude's readable name when it has the right prefix and is new in this plan; otherwise a fresh uid.
function idMaker(prefix) {
  const seen = new Set(); const re = new RegExp("^" + prefix + "_[A-Za-z0-9_-]{1,40}$");
  return raw => { let id = str(raw); if (!re.test(id) || seen.has(id)) { do { id = uid(prefix); } while (seen.has(id)); } seen.add(id); return id; };
}
const travellers = trip => (Array.isArray(trip.travellers) ? trip.travellers : []).filter(p => isObj(p) && str(p.id));

/* Clean a write_plan input (or a stored plan, with keepIds) into a fresh plan. keepIds marks trusted data, the
   person's own: the fields people own (statuses, confirmations, gear cells, done to-dos) are kept; from Claude they start empty. */
export function normalizePlan(input, trip, { today = new Date().toISOString().slice(0, 10), optionId = null, keepIds = false } = {}) {
  const i = isObj(input) ? input : {}; const own = keepIds;
  const ids = Object.fromEntries(["d", "l", "b", "p", "a", "g", "t", "c"].map(p => [p, idMaker(p)]));
  const people = travellers(trip);
  const plan = { optionId: str(optionId) || null };
  plan.days = list(i.days, d => {
    if (!isObj(d)) return null; const n = isObj(d.night) ? d.night : {};
    return {
      id: ids.d(d.id), date: date(d.date), move: str(d.move), km: num(d.km), ascentM: num(d.ascentM), descentM: num(d.descentM), hours: num(d.hours),
      night: { name: str(n.name), type: oneOf(n.type, NIGHT_TYPES, "other"), bookingId: str(n.bookingId) || null }, fallback: str(d.fallback),
      legs: list(d.legs, l => isObj(l) ? { id: ids.l(l.id), mode: oneOf(l.mode, LEG_MODES, null), from: str(l.from), to: str(l.to), time: str(l.time), bookingId: str(l.bookingId) || null, note: str(l.note) } : null),
      points: list(d.points, p => isObj(p) && str(p.name) ? { name: str(p.name), lat: num(p.lat), lon: num(p.lon), kind: oneOf(p.kind, POINT_KINDS, "sight") } : null)
    };
  });
  plan.bookings = list(i.bookings, b => isObj(b) && str(b.what) ? {
    id: ids.b(b.id), what: str(b.what), category: oneOf(b.category, BOOKING_CATEGORIES, "other"), pick: str(b.pick), alternative: str(b.alternative),
    price: num(b.price), currency: cur(b.currency), seenOn: day(b.seenOn, today), status: oneOf(b.status, BOOKING_STATUSES, "idea"),
    confirmation: own ? str(b.confirmation) : "", link: https(b.link), bookBy: date(b.bookBy), details: str(b.details), source: source(b.source, today)
  } : null);
  plan.permits = list(i.permits, p => isObj(p) && str(p.what) ? { id: ids.p(p.id), what: str(p.what), who: list(p.who, str), how: str(p.how), leadTime: str(p.leadTime), bookBy: date(p.bookBy), note: str(p.note) } : null);
  // Admin comes from Claude as a list keyed by traveller name, and from storage as { travellerId: [...] }.
  plan.admin = {};
  const adminItem = (a, key) => {
    if (!isObj(a) || !str(a.what)) return;
    (plan.admin[key] = plan.admin[key] || []).push({ id: ids.a(a.id), what: str(a.what), status: own ? oneOf(a.status, ADMIN_STATUSES, "open") : "open", note: str(a.note) });
  };
  const byName = name => (people.find(p => str(p.name).toLowerCase() === str(name).toLowerCase() && str(name)) || {}).id || "group";
  if (Array.isArray(i.admin)) for (const a of i.admin) adminItem(a, byName(isObj(a) ? a.traveller : ""));
  else if (isObj(i.admin)) for (const [k, items] of Object.entries(i.admin)) for (const a of Array.isArray(items) ? items : []) adminItem(a, people.some(p => p.id === k) ? k : "group");
  plan.gear = list(i.gear, g => {
    if (!isObj(g) || !str(g.name)) return null;
    const per = {}; if (own && isObj(g.per)) for (const p of people) if (typeof g.per[p.id] === "string") per[p.id] = g.per[p.id];
    return { id: ids.g(g.id), name: str(g.name), note: str(g.note), per };
  });
  plan.food = str(i.food);
  plan.todo = list(i.todo, x => isObj(x) && str(x.what) ? { id: ids.t(x.id), date: date(x.date), what: str(x.what), done: own ? x.done === true : false } : null);
  plan.otherCosts = list(i.otherCosts, c => isObj(c) && str(c.what) ? { id: ids.c(c.id), what: str(c.what), amount: num(c.amount), currency: cur(c.currency), seenOn: day(c.seenOn, today) } : null);
  plan.sources = list(i.sources, s => source(s, today));
  return fixRefs(plan);
}

/* A night or leg pointing at a booking that isn't in the plan points at nothing. */
function fixRefs(plan) {
  const ids = new Set((plan.bookings || []).map(b => b.id));
  for (const d of plan.days || []) {
    if (d.night && !ids.has(d.night.bookingId)) d.night.bookingId = null;
    for (const l of d.legs || []) if (!ids.has(l.bookingId)) l.bookingId = null;
  }
  return plan;
}

/* Rates from a plan input, merged into the trip's. */
export function planRates(input, trip, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const rates = Object.assign({}, trip.rates || {});
  for (const r of isObj(input) && Array.isArray(input.rates) ? input.rates : []) {
    if (!isObj(r)) continue; const c = cur(r.currency), v = num(r.toTrip);
    if (c && v && v > 0) rates[c] = { toTrip: v, seenOn: day(r.seenOn, today), source: source(r.source, today) };
  }
  return rates;
}

/* Merge Claude's write_plan (partial: false) or update_plan (partial: true) into the existing plan.
   Items match by id; the fields people own stay as they were; a booked booking is never dropped. */
export function mergePlan(existing, input, trip, { today = new Date().toISOString().slice(0, 10), partial = false, optionId } = {}) {
  const i = isObj(input) ? input : {};
  const fresh = normalizePlan(i, trip, { today, optionId: optionId !== undefined ? optionId : existing?.optionId });
  const sent = k => !partial || (i[k] !== null && i[k] !== undefined);
  const changed = COLLECTIONS.filter(sent);
  if (!isObj(existing)) return { plan: fresh, changed, rates: planRates(i, trip, { today }) };
  const plan = { optionId: fresh.optionId };
  const old = (k, fallback) => JSON.parse(JSON.stringify(existing[k] ?? fallback));
  const byId = arr => new Map((Array.isArray(arr) ? arr : []).map(x => [x.id, x]));
  for (const k of COLLECTIONS) plan[k] = sent(k) ? fresh[k] : old(k, k === "admin" ? {} : k === "food" ? "" : []);
  if (sent("bookings")) {
    const was = byId(existing.bookings);
    for (const b of plan.bookings) { const e = was.get(b.id); if (!e) continue; b.confirmation = e.confirmation || ""; if (e.status !== "idea") b.status = e.status; }
    const now = new Set(plan.bookings.map(b => b.id));
    for (const e of existing.bookings || []) if (e.status === "booked" && !now.has(e.id)) plan.bookings.push(JSON.parse(JSON.stringify(e)));
  }
  if (sent("gear")) { const was = byId(existing.gear); for (const g of plan.gear) { const e = was.get(g.id); if (e) g.per = Object.assign({}, e.per); } }
  if (sent("todo")) { const was = byId(existing.todo); for (const x of plan.todo) { const e = was.get(x.id); if (e) x.done = e.done === true; } }
  if (sent("admin")) {
    const was = byId(Object.values(existing.admin || {}).flat());
    for (const items of Object.values(plan.admin)) for (const a of items) { const e = was.get(a.id); if (e) a.status = e.status; }
  }
  return { plan: fixRefs(plan), changed, rates: planRates(i, trip, { today }) };
}

/* ---------- The chosen live option and its plan ---------- */
export function liveChoice(trip) {
  if (!trip || typeof trip.chosen !== "string" || !Array.isArray(trip.options)) return null;
  return trip.options.find(o => o && o.id === trip.chosen) || null;
}
/* The plan only when it belongs to the chosen option: a second choice never shows the first one's plan. */
export function currentPlan(trip) {
  const p = trip && trip.livePlan;
  return isObj(p) && liveChoice(trip) && p.optionId === trip.chosen ? p : null;
}

/* ---------- Totals and the to-do list (computed here, never written by Claude) ---------- */
export const CATEGORY_LABEL = { transport: "Transport", lodging: "Lodging", permit: "Permits", activity: "Activities", gear: "Gear", other: "Other", local: "Food & local" };

/* Bookings that aren't "not needed" plus other costs, each converted to the trip currency. A price with no rate
   is named in `missing` and left out; `counted` is how many prices went into the total. */
export function planTotals(plan, trip) {
  const byCategory = {}; const missing = []; let total = 0, counted = 0;
  const add = (what, amount, currency, label) => {
    if (amount === null || amount === undefined || !Number.isFinite(amount)) return;
    const v = toTripCurrency(amount, currency, trip);
    if (v === null) { missing.push({ what, currency }); return; }
    total += v; counted++; byCategory[label] = (byCategory[label] || 0) + v;
  };
  for (const b of plan?.bookings || []) if (b.status !== "not-needed") add(b.what, b.price, b.currency, CATEGORY_LABEL[b.category] || CATEGORY_LABEL.other);
  for (const c of plan?.otherCosts || []) add(c.what, c.amount, c.currency, CATEGORY_LABEL.local);
  const people = Array.isArray(trip.travellers) ? trip.travellers.length : 0;
  const budget = trip.budget?.total || 0;
  return { total, perPerson: Math.round(total / (people || 1)), byCategory, missing, overBudget: budget > 0 && total > budget, counted };
}

/* The plan's own to-dos, plus "Book …" for each booking with a book-by date and "Apply: …" for each permit,
   ordered by date with undated items last. */
export function planTodo(plan) {
  const items = [];
  for (const x of plan?.todo || []) items.push({ key: "todo:" + x.id, date: x.date || null, what: x.what, done: x.done === true, from: "todo", id: x.id });
  for (const b of plan?.bookings || []) if (b.bookBy && b.status !== "not-needed") items.push({ key: "booking:" + b.id, date: b.bookBy, what: "Book " + b.what, done: b.status === "booked", from: "booking", id: b.id });
  for (const p of plan?.permits || []) items.push({ key: "permit:" + p.id, date: p.bookBy || null, what: "Apply: " + p.what, done: false, from: "permit", id: p.id });
  return items.map((x, i) => [x, i]).sort(([a, i], [b, j]) => (a.date ? 0 : 1) - (b.date ? 0 : 1) || (a.date && b.date ? a.date.localeCompare(b.date) : 0) || i - j).map(([x]) => x);
}
