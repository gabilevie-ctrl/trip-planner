import test from "node:test"; import assert from "node:assert/strict";
import { WRITE_PLAN_TOOL, UPDATE_PLAN_TOOL, normalizePlan, mergePlan, currentPlan, liveChoice } from "../src/liveplan.js";
import { cleanImported } from "../src/options.js";
import { newTrip, migrate } from "../src/state.js";

const TODAY = "2026-11-09";
import { planInput } from "./plan-fixtures.mjs";
function situTrip() {
  const t = newTrip("explore");
  t.travellers = [{ id: "g", name: "Gabriel", limits: {} }, { id: "s", name: "Situ", limits: { countryZone: "schengen" } }];
  t.budget = { total: 1500, currency: "GBP" }; t.dates = { start: "2027-01-02", end: "2027-01-03" }; t.origin = { city: "London", region: "uk" };
  t.options = [{ id: "o_lp", name: "La Palma", countryCodes: ["ES"] }, { id: "o_ma", name: "Southern Morocco", countryCodes: ["MA"] }];
  t.chosen = "o_lp";
  return t;
}
const nulls = () => Object.fromEntries(Object.keys(planInput()).map(k => [k, null]));

test("the tools are strict and update_plan has every write_plan key, nullable", () => {
  assert.equal(WRITE_PLAN_TOOL.name, "write_plan"); assert.equal(UPDATE_PLAN_TOOL.name, "update_plan");
  assert.equal(WRITE_PLAN_TOOL.strict, true); assert.equal(UPDATE_PLAN_TOOL.strict, true);
  const keys = Object.keys(WRITE_PLAN_TOOL.input_schema.properties);
  assert.deepEqual(keys.sort(), Object.keys(planInput()).sort());
  assert.deepEqual(Object.keys(UPDATE_PLAN_TOOL.input_schema.properties).sort(), keys.sort());
  for (const k of keys) assert.ok(UPDATE_PLAN_TOOL.input_schema.properties[k].anyOf, k);
  assert.match(WRITE_PLAN_TOOL.description, /whole group/);
});

test("write_plan is cleaned: https links only, numbers coerced, ids prefixed and unique, bad refs become null", () => {
  const t = situTrip();
  const input = planInput();
  input.bookings[0].link = "javascript:alert(1)";
  input.bookings[2].id = "ferry"; input.bookings[2].status = "maybe";
  input.days[0].km = "12"; input.days[1].id = "d_1"; input.days[1].night.bookingId = "b_nope";
  const p = normalizePlan(input, t, { today: TODAY, optionId: "o_lp" });
  assert.equal(p.optionId, "o_lp");
  assert.equal(p.bookings[0].link, null);
  assert.equal(p.days[0].km, 12);
  assert.match(p.bookings[2].id, /^b_/); assert.notEqual(p.bookings[2].id, "ferry");
  assert.equal(p.bookings[2].status, "idea");
  assert.notEqual(p.days[0].id, p.days[1].id);
  assert.equal(p.days[1].night.bookingId, null);
  assert.equal(p.days[0].night.bookingId, "b_camp");
  assert.equal(p.days[0].legs[0].bookingId, "b_ferry");
});

test("admin names map to traveller ids; unknown names go to group", () => {
  const input = planInput({ admin: [{ id: "a_1", traveller: "situ", what: "Insurance", note: "" }, { id: "a_2", traveller: "Bob", what: "Visa", note: "" }] });
  const p = normalizePlan(input, situTrip(), { today: TODAY, optionId: "o_lp" });
  assert.equal(p.admin.s[0].what, "Insurance"); assert.equal(p.admin.group[0].what, "Visa");
  for (const list of Object.values(p.admin)) for (const a of list) assert.equal(a.status, "open");
});

test("a full rewrite keeps what people edited", () => {
  const t = situTrip();
  const existing = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  const ferry = existing.bookings.find(b => b.id === "b_ferry"); ferry.status = "booked"; ferry.confirmation = "ABC123";
  existing.gear[0].per.s = "has one"; existing.todo[0].done = true;
  const input = planInput();
  input.bookings = input.bookings.filter(b => b.id !== "b_ferry").map(b => b.id === "b_camp" ? Object.assign({}, b, { status: "decided" }) : b);
  const { plan, changed } = mergePlan(existing, input, t, { today: TODAY, partial: false });
  const f = plan.bookings.find(b => b.id === "b_ferry");
  assert.ok(f, "the booked ferry is kept"); assert.equal(f.status, "booked"); assert.equal(f.confirmation, "ABC123");
  assert.equal(plan.bookings.find(b => b.id === "b_camp").status, "decided");
  assert.equal(plan.gear.find(g => g.id === "g_tent").per.s, "has one");
  assert.equal(plan.todo.find(x => x.id === "t_permit").done, true);
  assert.ok(changed.includes("bookings"));
  assert.equal(plan.optionId, "o_lp");
});

