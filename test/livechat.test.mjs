import test from "node:test"; import assert from "node:assert/strict";
import { liveTurn } from "../src/livechat.js";
import { tripContext, SYSTEM_PROMPT } from "../src/prompts.js";
import { newTrip } from "../src/state.js";

const TODAY = "2026-11-09";
function situTrip() {
  const t = newTrip("explore");
  t.travellers = [{ id: "g", name: "Gabriel", limits: {} }, { id: "s", name: "Situ", limits: { countryZone: "schengen" } }];
  t.budget = { total: 1500, currency: "GBP" }; t.origin = { city: "London", region: "uk" };
  return t;
}
const option = name => ({ name, region: "", countryCodes: ["ES"], lat: null, lon: null, why: "", weather: { text: "", highC: 21, lowC: null, source: null }, maxAltitudeM: null, activities: [], access: { from: "London", mode: "flight", time: "", connections: "", pricePP: null, currency: "GBP", seenOn: TODAY, source: null }, lodging: [], estimate: { perPerson: null, group: 1200, currency: "GBP", breakdown: [] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: [] });
const fakeAsk = result => { const calls = []; const ask = async req => { calls.push(req); return result; }; return { ask, calls }; };
const opts = ask => ({ ask, apiKey: "sk-ant-x", today: TODAY, countries: [] });

test("a propose_options call replaces options and rates and keeps the old set on this device", async () => {
  const t = situTrip(); t.options = [{ id: "o_old", name: "Old idea" }];
  const { ask, calls } = fakeAsk({ ok: true, text: "Three ideas below.", toolCalls: [{ name: "propose_options", input: { options: [option("La Palma"), option("Madeira")], rates: [{ currency: "EUR", toTrip: 0.86, seenOn: TODAY, source: null }] } }], searches: 3 });
  const r = await liveTurn(t, "warm hiking from 2 to 9 January", opts(ask));
  assert.equal(r.ok, true); assert.equal(r.optionsChanged, true);
  assert.deepEqual(t.options.map(o => o.name), ["La Palma", "Madeira"]); assert.equal(t.rates.EUR.toTrip, 0.86);
  assert.equal(t._local.optionHistory[0].options[0].name, "Old idea");
  assert.equal(calls[0].tools[0].name, "propose_options"); assert.equal(calls[0].system, SYSTEM_PROMPT);
  const texts = t.brief.map(m => m.who + ":" + m.text);
  assert.equal(t.brief[0].who, "you"); assert.ok(t.brief.some(m => m.who === "app" && !m.live), "the form-fill reply stays");
  const last = t.brief.at(-1); assert.equal(last.live, true); assert.equal(last.text, "Three ideas below."); assert.ok(last.optionsRev, texts.join(" | "));
});
test("a text-only reply goes in the thread and leaves the options alone", async () => {
  const t = situTrip(); t.options = [{ id: "o_keep", name: "Keep me" }];
  const { ask } = fakeAsk({ ok: true, text: "Do you want beach days too?", toolCalls: [], searches: 0 });
  const r = await liveTurn(t, "what about tents?", opts(ask));
  assert.equal(r.optionsChanged, false); assert.equal(t.options[0].name, "Keep me"); assert.equal(t.brief.at(-1).text, "Do you want beach days too?");
});
test("a failed call says so, keeps the typed text, and still fills the form from the message", async () => {
  const t = situTrip();
  const { ask } = fakeAsk({ ok: false, error: "rate", message: "Live search is busy or over this month's limit. Try again in a minute." });
  const r = await liveTurn(t, "from 2 to 9 January 2027", opts(ask));
  assert.equal(r.ok, false); assert.equal(t.dates.start, "2027-01-02"); assert.equal(t.dates.end, "2027-01-09");
  assert.ok(t.brief.some(m => m.who === "you" && m.text === "from 2 to 9 January 2027"));
  const last = t.brief.at(-1); assert.equal(last.error, true); assert.match(last.text, /busy or over this month's limit/);
  assert.deepEqual(t.options, []);
});
test("Claude gets the trip with Situ's country limit, not the thread or device data", async () => {
  const t = situTrip(); t.brief = [{ who: "you", text: "earlier SECRET-THREAD" }, { who: "app", text: "ok" }]; t._local = { optionHistory: [{ at: "x", options: [{ name: "SECRET-LOCAL" }] }] };
  const { ask, calls } = fakeAsk({ ok: true, text: "ok", toolCalls: [], searches: 0 });
  await liveTurn(t, "ideas please", opts(ask));
  const msgs = calls[0].messages; const final = msgs.at(-1);
  assert.equal(final.role, "user"); assert.match(final.content, /Current trip:/); assert.match(final.content, /"countryZone":"schengen"/); assert.match(final.content, /ideas please/);
  assert.ok(!/SECRET-LOCAL/.test(JSON.stringify(msgs)));
  const ctx = tripContext(t); assert.ok(!/SECRET-THREAD/.test(ctx)); assert.ok(!/brief/.test(ctx));
  assert.equal(msgs[0].role, "user"); for (let i = 1; i < msgs.length; i++) assert.notEqual(msgs[i].role, msgs[i - 1].role, "roles alternate");
});
test("only the last three replaced option sets are kept", async () => {
  const t = situTrip();
  for (let i = 0; i < 5; i++) {
    const { ask } = fakeAsk({ ok: true, text: "", toolCalls: [{ name: "propose_options", input: { options: [option("Round " + i)], rates: [] } }], searches: 0 });
    await liveTurn(t, "again", opts(ask));
  }
  assert.equal(t._local.optionHistory.length, 3); assert.equal(t.options[0].name, "Round 4");
  assert.equal(t._local.optionHistory.at(-1).options[0].name, "Round 3");
});
test("review I2: a failed turn reports its error code so the app can lock again on auth", async () => {
  const t = situTrip();
  const { ask } = fakeAsk({ ok: false, error: "auth", message: "The saved key no longer works. Ask Gabriel for the new password." });
  const r = await liveTurn(t, "hello", opts(ask)); assert.equal(r.ok, false); assert.equal(r.error, "auth");
});
test("minor: earlier error replies are not sent to Claude as its own words", async () => {
  const t = situTrip(); t.brief = [{ who: "you", text: "first try" }, { who: "app", text: "Live search is busy.", live: true, error: true }];
  const { ask, calls } = fakeAsk({ ok: true, text: "ok", toolCalls: [], searches: 0 });
  await liveTurn(t, "second try", opts(ask));
  const msgs = calls[0].messages;
  assert.ok(!/Live search is busy/.test(JSON.stringify(msgs)));
  assert.equal(msgs.length, 1); assert.match(msgs[0].content, /first try[\s\S]*second try/);
});

/* ---------- The live plan ---------- */
import { planInput } from "./plan-fixtures.mjs";
import { normalizePlan } from "../src/liveplan.js";
function chosenTrip() {
  const t = situTrip();
  t.options = [Object.assign(option("La Palma"), { id: "o_lp" }), Object.assign(option("Southern Morocco"), { id: "o_ma" })];
  t.chosen = "o_lp"; t.dates = { start: "2027-01-02", end: "2027-01-03" };
  return t;
}
const planCall = (name, input) => ({ ok: true, text: "", toolCalls: [{ name, input }], searches: 2 });
const nullsBut = over => Object.assign(Object.fromEntries(Object.keys(planInput()).map(k => [k, null])), over);

test("with a chosen option, write_plan sets livePlan for it and keeps the old plan on this device", async () => {
  const t = chosenTrip(); t.livePlan = normalizePlan(planInput({ food: "old" }), t, { today: TODAY, optionId: "o_lp" });
  const bad = planInput(); bad.bookings[0].link = "javascript:alert(1)";
  const { ask, calls } = fakeAsk(planCall("write_plan", bad));
  const r = await liveTurn(t, "Write the full plan for La Palma.", opts(ask));
  assert.equal(r.ok, true); assert.equal(r.planChanged, true);
  assert.equal(t.livePlan.optionId, "o_lp"); assert.equal(t.livePlan.bookings[0].link, null);
  assert.equal(t._local.planHistory.length, 1); assert.equal(t._local.planHistory[0].plan.food, "old");
  assert.ok(t.brief.at(-1).planRev); assert.equal(t.brief.at(-1).text, "Here is the plan.");
  assert.deepEqual(calls[0].tools.map(x => x.name), ["propose_options", "write_plan", "update_plan"]);
  assert.equal(calls[0].maxTokens, 32000);
  assert.equal(t.rates.EUR.toTrip, 0.86);
});
test("update_plan merges into the current plan", async () => {
  const t = chosenTrip(); t.livePlan = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  const days = JSON.stringify(t.livePlan.days);
  const { ask } = fakeAsk(planCall("update_plan", nullsBut({ bookings: planInput().bookings.map(b => b.id === "b_camp" ? Object.assign({}, b, { price: 40 }) : b) })));
  const r = await liveTurn(t, "the campsite is 40 now", opts(ask));
  assert.equal(r.planChanged, true); assert.equal(t.brief.at(-1).text, "The plan is updated.");
  assert.equal(t.livePlan.bookings.find(b => b.id === "b_camp").price, 40); assert.equal(JSON.stringify(t.livePlan.days), days);
});
test("update_plan with no plan yet is taken as the whole plan", async () => {
  const t = chosenTrip();
  const { ask } = fakeAsk(planCall("update_plan", nullsBut({ bookings: planInput().bookings })));
  const r = await liveTurn(t, "plan please", opts(ask));
  assert.equal(r.planChanged, true); assert.equal(t.livePlan.optionId, "o_lp"); assert.equal(t.livePlan.bookings.length, 3); assert.deepEqual(t.livePlan.days, []);
});
test("Claude sees the chosen option and the plan, with booking statuses", async () => {
  const t = chosenTrip(); t.livePlan = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" }); t.livePlan.bookings[0].status = "booked";
  const { ask, calls } = fakeAsk({ ok: true, text: "ok", toolCalls: [], searches: 0 });
  await liveTurn(t, "anything to change?", opts(ask));
  const final = calls[0].messages.at(-1).content;
  assert.match(final, /"chosenOption":\{"id":"o_lp"/); assert.match(final, /"status":"booked"/);
});
test("without a chosen option, maxTokens stays 16000 and no plan is written", async () => {
  const t = situTrip();
  const { ask, calls } = fakeAsk(planCall("write_plan", planInput()));
  const r = await liveTurn(t, "ideas", opts(ask));
  assert.equal(calls[0].maxTokens, 16000); assert.equal(r.planChanged, false); assert.equal(t.livePlan, null);
});
test("only the last three replaced plans are kept", async () => {
  const t = chosenTrip();
  for (let i = 0; i < 5; i++) { const { ask } = fakeAsk(planCall("write_plan", planInput({ food: "round " + i }))); await liveTurn(t, "again", opts(ask)); }
  assert.equal(t._local.planHistory.length, 3); assert.equal(t.livePlan.food, "round 4"); assert.equal(t._local.planHistory.at(-1).plan.food, "round 3");
});

test("final I1: new options in a plan turn keep the chosen option, so the plan stays visible and the update applies", async () => {
  const t = chosenTrip(); t.livePlan = normalizePlan(planInput(), t, { today: TODAY, optionId: "o_lp" });
  const res = { ok: true, text: "", searches: 1, toolCalls: [
    { name: "propose_options", input: { options: [option("La Palma"), option("Gran Canaria")], rates: [] } },
    { name: "update_plan", input: nullsBut({ food: "new food" }) }] };
  const { ask } = fakeAsk(res);
  await liveTurn(t, "Situ can't go above 1500 m", opts(ask));
  assert.equal(t.chosen, "o_lp"); assert.ok(t.options.some(o => o.id === "o_lp" && o.name === "La Palma"));
  assert.equal(t.livePlan.food, "new food");
  const u = chosenTrip(); u.livePlan = normalizePlan(planInput(), u, { today: TODAY, optionId: "o_lp" });
  const { ask: ask2 } = fakeAsk({ ok: true, text: "", searches: 1, toolCalls: [{ name: "propose_options", input: { options: [option("Gran Canaria")], rates: [] } }] });
  await liveTurn(u, "other ideas?", opts(ask2));
  assert.ok(u.options.some(o => o.id === "o_lp"), "the chosen option stays in the list even when Claude leaves it out");
  assert.equal(u.options.length, 2);
});

test("bug 1: the app's own plan request doesn't go through the reader, so an option name with a date can't move the trip dates", async () => {
  const t = chosenTrip(); t.dates = { start: "2027-04-09", end: "2027-04-11" };
  const { ask } = fakeAsk({ ok: true, text: "ok", toolCalls: [], searches: 0 });
  await liveTurn(t, "Write the full plan for Nice, Fri 9 – Sun 11 Apr.", Object.assign(opts(ask), { fromApp: true }));
  assert.deepEqual(t.dates, { start: "2027-04-09", end: "2027-04-11" });
  assert.ok(t.brief.some(m => m.who === "you" && m.text === "Write the full plan for Nice, Fri 9 – Sun 11 Apr."), "the request still shows in the thread");
});
