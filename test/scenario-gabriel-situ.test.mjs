// Persona scenario: Gabriel and Situ plan a warm January hiking-and-camping week from London (~£1,500 for two;
// Situ can only travel within the Schengen area). Live search is on (a fake Claude); the whole live path is walked:
// describe → options (one breaks Situ's limit) → follow-ups → Choose → the plan → mark bookings, gear, to-dos →
// change the plan in the chat → Money → share with Situ, she edits her copy → Gabriel gets her changes back.
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
const toolReply = (name, input, text = "") => ({ stop_reason: "end_turn", usage: {}, content: [...(text ? [{ type: "text", text }] : []), { type: "tool_use", id: "tu1", name, input }] });
const textReply = text => ({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text }] });
const store = () => JSON.parse(window.localStorage.getItem("tripplanner.v1"));
const storedTrip = () => { const s = store(); return s.trips[s.current]; };
const chatSend = async (text, wait = 300) => { $("#chatText").value = text; click($('[data-act="chat-send"]')); await tick(wait); };
const submit = form => form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const lastAppMsg = () => $$(".thread .msg.app").pop()?.textContent || "";

const TODAY = new Date().toISOString().slice(0, 10);
const PASSWORD = "correct horse battery staple long";
let sent = []; // every request body the fake Claude received
const answer = fn => { fakeApi = async (url, init) => { const body = JSON.parse(init.body); sent.push(body); return fn(body); }; };
const lastUserText = body => { const m = body.messages.at(-1); return typeof m.content === "string" ? m.content : JSON.stringify(m.content); };