test("a partial update replaces only the collections it sends", () => {
  const t = situTrip();
  const existing = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  const input = Object.assign(nulls(), { bookings: planInput().bookings.map(b => b.id === "b_camp" ? Object.assign({}, b, { price: 40 }) : b) });
  const { plan, changed } = mergePlan(existing, input, t, { today: TODAY, partial: true });
  assert.deepEqual(changed, ["bookings"]);
  assert.deepEqual(plan.days, existing.days); assert.equal(plan.food, existing.food);
  assert.equal(plan.bookings.find(b => b.id === "b_camp").price, 40);
});

test("Claude can move a booking from idea, not from booked", () => {
  const t = situTrip();
  const existing = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  existing.bookings.find(b => b.id === "b_camp").status = "booked";
  const input = planInput(); input.bookings.find(b => b.id === "b_ferry").status = "decided"; input.bookings.find(b => b.id === "b_camp").status = "idea";
  const { plan } = mergePlan(existing, input, t, { today: TODAY, partial: false });
  assert.equal(plan.bookings.find(b => b.id === "b_ferry").status, "decided");
  assert.equal(plan.bookings.find(b => b.id === "b_camp").status, "booked");
});

test("currentPlan is null when the plan belongs to another option", () => {
  const t = situTrip(); t.livePlan = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  assert.equal(currentPlan(t), t.livePlan); assert.equal(liveChoice(t).name, "La Palma");
  t.chosen = "o_ma"; assert.equal(currentPlan(t), null); assert.equal(liveChoice(t).name, "Southern Morocco");
  t.chosen = "lapalma-library"; assert.equal(liveChoice(t), null); assert.equal(currentPlan(t), null);
});

test("cleanImported cleans a crafted livePlan", () => {
  const t = situTrip();
  t.livePlan = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  t.livePlan.bookings[0].what = "<img id=x>"; t.livePlan.bookings[0].link = "javascript:x"; t.livePlan.bookings[0].status = "booked"; t.livePlan.bookings[0].confirmation = "Z9";
  t.livePlan.gear[0].per = { s: "mine", evil: { x: 1 } };
  cleanImported(t, { today: TODAY });
  assert.equal(t.livePlan.bookings[0].what, "<img id=x>"); assert.equal(t.livePlan.bookings[0].link, null);
  assert.equal(t.livePlan.bookings[0].id, "b_ferry"); assert.equal(t.livePlan.bookings[0].status, "booked"); assert.equal(t.livePlan.bookings[0].confirmation, "Z9");
  assert.equal(t.livePlan.gear[0].per.s, "mine"); assert.equal(t.livePlan.gear[0].per.evil, undefined);
  const u = situTrip(); u.livePlan = { optionId: "o_lp", bookings: "nope", days: [{ id: 3 }] };
  cleanImported(u, { today: TODAY });
  assert.deepEqual(u.livePlan.bookings, []); assert.equal(u.livePlan.days.length, 1);
  const v = situTrip(); v.livePlan = "junk"; cleanImported(v, { today: TODAY }); assert.equal(v.livePlan, null);
});

test("migrate adds an empty plan history on this device", () => {
  const old = { kind: "explore", _local: { optionHistory: [] } }; migrate(old);
  assert.deepEqual(old._local.planHistory, []);
});

