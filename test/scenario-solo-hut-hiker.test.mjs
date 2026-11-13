// Persona scenario: Gabriel alone, library path (no live search on this device).
// "5–6 days of hut-to-hut hiking sometime in September, no dates yet, by train from Brussels, about €900."
// Walks Home → Setup → Destinations → Build → Itinerary → Plan & book → Money → Conditions → Share in the real router.
import test from "node:test"; import assert from "node:assert/strict";
import { JSDOM } from "jsdom"; import fs from "node:fs"; import vm from "node:vm";
const dom = new JSDOM(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), { url: "https://example.test/index.html#home", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["document", "window", "location", "localStorage", "HTMLElement", "FormData", "Event", "CustomEvent"]) { try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } catch (e) {} }
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
import { fileURLToPath } from "node:url";
// No lock file (claude-key.json → 404) and no API: this device has no live search.
globalThis.fetch = async (u) => { const url = new URL(String(u));
  if (url.hostname === "api.anthropic.com") throw new Error("the library path must never call the API");
  if (url.pathname.endsWith("/data/claude-key.json")) return { ok: false, status: 404, json: async () => null }; const file = url.protocol === "file:" ? fileURLToPath(url) : fileURLToPath(new URL("../" + url.pathname.replace(/^\//, ""), import.meta.url)); return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, "utf8")) }; };
const sb = { module: { exports: {} } }; sb.exports = sb.module.exports; vm.runInNewContext(fs.readFileSync(new URL("../vendor/lz-string.min.js", import.meta.url), "utf8"), sb); window.LZString = sb.module.exports;
window.confirm = () => true;
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const change = (el, v) => { if (el.type === "checkbox") el.checked = v; else el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); };
const go = async h => { window.location.hash = h; await tick(60); };
const text = s => ($(s)?.textContent || "").replace(/\s+/g, " ");
const trip = () => { const s = JSON.parse(window.localStorage.getItem("tripplanner.v1")); return s.trips[s.current]; };
const lastReply = () => $$(".thread li.app").at(-1)?.textContent || "";
const submit = form => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));

const IDEA = "Just me, 5-6 days of hut-to-hut hiking sometime in September, no dates yet, by train from Brussels, about €900";

test("solo hut-to-hut hiker: from a vague September idea to an itinerary with huts and trains marked booked", async () => {
  await import("../src/main.js"); await tick(80);

  // 1. Home: no live-search card (no lock file), the describe box is the way in.
  assert.ok($("#describeText"), "describe box on Home");
  $("#describeText").value = IDEA;
  click($('[data-act="describe-new"]')); await tick(120);
  assert.equal(window.location.hash, "#setup");
  assert.ok(!$(".livecard"), "no password card when no locked key is published");

  // 2. Setup: the rule-based reader filled what it could and says the dates are a guess.
  let t = trip();
  assert.equal(t.kind, "hike", "hut-to-hut → Hut-to-hut hiking");
  assert.equal(t.travellers.length, 1, "just me → one traveller");
  assert.equal(t.travel.mode, "train"); assert.equal(t.origin.city, "Brussels");
  assert.deepEqual([t.budget.total, t.budget.currency], [900, "EUR"]);
  assert.deepEqual(t.dates, { start: "2027-09-01", end: "2027-09-06" }, "'sometime in September' + '6 days' → 1–6 Sep, flagged as a guess");
  assert.match(lastReply(), /\(a guess\)/); assert.match(lastReply(), /Guesses to check: the dates/);
  const ideas = $$(".fitideas li"); assert.equal(ideas.length, 3, "three ideas that fit so far");
  assert.match(text(".fitideas"), /Alta Via 1|GR20|Haute Route|Mont Blanc/);

  // 3. He asks the planner which week to go. The rule-based chat has no notion of weeks.
  $("#chatText").value = "Which week in September is best for the huts?";
  click($('[data-act="chat-send"]')); await tick(80);
  assert.doesNotMatch(lastReply(), /first week|second week|mid-September|late September|close/i, "no week advice in the library path");

  // He decides himself (Mon 6 – Sat 11 Sep 2027, 6 days) and names the trip.
  change($('[data-bind="dates.start"]'), "2027-09-06"); await tick(30);
  change($('[data-bind="dates.end"]'), "2027-09-11"); await tick(60);
  change($('[data-bind="name"]'), "September huts"); await tick(40);
  change($('[data-bind="travellers.0.name"]'), "Gabriel"); await tick(40);
  assert.match(text(".view-setup"), /6 days/);
  assert.equal(trip().dates.end, "2027-09-11");

  // 4. Destinations: train-only filter and the budget filter.
  await go("#destinations");
  const all = $$(".dest").length; assert.equal(all, 6, "six hiking routes in the library");
  change($('input[data-ui="mode"]'), true); await tick(60);
  assert.equal($$(".dest").length, 6, "every route is reachable by train from Brussels");
  change($('input[data-ui="fit"]'), true); await tick(60);
  const fitting = $$(".dest h3").map(h => h.textContent);
  assert.ok(fitting.length >= 1 && fitting.length < 6, `some routes fit €900 (${fitting.join(", ")})`);
  change($('input[data-ui="fit"]'), false); await tick(60);
  // Season fit is monthly: every route scores September the same, so dates inside September don't change the ranking.
  const seasonOf = () => $$(".dest").map(d => d.querySelector(".scorebox .score").textContent).join(",");
  const early = seasonOf();
  await go("#setup"); change($('[data-bind="dates.start"]'), "2027-09-20"); await tick(30); change($('[data-bind="dates.end"]'), "2027-09-25"); await tick(60);
  await go("#destinations"); const late = seasonOf();
  assert.equal(late, early, "late September (TMB/Haute Route huts closing) scores exactly like early September");
  await go("#setup"); change($('[data-bind="dates.start"]'), "2027-09-06"); await tick(30); change($('[data-bind="dates.end"]'), "2027-09-11"); await tick(60);
  await go("#destinations");

  // He picks the Alta Via 1, Northern week (5 stages).
  const av1 = $("#d-alta-via-1"); assert.ok(av1, "Alta Via 1 card");
  click(av1.querySelector('[data-act="preset"][data-i="1"]')); await tick(60);
  click($("#d-alta-via-1 [data-act=choose]")); await tick(60);
  assert.ok($(".dest.chosen#d-alta-via-1")); assert.ok($(".nextbar"), "next-step bar after choosing");

  // 5. Build: 5 stages + 1 rest fill all 6 days, leaving no day to get there; he removes the rest day.
  await go("#build");
  assert.equal($$("ol.stages li.block.on").length, 5, "five stages on");
  assert.match(text(".view-build"), /Only 0 travel days/);
  click($('button[data-act="rest"][data-d="-1"]')); await tick(60);
  assert.match(text(".view-build"), /1 travel day left, nothing flagged/);
  assert.match(text(".view-build"), /Trains from Brussels/);
  assert.match(text(".view-build"), /book 5 mo ahead/, "hut lead time shown on the stage");

  // 6. Itinerary: one row per day, travel day first, huts with a book link.
  await go("#itinerary");
  const rows = $$("table.itin tbody tr"); assert.equal(rows.length, 6, "six days for a six-day trip");
  assert.match(rows[0].textContent, /Travel: Brussels → Alta Via 1/);
  assert.match(rows[5].textContent, /travel home in the evening/);
  assert.equal($$('table.itin a').filter(a => a.textContent === "book the hut").length, 5);

  // 7. Plan & book: the steps, hut lead times, booking refs night by night.
  await go("#plan");
  const plan = text(".view-plan");
  assert.match(plan, /Book trains out and back/); assert.match(plan, /Advance fares open 2–4 months ahead/);
  assert.match(plan, /Book 5 hut nights/); assert.match(plan, /Rifugio Sennes \(5 months ahead\)/);
  assert.match(plan, /hut-reservation\.org/);
  const refs = $$('input[data-bind^="lodgingBooked."]'); assert.equal(refs.length, 5, "a Booked? field per hut night");
  for (const [i, el] of refs.entries()) { change(el, `AV1-${i + 1} deposit paid`); await tick(20); }
  for (const key of ["dates", "destination", "trains", "huts", "halfboard"]) { const box = $(`input[data-act="step"][data-key="${key}"]`); assert.ok(box, `step ${key}`); change(box, true); await tick(30); }
  assert.match(text(".view-plan"), /5 of 12 done/);
  assert.equal(Object.keys(trip().lodgingBooked).length, 5);

  // 8. Money: solo, so no split; the budget bar tracks what is committed.
  await go("#money");
  const f = $('form[data-form="expense"]');
  f.querySelector("[name=desc]").value = "Trains Brussels → Dobbiaco, return from Belluno"; f.querySelector("[name=amount]").value = "230"; f.querySelector("[name=category]").value = "Transport"; submit(f); await tick(60);
  const f2 = $('form[data-form="expense"]');
  f2.querySelector("[name=desc]").value = "Hut deposits (5 nights)"; f2.querySelector("[name=amount]").value = "100"; f2.querySelector("[name=category]").value = "Huts"; f2.querySelector("[name=status]").value = "planned"; submit(f2); await tick(60);
  const money = text(".view-money");
  assert.match(money, /Committed so far \(paid \+ planned\)€330/);
  assert.match(money, /Left in the budget€570/);
  assert.match(money, /Everyone is square/, "settle-up is moot for one person");

  // 9. Conditions: the forecast link and a daily log for each walking day.
  await go("#conditions");
  assert.match(text(".view-conditions"), /ARPA Veneto Dolomiti Meteo/);
  const w = $('input[data-log="2027-09-07"][data-k="weather"]'); assert.ok(w, "log row for stage 1"); change(w, "sunny, 14°C, light wind"); await tick(30);
  change($('select[data-log="2027-09-07"][data-k="decision"]'), "go"); await tick(40);
  assert.equal(trip().log.find(l => l.date === "2027-09-07").decision, "go");

  // 10. Share: the summary carries the day by day with huts and the open steps.
  await go("#share");
  const sum = text("pre.summary");
  assert.match(sum, /September huts \(hike\)/); assert.match(sum, /Gabriel · from Brussels · train/);
  assert.match(sum, /Destination: Alta Via 1/); assert.match(sum, /Rifugio Sennes/);
  assert.match(sum, /Planning steps: 5\/12 done/);
  assert.match($("#shareLink").value, /#s-[A-Za-z0-9-]+$/);
});

test("no dates yet: Build, Conditions and Share still open once a route is chosen", async () => {
  await go("#home"); $("#describeText").value = "Hut to hut hiking, just me, by train from Brussels";
  click($('[data-act="describe-new"]')); await tick(120);
  assert.equal(trip().dates.start, "", "no month given → no dates");
  await go("#destinations"); assert.match(text(".view-destinations"), /No dates yet/);
  click($('#d-alta-via-1 [data-act="choose"]')); await tick(60);
  await go("#build"); assert.ok($("ol.stages"), "build renders without dates");
  await go("#conditions"); assert.match(text(".view-conditions"), /Set the dates to get one row per day/);
  await go("#share"); assert.match(text("pre.summary"), /Day by day:/);
});

// What Gabriel needed and the app could not do (or got wrong) on the library path.
test.todo("Itinerary and Plan & book open without dates (today both show 'Something went wrong: Invalid time value': stays() in compute.js dates 'day-1')");
test.todo("Help pick the week: compare weeks inside September (hut opening/closing dates, crowds, Ferragosto/UTMB) instead of one monthly season score");
test.todo("Flag a trip that runs past a route's hut season (TMB refuges close mid-September; late-September dates score the same as early)");
test.todo("Turn 'book 5 months ahead' into a dated deadline ('book by 6 April 2027') and a reminder, reconciled with the route note 'book in January'");
test.todo("The rule-based chat should not re-ask 'How many of you are going?' after 'Just me', nor read 'which week' as a 7-day trip length");
test.todo("A solo trip: say 'for you' not 'for the group', and hide the split/settle-up blocks when there is one traveller");
test.todo("Fit the plan to the dates when a preset is picked (Northern week + 1 rest day fills a 6-day trip and leaves 0 travel days)");
test.todo("Nights at either end: the arrival night after a 10 h train (Dobbiaco/Braies) and the last night have no lodging row to book");
test.todo("Train legs as bookable rows (dates prefilled, booked yes/no, reference), not one 'Book trains out and back' step and an empty Trainline link");
test.todo("Rome2Rio/map links use the stage description ('Up from the lake over the Forcella Sora Forno') instead of a place name");
test.todo("A booking list: what is booked, with refs, in the share summary (lodgingBooked refs are not in the summary)");
test.todo("Route exit: Northern week ends at Rifugio Città di Fiume but the way home (bus to a station) is not given");
