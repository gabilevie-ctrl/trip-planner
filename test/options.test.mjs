import test from "node:test"; import assert from "node:assert/strict";
import { OPTIONS_TOOL, normalizeOptions, checkOption, toTripCurrency } from "../src/options.js";
import { newTrip } from "../src/state.js";

const TODAY = "2026-11-09";
function situTrip() {
  const t = newTrip("explore");
  t.travellers = [{ id: "g", name: "Gabriel", limits: {} }, { id: "s", name: "Situ", limits: { countryZone: "schengen", minDayHighC: 18 } }];
  t.budget = { total: 1500, currency: "GBP" }; t.dates = { start: "2027-01-02", end: "2027-01-09" }; t.origin = { city: "London", region: "uk" };
  return t;
}
const opt = (over = {}) => Object.assign({ name: "La Palma", region: "Canaries", countryCodes: ["ES"], lat: 28.7, lon: -17.9, why: "Warm hiking", weather: { text: "20–22 °C", highC: 21, lowC: 14, source: null }, maxAltitudeM: 2426, activities: ["GR131"], access: { from: "London", mode: "flight", time: "4h30", connections: "TFS + ferry", pricePP: 36, currency: "GBP", seenOn: TODAY, source: null }, lodging: [{ type: "camping", low: 0, high: 0, currency: "EUR" }], estimate: { perPerson: 650, group: 1300, currency: "GBP", breakdown: [{ what: "Flights", amount: 154 }] }, tradeOff: "Permits", pick: false, mention: false, mentionWhy: null, sources: [] }, over);