/* ---------- Task 2: totals and the to-do list ---------- */
import { planTotals, planTodo, CATEGORY_LABEL } from "../src/liveplan.js";
function pricedPlan(t) {
  t.rates = { EUR: { toTrip: 0.86, seenOn: TODAY, source: null } };
  const p = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  p.bookings.find(b => b.id === "b_camp").status = "not-needed";
  return p;
}
test("totals: bookings that aren't 'not needed', plus other costs, converted to the trip currency", () => {
  const t = situTrip(); const p = pricedPlan(t);
  const r = planTotals(p, t);
  assert.equal(r.total, Math.round(72 * 0.86) + Math.round(100 * 0.86));
  assert.equal(r.byCategory.Transport, 62); assert.equal(r.byCategory["Food & local"], 86);
  assert.equal(r.byCategory.Lodging, undefined);
  assert.equal(r.perPerson, Math.round(r.total / 2)); assert.equal(r.counted, 2);
  assert.deepEqual(r.missing, []); assert.equal(r.overBudget, false);
  assert.equal(CATEGORY_LABEL.local, "Food & local");
});
test("a price with no rate is named in missing and left out", () => {
  const t = situTrip(); const p = pricedPlan(t); const before = planTotals(p, t).total;
  p.bookings.push({ id: "b_whale", what: "Whale trip", category: "activity", price: 90, currency: "USD", status: "decided" });
  const r = planTotals(p, t);
  assert.deepEqual(r.missing, [{ what: "Whale trip", currency: "USD" }]); assert.equal(r.total, before);
});
test("overBudget only when a budget is set", () => {
  const t = situTrip(); const p = pricedPlan(t);
  t.budget.total = 100; assert.equal(planTotals(p, t).overBudget, true);
  t.budget.total = 0; assert.equal(planTotals(p, t).overBudget, false);
});
test("to-do: own items, 'Book …' for unbooked bookings with a book-by date, 'Apply: …' for permits, ordered by date, undated last", () => {
  const t = situTrip(); const p = pricedPlan(t);
  p.todo = [{ id: "t_stove", date: null, what: "Pack the stove", done: false }];
  p.bookings.push({ id: "b_flight", what: "Flight to Tenerife", category: "transport", price: null, currency: "GBP", status: "booked", bookBy: "2026-11-20" });
  const items = planTodo(p); const whats = items.map(x => x.what);
  assert.ok(whats.indexOf("Book Ferry Los Cristianos → Santa Cruz") < whats.indexOf("Apply: Caldera camping permit"), whats.join(" | "));
  assert.equal(whats.at(-1), "Pack the stove");
  assert.equal(items.find(x => x.what === "Book Flight to Tenerife").done, true);
  assert.ok(!whats.some(w => /Caldera campsite/.test(w)), "a not-needed booking gives no item");
  assert.equal(items.find(x => x.what.startsWith("Book Ferry")).from, "booking");
  assert.equal(items.find(x => x.what.startsWith("Book Ferry")).date, "2026-12-01");
});

/* ---------- Final review fixes ---------- */
test("final I3: a rewrite with new ids keeps people's work on matching items and counts a booked booking once", () => {
  const t = situTrip(); t.rates = { EUR: { toTrip: 0.86, seenOn: TODAY, source: null } };
  const existing = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  const ferry = existing.bookings.find(b => b.id === "b_ferry"); ferry.status = "booked"; ferry.confirmation = "ABC123";
  existing.bookings.find(b => b.id === "b_camp").confirmation = "HOLD-7";
  existing.gear[0].per.s = "has one"; existing.todo[0].done = true; existing.admin.s[0].status = "done";
  const input = planInput();
  input.bookings = input.bookings.map(b => Object.assign({}, b, { id: b.id.replace("b_", "b_new_") }));
  input.days[0].legs[0].bookingId = "b_new_ferry"; input.days[0].night.bookingId = "b_new_camp";
  input.gear = [{ id: "g_1", name: "tent", note: "" }]; input.todo = [{ id: "t_9", date: null, what: "Print the permit" }];
  input.admin = [{ id: "a_9", traveller: "Situ", what: "Travel insurance", note: "" }];
  const { plan } = mergePlan(existing, input, t, { today: TODAY, partial: false });
  const ferries = plan.bookings.filter(b => /Ferry/.test(b.what));
  assert.equal(ferries.length, 1, "one ferry, not two"); assert.equal(ferries[0].status, "booked"); assert.equal(ferries[0].confirmation, "ABC123");
  assert.equal(plan.bookings.find(b => /campsite/.test(b.what)).confirmation, "HOLD-7");
  assert.equal(plan.gear[0].per.s, "has one"); assert.equal(plan.todo[0].done, true); assert.equal(plan.admin.s[0].status, "done");
  assert.equal(plan.days[0].legs[0].bookingId, ferries[0].id, "the day still points at the ferry");
  assert.equal(planTotals(plan, t).total, Math.round(72 * 0.86) + Math.round(20 * 0.86) + Math.round(100 * 0.86));
});
test("final M3: Claude can't mark a booking booked; only people can", () => {
  const t = situTrip(); const input = planInput(); input.bookings[0].status = "booked";
  assert.equal(normalizePlan(input, t, { today: TODAY, optionId: "o_lp" }).bookings[0].status, "decided");
  const own = normalizePlan(input, t, { today: TODAY, optionId: "o_lp", keepIds: true });
  assert.equal(own.bookings[0].status, "booked", "a stored or imported plan keeps it");
});

