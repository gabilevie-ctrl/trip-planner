import test from "node:test"; import assert from "node:assert/strict";
import { buildPrompt, readReply, tripFromReply } from "../src/chatbot.js";
import { KINDS, CRITERIA } from "../src/criteria.js";
import { migrate } from "../src/state.js";
const today = "2026-11-09";
const text = "Mom and me from London, two weeks in July. Mom can't do altitude.";
const fill = obj => tripFromReply(obj, { text, today });

test("prompt names every kind and criterion, today's date and the text", () => {
  const p = buildPrompt(text, { today });
  for (const k of Object.keys(KINDS)) assert.ok(p.includes(k), k);
  for (const c of CRITERIA) assert.ok(p.includes(c.key), c.key);
  assert.ok(p.includes(today)); assert.ok(p.includes(text));
});

test("prompt caps the description", () => {
  const p = buildPrompt("x".repeat(5000), { today });
  assert.ok(!p.includes("x".repeat(2001))); assert.ok(p.includes("x".repeat(2000)));
});

test("reads fenced JSON", () => {
  assert.deepEqual(readReply('```json\n{"name": "A"}\n```').obj, { name: "A" });
  assert.deepEqual(readReply('```\n{"name": "A"}\n```').obj, { name: "A" });
});

test("reads JSON with chatter around it", () => {
  assert.deepEqual(readReply('Here you go!\n{"name": "A", "dates": {"start": "2027-07-01"}}\nEnjoy your trip.').obj, { name: "A", dates: { start: "2027-07-01" } });
  assert.deepEqual(readReply('Notes [see below]: {"name": "A"} (done)').obj, { name: "A" });
});

test("repairs curly quotes and trailing commas", () => {
  assert.deepEqual(readReply('{“name”: “A”, "type": {"coast": 3,},}').obj, { name: "A", type: { coast: 3 } });
});

test("cut-off reply is an error", () => {
  const r = readReply('```json\n{"name":"A", "dates": {');
  assert.ok(!r.obj); assert.match(r.error, /cut off/);
});

test("no JSON or an array is an error", () => {
  assert.match(readReply("Sure! What dates?").error, /no trip/);
  assert.match(readReply("[1, 2]").error, /no trip/);
  assert.match(readReply("").error, /no trip/);
});

const good = {
  kind: "explore", name: "Summer with Mom", origin: "London", travelMode: "train", lodging: "hotel",
  dates: { start: "2027-07-10", end: "2027-07-24" }, budget: { total: 12000, currency: "GBP" },
  type: { coast: 3, food: 3 },
  travellers: [{ name: "Mom", limits: { maxAltitudeM: 2000, maxDayHighC: 30 } }, { name: "Gabriel", limits: {} }],
  notes: "Mom prefers trains.", assumptions: ["July means mid-July"]
};

test("a good reply fills the trip, limits on the right person, interests on top of the defaults", () => {
  const r = fill(good);
  assert.ok(!r.error, r.error);
  const t = r.trip;
  assert.equal(t.kind, "explore"); assert.equal(t.name, "Summer with Mom");
  assert.deepEqual(t.origin, { city: "London", region: "uk" });
  assert.equal(t.travel.mode, "train"); assert.equal(t.lodging, "hotel");
  assert.deepEqual(t.dates, { start: "2027-07-10", end: "2027-07-24" });
  assert.equal(t.budget.total, 12000); assert.equal(t.budget.currency, "GBP");
  assert.deepEqual(t.type, { cities: 2, hike: 2, coast: 3, wildlife: 0, history: 1, food: 3 });
  assert.equal(t.travellers.length, 2);
  assert.equal(t.travellers[0].name, "Mom"); assert.equal(t.travellers[0].limits.maxAltitudeM, 2000);
  assert.deepEqual(t.travellers[1].limits, {});
  assert.ok(t.travellers.every(p => /^p_/.test(p.id)));
  assert.ok(t.notes.includes(text)); assert.ok(t.notes.includes("Mom prefers trains."));
  assert.deepEqual(t.brief.map(m => m.who), ["you", "app"]);
  assert.match(t.brief[1].text, /Filled in by the chatbot/); assert.match(t.brief[1].text, /July means mid-July/);
  assert.deepEqual(r.assumptions, ["July means mid-July"]);
  assert.deepEqual(r.dropped, []);
  assert.deepEqual(migrate(structuredClone(t)), t);
});

