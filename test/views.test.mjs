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
test("destination card shows sources and review date", () => {
  const trip = familyTrip({ id: "t_src" }); const ctx = ctxFor(trip);
  const i = ctx.dests.findIndex(d => d.id === "norway");
  ctx.dests[i] = Object.assign({}, ctx.dests[i], { lastReviewed: "2026-11-08", sources: [{ name: "Visit Norway", url: "https://www.visitnorway.com/" }] });
  const html = views.destinations.render(ctx);
  assert.ok(html.includes("Reviewed 8 Nov 2026"), "review date shown");
  assert.match(html, /<a href="https:\/\/www\.visitnorway\.com\/" target="_blank" rel="noopener"[^>]*>Visit Norway<\/a>/);
  assert.ok(html.includes("No sources yet"), "destinations without sources say so");
});
test("minor: a double click on Unlock tries the password once", async () => {
  document.getElementById("app").innerHTML = `<input id="livePass" value="pw"><input type="checkbox" id="liveRemember">`;
  let calls = 0; const pending = []; const release = v => pending.splice(0).forEach(r => r(v));
  const vault = { unlock: () => { calls++; return new Promise(r => pending.push(r)); } };
  const ctx = Object.assign(ctxFor(familyTrip()), { vault, rerender() {} });
  const a = views.setup.actions["live-unlock"](null, ctx), b = views.setup.actions["live-unlock"](null, ctx);
  release({ ok: true }); await a; await b;
  assert.equal(calls, 1);
  const c = views.setup.actions["live-unlock"](null, ctx); release({ ok: true }); await c;
  assert.equal(calls, 2, "it can be tried again once the first try is over");
});

test("live plan views render without a plan and without a trip budget", async () => {
  const lp = await import("../src/views/liveplan.js");
  const { normalizePlan } = await import("../src/liveplan.js");
  const t = familyTrip({ id: "t_live", kind: "hike", budget: { total: 0, currency: "EUR" }, options: [{ id: "o_lp", name: "La Palma" }], chosen: "o_lp", livePlan: null, brief: [], rates: {} });
  const ctx = Object.assign(ctxFor(t), { liveStatus: "none", busyTrips: new Set() });
  for (const f of ["planChat", "daysCard", "gearCard", "bookingsCard", "permitsCard", "todoCard", "sourcesCard", "waitingCard"]) assert.equal(typeof lp[f](t, ctx), "string", f);
  assert.match(lp.waitingCard(t, ctx), /Unlock live search in Setup/);
  assert.match(lp.waitingCard(t, Object.assign({}, ctx, { liveStatus: "unlocked" })), /data-act="ask-plan"/);
  assert.match(lp.waitingCard(t, Object.assign({}, ctx, { busyTrips: new Set([t.id]) })), /Writing the plan/);
  for (const v of ["build", "itinerary", "plan", "money", "share"]) assert.equal(typeof views[v].render(ctx), "string", v);
  t.livePlan = normalizePlan({ bookings: [] }, t, { optionId: "o_lp" });
  for (const f of ["daysCard", "gearCard", "bookingsCard", "permitsCard", "todoCard", "sourcesCard"]) assert.equal(typeof lp[f](t, ctx), "string", f);
  for (const v of ["build", "itinerary", "plan", "money", "share"]) assert.equal(typeof views[v].render(ctx), "string", v);
});

