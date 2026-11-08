import test from "node:test"; import assert from "node:assert/strict";
import { computePlan, ensurePlan, fitToDates, applyPreset } from "../src/compute.js";
import { dest, familyTrip } from "./helpers.mjs";

const shortTrip = () => { const t = familyTrip(); t.plans = {}; t.dates = { start: "2027-01-02", end: "2027-01-09" }; return t; };

test("a new plan fits the trip's dates, leaving travel days", () => {
  const t = shortTrip(); const c = computePlan(dest("alsace-black-forest"), t);
  assert.equal(c.len, 8); assert.ok(c.alloc <= 6, `planned ${c.alloc} days in an 8-day trip`);
  assert.ok(!c.warnings.some(w => /days planned in a/.test(w)));
});

test("fitToDates trims an over-long plan, and leaves a plan that fits alone", () => {
  const t = shortTrip(); const d = dest("alsace-black-forest");
  t.plans[d.id] = applyPreset(d, 0);
  assert.ok(computePlan(d, t).alloc > 6);
  assert.equal(fitToDates(d, t), true);
  assert.ok(computePlan(d, t).alloc <= 6);
  assert.equal(fitToDates(d, t), false, "nothing to do the second time");
});

test("a plan the user already edited is not refitted on its own", () => {
  const t = shortTrip(); const d = dest("alsace-black-forest");
  t.plans[d.id] = applyPreset(d, 0); const before = JSON.stringify(t.plans[d.id]);
  ensurePlan(t, d); assert.equal(JSON.stringify(t.plans[d.id]), before);
});
