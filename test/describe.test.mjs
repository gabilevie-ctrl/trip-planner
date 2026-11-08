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
  { const r = replyFor(applyDescription(t2, p2), t2, p2); assert.match(r, /nothing new/i); assert.match(r, /when/i); }
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

/* ---- review fixes ---- */
test("review: a later message never loosens a stricter crowds or grade limit", () => {
  const t = newTrip("hike");
  applyDescription(t, readDescription("avoid crowds, T2 max", T));
  const changes = applyDescription(t, readDescription("somewhere quiet, T4 is ok for us", T));
  assert.equal(t.travellers[0].limits.crowds, "avoid"); assert.equal(t.travellers[0].limits.maxGradeHike, "T2");
  assert.ok(changes.some(c => /kept the stricter/.test(c)), changes.join(" | "));
});

test("review: a negated kind word, or plain skiing, does not make a ski touring trip", () => {
  assert.equal(readDescription("skiing is not for us, we want beaches", T).kind, "explore");
  assert.equal(readDescription("No skiing please, we want a hut trek", T).kind, "hike");
  const p = readDescription("A skiing holiday with the kids", T);
  assert.equal(p.kind, "explore"); assert.ok(!p.kindSaid); assert.ok(p.guesses.some(g => /ski touring/.test(g)));
});

test("review: traveller counts with roles, the speaker and an explicit family size", () => {
  assert.equal(readDescription("We are a family of 4 with 2 kids", T).travellers, 4);
  assert.equal(readDescription("We're 2 parents, 2 kids", T).travellers, 4);
  assert.equal(readDescription("Me, my wife and our 3 kids", T).travellers, 5);
  assert.equal(readDescription("I may go with 3 friends", T).travellers, 4);
});

test("review: European number formats and nightly prices", () => {
  assert.equal(readDescription("€15.000 total", T).budget.total, 15000);
  assert.deepEqual(readDescription("€ 1.500 each", T).budget, { total: 1500, currency: "EUR", perPerson: true });
  assert.equal(readDescription("budget 2.500,50 euros", T).budget.total, 2501);
  const p = readDescription("hotels around €500 a night max", T);
  assert.equal(p.budget, undefined); assert.equal(p.days, undefined);
});

test("review: a per-person budget follows the traveller count", () => {
  const t = newTrip("explore");
  describeTurn(t, "4 of us, €1000 per person", T);
  assert.equal(t.budget.total, 4000);
  const r = describeTurn(t, "actually 6 of us", T);
  assert.equal(t.budget.total, 6000); assert.match(r.reply, /6,000/);
});

test("review: dates across two months, and impossible dates are not used", () => {
  let p = readDescription("28 Dec to 3 Jan", T); assert.equal(p.start, "2026-12-28"); assert.equal(p.end, "2027-01-03"); assert.equal(p.days, 7);
  p = readDescription("30 June to 5 July", T); assert.equal(p.start, "2027-06-30"); assert.equal(p.end, "2027-07-05");
  p = readDescription("31 to 2 February", T); assert.equal(p.start, undefined); assert.ok(p.guesses.some(g => /dates/.test(g)));
});

test("review: altitude after the number, and 'up to 2000 m' is not an ascent", () => {
  assert.equal(readDescription("1500 m altitude max", T).limits.maxAltitudeM, 1500);
  const p = readDescription("mom is fine up to 2000 m", T);
  assert.equal(p.limits.maxAltitudeM, 2000); assert.equal(p.limits.maxDailyAscentM, undefined);
});

test("review: origins written as a country or with 'the'", () => {
  assert.equal(readDescription("We fly from the UK", T).origin, "London");
  assert.equal(readDescription("Leaving from London", T).origin, "London");
});

test("review: very long input stays quick", () => {
  const t0 = Date.now(); readDescription("1".repeat(50000) + " €", T); assert.ok(Date.now() - t0 < 500);
});

/* ---- the chat Gabriel tried (8 Nov 2026) ---- */
test("chat transcript: 'jan 2nd until jan 9th, situ and I, low budget…'", () => {
  const p = readDescription("jan 2nd until jan 9th, situ and I. low budget. want to be outside in nature as much as possible. Maybe somewhere warm in europe/shengen.", T);
  assert.equal(p.start, "2027-01-02"); assert.equal(p.end, "2027-01-09"); assert.ok(!p.guessedDates);
  assert.equal(p.travellers, 2);
  assert.equal(p.lowBudget, true);
  assert.equal(p.type.hike, 3);
  assert.equal(p.limits.countryZone, "schengen");
  assert.equal(p.limits.minDayHighC, 18);
});

test("more ways of saying who is coming and when", () => {
  assert.equal(readDescription("Anna, Tom and I", T).travellers, 3);
  assert.equal(readDescription("me and my brother", T).travellers, 2);
  const p = readDescription("January 2 to January 9 2027", T); assert.equal(p.start, "2027-01-02"); assert.equal(p.end, "2027-01-09");
  assert.equal(readDescription("options in europe", T).limits.countryZone, "europe");
  assert.equal(readDescription("schegen area please", T).limits.countryZone, "schengen");
});

test("a low budget ranks cheaper places higher and is said back", () => {
  const t = newTrip("explore");
  const changes = applyDescription(t, readDescription("we're on a tight budget", T));
  assert.equal(t.weights.cost, 3);
  assert.ok(changes.some(c => /cheaper/.test(c)), changes.join(" | "));
});

test("asking for options answers with ideas, and a message with nothing new still asks the next question", () => {
  const t = newTrip("explore");
  describeTurn(t, "2 of us", T);
  const ideas = [{ name: "Slovenia", score: 70, pp: 900, reason: "Strong on cost", flags: [] }, { name: "Norway", score: 60, pp: 1800, reason: "Strong on nature", flags: ["Bergen: ~3°C is below the 18°C floor"] }];
  const r = describeTurn(t, "give us options", { ...T, suggest: () => ideas });
  assert.match(r.reply, /Slovenia/); assert.match(r.reply, /Norway/); assert.match(r.reply, /below the 18°C floor/);
  assert.doesNotMatch(r.reply, /didn't catch/);
  const r2 = describeTurn(t, "hmm ok", T);
  assert.match(r2.reply, /when/i);
});