test("Morocco breaks Situ's Schengen limit; La Palma breaks nothing", () => {
  const t = situTrip();
  const ma = checkOption(opt({ name: "Southern Morocco", countryCodes: ["MA"], weather: { text: "", highC: 22, lowC: 8, source: null }, estimate: { perPerson: 550, group: 1100, currency: "GBP", breakdown: [] } }), t);
  assert.ok(ma.flags.includes("Morocco is outside the Schengen area"), ma.flags.join(" | ")); assert.equal(ma.countryBreach, true);
  const lp = checkOption(opt(), t); assert.deepEqual(lp.flags, []); assert.equal(lp.groupTotal, 1300); assert.equal(lp.overBudget, false);
});
test("a 17 °C place is flagged against an 18 °C warmth floor", () => {
  const c = checkOption(opt({ name: "Madeira", countryCodes: ["PT"], weather: { text: "", highC: 17, lowC: 12, source: null } }), situTrip());
  assert.ok(c.flags.includes("Madeira: ~17°C in those months, below the 18°C floor"), c.flags.join(" | "));
});
test("an estimate in a currency with no rate is flagged and left out", () => {
  const c = checkOption(opt({ estimate: { perPerson: 1000, group: 2000, currency: "EUR", breakdown: [] } }), situTrip());
  assert.deepEqual(c.missingRates, ["EUR"]); assert.equal(c.groupTotal, null);
  assert.ok(c.flags.includes("No exchange rate for EUR yet; the total is left out"), c.flags.join(" | "));
});
test("with a rate the total converts and an over-budget total is flagged", () => {
  const t = situTrip(); t.rates = { EUR: { toTrip: 0.86, seenOn: TODAY, source: null } };
  const c = checkOption(opt({ estimate: { perPerson: 1000, group: 2000, currency: "EUR", breakdown: [] } }), t);
  assert.equal(c.groupTotal, 1720); assert.equal(c.overBudget, true);
  assert.ok(c.flags.includes("About £1,720 for the group, over the £1,500 budget"), c.flags.join(" | "));
  assert.equal(toTripCurrency(100, "GBP", t), 100); assert.equal(toTripCurrency(100, "USD", t), null);
});
test("altitude and trains-only flags use the library's wording", () => {
  const t = situTrip(); t.travellers[0].limits.maxAltitudeM = 2000; t.travel = { mode: "train" };
  const c = checkOption(opt(), t);
  assert.ok(c.flags.includes("La Palma: 2,426 m is above the 2,000 m ceiling"), c.flags.join(" | "));
  assert.ok(c.flags.includes("Reaching this destination needs a flight; the trip is set to trains only"));
});
test("normalising cleans Claude's input field by field", () => {
  const raw = { options: [
    opt({ pick: true, countryCodes: ["es", "Spain"], access: { ...opt().access, pricePP: "120" }, sources: [{ name: "ok", url: "https://ok.example", seenOn: null }, { name: "bad", url: "http://x", seenOn: TODAY }, { name: "evil", url: "javascript:alert(1)", seenOn: TODAY }] }),
    opt({ name: "Madeira", pick: true, estimate: { perPerson: "abc", group: 900, currency: "gbp", breakdown: [] } })
  ], rates: [{ currency: "eur", toTrip: 0.86, seenOn: TODAY, source: null }] };
  const { options, rates } = normalizeOptions(raw, situTrip(), { today: TODAY });
  assert.deepEqual(options[0].countryCodes, ["ES"]); assert.equal(options[0].access.pricePP, 120);
  assert.deepEqual(options[0].sources.map(s => s.name), ["ok"]); assert.equal(options[0].sources[0].seenOn, TODAY);
  assert.equal(options[0].pick, true); assert.equal(options[1].pick, false);
  assert.equal(options[1].estimate.perPerson, null); assert.equal(options[1].estimate.currency, "GBP");
  assert.ok(options.every(o => o.id.startsWith("o_")));
  assert.equal(rates.EUR.toTrip, 0.86);
});
test("normalising caps the list at 8, marks a pick when none is given, and survives junk", () => {
  const { options } = normalizeOptions({ options: Array.from({ length: 10 }, (_, i) => opt({ name: "P" + i })) }, situTrip(), { today: TODAY });
  assert.equal(options.length, 8); assert.equal(options.filter(o => o.pick).length, 1); assert.equal(options[0].pick, true);
  const junk = normalizeOptions({ options: [{ name: "Bare" }, null, "x"] }, situTrip(), { today: TODAY });
  assert.equal(junk.options.length, 1); assert.deepEqual(junk.options[0].countryCodes, []); assert.equal(junk.options[0].estimate.group, null);
  assert.deepEqual(normalizeOptions(undefined, situTrip(), { today: TODAY }).options, []);
});
test("the tool schema is strict at every object level", () => {
  assert.equal(OPTIONS_TOOL.name, "propose_options"); assert.equal(OPTIONS_TOOL.strict, true);
  const s = OPTIONS_TOOL.input_schema; assert.equal(s.additionalProperties, false);
  const item = s.properties.options.items; assert.equal(item.additionalProperties, false);
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort());
  assert.equal(item.properties.access.additionalProperties, false); assert.equal(item.properties.estimate.additionalProperties, false);
});
test("with no budget set, a missing exchange rate is not flagged (nothing to compare against)", () => {
  const t = situTrip(); t.budget = { total: 0, currency: "EUR" };
  const c = checkOption(opt(), t); assert.deepEqual(c.flags, []); assert.deepEqual(c.missingRates, ["GBP"]); assert.equal(c.groupTotal, null);
});
test("review C1: options and rates from an imported link are cleaned, ids kept, HTML can't get through", async () => {
  const { cleanImported } = await import("../src/options.js");
  const { fmtMoney } = await import("../src/ui.js");
  const t = situTrip();
  t.options = [{ id: "o_abc123", name: "Evil", weather: { text: "", highC: "<img src=x onerror=alert(1)>", lowC: null, source: null }, access: { currency: "<b>x</b>", pricePP: 10 }, lodging: [{ type: "hut", low: 1, high: 2, currency: "<i>" }], estimate: { group: 100, currency: "GBP", breakdown: [] } },
    { id: "bad id\"><", name: "No weather" }];
  t.rates = { "<x>": { toTrip: 2, seenOn: TODAY, source: null }, EUR: { toTrip: "abc", seenOn: TODAY, source: null }, USD: { toTrip: 0.8, seenOn: TODAY, source: null } };
  cleanImported(t, { today: TODAY });
  assert.equal(t.options[0].id, "o_abc123"); assert.equal(t.options[0].weather.highC, null);
  assert.equal(t.options[0].access.currency, ""); assert.equal(t.options[0].lodging[0].currency, "");
  assert.ok(t.options[1].id.startsWith("o_") && !/["<>]/.test(t.options[1].id)); assert.equal(typeof t.options[1].weather, "object");
  assert.deepEqual(Object.keys(t.rates), ["USD"]);
  assert.ok(!fmtMoney(5, "<b>").includes("<b>"), "fmtMoney escapes an odd currency code");
});
