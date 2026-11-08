import test from "node:test"; import assert from "node:assert/strict";
import { JSDOM } from "jsdom";
import * as compute from "../src/compute.js";
import { allDests, familyTrip, skiTrip } from "./helpers.mjs";
const dom = new JSDOM("<!doctype html><div id=app></div><div id=toast></div>"); globalThis.document = dom.window.document; globalThis.window = dom.window;
const views = {};
for (const v of ["home", "setup", "destinations", "build", "itinerary", "plan", "money", "decisions", "conditions", "share"]) views[v] = await import(`../src/views/${v}.js`);
const all = allDests();
function ctxFor(trip) {
  const dests = all.filter(d => d.kind === trip.kind);
  return { store: { trips: { [trip.id]: trip }, current: trip.id }, trip, dests, destsLite: all.map(d => ({ id: d.id, kind: d.kind, name: d.name })), names: Object.fromEntries(all.map(d => [d.id, d.name])), compute, templates: [], countries: [], loadTemplate: async () => null, commit() {}, save() {}, nav() {}, shareLink: () => "https://example.test/#s-abc", copy() {}, toast() {}, confirm: () => true };
}
const trips = {
  family: familyTrip(),
  ski: skiTrip(),
  hike: familyTrip({ id: "t_hike", kind: "hike", name: "Alta Via 2", travel: { mode: "train" }, dates: { start: "2027-08-28", end: "2027-09-11" }, budget: { total: 6000, currency: "EUR" }, travellers: [{ id: "g", name: "Gabriel", limits: { maxGradeHike: "T3+", maxDailyAscentM: 1200 } }, { id: "s", name: "Situ", limits: {} }], type: {} }),
  jan: familyTrip({ id: "t_jan", kind: "explore", name: "January by train", origin: { city: "London", region: "uk" }, travel: { mode: "train" }, dates: { start: "2027-01-09", end: "2027-01-16" }, budget: { total: 1800, currency: "GBP" }, travellers: [{ id: "g", name: "Gabriel", limits: {} }, { id: "s", name: "Situ", limits: {} }], type: { cities: 2, hike: 2 } })
};
for (const [name, trip] of Object.entries(trips)) {
  test(`all views render for the ${name} trip, with and without a chosen destination`, () => {
    const ctx = ctxFor(trip);
    for (const chosen of [null, ctx.dests[0].id]) {
      trip.chosen = chosen;
      for (const [v, mod] of Object.entries(views)) { const html = mod.render(ctx); assert.ok(typeof html === "string" && html.length > 50, `${v} empty`); assert.ok(!/undefined|NaN|\[object Object\]/.test(html), `${v} leaks: ${(html.match(/.{40}(undefined|NaN|\[object Object\]).{40}/) || [""])[0]}`); }
    }
  });
}
test("January train trip from London: Bernese Oberland and Lake District are reachable, Mexico is flagged", () => {
  const ctx = ctxFor(trips.jan); const html = views.destinations.render(ctx);
  assert.ok(html.includes("Bernese Oberland")); assert.ok(html.includes("Lake District"));
  const mex = compute.computePlan(all.find(d => d.id === "mexico"), trips.jan); assert.ok(mex.flags.some(f => /needs a flight/.test(f)));
});
test("plan steps for the ski trip mention the bulletin and the car, and conditions view has a log row per day", () => {
  const ctx = ctxFor(trips.ski); trips.ski.chosen = "ecrins-ski";
  const plan = views.plan.render(ctx); assert.ok(/avalanche bulletin/i.test(plan)); assert.ok(/who drives/.test(plan));
  const cond = views.conditions.render(ctx); assert.ok((cond.match(/data-k="danger"/g) || []).length >= 5);
});
