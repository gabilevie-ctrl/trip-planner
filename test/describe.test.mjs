import test from "node:test"; import assert from "node:assert/strict";
import { readDescription, applyDescription, replyFor, describeTurn } from "../src/describe.js";
import { newTrip } from "../src/state.js";
const T = { today: "2026-11-08" };

test("reads the family description", () => {
  const p = readDescription("Five of us from Brussels, 12-26 July 2027. Mom can't do heat above 30°C or altitude over 2500 m and we want to avoid crowds. We love old towns and food, a bit of hiking. No flights please. Budget around €15,000.", T);
  assert.equal(p.kind, "explore");
  assert.equal(p.travellers, 5);
  assert.equal(p.start, "2027-07-12"); assert.equal(p.end, "2027-07-26"); assert.ok(!p.guessedDates);
  assert.deepEqual(p.budget, { total: 15000, currency: "EUR", perPerson: false });
  assert.equal(p.origin, "Brussels");
  assert.equal(p.travel, "train");
  assert.equal(p.limits.maxDayHighC, 30);
  assert.equal(p.limits.maxAltitudeM, 2500);
  assert.equal(p.limits.crowds, "avoid");
  assert.equal(p.type.cities, 3); assert.equal(p.type.food, 3); assert.equal(p.type.hike, 1);
});

test("reads a ski touring week with grades and effort", () => {
  const p = readDescription("Ski touring week for 2 in March, max 1200 m up a day, nothing harder than ZS, huts only, we drive", T);
  assert.equal(p.kind, "skitour");
  assert.equal(p.travellers, 2);
  assert.equal(p.travel, "drive");
  assert.equal(p.limits.maxDailyAscentM, 1200);
  assert.equal(p.limits.maxGradeSki, "ZS");
  assert.equal(p.limits.hutsOnly, true);
  assert.equal(p.start, "2027-03-01"); assert.equal(p.end, "2027-03-07"); assert.ok(p.guessedDates);
});

test("hut-to-hut and lengths", () => {
  const p = readDescription("a hut to hut trek, 10 days in late August, T3 max, 6 hours a day at most", T);
  assert.equal(p.kind, "hike"); assert.equal(p.days, 10);
  assert.equal(p.start, "2027-08-20"); assert.equal(p.end, "2027-08-29"); assert.ok(p.guessedDates);
  assert.equal(p.limits.maxGradeHike, "T3"); assert.equal(p.limits.maxDailyHours, 6);
});

test("per-person budget in pounds, and family counts", () => {
  const p = readDescription("two adults and three kids, about £2k each, two weeks", T);
  assert.equal(p.travellers, 5);
  assert.deepEqual(p.budget, { total: 2000, currency: "GBP", perPerson: true });
  assert.equal(p.days, 14);
});

test("numbers that are not money are not read as a budget", () => {
  const p = readDescription("nothing above 3000 m, under 28 degrees, in 2027 for 3 weeks", T);
  assert.equal(p.budget, undefined);
  assert.equal(p.limits.maxAltitudeM, 3000); assert.equal(p.limits.maxDayHighC, 28); assert.equal(p.days, 21);
});

test("negations lower interests and vague limits become labelled guesses", () => {
  const p = readDescription("no beaches, not too much walking, not too hot, somewhere quiet", T);
  assert.equal(p.type.coast, 0); assert.equal(p.type.hike, 1); assert.equal(p.limits.maxHikeShare, 40);
  assert.equal(p.limits.maxDayHighC, 28); assert.equal(p.limits.crowds, "prefer");
  assert.ok(p.guesses.some(g => /28/.test(g)));
});

test("apply fills the trip, says what changed, and never changes the kind", () => {
  const t = newTrip("explore");
  const changes = applyDescription(t, readDescription("ski touring, 3 of us from London, €900 per person, 2-8 March 2027, avoid crowds", T));
  assert.equal(t.kind, "explore");
  assert.equal(t.travellers.length, 3);
  assert.equal(t.origin.city, "London"); assert.equal(t.origin.region, "uk");
  assert.equal(t.budget.total, 2700);
  assert.equal(t.dates.start, "2027-03-02");
  assert.ok(t.travellers.every(p => p.limits.crowds === "avoid"));
  assert.ok(changes.some(c => /2,700|2700/.test(c)));
  const reply = replyFor(changes, t, readDescription("ski touring", T));
  assert.match(reply, /new trip/i);
});

test("reply asks for the first missing thing", () => {
  const t = newTrip("explore");
  const p = readDescription("we love museums", T);
  const reply = replyFor(applyDescription(t, p), t, p);
  assert.match(reply, /when/i);
  const t2 = newTrip("explore"); const p2 = readDescription("hello", T);
  assert.match(replyFor(applyDescription(t2, p2), t2, p2), /didn't catch/i);
});

test("'can't do heat or altitude' sets both, and the reply writes months properly", () => {
  const p = readDescription("Mom can't do heat or altitude, two weeks in July", T);
  assert.equal(p.limits.maxDayHighC, 28); assert.equal(p.limits.maxAltitudeM, 3000);
  const t = newTrip("explore"); const changes = applyDescription(t, p);
  assert.ok(changes.some(c => c.includes("1 Jul 2027 → 14 Jul 2027 (a guess)")), changes.join(" | "));
  assert.equal(p.guesses.filter(g => /2027-07-01/.test(g)).length, 0, "dates are not repeated as ISO in the guesses");
});

test("a later limit never loosens a stricter one already set", () => {
  const t = newTrip("explore");
  applyDescription(t, readDescription("nothing above 2000 m", T));
  const changes = applyDescription(t, readDescription("Dad is fine up to 4000 m", T));
  assert.ok(t.travellers.every(p => p.limits.maxAltitudeM === 2000));
  assert.ok(changes.some(c => /kept the stricter/.test(c)), changes.join(" | "));
});

test("interests are not asked again once given, and visited countries are read", () => {
  const t = newTrip("explore");
  describeTurn(t, "two weeks in July for 4, €8000, we love museums", T);
  const r = describeTurn(t, "we've already been to Slovenia and Norway", { ...T, countries: [{ code: "SI", name: "Slovenia" }, { code: "NO", name: "Norway" }, { code: "IT", name: "Italy" }] });
  assert.deepEqual(t.visitedCountries.sort(), ["NO", "SI"]);
  assert.doesNotMatch(r.reply, /what do you love/i);
  assert.match(r.reply, /Slovenia/);
});

test("common country nicknames count as the country", () => {
  const countries = [{ code: "GB", name: "United Kingdom" }, { code: "US", name: "United States" }, { code: "NL", name: "Netherlands" }, { code: "CZ", name: "Czechia" }];
  const p = readDescription("we've been to Scotland, the USA, Holland and the Czech Republic", { ...T, countries });
  assert.deepEqual(p.visited.map(c => c.code).sort(), ["CZ", "GB", "NL", "US"]);
});
