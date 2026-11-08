import test from "node:test"; import assert from "node:assert/strict";
import { computePlan } from "../src/compute.js";
import { strictestLimits, criteriaFor, countriesOutside } from "../src/criteria.js";
import { criteria } from "../src/scoring.js";
import { tempClass } from "../src/ui.js";
import { readDescription, applyDescription } from "../src/describe.js";
import { newTrip } from "../src/state.js";
import { dest, familyTrip } from "./helpers.mjs";
const T = { today: "2026-11-08" };

test("warmth floor: the highest floor across travellers wins", () => {
  const t = familyTrip(); t.travellers[0].limits.minDayHighC = 18; t.travellers[1].limits.minDayHighC = 22;
  assert.equal(strictestLimits(t).minDayHighC, 22);
  assert.ok(criteriaFor("explore").some(c => c.key === "minDayHighC" && c.label === "Warmth floor"));
});

test("warmth floor flags cold stops and zeroes the temperature score (no dates: per stop)", () => {
  const t = familyTrip(); t.dates = { start: "", end: "" }; t.travellers[0].limits.minDayHighC = 15;
  const d = dest("alsace-black-forest"); const c = computePlan(d, t);
  assert.ok(c.flags.includes("Strasbourg: ~5°C is below the 15°C floor"), c.flags.join(" | "));
  assert.equal(criteria(d, t, c).heat, 0);
  assert.equal(tempClass(5, 30, 15), "crit"); assert.equal(tempClass(16, 30, 15), "warn"); assert.equal(tempClass(22, 30, 15), "good");
});

test("country limit: every traveller's limit applies, 'any' is ignored", () => {
  const t = familyTrip(); t.travellers[0].limits.countryZone = "schengen"; t.travellers[1].limits.countryZone = "eu"; t.travellers[2].limits.countryZone = "any";
  assert.deepEqual(strictestLimits(t).countryZone, ["schengen", "eu"]);
});

test("country limit is a flag, never an exclusion", () => {
  assert.deepEqual(countriesOutside(["NO"], "schengen", "europe"), []);
  assert.deepEqual(countriesOutside(["NO"], "eu", "europe"), ["NO"]);
  assert.deepEqual(countriesOutside(["IS", "GL"], "schengen", "europe"), ["GL"]);
  assert.deepEqual(countriesOutside(["MX"], "europe", "americas"), ["MX"]);
  const t = familyTrip(); t.travellers[0].limits.countryZone = "schengen";
  const c = computePlan(dest("caucasus"), t);
  assert.ok(c.flags.includes("Georgia and Armenia are outside the Schengen area"), c.flags.join(" | "));
  assert.equal(computePlan(dest("slovenia"), t).flags.filter(f => /Schengen/.test(f)).length, 0);
});

test("the chat reads a warmth floor and a country limit", () => {
  assert.equal(readDescription("at least 20 degrees please", T).limits.minDayHighC, 20);
  const both = readDescription("somewhere between 18 and 28°C", T).limits;
  assert.equal(both.minDayHighC, 18); assert.equal(both.maxDayHighC, 28);
  const cold = readDescription("we hate the cold", T); assert.equal(cold.limits.minDayHighC, 18); assert.ok(cold.guesses.some(g => /18/.test(g)));
  assert.equal(readDescription("Mom can't do heat above 30°C", T).limits.minDayHighC, undefined);
  assert.equal(readDescription("Schengen only, Antoine's visa", T).limits.countryZone, "schengen");
  assert.equal(readDescription("we'd like to stay in the EU", T).limits.countryZone, "eu");
  assert.equal(readDescription("somewhere within Europe", T).limits.countryZone, "europe");
  const t = newTrip("explore"); const changes = applyDescription(t, readDescription("Schengen only", T));
  assert.ok(changes.some(c => /countries Schengen area only/i.test(c)), changes.join(" | "));
});

test("with dates, the warmth floor uses the weather in those months, not each stop's single value", () => {
  const t = familyTrip(); t.dates = { start: "2027-10-01", end: "2027-10-10" };
  t.travellers[0].limits.minDayHighC = 12;
  const d = dest("snowdonia");
  let c = computePlan(d, t);
  assert.equal(c.flags.filter(f => /floor/.test(f)).length, 0, c.flags.join(" | "));
  assert.ok(criteria(d, t, c).heat > 0);
  t.travellers[0].limits.minDayHighC = 15; c = computePlan(d, t);
  assert.deepEqual(c.flags.filter(f => /floor/.test(f)), ["Betws-y-Coed (60 m): ~13°C on average in those months, below the 15°C floor"]);
  assert.equal(criteria(d, t, c).heat, 0);
});
