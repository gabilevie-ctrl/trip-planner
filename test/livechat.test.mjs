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
