// Persona: Gabriel (with Situ) wants "a long weekend somewhere warm in March or April, whichever weekend is cheapest,
// 2 people, from London, by train if possible, max £600". Walked twice: (b) on a device with no live search, then
// (a) with live search unlocked (fake Claude). Then he changes his mind (train → flight, 2 → 3 people, new dates after
// a plan exists) and we look at what goes stale. Where the app can't do what he needs, a test.todo says so.
import test from "node:test"; import assert from "node:assert/strict";
import { JSDOM } from "jsdom"; import fs from "node:fs"; import vm from "node:vm";
const dom = new JSDOM(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), { url: "https://example.test/index.html#home", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["document", "window", "location", "localStorage", "HTMLElement", "FormData", "Event", "CustomEvent"]) { try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } catch (e) {} }
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
import { fileURLToPath } from "node:url";
const fakeFiles = new Map(); let fakeApi = null;
globalThis.fetch = async (u, init) => { const url = new URL(String(u));
  if (url.hostname === "api.anthropic.com") { if (!fakeApi) return { ok: false, status: 503, text: async () => "" }; const r = await fakeApi(url, init); const st = r.__status || 200; return { ok: st < 400, status: st, text: async () => JSON.stringify(r) }; }
  for (const [k, v] of fakeFiles) if (url.pathname.endsWith(k)) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(v)) };
  if (url.pathname.endsWith("/data/claude-key.json")) return { ok: false, status: 404, json: async () => null }; const file = url.protocol === "file:" ? fileURLToPath(url) : fileURLToPath(new URL("../" + url.pathname.replace(/^\//, ""), import.meta.url)); return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, "utf8")) }; };
const sb = { module: { exports: {} } }; sb.exports = sb.module.exports; vm.runInNewContext(fs.readFileSync(new URL("../vendor/lz-string.min.js", import.meta.url), "utf8"), sb); window.LZString = sb.module.exports;
window.confirm = () => true;
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const $ = s => window.document.querySelector(s);
const $$ = s => [...window.document.querySelectorAll(s)];
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const change = (el, v) => { if (el.type === "checkbox") el.checked = v; else el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); };
const go = async h => { window.location.hash = h; await tick(60); };
const storedTrip = () => { const s = JSON.parse(window.localStorage.getItem("tripplanner.v1")); return s.trips[s.current]; };
const lastApp = () => $$(".chat .msg.app").pop()?.textContent || "";
const say = async text => { $("#chatText").value = text; click($('[data-act="chat-send"]')); await tick(300); };

const WISH = "a long weekend somewhere warm in March or April, whichever weekend is cheapest, 2 people, from London, by train if possible, max £600";
const PASS = "correct horse battery staple long";

/* ---------------- (b) No password on this device ---------------- */

test("(b) no live search: the sentence fills the form, but the long weekend, the either-month and 'cheapest weekend' are lost", async () => {
  await import("../src/main.js"); await go("#home");
  assert.equal($("#livePass"), null, "no unlock card: this site has no locked key");
  $("#describeText").value = WISH; click($('[data-act="describe-new"]')); await tick(200);
  assert.equal(window.location.hash, "#setup");
  const t = storedTrip();
  // What was read correctly
  assert.equal(t.travellers.length, 2);
  assert.equal(t.origin.city, "London");
  assert.deepEqual([t.budget.total, t.budget.currency], [600, "GBP"]);
  assert.equal(t.travellers[0].limits.minDayHighC, 18, "'somewhere warm' becomes an 18 °C floor (a guess)");
  // What went wrong: "long weekend" is not a length, "March or April" became fixed dates, Mon 1 → Sun 7 March
  assert.deepEqual(t.dates, { start: "2027-03-01", end: "2027-03-07" }, "a guessed 7-day week starting on a Monday, not a weekend");
  assert.match($(".triphead").textContent, /7 days/);
  assert.match(lastApp(), /7-day length/, "the reply admits the 7-day length is a guess");
  assert.doesNotMatch(lastApp(), /weekend|April/i, "nothing in the reply acknowledges the long weekend, April, or 'cheapest weekend'");
  // "by train if possible" became a hard rule
  assert.equal(t.travel.mode, "train");
  assert.match($('[data-bind="travel.mode"]').selectedOptions[0].textContent, /Trains only/);
  // Nothing says what this device is missing
  assert.doesNotMatch($(".view-setup").textContent, /live search/i, "no hint that live search exists or needs a password");
  // There is no way to say the dates are flexible
  assert.equal($('[data-bind^="dates.flex"], [data-bind="dates.window"]'), null, "no flexible-dates control");
});

test("(b) no live search: library ideas give a ranked list, priced by month, never by weekend", async () => {
  await import("../src/main.js");
  const ideas = () => $$(".fitideas li").map(li => li.textContent.replace(/\s+/g, " ").trim());
  assert.equal(ideas().length, 3, "three ideas show under the chat");
  await say("give us options");
  assert.match(lastApp(), /best fits in the library/);
  // He fixes a long weekend in March, notes the per-person estimate of the top idea, then tries an April weekend
  await say("12-14 March");
  assert.deepEqual(storedTrip().dates, { start: "2027-03-12", end: "2027-03-14" });
  assert.match($(".triphead").textContent, /3 days/);
  const pp = () => $$(".fitideas li").map(li => (li.textContent.match(/£[\d,]+ pp/) || [""])[0]);
  const names = () => $$(".fitideas li strong").map(s => s.textContent);
  const march = { names: names(), pp: pp() };
  await say("19-21 March");
  assert.deepEqual(storedTrip().dates, { start: "2027-03-19", end: "2027-03-21" });
  assert.deepEqual({ names: names(), pp: pp() }, march, "another March weekend: same places, same prices; the library prices a month, not a weekend");
  // Asking about April in his own words throws away the 3-day length: a month alone resets to the 1st, 7 days
  await say("what about April instead?");
  assert.deepEqual(storedTrip().dates, { start: "2027-04-01", end: "2027-04-07" }, "the long weekend became a 7-day week again");
  assert.match(lastApp(), /a guess/);
  await say("9-11 April");
  assert.deepEqual(storedTrip().dates, { start: "2027-04-09", end: "2027-04-11" });
  assert.notDeepEqual(pp(), march.pp, "April prices differ from March (a seasonal factor), one month at a time");
  // Destinations: the library's comparison table, for the 3-day trip
  await go("#destinations");
  change($('input[data-ui="compare"]'), true); await tick(60);
  assert.ok($("table.cmp tbody tr"), "the library comparison table is there");
  const rows = $$("table.cmp tbody tr").length;
  assert.ok(rows > 3, `${rows} rows to compare`);
  // Changing his mind in words: "fly" is not understood, a third person is
  await go("#setup");
  await say("actually let's fly instead");
  assert.equal(storedTrip().travel.mode, "train", "'let's fly' leaves the trip on Trains only");
  assert.match(lastApp(), /Nothing new to fill in/);
  await say("3 of us now");
  assert.equal(storedTrip().travellers.length, 3);
  assert.equal(storedTrip().budget.total, 600, "the £600 stays the group total for three; nothing asks whether it should grow");
});

test.todo("(b) 'a long weekend' is read as 3 days (Fri–Sun) and 'March or April' is kept as a window, not turned into 1–7 March");
test.todo("(b) 'by train if possible' is a preference (rank trains first), not 'Trains only' that red-flags every flight");
test.todo("(b) Setup says plainly that live search (real options and prices from the web) is not set up on this device, and what to ask for");
test.todo("(b) dates can be held as flexible: a window (March–April), a length (3 days) and 'weekends only', until one is picked");
test.todo("(b) a cost-by-weekend view: the same destination priced for each candidate weekend in the window, cheapest first");

/* ---------------- (a) Live search unlocked (fake Claude) ---------------- */

const src = { name: "Eurostar", url: "https://www.eurostar.com/", seenOn: "2026-11-13" };
const opt = (name, over = {}) => Object.assign({ name, region: "", countryCodes: ["FR"], lat: null, lon: null, why: "Warm-ish spring sun, walkable old town", weather: { text: "15–18 °C by day", highC: 17, lowC: 9, source: null }, maxAltitudeM: null, activities: ["Promenade", "Old town"], access: { from: "London", mode: "train", time: "8h40", connections: "Eurostar + TGV via Paris", pricePP: 150, currency: "GBP", seenOn: "2026-11-13", source: src }, lodging: [{ type: "hotel", low: 90, high: 140, currency: "EUR" }], estimate: { perPerson: 280, group: 560, currency: "GBP", breakdown: [{ what: "Trains", amount: 300 }, { what: "Hotel 2 nights", amount: 200 }, { what: "Food", amount: 60 }] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: [src] }, over);
// The only way Claude can show "prices differ by weekend" today: one option per destination-and-weekend, the weekend in the name.
const weekendOptions = () => ({ rates: [{ currency: "EUR", toTrip: 0.86, seenOn: "2026-11-13", source: null }], options: [
  opt("Nice, Fri 9 – Sun 11 Apr", { pick: true, estimate: { perPerson: 255, group: 510, currency: "GBP", breakdown: [] }, tradeOff: "Cheapest weekend found; trains sell out after January" }),
  opt("Nice, Fri 12 – Sun 14 Mar", { weather: { text: "13–15 °C", highC: 14, lowC: 6, source: null }, estimate: { perPerson: 290, group: 580, currency: "GBP", breakdown: [] }, tradeOff: "Cooler" }),
  opt("Barcelona, Fri 16 – Sun 18 Apr", { countryCodes: ["ES"], weather: { text: "19 °C", highC: 19, lowC: 11, source: null }, access: { from: "London", mode: "train", time: "10h", connections: "Eurostar + TGV", pricePP: 210, currency: "GBP", seenOn: "2026-11-13", source: src }, estimate: { perPerson: 340, group: 680, currency: "GBP", breakdown: [] }, tradeOff: "Warmest, but over £600" }),
  opt("Seville, any March weekend", { countryCodes: ["ES"], weather: { text: "22 °C", highC: 22, lowC: 10, source: null }, access: { from: "London", mode: "flight", time: "2h40", connections: "Direct from Gatwick", pricePP: 70, currency: "GBP", seenOn: "2026-11-13", source: null }, estimate: { perPerson: 230, group: 460, currency: "GBP", breakdown: [] }, mention: true, mentionWhy: "Only by plane; by train it is two days each way" })
] });
const toolReply = (name, input, text = "") => ({ stop_reason: "end_turn", usage: {}, content: [...(text ? [{ type: "text", text }] : []), { type: "tool_use", id: "tu1", name, input }] });
const bk = over => Object.assign({ id: "b_x", what: "x", category: "other", pick: "", alternative: "", price: null, currency: "GBP", seenOn: "2026-11-13", status: "idea", link: null, bookBy: null, details: "", source: null }, over);
const niceDay = (id, date, move, night) => ({ id, date, move, km: null, ascentM: null, descentM: null, hours: null, night, fallback: "", legs: [], points: [] });
const nicePlan = () => ({
  days: [
    niceDay("d_1", "2027-04-09", "Eurostar 07:01 then TGV to Nice", { name: "Hôtel Le Genève", type: "hotel", bookingId: "b_hotel" }),
    niceDay("d_2", "2027-04-10", "Old town, Colline du Château, Villefranche by bus", { name: "Hôtel Le Genève", type: "hotel", bookingId: "b_hotel" }),
    niceDay("d_3", "2027-04-11", "Train home", { name: "", type: "none", bookingId: null })
  ],
  bookings: [
    bk({ id: "b_train", what: "Eurostar + TGV return, 2 adults", category: "transport", price: 300, currency: "GBP", bookBy: "2027-01-15", details: "2 adults, Fri 9 Apr out, Sun 11 Apr back" }),
    bk({ id: "b_hotel", what: "Hôtel Le Genève, 2 nights, double", category: "lodging", price: 220, currency: "EUR", details: "1 double room, 2 adults" })
  ],
  permits: [], admin: [], gear: [], food: "Socca at the market", todo: [{ id: "t_1", date: "2027-01-15", what: "Book the trains when fares open" }],
  otherCosts: [{ id: "c_food", what: "Food and buses", amount: 120, currency: "EUR", seenOn: "2026-11-13" }],
  sources: [src], rates: [{ currency: "EUR", toTrip: 0.86, seenOn: "2026-11-13", source: null }]
});

test("(a) live: Claude is told the guessed 1–7 March week as fact; weekends can only be compared as separate cards", async () => {
  await import("../src/main.js");
  const { lockKey } = await import("../src/keylock.js");
  fakeFiles.set("/data/claude-key.json", await lockKey("sk-ant-test", PASS, { iterations: 1000 }));
  await go("#home");
  $("#describeText").value = WISH; click($('[data-act="describe-new"]')); await tick(200);
  assert.equal(window.location.hash, "#setup");
  assert.ok($("#livePass"), "the unlock card shows on Setup");
  assert.match($(".view-setup").textContent, /Ask him for the family password/, "a locked device says what it is missing");
  $("#livePass").value = PASS; click($('[data-act="live-unlock"]')); await tick(150);
  assert.match($(".livestatus").textContent, /Live search is on/);
  let sent = null; fakeApi = async (url, init) => { sent = JSON.parse(init.body); return toolReply("propose_options", weekendOptions(), "Cheapest is Nice on 9–11 April. Want me to check Easter?"); };
  await say("Which weekend in March or April is cheapest? Compare a few weekends for us");
  const ctxText = JSON.stringify(sent.messages);
  assert.match(ctxText, /2027-03-01/, "the guessed start date goes to Claude");
  assert.match(ctxText, /\\"lengthDays\\":7/, "Claude is told the trip is 7 days");
  const tripJson = sent.messages.at(-1).content.split("Current trip:\n")[1].split("\n\nMessage:")[0];
  assert.doesNotMatch(tripJson, /guess|flexib|window/i, "the trip JSON (the 'truth' for Claude) has no sign the dates are a guess or flexible");
  // His question names two months: the rule-based reader re-guessed the dates from "March" before Claude saw them
  assert.match(ctxText, /1 Mar 2027 → 7 Mar 2027 \(a guess\)/);
  assert.match(ctxText, /\\"travelMode\\":\\"train\\"/);
  // The cards: prices do differ by weekend, but only because each weekend is its own card
  const cards = $$(".optcard");
  assert.equal(cards.length, 3);
  assert.match(cards[0].textContent, /Claude's pick/); assert.match(cards[0].textContent, /9 – Sun 11 Apr/);
  assert.match(cards[0].textContent, /£510/); assert.match(cards.find(c => /Mar/.test(c.textContent)).textContent, /£580/);
  const bcn = cards.find(c => /Barcelona/.test(c.textContent));
  assert.match(bcn.textContent, /over the £600 budget/, "the app flags the weekend over £600");
  assert.match($(".optmentions").textContent, /Seville/);
  // No side-by-side table and no sort by price for live options; Destinations shows the library, not these cards
  await go("#destinations");
  assert.doesNotMatch($(".view-destinations").textContent, /Nice, Fri 9/, "live options are not in the Destinations comparison");
  await go("#setup");
});

test("(a) live: choosing the 9–11 April card writes a 3-day plan, and the card's name no longer moves the trip dates", async () => {
  await import("../src/main.js");
  const datesBefore = JSON.parse(JSON.stringify(storedTrip().dates));
  let sent = null; fakeApi = async (url, init) => { sent = JSON.parse(init.body); return toolReply("write_plan", nicePlan(), "Here is your Nice weekend."); };
  const pick = $$(".optcard").find(c => /9 – Sun 11 Apr/.test(c.textContent));
  click(pick.querySelector('[data-act="choose-option"]')); await tick(350);
  assert.equal(window.location.hash, "#build");
  // Fixed (bug 1): the app's own message skips the rule-based reader, so "Apr" in the card's name can't move the dates
  assert.match(JSON.stringify(sent.messages), /Write the full plan for Nice, Fri 9 – Sun 11 Apr\./);
  assert.deepEqual(storedTrip().dates, datesBefore, "choosing a card leaves the trip dates alone");
  // The plan itself is fine: 3 days, with its own dates
  assert.equal($$(".daytable tbody tr").length, 3);
  assert.match($(".daytable").textContent, /9 Apr/);
  // The trip keeps its own dates (no guessed 1–7 April week); choosing a dated card still doesn't set them, and nothing flags the mismatch
  assert.doesNotMatch($(".triphead").textContent, /1 Apr 2027 → 7 Apr 2027/);
  assert.doesNotMatch($(".view-build").textContent, /dates? (don't|do not) match|outside the trip/i, "no flag for plan days outside the trip dates");
  // Money: the plan total is computed and within £600
  await go("#money");
  const { planTotals } = await import("../src/liveplan.js"); const { fmtMoney } = await import("../src/ui.js");
  const tot = planTotals(storedTrip().livePlan, storedTrip());
  assert.equal(tot.total, 300 + Math.round(220 * 0.86) + Math.round(120 * 0.86));
  assert.ok($(".view-money").textContent.includes(fmtMoney(tot.total, "GBP")));
  assert.equal(tot.overBudget, false);
  assert.ok($(".view-money").textContent.includes(fmtMoney(tot.perPerson, "GBP")), "per person shown");
  // Plan & book: the train booking has its book-by date and the to-do list is ordered
  await go("#plan");
  assert.match($(".todolist").textContent, /Book Eurostar \+ TGV return/);
});

test("(a) changing his mind after the plan: dates, people and mode change; the plan and its totals don't notice", async () => {
  await import("../src/main.js");
  const { planTotals } = await import("../src/liveplan.js");
  const before = planTotals(storedTrip().livePlan, storedTrip());
  let calls = 0; fakeApi = async () => { calls++; return { stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "ok" }] }; };
  // 1. He fixes the dates by hand to the weekend he chose: nothing re-checks the plan, nothing asks Claude
  await go("#setup");
  change($('[data-bind="dates.start"]'), "2027-04-16"); change($('[data-bind="dates.end"]'), "2027-04-18"); await tick(80);
  assert.match($(".triphead").textContent, /3 days/);
  await go("#build");
  assert.match($(".daytable").textContent, /9 Apr/, "the plan still shows the 9–11 April days after the dates moved to 16–18");
  assert.doesNotMatch($(".view-build").textContent, /out of date|dates changed|no longer match/i, "no stale-plan warning");
  // 2. Situ's friend joins: 3 travellers. Group prices were for 2; the per-person total silently drops
  await go("#setup");
  click($('[data-act="add-traveller"]')); await tick(60);
  const after3 = planTotals(storedTrip().livePlan, storedTrip());
  assert.equal(after3.total, before.total, "the group total doesn't grow with a third person");
  // Fixed (bug 8): per person stays on the 2 the plan was priced for, and the change is named
  assert.equal(after3.perPerson, before.perPerson, "per person isn't silently divided by 3");
  assert.deepEqual(after3.travellersChanged, { was: 2, now: 3 });
  assert.equal(storedTrip().budget.total, 600, "the £600 cap stays a group cap; nobody asks if it was per couple");
  // 3. He'd fly after all: the trains-only flag on the Seville idea goes away (checks are live), but the options
  //    and the plan were all researched for trains and nothing suggests asking again
  change($('[data-bind="travel.mode"]'), "any"); await tick(80);
  assert.equal(storedTrip().travel.mode, "any");
  assert.doesNotMatch($(".view-setup").textContent, /needs a flight/);
  assert.doesNotMatch($(".view-setup").textContent, /search again|refresh the options|options were found for/i, "no hint the options are stale");
  assert.equal(calls, 0, "no form change triggers Claude");
  // 4. Saying it in the chat does reach Claude (with the new trip JSON), which is the only way to refresh
  let sent = null; fakeApi = async (url, init) => { sent = JSON.parse(init.body); return toolReply("update_plan", Object.assign(Object.fromEntries(Object.keys(nicePlan()).map(k => [k, null])), { bookings: nicePlan().bookings.map(b => b.id === "b_train" ? Object.assign({}, b, { what: "Eurostar + TGV return, 3 adults", price: 450 }) : b) }), "Updated for three.");
  };
  await go("#build");
  await say("we're 3 now, and the 16-18 April weekend");
  assert.match(JSON.stringify(sent.messages), /16/);
  const t = storedTrip();
  assert.equal(planTotals(t.livePlan, t).total, before.total + 150, "the plan total follows once Claude updates the booking");
  assert.match($(".daytable").textContent, /9 Apr/, "days Claude didn't resend keep their old dates");
});

test.todo("(a) live options carry their own dates (a weekend) so the same place can be compared across weekends in one row, sorted by price");
test.todo("(a) choosing an option with dates fixes trip.dates to that weekend (and the plan is written for them)");
test.todo("(a) a flag when the plan's days fall outside the trip's dates, or the number of days differs");
test.todo("(a) after a change to dates, travellers, mode or budget, options and plan are marked 'found for the old inputs' with a one-click 'ask again'");
test.todo("(a) prices that scale with people (trains, beds) are per person or per unit, so a third traveller updates the plan total or flags it");
test.todo("(a) a side-by-side table for live options (weather, getting there, total, flags), as for library destinations");