/* ---------- What a realistic Claude sends ---------- */
const src = (name, url) => ({ name, url, seenOn: TODAY });
const option = (name, over = {}) => Object.assign({
  name, region: "", countryCodes: ["ES"], lat: null, lon: null, why: "", weather: { text: "", highC: null, lowC: null, source: null },
  maxAltitudeM: null, activities: [], access: { from: "London", mode: "flight", time: "", connections: "", pricePP: null, currency: "GBP", seenOn: TODAY, source: null },
  lodging: [], estimate: { perPerson: null, group: null, currency: "GBP", breakdown: [] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: []
}, over);
const RATES = [{ currency: "EUR", toTrip: 0.86, seenOn: TODAY, source: src("XE", "https://www.xe.com/currencyconverter/convert/?From=EUR&To=GBP") }];
function shortlist({ laPalmaFlightPP = 118 } = {}) {
  return { rates: RATES, options: [
    option("La Palma", { region: "Canary Islands, Spain", countryCodes: ["ES"], lat: 28.68, lon: -17.86, pick: true,
      why: "Spain, so inside Schengen for Situ; 20 °C days, the GR131 volcano ridge and the Caldera de Taburiente, with official camping zones you can reach by bus and taxi.",
      weather: { text: "Coast 20–21 °C by day; the ridge (1,400–2,400 m) near freezing at night", highC: 21, lowC: 8, source: src("AEMET climate, Santa Cruz de La Palma", "https://www.aemet.es/es/serviciosclimaticos/datosclimatologicos/valoresclimatologicos") },
      maxAltitudeM: 2426, activities: ["GR131 Ruta de los Volcanes", "Caldera de Taburiente", "Los Tilos laurel forest"],
      access: { from: "London", mode: "flight", time: "4h20 + 1h50 ferry", connections: "Gatwick → Tenerife South, bus to Los Cristianos, Fred. Olsen ferry", pricePP: laPalmaFlightPP, currency: "GBP", seenOn: TODAY, source: src("easyJet", "https://www.easyjet.com/en") },
      lodging: [{ type: "camping", low: 0, high: 24, currency: "EUR" }, { type: "guesthouse", low: 55, high: 80, currency: "EUR" }],
      estimate: { perPerson: 420, group: 840, currency: "GBP", breakdown: [{ what: "Flights", amount: laPalmaFlightPP * 2 }, { what: "Ferry", amount: 101 }, { what: "Camping and 2 guesthouse nights", amount: 157 }, { what: "Buses and taxi", amount: 103 }, { what: "Food", amount: 190 }] },
      tradeOff: "Camping zones need permits from the Cabildo and the national park; the Caldera fills up.",
      sources: [src("Cabildo de La Palma – zonas de acampada", "https://www.cabildodelapalma.es/"), src("Parque Nacional de la Caldera de Taburiente", "https://www.miteco.gob.es/es/red-parques-nacionales/nuestros-parques/caldera-taburiente.html")] }),
    option("Madeira", { region: "Portugal", countryCodes: ["PT"], why: "Schengen, levada walks, 19 °C.", weather: { text: "18–19 °C, wetter in the north", highC: 19, lowC: 13, source: null },
      access: { from: "London", mode: "flight", time: "3h50", connections: "direct", pricePP: 140, currency: "GBP", seenOn: TODAY, source: null },
      lodging: [{ type: "camping", low: 0, high: 15, currency: "EUR" }], estimate: { perPerson: 610, group: 1220, currency: "GBP", breakdown: [] },
      tradeOff: "Camping only in a few official parks, licence needed; PR1 peak trail can close after storms." }),
    option("Anti-Atlas around Tafraoute", { region: "Southern Morocco", countryCodes: ["MA"], why: "Warmest and cheapest; granite and palm-oasis walking.", weather: { text: "22 °C days, cold nights", highC: 22, lowC: 5, source: null },
      access: { from: "London", mode: "flight", time: "3h45 + 3h drive", connections: "Gatwick → Agadir, bus or grand taxi", pricePP: 90, currency: "GBP", seenOn: TODAY, source: null },
      lodging: [{ type: "camping", low: 0, high: 8, currency: "EUR" }], estimate: { perPerson: 380, group: 760, currency: "GBP", breakdown: [] },
      tradeOff: "Outside Schengen: Situ's visa may not cover Morocco." }),
    option("Cyprus, Troodos and Akamas", { region: "Cyprus", countryCodes: ["CY"], why: "EU, 18 °C on the coast, E4 trail.", weather: { text: "17–18 °C on the coast", highC: 18, lowC: 9, source: null },
      access: { from: "London", mode: "flight", time: "4h30", connections: "direct to Paphos", pricePP: 110, currency: "GBP", seenOn: TODAY, source: null },
      lodging: [{ type: "camping", low: 0, high: 12, currency: "EUR" }], estimate: { perPerson: 560, group: 1120, currency: "GBP", breakdown: [] },
      tradeOff: "Troodos campsites mostly close in winter." }),
    option("Cape Verde, Santo Antão", { region: "Cape Verde", countryCodes: ["CV"], mention: true, mentionWhy: "Best walking of all, but 6h+ flights and outside Schengen." })
  ] };
}

// The plan Claude writes for La Palma, 9–16 Jan 2027: ferry, campsites with permits, buses, gear, food, dated to-dos, EUR prices with a rate.
const leg = (id, mode, from, to, time, bookingId = null, note = "") => ({ id, mode, from, to, time, bookingId, note });
const day = (id, date, move, night, extra = {}) => Object.assign({ id, date, move, km: null, ascentM: null, descentM: null, hours: null, night, fallback: "", legs: [], points: [] }, extra);
const booking = over => Object.assign({ id: "b_x", what: "", category: "other", pick: "", alternative: "", price: null, currency: "EUR", seenOn: TODAY, status: "idea", link: null, bookBy: null, details: "", source: null }, over);
function laPalmaPlan() {
  return {
    days: [
      day("d_1", "2027-01-09", "Fly Gatwick → Tenerife South, bus to Los Cristianos, afternoon ferry to Santa Cruz de La Palma", { name: "Guesthouse, Santa Cruz", type: "guesthouse", bookingId: "b_guest1" },
        { legs: [leg("l_1a", "flight", "London Gatwick", "Tenerife South", "07:05", "b_flights"), leg("l_1b", "bus", "Tenerife South", "Los Cristianos", "12:10", null, "TITSA 111, every 30 min"), leg("l_1c", "ferry", "Los Cristianos", "Santa Cruz de La Palma", "15:30", "b_ferry")], fallback: "If the ferry is cancelled for swell, the 21:00 Armas sailing" }),
      day("d_2", "2027-01-10", "Bus to El Paso, shop (gas!), taxi to El Pilar; walk up Pico Birigoyo", { name: "Zona de acampada El Pilar", type: "camping", bookingId: "b_pilar" },
        { km: 8, ascentM: 500, descentM: 500, hours: 3, legs: [leg("l_2a", "bus", "Santa Cruz", "El Paso", "09:00", null, "TILP 300"), leg("l_2b", "drive", "El Paso", "El Pilar", "13:00", null, "taxi, ~€25")], fallback: "Rain: stay low, Casa rural in El Paso" }),
      day("d_3", "2027-01-11", "GR131 Ruta de los Volcanes, El Pilar → Fuencaliente; bus to Los Llanos and on to Puntagorda", { name: "Camping La Rosa, Puntagorda", type: "camping", bookingId: "b_rosa" },
        { km: 17, ascentM: 750, descentM: 1450, hours: 6.5, legs: [leg("l_3a", "walk", "El Pilar", "Fuencaliente", "08:30"), leg("l_3b", "bus", "Fuencaliente", "Puntagorda", "16:30", null, "TILP 200 then 100")], fallback: "Wind over 60 km/h on the ridge: walk the coast at Fuencaliente lighthouse" }),
      day("d_4", "2027-01-12", "Taxi to Los Brecitos, walk down into the Caldera", { name: "Caldera de Taburiente campsite", type: "camping", bookingId: "b_caldera" },
        { km: 7, ascentM: 150, descentM: 500, hours: 3, legs: [leg("l_4a", "drive", "Los Llanos", "Los Brecitos", "09:00", "b_taxi")], fallback: "Barranco in flood: the park closes the campsite; stay at La Rosa" }),
      day("d_5", "2027-01-13", "Day walk to Roque del Huso and the Taburiente waterfalls", { name: "Caldera de Taburiente campsite", type: "camping", bookingId: "b_caldera" }, { km: 9, ascentM: 450, descentM: 450, hours: 4 }),
      day("d_6", "2027-01-14", "Walk out by the Barranco de las Angustias, bus back to Puntagorda", { name: "Camping La Rosa, Puntagorda", type: "camping", bookingId: "b_rosa" }, { km: 13, ascentM: 100, descentM: 700, hours: 4.5 }),
      day("d_7", "2027-01-15", "Molinos de Puntagorda walk, bus to Santa Cruz", { name: "Guesthouse, Santa Cruz", type: "guesthouse", bookingId: "b_guest7" }, { km: 6, ascentM: 200, descentM: 200, hours: 2 }),
      day("d_8", "2027-01-16", "Morning ferry to Los Cristianos, fly home", { name: "", type: "none", bookingId: null },
        { legs: [leg("l_8a", "ferry", "Santa Cruz de La Palma", "Los Cristianos", "07:00", "b_ferry"), leg("l_8b", "flight", "Tenerife South", "London Gatwick", "19:40", "b_flights")] })
    ],
    bookings: [
      booking({ id: "b_flights", what: "Flights Gatwick ⇄ Tenerife South (easyJet)", category: "transport", pick: "EZY8061 out 07:05, EZY8062 back 19:40", alternative: "Jet2 from Stansted, ~£20 more each", price: 236, currency: "GBP", bookBy: "2026-11-30", link: "https://www.easyjet.com/en", details: "2 adults, one 15 kg hold bag (tent, poles, stove — no gas)", source: src("easyJet", "https://www.easyjet.com/en") }),
      // Claude writes "booked" here by mistake: the app must show it as Decided until a person marks it.
      booking({ id: "b_ferry", what: "Ferry Los Cristianos ⇄ Santa Cruz de La Palma (Fred. Olsen)", category: "transport", pick: "15:30 out on 9 Jan, 07:00 back on 16 Jan", alternative: "Naviera Armas, slower, ~€90", price: 118, currency: "EUR", status: "booked", bookBy: "2026-12-15", link: "https://www.fredolsen.es/en", details: "2 adults, foot passengers, return", source: src("Fred. Olsen Express", "https://www.fredolsen.es/en") }),
      booking({ id: "b_guest1", what: "Guesthouse in Santa Cruz, 9 Jan", category: "lodging", price: 68, bookBy: "2026-12-20", link: "https://www.booking.com/searchresults.html?ss=Santa+Cruz+de+La+Palma&checkin=2027-01-09&checkout=2027-01-10&group_adults=2" }),
      booking({ id: "b_pilar", what: "Zona de acampada El Pilar, 10 Jan", category: "lodging", price: 0, details: "Cabildo permit, see Permits" }),
      booking({ id: "b_rosa", what: "Camping La Rosa, Puntagorda, 11 and 14 Jan", category: "lodging", price: 48, bookBy: "2026-12-20", details: "2 people, 1 small tent, no car" }),
      booking({ id: "b_caldera", what: "Caldera de Taburiente campsite, 12–13 Jan", category: "lodging", price: 0, details: "National park permit, see Permits" }),
      booking({ id: "b_taxi", what: "Taxi Los Llanos → Los Brecitos", category: "transport", price: 60, bookBy: "2027-01-11", details: "Phone the Los Llanos taxi rank the day before" }),
      booking({ id: "b_guest7", what: "Guesthouse in Santa Cruz, 15 Jan", category: "lodging", price: 68, bookBy: "2026-12-20" })
    ],
    permits: [
      { id: "p_caldera", what: "Caldera de Taburiente camping permit, 12–13 Jan", who: ["all"], how: "Online on the national park's reservation page; names and passport/ID numbers for both", leadTime: "Opens about a month ahead; fills fast", bookBy: "2026-12-13", note: "Max 2 nights" },
      { id: "p_pilar", what: "Cabildo camping permit, El Pilar, 10 Jan", who: ["all"], how: "Form on the Cabildo's sede electrónica, or by email in Spanish", leadTime: "7 days", bookBy: "2026-12-31", note: "" }
    ],
    admin: [
      { id: "a_situ_visa", traveller: "Situ", what: "Check her residence permit and Schengen visa cover 9–16 Jan (Spain)", note: "The flight changes nowhere outside Schengen" },
      { id: "a_situ_ins", traveller: "Situ", what: "Travel insurance that covers hiking", note: "" },
      { id: "a_gab_ghic", traveller: "Gabriel", what: "GHIC card", note: "" },
      { id: "a_gab_ins", traveller: "Gabriel", what: "Travel insurance that covers hiking", note: "" }
    ],
    gear: [
      { id: "g_tent", name: "Tent", note: "2-person, 3-season; wind on El Pilar" },
      { id: "g_stove", name: "Stove", note: "No gas on the plane: buy a canister in El Paso" },
      { id: "g_bags", name: "Sleeping bags", note: "Comfort 0–5 °C: El Pilar is at 1,450 m" },
      { id: "g_mats", name: "Sleeping mats", note: "" }
    ],
    food: "Shop in El Paso on 10 Jan and in Los Llanos on 12 Jan: nothing to buy at El Pilar or in the Caldera. Water tap at the Caldera campsite.",
    todo: [
      { id: "t_gas", date: "2027-01-10", what: "Buy a gas canister in El Paso before the taxi" },
      { id: "t_print", date: "2027-01-05", what: "Print both camping permits" },
      { id: "t_tilp", date: null, what: "Save the TILP bus timetables offline" }
    ],
    otherCosts: [
      { id: "c_food", what: "Food for 8 days", amount: 220, currency: "EUR", seenOn: TODAY },
      { id: "c_bus", what: "TILP buses", amount: 40, currency: "EUR", seenOn: TODAY },
      { id: "c_tfs", what: "Bus Tenerife South ⇄ Los Cristianos", amount: 20, currency: "EUR", seenOn: TODAY }
    ],
    sources: [src("Fred. Olsen Express", "https://www.fredolsen.es/en"), src("TILP timetables", "https://www.tilp.es/"), src("Cabildo de La Palma", "https://www.cabildodelapalma.es/")],
    rates: RATES
  };
}

let gabrielTripId, situId, gabrielId, firstLink, laPalmaId;

test("1. Gabriel describes the trip, unlocks live search, and names Situ", async () => {
  const { lockKey } = await import("../src/keylock.js");
  fakeFiles.set("/data/claude-key.json", await lockKey("sk-ant-test", PASSWORD, { iterations: 1000 }));
  await import("../src/main.js"); await tick(150);
  $("#describeText").value = "Warm hiking with camping in January, about 8 days, from London, ~£1,500 for the two of us; Situ can only travel within the Schengen area.";
  click($('[data-act="describe-new"]')); await tick(200);
  assert.equal(window.location.hash, "#setup");
  gabrielTripId = store().current;
  // The rule-based reader fills the form at once.
  assert.equal($('[data-bind="budget.total"]').value, "1500"); assert.equal($('[data-bind="budget.currency"]').value, "GBP");
  assert.equal(storedTrip().origin.city, "London");
  assert.equal($$("table.people tbody tr").length, 2);
  assert.match(lastAppMsg(), /a guess/, "the January dates are flagged as a guess");
  // Finding: "Situ can only travel within Schengen" lands on both travellers, and neither is named Situ.
  assert.equal(storedTrip().travellers[0].limits.countryZone, "schengen");
  assert.equal(storedTrip().travellers[1].limits.countryZone, "schengen");
  assert.equal(storedTrip().travellers[1].name, "");
  // Unlock live search with the family password.
  assert.ok($("#livePass"), "the unlock card shows");
  $("#livePass").value = PASSWORD; click($('[data-act="live-unlock"]')); await tick(150);
  assert.match($(".livestatus").textContent, /Live search is on/);
  // Gabriel fixes what the reader got wrong: names, his own limit, and the real dates (9–16 Jan).
  change($('[data-bind="travellers.0.name"]'), "Gabriel"); await tick(40);
  change($('[data-bind="travellers.1.name"]'), "Situ"); await tick(40);
  change($('[data-bind="travellers.0.limits.countryZone"]'), "any"); await tick(40);
  change($('[data-bind="dates.start"]'), "2027-01-09"); change($('[data-bind="dates.end"]'), "2027-01-16"); await tick(60);
  const t = storedTrip(); gabrielId = t.travellers[0].id; situId = t.travellers[1].id;
  assert.equal(t.travellers[1].limits.countryZone, "schengen");
  assert.match($(".triphead").textContent, /8 days/);
});

test.todo("the describe box ties a limit to the named person ('Situ can only travel within Schengen' → Situ's row, not everyone's)");

test("2. Options: La Palma is the pick; Morocco and Cyprus are flagged for Situ's Schengen limit", async () => {
  answer(() => toolReply("propose_options", shortlist(), "La Palma is the one I'd book tonight: warm, Schengen, and the camping zones are reachable by bus and taxi. Do you have a tent and stove already? Would you take one guesthouse night?"));
  await chatSend("Give us options", 300);
  const body = sent.at(-1);
  // Nothing to re-explain: the request carries Situ's limit and the budget.
  assert.match(lastUserText(body), /"name":"Situ","limits":\{"countryZone":"schengen"\}/);
  assert.match(lastUserText(body), /"total":1500,"currency":"GBP"/);
  const cards = $$(".optcard");
  assert.equal(cards.length, 4, "four options; Cape Verde is listed apart");
  assert.match(cards[0].textContent, /La Palma/); assert.match(cards[0].textContent, /Claude's pick/);
  assert.equal(cards[0].querySelectorAll(".chip.crit").length, 0, "La Palma breaks no limit");
  const morocco = cards.find(c => /Tafraoute/.test(c.textContent));
  assert.match(morocco.textContent, /Morocco is outside the Schengen area/);
  const cyprus = cards.find(c => /Cyprus/.test(c.textContent));
  assert.match(cyprus.textContent, /Cyprus is outside the Schengen area/, "EU but not Schengen is still caught");
  assert.match($(".optmentions").textContent, /Cape Verde/);
  assert.match(cards[0].textContent, /€0–24\/night/);
  assert.ok(cards[0].textContent.includes("£840"), "group estimate in pounds");
});

test("3. Follow-ups in the chat: cheaper flights updates the card; wild camping is answered in text", async () => {
  const before = storedTrip().options.find(o => o.name === "La Palma").id;
  answer(() => toolReply("propose_options", shortlist({ laPalmaFlightPP: 79 }), "Ryanair from Stansted on Saturdays is £79 each; I've updated La Palma. The others didn't get cheaper."));
  await chatSend("cheaper flights?", 300);
  const lp = $$(".optcard").find(c => /La Palma/.test(c.textContent));
  assert.ok(lp.textContent.includes("£79"), "the new flight price shows");
  assert.notEqual(storedTrip().options.find(o => o.name === "La Palma").id, before, "a new shortlist gets new ids (nothing chosen yet)");
  // The earlier shortlist is kept on this device, but not shown anywhere.
  assert.equal(storedTrip()._local.optionHistory.length, 1);
  assert.doesNotMatch($(".view-setup").textContent, /earlier options|previous options/i);

  answer(() => textReply("No: wild camping is illegal across the Canaries, with fines from €300. Use the official zonas de acampada (free with a Cabildo permit) and the Caldera campsite (national park permit). I've kept La Palma as the pick."));
  await chatSend("can we wild camp?", 300);
  assert.match(lastAppMsg(), /wild camping is illegal/);
  assert.equal($$(".optcard").length, 4, "the options stay");
  assert.ok(sent.at(-1).messages.length >= 3, "Claude got the earlier turns");
  assert.match(JSON.stringify(sent.at(-1).messages), /cheaper flights\?/);
  // The answer that matters ("illegal, use the zones") lives only in the thread, not on the La Palma card.
  assert.doesNotMatch($$(".optcard").find(c => /La Palma/.test(c.textContent)).textContent, /illegal/);
});

test.todo("a feasibility answer from the chat (\"wild camping is illegal\") is pinned to the option it is about, not only in the scrolling thread");
test.todo("options sit side by side in one comparison table (weather, getting there, total, flags)");

test("4. Choose La Palma: Claude writes a realistic plan; the app shows it in Build, Itinerary, Plan & book and Money", async () => {
  answer(() => toolReply("write_plan", laPalmaPlan(), "Here is the plan. Book the flights first; the Caldera permit opens about a month ahead."));
  laPalmaId = storedTrip().options.find(o => o.name === "La Palma").id;
  click($(`[data-act="choose-option"][data-id="${laPalmaId}"]`)); await tick(400);
  assert.equal(window.location.hash, "#build");
  assert.equal(sent.at(-1).max_tokens, 32000);
  assert.match($(".triphead").textContent, /La Palma/);
  assert.doesNotMatch($(".view-build").textContent, /Limits broken/);
  assert.equal($$(".daytable tbody tr").length, 8, "one row per day");
  assert.match($$(".daytable tbody tr")[2].textContent, /17 km · ↗ 750 m · ↘ 1450 m · 6.5 h/);
  const heads = $$(".geartable thead th").map(th => th.textContent);
  assert.deepEqual(heads, ["Gear", "Gabriel", "Situ"]);
  assert.match($(".view-build").textContent, /No gas on the plane/);
  // Claude said the ferry was booked; only people mark things booked.
  assert.equal(storedTrip().livePlan.bookings.find(b => b.id === "b_ferry").status, "decided");
  await go("#itinerary"); assert.equal($$(".daytable tbody tr").length, 8);
  await go("#plan");
  const text = $(".view-plan").textContent;
  assert.match(text, /Caldera de Taburiente camping permit/); assert.match(text, /apply by/);
  assert.match(text, /€118 \(≈ £101\)/, "EUR prices with the rate");
  const situAdmin = $$(".view-plan h4").find(h => h.textContent === "Situ");
  assert.ok(situAdmin, "Situ has her own admin list"); assert.match(situAdmin.nextElementSibling.textContent, /Schengen visa/);
  const todos = $$(".todolist li").map(li => li.textContent.replace(/\s+/g, " ").trim());
  assert.match(todos[0], /Book Flights/, "the earliest book-by first"); assert.match(todos.at(-1), /TILP/, "undated last");
  await go("#money");
  const { planTotals } = await import("../src/liveplan.js");
  const tot = planTotals(storedTrip().livePlan, storedTrip());
  assert.equal(tot.missing.length, 0); assert.equal(tot.overBudget, false);
  assert.ok($(".view-money").textContent.includes(`£${tot.total.toLocaleString("en-GB")}`), "plan total shows against the £1,500 budget");
});

test.todo("consistency checks on the plan: a camping night with no tent ticked, a booking marked booked with no confirmation, a book-by date already past");
test.todo("a map of the days and legs");

test("5. Gabriel books: ferry and flights booked with confirmations, gear cells, a to-do ticked, his own gear added", async () => {
  await go("#plan");
  change($('select[data-bind="livePlan.bookings.#b_ferry.status"]'), "booked"); await tick(60);
  change($('input[data-bind="livePlan.bookings.#b_ferry.confirmation"]'), "FO-7731294"); await tick(60);
  change($('select[data-bind="livePlan.bookings.#b_flights.status"]'), "booked"); await tick(60);
  change($('input[data-bind="livePlan.bookings.#b_flights.confirmation"]'), "K8W2TQP"); await tick(60);
  change($('select[data-bind="livePlan.bookings.#b_pilar.status"]'), "booked"); await tick(60);
  change($('input[data-bind="livePlan.bookings.#b_pilar.confirmation"]'), "CAB-2291"); await tick(60);
  change($('input[data-bind="livePlan.todo.#t_print.done"]'), true); await tick(60);
  const lis = $$(".todolist li");
  assert.ok(lis.find(li => /Book Ferry/.test(li.textContent)).classList.contains("done"));
  assert.ok(lis.find(li => /Print both/.test(li.textContent)).classList.contains("done"));
  // Permits and admin have no tick box: "Apply: Cabildo camping permit" can never be marked done.
  assert.equal(lis.find(li => /Apply: Cabildo/.test(li.textContent)).querySelector("input"), null);
  assert.equal($(".view-plan .steps:not(.todolist) input"), null, "admin items (Situ's visa check) have no tick box either");
  await go("#build");
  change($(`.geartable input[data-bind="livePlan.gear.#g_tent.per.${gabrielId}"]`), "has one (MSR Hubba)"); await tick(60);
  change($(`.geartable input[data-bind="livePlan.gear.#g_stove.per.${gabrielId}"]`), "brings, no gas"); await tick(60);
  const f = $('form[data-form="gear-add"]'); f.querySelector("[name=name]").value = "Head torches"; submit(f); await tick(60);
  assert.ok($(".geartable").textContent.includes("Head torches"));
  const p = storedTrip().livePlan;
  assert.equal(p.gear.find(g => g.id === "g_tent").per[gabrielId], "has one (MSR Hubba)");
  assert.equal(p.bookings.find(b => b.id === "b_ferry").confirmation, "FO-7731294");
});

test.todo("tick a permit as applied/granted and an admin item (Situ's visa check) as done");
test.todo("record who marked a booking booked and when, so the other person can trust it");

test("6. Plan chat: swap the El Pilar camping night for a hut and add a rest day; nothing they marked is lost", async () => {
  const p0 = storedTrip().livePlan;
  const headId = p0.gear.find(g => g.name === "Head torches").id;
  const nulls = Object.fromEntries(Object.keys(laPalmaPlan()).map(k => [k, null]));
  const base = laPalmaPlan();
  const days = base.days.map(d => d.id === "d_2" ? Object.assign({}, d, { move: "Bus to El Paso, shop (gas!), walk up Pico Birigoyo from El Pilar, taxi back down", night: { name: "Casa rural, El Paso", type: "guesthouse", bookingId: "b_casa" } })
    : d.id === "d_7" ? Object.assign({}, d, { move: "Rest day: bus to Santa Cruz, old town and the beach", km: null, ascentM: null, descentM: null, hours: null }) : d);
  const bookings = base.bookings.filter(b => b.id !== "b_pilar").concat([booking({ id: "b_casa", what: "Casa rural in El Paso, 10 Jan", category: "lodging", price: 85, bookBy: "2026-12-20", link: "https://www.booking.com/searchresults.html?ss=El+Paso+La+Palma&checkin=2027-01-10&checkout=2027-01-11&group_adults=2" })])
    .map(b => b.id === "b_ferry" ? Object.assign({}, b, { status: "idea" }) : b); // Claude resends the ferry as an idea
  const gear = base.gear.concat([{ id: headId, name: "Head torches", note: "" }]);
  answer(body => { assert.match(lastUserText(body), /FO-7731294/, "Claude sees what they marked"); return toolReply("update_plan", Object.assign({}, nulls, { days, bookings, gear, permits: base.permits.filter(x => x.id !== "p_pilar") }),
    "La Palma has no staffed huts, so night 2 is now a casa rural in El Paso; 15 Jan is a rest day in Santa Cruz. You marked El Pilar booked: cancel that permit if you no longer need it."); });
  await chatSend("Swap the El Pilar camping night for a hut, and add a rest day", 400);
  const p = storedTrip().livePlan;
  const b = id => p.bookings.find(x => x.id === id);
  assert.equal(b("b_ferry").status, "booked"); assert.equal(b("b_ferry").confirmation, "FO-7731294");
  assert.equal(b("b_flights").status, "booked"); assert.equal(b("b_flights").confirmation, "K8W2TQP");
  assert.equal(p.gear.find(g => g.id === "g_tent").per[gabrielId], "has one (MSR Hubba)");
  assert.ok(p.gear.some(g => g.name === "Head torches"), "Gabriel's own gear row stays");
  assert.equal(p.todo.find(x => x.id === "t_print").done, true, "the ticked to-do stays ticked");
  assert.equal(p.days[1].night.name, "Casa rural, El Paso"); assert.match(p.days[6].move, /Rest day/);
  // The booked El Pilar permit is kept (good) but nothing in the app says it is no longer used by any night.
  assert.equal(b("b_pilar").status, "booked");
  assert.ok(!p.days.some(d => d.night.bookingId === "b_pilar"));
  await go("#plan");
  const row = $$(".booktable tbody tr").find(tr => /El Pilar/.test(tr.textContent));
  assert.ok(row, "the orphaned booked row is still listed");
  assert.doesNotMatch(row.textContent, /no longer|not used|cancel/i);
});

test.todo("a booked booking that no night or leg uses any more is flagged ('cancel or keep?') and its price shown apart from the plan total");
test.todo("when an update leaves out an item someone ticked or added (a done to-do, their own gear row), the app keeps it or asks, instead of dropping it");

test("7. Money: plan total vs budget, real expenses, and the split", async () => {
  await go("#money");
  const txt = () => $(".view-money").textContent;
  assert.match(txt(), /Plan total \(La Palma/);
  // Flights and ferry are marked booked, but Money's "committed" starts at zero: bookings don't reach the ledger.
  assert.match(txt(), /Committed so far \(paid \+ planned\)£0/);
  const add = async (desc, amount, paidBy, status = "paid", category = "Transport") => {
    const f = $('form[data-form="expense"]'); f.querySelector("[name=desc]").value = desc; f.querySelector("[name=amount]").value = String(amount);
    f.querySelector("[name=paidBy]").value = paidBy; f.querySelector("[name=status]").value = status; f.querySelector("[name=category]").value = category; submit(f); await tick(60);
  };
  await add("easyJet flights K8W2TQP", 236, gabrielId);
  // The ferry was €118: the expense form only takes pounds, so Situ converts it herself.
  await add("Fred. Olsen ferry FO-7731294 (€118)", 101, situId);
  await add("Casa rural El Paso deposit", 73, situId, "planned", "Lodging");
  assert.equal($$("table.ledger tbody tr").length, 3);
  assert.match(txt(), /Committed so far \(paid \+ planned\)£410/);
  assert.match(txt(), /Left in the budget£1,090/);
  const settle = $$(".view-money h3").find(h => h.textContent === "Settle up").parentElement.textContent;
  // 236 + 101 + 73 = 410; each owes 205: Gabriel paid 236 (+31), Situ 174 (−31).
  assert.match(settle, /Situ → Gabriel: £31/);
});

test.todo("an expense in euros, converted with the trip's rate");
test.todo("marking a booking booked offers to add it to the ledger (who paid, how much), so Money's 'committed' follows the plan");

test("8. Share with Situ; she imports it, fills her gear column and confirms a booking on her copy", async () => {
  await go("#share");
  firstLink = $("#shareLink").value;
  assert.match(firstLink, /#s-[A-Za-z0-9-]+$/);
  // Finding: the link is about 17,000 characters (the whole thread, five options with sources, the plan); the page warns.
  assert.ok(firstLink.length > 10000, `link is ${firstLink.length} characters`);
  assert.match($(".view-share").textContent, /Very long links can be refused/);
  const { stripForShare } = await import("../src/state.js");
  const parts = Object.fromEntries(["brief", "options", "livePlan"].map(k => [k, JSON.stringify(stripForShare(storedTrip())[k]).length]));
  globalThis.__linkParts = parts;
  assert.match($("pre.summary").textContent, /\[Booked\] Ferry Los Cristianos .* · FO-7731294/);
  // On Situ's phone the link decodes to the same trip id.
  const { decodeShare } = await import("../src/state.js");
  const decoded = decodeShare(firstLink.split("#")[1], window.LZString);
  assert.equal(decoded.id, gabrielTripId); assert.equal(decoded._local, undefined);
  // Simulate her phone in this browser: import the link (it becomes a copy here because Gabriel's trip is already stored).
  window.location.hash = firstLink.split("#")[1]; await tick(250);
  assert.equal(window.location.hash, "#setup");
  const situCopyId = store().current; assert.notEqual(situCopyId, gabrielTripId);
  // Live search is unlocked on this browser; on Situ's own phone she would need the family password as well.
  await go("#build");
  change($(`.geartable input[data-bind="livePlan.gear.#g_bags.per.${situId}"]`), "has a 0 °C bag"); await tick(60);
  change($(`.geartable input[data-bind="livePlan.gear.#g_mats.per.${situId}"]`), "buys one"); await tick(60);
  await go("#plan");
  change($('select[data-bind="livePlan.bookings.#b_casa.status"]'), "booked"); await tick(60);
  change($('input[data-bind="livePlan.bookings.#b_casa.confirmation"]'), "BK-5521093"); await tick(60);
  const mine = storedTrip();
  assert.equal(mine.livePlan.gear.find(g => g.id === "g_bags").per[situId], "has a 0 °C bag");
  assert.equal(mine.livePlan.gear.find(g => g.id === "g_tent").per[gabrielId], "has one (MSR Hubba)", "Gabriel's cells came along");
  // Situ shares her copy back. On her phone the trip keeps Gabriel's id and name, so restore those before encoding.
  const { encodeShare } = await import("../src/state.js");
  const asOnHerPhone = Object.assign({}, mine, { id: gabrielTripId, name: decoded.name });
  const back = encodeShare(asOnHerPhone, window.LZString);
  globalThis.__situLink = back;
});

test("9. Gabriel opens Situ's link: he gets a second trip, not her changes in his", async () => {
  const before = Object.keys(store().trips).length;
  // Meanwhile Gabriel ticked something on his own copy.
  window.location.hash = "#home"; await tick(80);
  click($(`.tripcard[data-act="open-trip"][data-id="${gabrielTripId}"]`)); await tick(100);
  await go("#plan");
  change($('input[data-bind="livePlan.todo.#t_tilp.done"]'), true); await tick(60);
  window.location.hash = globalThis.__situLink; await tick(250);
  const s = store();
  assert.equal(Object.keys(s.trips).length, before + 1, "importing her link adds a trip");
  const imported = s.trips[s.current];
  assert.match(imported.name, /\(imported\)$/);
  assert.equal(imported.livePlan.bookings.find(b => b.id === "b_casa").status, "booked", "her booking is in the new copy");
  assert.equal(imported.livePlan.todo.find(x => x.id === "t_tilp").done, false, "his newer tick is missing from her copy");
  const his = s.trips[gabrielTripId];
  assert.equal(his.livePlan.bookings.find(b => b.id === "b_casa").status, "idea", "his trip doesn't know the casa rural is booked");
  assert.equal(his.livePlan.gear.find(g => g.id === "g_bags").per[situId], undefined, "nor her gear column");
  assert.equal(his.livePlan.todo.find(x => x.id === "t_tilp").done, true);
  await go("#home");
  assert.equal($$('.tripcard[data-act="open-trip"]').filter(c => /La Palma/.test(c.textContent)).length >= 2, true, "two La Palma trips side by side, to reconcile by eye");
});

test.todo("importing a newer copy of the same trip merges field by field (her gear column and her booking into his trip, his tick kept) and asks only when both changed the same field — spec requirement 5");
test.todo("a way to see what changed between two copies before importing");
test.todo("a calendar file (.ics) for the book-by dates and dated to-dos");