/* ---------- Persona review bugs ---------- */
test("bug 2: Itinerary and Plan & book render a chosen route with no dates", () => {
  const t = familyTrip({ id: "t_nodates", kind: "hike", dates: { start: "", end: "" }, travellers: [{ id: "g", name: "Gabriel", limits: {} }], type: {} });
  const ctx = ctxFor(t); t.chosen = ctx.dests[0].id;
  assert.doesNotThrow(() => compute.stays(ctx.dests[0], t));
  for (const v of ["itinerary", "plan"]) { const html = views[v].render(ctx); assert.ok(!/Invalid/.test(html), v); }
  assert.match(views.itinerary.render(ctx), /No dates yet/);
});
test("bug 3: Conditions shows the live choice, not a library destination", async () => {
  const { normalizePlan } = await import("../src/liveplan.js");
  const t = skiTrip({ id: "t_live_ski", options: [{ id: "o_gud", name: "Gudauri", region: "Georgia" }], chosen: "o_gud", log: [] });
  const ctx = ctxFor(t);
  t.livePlan = normalizePlan({ days: [{ id: "d_1", date: "2027-03-20", move: "Tour to Sadzele" }, { id: "d_2", date: "2027-03-21", move: "Kudebi" }] }, t, { optionId: "o_gud" });
  const html = views.conditions.render(ctx);
  assert.match(html, /Conditions: Gudauri/); for (const d of ctx.dests) assert.ok(!html.includes("Conditions: " + d.name), d.name);
  assert.match(html, /Tour to Sadzele/); assert.match(html, /data-log="2027-03-21"/);
});
test("bug 4: a day at the danger limit is allowed; only above it is a no-go", () => {
  const t = skiTrip({ id: "t_danger", log: [{ date: "2027-03-21", danger: "2" }, { date: "2027-03-22", danger: "3" }] });
  const ctx = ctxFor(t); t.chosen = ctx.dests[0].id; t.travellers[1].limits.maxDanger = "2";
  const html = views.conditions.render(ctx);
  const row = date => html.split("<tr").find(r => r.includes(`data-log="${date}"`)) || "";
  assert.ok(!/nogo/.test(row("2027-03-21")), "level 2 with a limit of 2 is fine");
  assert.match(row("2027-03-22"), /nogo/);
  assert.match(html, /Above it, the day is a no-go/);
});
test("bug 5: permits and admin items have a tick box", async () => {
  const lp = await import("../src/views/liveplan.js"); const { normalizePlan } = await import("../src/liveplan.js");
  const { planInput } = await import("./plan-fixtures.mjs");
  const t = familyTrip({ id: "t_tick", kind: "hike", options: [{ id: "o_lp", name: "La Palma" }], chosen: "o_lp", travellers: [{ id: "s", name: "Situ", limits: {} }] });
  t.livePlan = normalizePlan(planInput(), t, { optionId: "o_lp" });
  const html = lp.permitsCard(t);
  assert.match(html, /data-bind="livePlan\.permits\.#p_caldera\.done" data-type="bool"/);
  assert.match(html, /data-act="admin-done" data-key="s" data-id="a_ins"/);
});
test("bug 7: Destinations names the live choice and offers Next, and warns that choosing here replaces it", () => {
  const t = familyTrip({ id: "t_live_dest", options: [{ id: "o_jp", name: "Kyoto and the Kumano Kodo" }], chosen: "o_jp" });
  const html = views.destinations.render(ctxFor(t));
  assert.match(html, /Chosen: <strong>Kyoto and the Kumano Kodo<\/strong>/); assert.match(html, /href="#build"/);
  assert.match(html, /replaces? it/);
});
test("bug 8: Money says the plan was priced for fewer people", async () => {
  const { normalizePlan } = await import("../src/liveplan.js"); const { planInput } = await import("./plan-fixtures.mjs");
  const t = familyTrip({ id: "t_more", kind: "hike", options: [{ id: "o_lp", name: "La Palma" }], chosen: "o_lp", travellers: [{ id: "g", name: "G", limits: {} }, { id: "s", name: "S", limits: {} }, { id: "x", name: "X", limits: {} }], rates: { EUR: { toTrip: 1, seenOn: "2026-11-09", source: null } } });
  t.livePlan = Object.assign(normalizePlan(planInput(), t, { optionId: "o_lp" }), { forTravellers: 2 });
  assert.match(views.money.render(ctxFor(t)), /priced for 2 travellers; the trip now has 3/);
});