/* ---------- Persona review bugs ---------- */
test("bug 5: permits can be marked done; the derived 'Apply' to-do follows; a rewrite keeps it", () => {
  const t = situTrip();
  const existing = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  assert.equal(existing.permits[0].done, false);
  existing.permits[0].done = true;
  assert.equal(planTodo(existing).find(x => x.from === "permit").done, true);
  const { plan } = mergePlan(existing, planInput(), t, { today: TODAY, partial: false });
  assert.equal(plan.permits[0].done, true);
  const fromClaude = planInput(); fromClaude.permits[0].done = true;
  assert.equal(normalizePlan(fromClaude, t, { today: TODAY, optionId: "o_lp" }).permits[0].done, false, "Claude can't tick it");
});
test("bug 6: an update that leaves out people's work keeps it, and marks bookings Claude dropped", () => {
  const t = situTrip();
  const existing = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  existing.bookings.find(b => b.id === "b_camp").status = "decided";
  existing.todo[0].done = true;
  existing.gear.push({ id: "g_mine", name: "Head torches", note: "", per: { s: "has two" } });
  const input = planInput(); input.bookings = input.bookings.filter(b => b.id !== "b_camp"); input.todo = []; input.gear = [];
  const { plan } = mergePlan(existing, input, t, { today: TODAY, partial: false });
  const camp = plan.bookings.find(b => b.id === "b_camp");
  assert.ok(camp, "a decided booking is kept"); assert.equal(camp.dropped, true, "and marked as left out of Claude's plan");
  assert.equal(plan.bookings.find(b => b.id === "b_ferry").dropped, undefined);
  assert.ok(plan.todo.some(x => x.id === "t_permit" && x.done), "a done to-do is kept");
  assert.ok(plan.gear.some(g => g.id === "g_mine" && g.per.s === "has two"), "a gear row with cells is kept");
  const again = mergePlan(plan, planInput(), t, { today: TODAY, partial: false }).plan;
  assert.equal(again.bookings.find(b => b.id === "b_camp").dropped, undefined, "back in the plan, the mark goes");
  assert.equal(normalizePlan(Object.assign(planInput(), { bookings: [Object.assign(planInput().bookings[0], { dropped: true })] }), t, { today: TODAY }).bookings[0].dropped, undefined, "Claude can't set the mark");
});
test("bug 8: the plan remembers how many it was priced for; per person uses that and says when the group changed", () => {
  const t = situTrip(); t.rates = { EUR: { toTrip: 0.86, seenOn: TODAY, source: null } };
  const p = mergePlan(null, planInput(), t, { today: TODAY, optionId: "o_lp" }).plan;
  assert.equal(p.forTravellers, 2);
  const before = planTotals(p, t);
  t.travellers.push({ id: "x", name: "Third", limits: {} });
  const after = planTotals(p, t);
  assert.equal(after.total, before.total); assert.equal(after.perPerson, before.perPerson, "not silently divided by three");
  assert.deepEqual(after.travellersChanged, { was: 2, now: 3 });
  assert.equal(before.travellersChanged, null);
});

/* ---------- Review of the persona fixes ---------- */
test("review 1: the plan's head count changes only when Claude says what the prices are for", () => {
  const t = situTrip();
  const plan = mergePlan(null, planInput(), t, { today: TODAY, optionId: "o_lp" }).plan;
  assert.equal(plan.forTravellers, 2);
  t.travellers.push({ id: "x", name: "Third", limits: {} });
  const nulls = Object.fromEntries(Object.keys(planInput()).map(k => [k, null]));
  const food = mergePlan(plan, Object.assign({}, nulls, { otherCosts: planInput().otherCosts }), t, { today: TODAY, partial: true }).plan;
  assert.equal(food.forTravellers, 2, "an update that doesn't say keeps the old count");
  assert.deepEqual(planTotals(food, t).travellersChanged, { was: 2, now: 3 });
  const repriced = mergePlan(food, Object.assign({}, nulls, { bookings: planInput().bookings, pricedFor: 3 }), t, { today: TODAY, partial: true }).plan;
  assert.equal(repriced.forTravellers, 3); assert.equal(planTotals(repriced, t).travellersChanged, null);
});
test("review 2: a plan saved or shared before the head count existed is taken as priced for its group", () => {
  const t = situTrip(); t.travellers.push({ id: "x", name: "Third", limits: {} });
  const old = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" }); delete old.forTravellers;
  assert.equal(normalizePlan(old, t, { today: TODAY, optionId: "o_lp", keepIds: true }).forTravellers, 3, "an import");
  const stored = { kind: "hike", travellers: t.travellers, livePlan: old }; migrate(stored);
  assert.equal(stored.livePlan.forTravellers, 3, "a trip already on this device");
});
test("review 3: a dropped booking that isn't booked is left out of the total and named apart", () => {
  const t = situTrip(); t.rates = { EUR: { toTrip: 0.86, seenOn: TODAY, source: null } };
  const p = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  const base = planTotals(p, t).total;
  p.bookings.find(b => b.id === "b_camp").dropped = true; p.bookings.find(b => b.id === "b_camp").status = "decided";
  const r = planTotals(p, t);
  assert.equal(r.total, base - Math.round(20 * 0.86)); assert.deepEqual(r.setAside, [{ what: "Caldera campsite" }]);
  p.bookings.find(b => b.id === "b_camp").status = "booked";
  assert.equal(planTotals(p, t).total, base, "a booked one was paid, so it still counts"); assert.deepEqual(planTotals(p, t).setAside, []);
});
