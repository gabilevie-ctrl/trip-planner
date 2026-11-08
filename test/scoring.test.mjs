import test from "node:test"; import assert from "node:assert/strict";
import { seasonFit, score } from "../src/scoring.js";
import { dest, allDests, familyTrip, skiTrip } from "./helpers.mjs";

test("season fit follows the months and reacts to events", () => {
  const t = familyTrip(); const kg = dest("kyrgyz");
  const july = seasonFit(kg, t).score; t.dates = { start: "2027-01-10", end: "2027-01-20" }; const jan = seasonFit(kg, t).score;
  assert.ok(july > 80 && jan < 30);
  const nw = dest("norway"); const t2 = familyTrip({ dates: { start: "2027-07-26", end: "2027-08-05" } }); const sf = seasonFit(nw, t2); assert.ok(sf.events.some(e => /Olavsfest/.test(e.name)));
});

test("every destination scores without throwing and over-budget trips are capped low on cost", () => {
  const t = familyTrip(); for (const d of allDests().filter(d => d.kind === "explore")) { const s = score(d, t); assert.ok(s.score >= 0 && s.score <= 100, d.id); assert.ok(s.reason.length > 0); if (!s.criteria || !s.parts.length) assert.fail(d.id); }
  const pac = score(dest("pacific"), t); assert.ok(pac.criteria.cost <= 15);
});

test("ski trip scoring: wrong season tanks, right season holds; drive mode gets car steps", async () => {
  const s = skiTrip(); const d = dest("queyras-ski"); const march = score(d, s).score;
  s.dates = { start: "2027-07-20", end: "2027-07-26" }; const july = score(d, s).score; assert.ok(march > july + 20);
  const { planningSteps } = await import("../src/criteria.js"); const steps = planningSteps(skiTrip(), d, { picks: {}, guided: false });
  assert.ok(steps.some(x => x.key === "car")); assert.ok(!steps.some(x => x.key === "flights")); assert.ok(steps.some(x => x.key === "bulletin"));
});
