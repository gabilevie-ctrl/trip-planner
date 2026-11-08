import test from "node:test"; import assert from "node:assert/strict";
import { computePlan, itinerary, stays, tripLength, rebalance, climateFor } from "../src/compute.js";
import { strictestLimits } from "../src/criteria.js";
import { dest, familyTrip, skiTrip } from "./helpers.mjs";

test("strictest limit wins across travellers", () => {
  const t = familyTrip(); t.travellers[1].limits.maxAltitudeM = 3000;
  assert.equal(strictestLimits(t).maxAltitudeM, 3000);
  assert.equal(strictestLimits(t).crowds, "avoid");
  const s = skiTrip(); assert.equal(strictestLimits(s).maxDanger, "2");
});

test("budget: per person times travellers, contingency once, rest and free days at transit rate", () => {
  const t = familyTrip(); const d = dest("caucasus"); const c = computePlan(d, t);
  assert.equal(c.n, 5); assert.equal(c.len, 15);
  assert.ok(Math.abs(c.total - c.pp * 5) < 0.01);
  const sub = c.accessCost + c.extra + c.cityCost + c.outdoorCost + c.transitCost;
  assert.ok(Math.abs(c.pp - sub * 1.08) < 0.01);
  assert.ok(Math.abs(c.transitCost - (c.rest + Math.max(c.free, 0)) * d.rates.transit) < 0.01);
  assert.ok(c.fits, "Georgia should fit a 15k budget for five");
});

test("breaching a limit flags the block instead of hiding it", () => {
  const t = familyTrip(); const d = dest("peru"); t.plans[d.id] = { presetIdx: 0, picks: { incatrail: { on: true, days: 4 }, lima: { on: true, days: 2 } }, order: ["lima", "incatrail"], rest: 1, guided: false };
  t.travellers[0].limits.maxAltitudeM = 4000;
  const c = computePlan(d, t);
  assert.ok(c.sel.some(b => b.id === "incatrail"), "block still selected");
  assert.ok(c.flags.some(f => /Inca Trail.*4,215 m is above the 4,000 m ceiling/.test(f)), c.flags.join("|"));
});

test("travel mode train flags flight-only destinations", () => {
  const t = familyTrip({ travel: { mode: "train" } }); const c = computePlan(dest("mexico"), t);
  assert.ok(c.flags.some(f => /needs a flight/.test(f)));
  const c2 = computePlan(dest("cantabria"), t); assert.ok(!c2.flags.some(f => /needs a flight/.test(f)));
});

test("ski trip: difficulty and ascent flags, guided adds the guide rate", () => {
  const s = skiTrip(); const d = dest("ecrins-ski"); const c = computePlan(d, s);
  assert.ok(c.flags.some(f => /ZS\+, above the ZS limit/.test(f)), c.flags.join("|"));
  const before = c.pp; c.plan.guided = true; const c2 = computePlan(d, s); assert.ok(c2.pp > before);
});

test("rebalance moves days within min/max and keeps the total", () => {
  const t = familyTrip(); const d = dest("caucasus"); const c = computePlan(d, t);
  rebalance(d, c.plan, "outdoor", c.outdoor + 2); const c2 = computePlan(d, t);
  assert.equal(c2.outdoor, c.outdoor + 2);
  for (const b of c2.sel) { const p = c2.plan.picks[b.id]; assert.ok(p.days >= b.minDays && p.days <= b.maxDays); }
});

test("itinerary covers every day of the trip once and stays group nights", () => {
  const t = familyTrip(); const d = dest("caucasus"); const days = itinerary(d, t);
  assert.equal(days.length, tripLength(t));
  assert.equal(days[0].kind, "travel"); assert.ok(days[days.length - 1].kind === "travel" || /travel home/.test(days[days.length - 1].label));
  const st = stays(d, t); assert.ok(st.length >= 3); assert.ok(st.every(s => s.nights >= 1 && s.checkout > s.checkin));
});

test("changing dates re-generates the itinerary without losing picks", () => {
  const t = familyTrip(); const d = dest("caucasus"); computePlan(d, t); const picks = JSON.stringify(t.plans[d.id].picks);
  t.dates.end = "2027-07-30"; const days = itinerary(d, t); assert.equal(days.length, 19); assert.equal(JSON.stringify(t.plans[d.id].picks), picks);
});

test("climate for January train trip from London shows snow and cold", () => {
  const t = familyTrip({ origin: { city: "London", region: "uk" }, travel: { mode: "train" }, dates: { start: "2027-01-09", end: "2027-01-16" }, budget: { total: 1600, currency: "GBP" }, travellers: [{ id: "g", name: "Gabriel", limits: {} }, { id: "s", name: "Situ", limits: {} }] });
  const cl = climateFor(dest("bernese-winter"), t); assert.ok(cl.snow); assert.ok(cl.high < 5);
  const c = computePlan(dest("bernese-winter"), t); assert.equal(c.access.originCity, "London"); assert.equal(c.access.mode, "train");
});