test("bad values are dropped with reasons", () => {
  const r = fill({ kind: "beach", origin: "Lyon", dates: { start: "2027-07-20", end: "2027-07-10" }, budget: { total: 5000, currency: "JPY" }, type: { coast: 7, hike: 1 }, travellers: [{ name: "A", limits: { maxDailyHours: 6, crowds: "never" } }] });
  assert.ok(!r.error, r.error);
  const t = r.trip, d = r.dropped.join(" | ");
  assert.equal(t.kind, "explore"); assert.match(d, /kind/);
  assert.equal(t.origin.city, "Other"); assert.ok(t.notes.includes("Lyon"));
  assert.deepEqual(t.dates, { start: "", end: "" }); assert.match(d, /dates/);
  assert.equal(t.budget.currency, "EUR"); assert.match(d, /JPY/);
  assert.equal(t.type.coast, 0); assert.equal(t.type.hike, 1); assert.match(d, /coast/);
  assert.equal(t.travellers[0].limits.maxDailyHours, undefined); assert.match(d, /maxDailyHours/);
  assert.equal(t.travellers[0].limits.crowds, undefined); assert.match(d, /crowds/);
});

test("past dates, too-long trips and grades off the scale are dropped", () => {
  assert.equal(fill({ name: "x", dates: { start: "2025-01-01", end: "2025-01-05" } }).trip.dates.start, "");
  assert.equal(fill({ name: "x", dates: { start: "2027-01-01", end: "2027-04-01" } }).trip.dates.start, "");
  assert.equal(fill({ name: "x", dates: { start: "2027-02-30", end: "2027-03-02" } }).trip.dates.start, "");
  const r = fill({ kind: "skitour", travellers: [{ name: "B", limits: { maxGradeSki: "Z9", maxDanger: 2, hutsOnly: true } }] });
  assert.equal(r.trip.kind, "skitour");
  assert.equal(r.trip.travellers[0].limits.maxGradeSki, undefined);
  assert.equal(r.trip.travellers[0].limits.maxDanger, "2");
  assert.equal(r.trip.travellers[0].limits.hutsOnly, true);
  assert.deepEqual(r.trip.type, {});
});

test("per-person budget follows the traveller count", () => {
  const r = fill({ budget: { perPerson: 1000, currency: "EUR" }, travellers: [{ name: "A" }, { name: "B" }, { name: "C" }] });
  assert.equal(r.trip.budget.total, 3000); assert.equal(r.trip.budget.perPerson, 1000);
});

test("numeric strings are accepted, units in the string are not", () => {
  const r = fill({ travellers: [{ name: "A", limits: { maxAltitudeM: "3000", maxDayHighC: "30°C" } }] });
  assert.equal(r.trip.travellers[0].limits.maxAltitudeM, 3000);
  assert.equal(r.trip.travellers[0].limits.maxDayHighC, undefined);
});

test("odd shapes are dropped, not thrown", () => {
  const r = fill({ name: "Odd", travellers: "two", dates: "July", budget: 5000, type: [1] });
  assert.ok(!r.error, r.error);
  assert.equal(r.trip.travellers.length, 1);
  assert.match(r.dropped.join(" "), /travellers/); assert.match(r.dropped.join(" "), /dates/);
  const r2 = fill({ travellers: [null, { name: "A", limits: [1] }] });
  assert.equal(r2.trip.travellers.length, 1); assert.equal(r2.trip.travellers[0].name, "A");
});

test("nothing real is an error", () => {
  for (const o of [{}, { notes: "x" }, { assumptions: ["a"] }, { travellers: [{ name: "", limits: {} }] }, { kind: 5 }])
    assert.match(fill(o).error || "", /Nothing in that reply/, JSON.stringify(o));
});

test("name falls back to the month, unknown keys are reported", () => {
  const r = fill({ dates: { start: "2027-07-10", end: "2027-07-20" }, colour: "blue" });
  assert.equal(r.trip.name, "July 2027 trip"); assert.match(r.dropped.join(" "), /colour/);
});
