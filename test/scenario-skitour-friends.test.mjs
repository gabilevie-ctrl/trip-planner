// Persona scenario: Gabriel and three friends plan a ski-touring week in March.
// Léa caps avalanche danger at 2, Tom caps the ski grade at ZS, Marc caps daily ascent at 1000 m.
// The dates are undecided between two March weeks; they drive and share cars; Léa wants Gudauri (Georgia),
// which is not in the library, and asks live search (a fake Claude); the others lean to the Écrins.
// Harness copied from test/integration.test.mjs.
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
const submit = async (form, fields) => { for (const [k, v] of Object.entries(fields)) form.querySelector(`[name=${k}]`).value = v; form.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await tick(60); };
const storedTrip = () => { const s = JSON.parse(window.localStorage.getItem("tripplanner.v1")); return s.trips[s.current]; };
const text = sel => ($(sel) || { textContent: "" }).textContent;

/* The fake Claude: realistic propose_options and write_plan calls matching src/options.js and src/liveplan.js. */
const TODAY = "2026-11-13";
const liveOpt = (name, over = {}) => Object.assign({ name, region: "", countryCodes: ["GE"], lat: null, lon: null, why: "", weather: { text: "", highC: null, lowC: null, source: null }, maxAltitudeM: null, activities: [], access: { from: "Brussels", mode: "flight", time: "", connections: "", pricePP: null, currency: "EUR", seenOn: TODAY, source: null }, lodging: [], estimate: { perPerson: null, group: null, currency: "EUR", breakdown: [] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: [] }, over);
const toolReply = (name, input, txt = "") => ({ stop_reason: "end_turn", usage: {}, content: [...(txt ? [{ type: "text", text: txt }] : []), { type: "tool_use", id: "tu1", name, input }] });
const gudauri = liveOpt("Gudauri", { pick: true, region: "Kazbegi, Georgia", lat: 42.48, lon: 44.48, why: "Big freeride and touring terrain above the Georgian Military Road; cheap guesthouses; reliable March snow.",
  weather: { text: "-6 to 2 °C at 2,200 m in March", highC: 2, lowC: -6, source: { name: "meteoblue", url: "https://www.meteoblue.com/gudauri", seenOn: TODAY } },
  maxAltitudeM: 3300, activities: ["Kudebi tour", "Sadzele valley", "Kobi–Kazbegi day"],
  access: { from: "Brussels", mode: "flight", time: "7h30", connections: "via Istanbul to Tbilisi, then 2h by road", pricePP: 380, currency: "EUR", seenOn: TODAY, source: { name: "Google Flights", url: "https://www.google.com/flights", seenOn: TODAY } },
  lodging: [{ type: "guesthouse", low: 90, high: 160, currency: "GEL" }],
  estimate: { perPerson: 1250, group: 5000, currency: "EUR", breakdown: [{ what: "Flights", amount: 1520 }, { what: "Guesthouse half board", amount: 1400 }, { what: "Local guide 5 days", amount: 1250 }, { what: "Transfers and food", amount: 830 }] },
  tradeOff: "No hut-to-hut: day tours from a base. Avalanche bulletin (caucasus.avalanche.ge) is less detailed than the French BRA. Not drivable from Brussels.",
  sources: [{ name: "Georgian avalanche bulletin", url: "https://caucasus.avalanche.ge", seenOn: TODAY }] });
const optionsInput = { rates: [{ currency: "GEL", toTrip: 0.34, seenOn: TODAY, source: null }], options: [gudauri, liveOpt("Kazbegi from Stepantsminda", { why: "Quieter, higher", mention: true, mentionWhy: "Fewer guides, longer drives from Tbilisi" })] };
const planDay = (n, over) => Object.assign({ id: "d_" + n, date: `2027-03-${String(12 + n).padStart(2, "0")}`, move: "", km: null, ascentM: null, descentM: null, hours: null, night: { name: "Guesthouse Gudauri", type: "guesthouse", bookingId: "b_gh" }, fallback: "", legs: [], points: [] }, over);
const gudauriPlan = {
  days: [planDay(1, { move: "Fly Brussels → Tbilisi, transfer to Gudauri", legs: [{ id: "l_fly", mode: "flight", from: "Brussels", to: "Tbilisi", time: "06:40", bookingId: "b_fly", note: "" }] }),
    planDay(2, { move: "Kudebi tour", ascentM: 1400, descentM: 1400, hours: 6, fallback: "Lift-served tree skiing if danger is 3" }),
    planDay(3, { move: "Sadzele valley", ascentM: 900, descentM: 1500, hours: 5, fallback: "Rest" })],
  bookings: [{ id: "b_fly", what: "Flights Brussels–Tbilisi", category: "transport", pick: "Turkish via IST", alternative: "", price: 1520, currency: "EUR", seenOn: TODAY, status: "idea", link: null, bookBy: "2027-01-15", details: "4 adults", source: null },
    { id: "b_gh", what: "Guesthouse Gudauri, half board", category: "lodging", pick: "", alternative: "", price: 4100, currency: "GEL", seenOn: TODAY, status: "idea", link: null, bookBy: "2027-02-01", details: "", source: null },
    { id: "b_guide", what: "IFMGA guide, 5 days", category: "activity", pick: "", alternative: "", price: 1250, currency: "EUR", seenOn: TODAY, status: "idea", link: null, bookBy: "2027-01-31", details: "", source: null }],
  permits: [], admin: [{ id: "a_ins", traveller: "Léa", what: "Rescue insurance valid in Georgia", note: "" }],
  gear: [{ id: "g_avy", name: "Transceiver, shovel, probe", note: "" }], food: "Half board", todo: [], otherCosts: [], sources: [],
  rates: [{ currency: "GEL", toTrip: 0.34, seenOn: TODAY, source: null }]
};

const WEEK_A = ["2027-03-13", "2027-03-19"], WEEK_B = ["2027-03-20", "2027-03-26"];

test("scenario: four friends with different limits plan a ski-touring week, from two candidate weeks to settle-up", async () => {
  const { lockKey } = await import("../src/keylock.js");
  fakeFiles.set("/data/claude-key.json", await lockKey("sk-ant-test", "correct horse battery staple long", { iterations: 1000 }));
  await import("../src/main.js"); await tick(100);

  /* 1. Create the trip: ski touring, from Brussels by car, a budget, and week A as a first guess. */
  click($('[data-act="new-trip"][data-kind="skitour"]')); await tick(100);
  assert.equal(window.location.hash, "#setup");
  change($('[data-bind="name"]'), "March ski-touring week"); await tick(40);
  change($('[data-bind="owner"]'), "Gabriel"); await tick(20);
  change($('[data-bind="travel.mode"]'), "drive"); await tick(40);
  change($('[data-bind="budget.total"]'), "6000"); await tick(40);
  change($('[data-bind="dates.start"]'), WEEK_A[0]); change($('[data-bind="dates.end"]'), WEEK_A[1]); await tick(60);
  assert.match(text(".triphead"), /Ski touring/); assert.match(text(".triphead"), /7 days/);

  /* 2. Four travellers, each with their own limit. */
  change($('[data-bind="travellers.0.name"]'), "Gabriel"); await tick(30);
  for (const [i, name] of [[1, "Léa"], [2, "Tom"], [3, "Marc"]]) { click($('[data-act="add-traveller"]')); await tick(40); change($(`[data-bind="travellers.${i}.name"]`), name); await tick(30); }
  change($('[data-bind="travellers.1.limits.maxDanger"]'), "2"); await tick(30);
  change($('[data-bind="travellers.2.limits.maxGradeSki"]'), "ZS"); await tick(30);
  change($('[data-bind="travellers.3.limits.maxDailyAscentM"]'), "1000"); await tick(60);
  assert.equal($$("table.people tbody tr").length, 4);
  const applied = text(".view-setup");
  assert.match(applied, /Max avalanche danger level: 2 moderate/); assert.match(applied, /Max difficulty \(ski\): ZS/); assert.match(applied, /Max ascent per day: 1,000 m/);
  // Setup's own wording of the danger limit: the level ABOVE which the day is a no-go (so level 2 is still a go for Léa).
  const dangerHelp = $$("table.people thead th").find(th => /avalanche/.test(th.textContent)).getAttribute("title");
  assert.match(dangerHelp, /above which the day is a no-go/);
  // Applied limits are merged into one "strictest" set; the summary does not say whose limit each one is.
  const appliedLine = $$(".view-setup p").find(p => /Applied limits:/.test(p.textContent)).textContent;
  assert.doesNotMatch(appliedLine, /Léa|Tom|Marc/);
  // The library ideas react to the limits.
  assert.ok($$(".fitideas li").length >= 1, "ideas that fit so far show for a ski trip");

  /* 3. Compare the library: the Écrins, with the "Glacier Blanc week" preset. Flags, not exclusion. */
  await go("#destinations");
  const nLib = $$(".dest").length; assert.ok(nLib >= 5, "every ski destination is still listed despite the limits");
  const ecrins = () => $("#d-ecrins-ski");
  assert.ok(ecrins(), "Écrins card is shown");
  click(ecrins().querySelector('[data-act="preset"][data-i="0"]')); await tick(60);
  const ecrinsFlags = ecrins().querySelector(".alert.crit").textContent;
  assert.match(ecrinsFlags, /ZS\+, above the ZS limit/, "Tom's grade cap flags the ZS+ stage");
  // The flag sentence names the stage but not the person whose limit it breaks.
  assert.doesNotMatch(ecrinsFlags, /Tom|Marc|Léa/);
  // The danger limit plays no part before the trip (it's a day-of thing) — fine — but nothing tells Léa that either.
  assert.doesNotMatch(ecrinsFlags, /danger/i);
  // The compare table has a flags column per destination.
  change($('input[data-ui="compare"]'), true); await tick(60);
  assert.ok($("table.cmp"), "compare table renders");
  const cmpHead = $$("table.cmp thead th").map(th => th.textContent);
  assert.ok(cmpHead.includes("Flags"));
  assert.ok(!cmpHead.some(h => /Gabriel|Léa|Tom|Marc/.test(h)), "no column per traveller: you can't see at a glance who each destination is fine for");
  change($('input[data-ui="compare"]'), false); await tick(60);

  /* 4. Two candidate weeks: the trip holds one date range, so the only way to compare is to change the dates and look again. */
  const scoreOf = () => +ecrins().querySelector(".scorebox .score").textContent;
  const seasonOf = () => [...ecrins().querySelectorAll(".fact")].find(f => /Season fit/.test(f.textContent)).querySelector(".v").textContent;
  const weekA = { score: scoreOf(), season: seasonOf(), pp: ecrins().querySelector(".scorebox .pp").textContent };
  await go("#setup"); change($('[data-bind="dates.start"]'), WEEK_B[0]); change($('[data-bind="dates.end"]'), WEEK_B[1]); await tick(60);
  await go("#destinations");
  const weekB = { score: scoreOf(), season: seasonOf(), pp: ecrins().querySelector(".scorebox .pp").textContent };
  // Two readings, to be written down by hand; and the model can't tell two March weeks apart (monthly climate, same length).
  assert.deepEqual(weekA, weekB, "score, season fit and price are identical for 13–19 and 20–26 March");
  await go("#setup"); change($('[data-bind="dates.start"]'), WEEK_A[0]); change($('[data-bind="dates.end"]'), WEEK_A[1]); await tick(60);

  /* 5. Léa wants Gudauri: unlock live search and ask. */
  assert.ok($("#livePass"), "the unlock card shows");
  $("#livePass").value = "correct horse battery staple long"; click($('[data-act="live-unlock"]')); await tick(200);
  assert.match(text(".livestatus"), /Live search is on/);
  let sent = null;
  fakeApi = async (url, init) => { sent = JSON.parse(init.body); return toolReply("propose_options", optionsInput, "Gudauri fits a mixed group: day tours from one base, so anyone can sit a day out."); };
  $("#chatText").value = "Léa would like to try Gudauri, Georgia instead of the Alps. How does it compare?"; click($('[data-act="chat-send"]')); await tick(300);
  assert.ok(sent, "Claude was asked");
  assert.match(JSON.stringify(sent.messages), /maxGradeSki/, "Claude sees each traveller's limits");
  const cards = $$(".optcard"); assert.equal(cards.length, 1, "Gudauri card; Kazbegi listed apart as a mention");
  assert.match(cards[0].textContent, /Gudauri/); assert.match(cards[0].textContent, /Claude's pick/);
  assert.match(text(".optmentions"), /Kazbegi/);
  // The app checks the live option against limits: altitude, countries, heat, budget. Not grade, daily ascent or danger.
  assert.equal(cards[0].querySelectorAll(".chip.crit, .chips .crit").length, 0, "no flags at all on Gudauri, though Marc's ascent cap and Tom's grade cap are set");
  assert.doesNotMatch(cards[0].textContent, /Not reachable by car/, "a flight-only option isn't flagged for a trip set to 'we drive' (the library flags this)");
  // The library ideas card gives way to the live options on Setup…
  assert.equal($(".fitideas"), null, "Setup no longer shows the library's Écrins ideas next to Gudauri");
  // …and Destinations, where the friends compare, doesn't list Gudauri at all.
  await go("#destinations"); change($('input[data-ui="compare"]'), true); await tick(60);
  assert.doesNotMatch(text("table.cmp"), /Gudauri/, "the live option is absent from the compare table");
  change($('input[data-ui="compare"]'), false); await tick(60);

  /* 6. Léa chooses Gudauri to see what a plan looks like: Claude writes it. */
  await go("#setup");
  fakeApi = async () => toolReply("write_plan", gudauriPlan, "Here is a 3-day sketch.");
  click($$(".optcard")[0].querySelector('[data-act="choose-option"]')); await tick(350);
  assert.equal(window.location.hash, "#build");
  assert.match(text(".triphead"), /Gudauri/);
  assert.ok($(".daytable"), "the plan days show");
  assert.match(text(".daytable"), /↗ 1400 m/);
  assert.doesNotMatch(text(".view-build"), /1,?000 m daily limit|above the 1,?000/, "the 1400 m Kudebi day is not flagged against Marc's 1000 m cap");
  // Fixed (bug 3): Conditions shows Gudauri and its plan days, not a library destination
  await go("#conditions");
  const condHead = text(".view-conditions h2");
  assert.match(condHead, /Gudauri/); assert.doesNotMatch(condHead, /Dolomites/);

  /* 7. The group decides: a decision with the two options. There is no vote; the result is typed in by hand. */
  await go("#decisions");
  const gab = storedTrip().travellers.find(p => p.name === "Gabriel").id;
  await submit($('form[data-form="decision"]'), { title: "Écrins or Gudauri?", options: "Écrins Glacier Blanc (library), Gudauri (live)", owner: gab, due: "2026-11-30" });
  assert.match(text(".view-decisions"), /Écrins or Gudauri\?/);
  assert.equal($$('.decision [data-act="vote"], .decision input[type=radio]').length, 0, "no way for each friend to vote");
  const decideForm = $('form[data-form="decide"]');
  await submit(decideForm, { decision: "Écrins, 3 votes to 1 (Léa for Gudauri)" });
  assert.match(text(".view-decisions"), /Decided \(1\)/);
  assert.equal(storedTrip().chosen, storedTrip().options.find(o => o.name === "Gudauri").id, "deciding does not choose: Gudauri is still the chosen destination");

  /* 8. Choose the Écrins in the library. */
  await go("#destinations");
  click(ecrins().querySelector('[data-act="choose"]')); await tick(80);
  assert.equal(storedTrip().chosen, "ecrins-ski");
  assert.match(text(".triphead"), /Écrins/);

  /* 9. Build: stages, a rest day, the flagged stage dropped, guided. */
  await go("#build");
  assert.ok($("ol.stages"));
  assert.match(text(".view-build"), /Limits broken:.*ZS\+, above the ZS limit/s);
  const s3 = $("#chk-s3"); assert.ok(s3.checked, "the ZS+ stage to the Dôme is in the preset");
  change(s3, false); await tick(60);
  assert.doesNotMatch(text(".view-build"), /above the ZS limit/, "dropping the ZS+ stage clears Tom's flag");
  const ppBefore = text("table.budget tr.total td:last-child");
  click($('button[data-act="rest"][data-d="1"]')); await tick(60);
  change($('input[data-act="guided"]'), true); await tick(60);
  // 1 town day + 4 stages + 2 rest = 7 days in a 7-day trip: only a soft note, no "Fit to my dates" offer.
  assert.match(text(".view-build"), /Only 0 travel days/);
  assert.equal($('[data-act="fit-dates"]'), null);
  assert.ok(storedTrip().plans["ecrins-ski"].guided);
  assert.notEqual(text("table.budget tr.total td:last-child"), ppBefore, "a guide and a rest day change the per-person cost");
  assert.match(text("table.budget"), /guide/);
  // Optional stages for one person (Tom skips a ZS stage and waits at the hut) aren't possible: a stage is on or off for all.
  assert.equal($$('ol.stages [data-act="skip-for"]').length, 0);

  /* 10. Itinerary: one row per day, the hut on each stage night, a link to book it. */
  await go("#itinerary");
  const rows = $$("table.itin tbody tr");
  // The trip is 13–19 March, but with a travel day added in front the itinerary runs to Saturday 20 March.
  assert.equal(rows.length, 8, "8 rows for a 7-day trip");
  assert.match(rows[7].textContent, /20 Mar/); assert.match(rows[7].textContent, /travel home/);
  // The trip is set to "we drive", but day 1 leads with the train route.
  assert.match(rows[0].textContent, /Brussels→Paris→Grenoble or Briançon \(train\)/);
  assert.match(text("table.itin"), /Refuge du Glacier Blanc/);
  assert.ok($$("table.itin a").some(a => /book the hut/.test(a.textContent)), "a 'book the hut' link per hut stay");

  /* 11. Plan & book: hut steps with lead times in months, a booking-reference cell per stay. */
  await go("#plan");
  const planTxt = text(".view-plan");
  assert.match(planTxt, /Book \d+ hut nights?/); assert.match(planTxt, /2 months ahead/);
  assert.match(planTxt, /Guided: book the guide first/);
  assert.match(planTxt, /Agree who drives and the fuel and toll split/);
  assert.doesNotMatch(planTxt, /book by \d|by 13 Jan|by 2027-01/i, "the lead time is never turned into a date (13 Jan for 13 Mar)");
  const ref = $('input[data-bind^="lodgingBooked."]'); assert.ok(ref);
  change(ref, "FFCAM #88231 (Léa)"); await tick(60);
  assert.equal(Object.values(storedTrip().lodgingBooked)[0], "FFCAM #88231 (Léa)");
  assert.match(text(".view-plan"), /\d+ of \d+ done/);
  assert.doesNotMatch(text(".view-plan").match(/(\d+) of \d+ done/)[1], /[1-9]/, "a booking reference doesn't tick the 'Book hut nights' step");

  /* 12. During the trip: the conditions log. */
  await go("#conditions");
  assert.match(text(".view-conditions h2"), /Écrins/);
  assert.match(text(".view-conditions"), /Météo-France avalanche bulletin/);
  assert.match(text(".view-conditions"), /Group limit: danger level 2/);
  const sel = () => $$('select[data-k="danger"]');
  assert.ok(sel().length >= 5, "a row per day on the mountain");
  change(sel()[1], "1"); await tick(60);
  assert.equal($$("tr.nogo").length, 0, "level 1 is fine for everyone");
  // Fixed (bug 4): Léa's maximum is 2, so a level-2 day goes ahead; level 3 is a no-go (the log still doesn't name her).
  change(sel()[2], "2"); await tick(60);
  assert.equal($$("tr.nogo").length, 0, "level 2 is within the limit of 2");
  change(sel()[2], "3"); await tick(60);
  assert.equal($$("tr.nogo").length, 1, "level 3 flags the day");
  const nogo = text("tr.nogo");
  assert.match(nogo, /above the group limit/);
  assert.doesNotMatch(nogo, /Léa/);
  change($$('select[data-k="decision"]')[2], "modified"); await tick(60);
  const note = $$('input[data-k="note"]')[2]; note.value = "Léa rested at the hut; three of us did the Pic du Glacier d'Arias under 30°"; note.dispatchEvent(new window.Event("change", { bubbles: true })); await tick(60);
  const logged = storedTrip().log.find(l => l.danger === "3");
  assert.equal(logged.decision, "modified"); assert.match(logged.note, /Léa rested/);

  /* 13. Money: fuel, huts, a guide only three of them used; different payers; settle-up. */
  await go("#money");
  const ids = Object.fromEntries(storedTrip().travellers.map(p => [p.name, p.id]));
  const addExpense = async (desc, amount, category, paidBy, skip = []) => {
    const f = $('form[data-form="expense"]');
    for (const box of f.querySelectorAll('input[name="split"]')) box.checked = !skip.includes(box.value);
    await submit(f, { desc, amount: String(amount), category, status: "paid", paidBy, date: "2027-03-19" });
  };
  await addExpense("Fuel and tolls, Gabriel's car", 180, "Transport", ids.Gabriel);
  await addExpense("Refuge du Glacier Blanc, 4 × half board × 2 nights", 640, "Huts", ids["Léa"]);
  await addExpense("Guide, 3 days (Gabriel stayed in Vallouise)", 900, "Guide", ids.Tom, [ids.Gabriel]);
  assert.equal($$("table.ledger tbody tr").length, 3);
  assert.match(text("table.ledger"), /Tom, Léa, Marc|Léa, Tom, Marc/, "the guide split shows the three who used it");
  const settle = $$(".view-money h3").find(h => /Settle up/.test(h.textContent)).parentElement.textContent;
  // Gabriel −25, Léa +135, Tom +395, Marc −505 → Marc pays Tom 395 and Léa 110, Gabriel pays Léa 25.
  assert.match(settle, /Marc → Tom: €395/); assert.match(settle, /Marc → Léa: €110/); assert.match(settle, /Gabriel → Léa: €25/);
  // One currency for the trip: a GEL guesthouse bill (had they gone to Georgia) can't be entered in GEL.
  assert.equal($('form[data-form="expense"] [name=currency]'), null);

  /* 14. Share: the friends get a link, open a copy, add their own expense — Gabriel's trip doesn't see it. */
  await go("#share");
  const link = $("#shareLink").value; assert.match(link, /#s-[A-Za-z0-9-]+$/);
  assert.match(text("pre.summary"), /Écrins/); assert.match(text("pre.summary"), /Gabriel, Léa, Tom, Marc/);
  const mine = storedTrip().id;
  window.location.hash = link.split("#")[1]; await tick(200);
  const copy = storedTrip(); assert.notEqual(copy.id, mine); assert.match(copy.name, /\(imported\)/);
  await go("#money");
  await addExpense("Marc: supermarket run", 120, "Food", ids.Marc);
  const store = JSON.parse(window.localStorage.getItem("tripplanner.v1"));
  assert.equal(store.trips[mine].expenses.length, 3, "Gabriel's trip still has 3 expenses: links copy, they never merge");
});

test.todo("Flags name the person whose limit is broken (\"Dôme des Écrins is ZS+, above Tom's ZS\"), and the compare table shows per destination who it is fine for");
test.todo("Hold two candidate date ranges (13–19 or 20–26 March) and compare season fit, events and price for both side by side, then pick one");
test.todo("A vote on a decision: each friend picks an option, the app tallies, and deciding on a destination option chooses it");
test.todo("Live options sit next to library destinations in Destinations and the compare table, so Gudauri and the Écrins can be compared on the same rows");
test.todo("Live options and live plan days are checked against ski grade, daily ascent and the 'we drive' travel mode, not only altitude, countries, heat and budget");
test.todo("Conditions for a live choice lists Gudauri's bulletin pages (it now shows its days, with no bulletin links)");
test.todo("Hut lead times become book-by dates from the trip start (2 months before 13 March = by 13 January) and land in a dated to-do list");
test.todo("A booking reference entered for a hut ticks off (or counts toward) the 'Book hut nights' step");
test.todo("Danger limit means the same in Setup and in the log (Setup: no-go above 2; log: no-go at 2), and the log says whose limit it is, allowing 'go for three, Léa rests'");
test.todo("A stage can be skipped by one person (Tom waits at the hut on the ZS+ day) without dropping it for the group");
test.todo("The itinerary stays inside the trip dates (13–19 March, not to the 20th), or Build warns and offers 'Fit to my dates' when travel days are squeezed to 0; day 1 shows the drive, not the train, for a 'we drive' trip");
test.todo("Expenses in another currency (GEL) with the trip's rate, and per-car fuel splits");
test.todo("Friends' edits come back together: importing a link from the same trip offers to merge expenses, log and decisions instead of making an '(imported)' copy");
