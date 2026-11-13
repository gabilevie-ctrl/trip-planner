// Persona: Gabriel plans the Parents' 30th with the family from the template; Mom gets the link. Also the live path ("somewhere in Japan").
import test from "node:test"; import assert from "node:assert/strict";
import { JSDOM } from "jsdom"; import fs from "node:fs"; import vm from "node:vm";
const dom = new JSDOM(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), { url: "https://example.test/index.html#home", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["document", "window", "location", "localStorage", "HTMLElement", "FormData", "Event", "CustomEvent"]) { try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } catch (e) {} }
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
import { fileURLToPath } from "node:url";
const fakeFiles = new Map(); let fakeApi = null; // in-memory files (checked before disk) and the Claude API stand-in
globalThis.fetch = async (u, init) => { const url = new URL(String(u));
  if (url.hostname === "api.anthropic.com") { if (!fakeApi) return { ok: false, status: 503, text: async () => "" }; const r = await fakeApi(url, init); const st = r.__status || 200; return { ok: st < 400, status: st, text: async () => JSON.stringify(r) }; }
  for (const [k, v] of fakeFiles) if (url.pathname.endsWith(k)) return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(v)) };
  if (url.pathname.endsWith("/data/claude-key.json")) return { ok: false, status: 404, json: async () => null }; const file = url.protocol === "file:" ? fileURLToPath(url) : fileURLToPath(new URL("../" + url.pathname.replace(/^\//, ""), import.meta.url)); return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, "utf8")) }; };
const sb = { module: { exports: {} } }; sb.exports = sb.module.exports; vm.runInNewContext(fs.readFileSync(new URL("../vendor/lz-string.min.js", import.meta.url), "utf8"), sb); window.LZString = sb.module.exports;
window.confirm = () => true;
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const $ = s => window.document.querySelector(s);
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
const change = (el, v) => { if (el.type === "checkbox") el.checked = v; else el.value = v; el.dispatchEvent(new window.Event("change", { bubbles: true })); };
const go = async h => { window.location.hash = h; await tick(60); };

const txt = s => { const el = $(s); return el ? el.textContent.replace(/\s+/g, " ") : ""; };
const all = s => [...window.document.querySelectorAll(s)];
const submit = f => f.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true }));
const store = () => JSON.parse(window.localStorage.getItem("tripplanner.v1"));
const storedTrip = () => { const s = store(); return s.trips[s.current]; };
const hrefOfNext = () => { const a = all("main a[role=button], main a.next-step").find(x => /^Next/.test(x.textContent.trim())); return a && a.getAttribute("href"); };
const card = name => all(".dest").find(c => c.querySelector("h3").textContent === name);
const addExpense = async (desc, amount, payer, splitNames, category = "Other") => {
  const f = $('form[data-form="expense"]'); const t = storedTrip(); const id = n => t.travellers.find(p => p.name === n).id;
  f.querySelector("[name=desc]").value = desc; f.querySelector("[name=amount]").value = String(amount);
  f.querySelector("[name=category]").value = category; f.querySelector("[name=paidBy]").value = id(payer);
  for (const box of f.querySelectorAll('input[name="split"]')) box.checked = splitNames.map(id).includes(box.value);
  submit(f); await tick(60);
};
const addDecision = async (title, options, ownerName, due) => {
  const f = $('form[data-form="decision"]'); const t = storedTrip();
  f.querySelector("[name=title]").value = title; f.querySelector("[name=options]").value = options;
  f.querySelector("[name=owner]").value = t.travellers.find(p => p.name === ownerName).id; f.querySelector("[name=due]").value = due;
  submit(f); await tick(60);
};
const decide = async (titleRe, decision) => {
  const li = all("li.decision").find(l => titleRe.test(l.textContent)); const f = li.querySelector('form[data-form="decide"]');
  f.querySelector("[name=decision]").value = decision; submit(f); await tick(60);
};
const fmt = n => "€" + n.toLocaleString("en-GB");
let gabrielTripId = null, gabrielLink = null;

/* ---------- 1. Gabriel and the family, library destinations ---------- */
test("family: Gabriel opens the template, the family brainstorms and compares, Mom's limits show as flags", async () => {
  await import("../src/main.js"); await tick(120);
  click($('[data-act="use-template"]')); await tick(200);
  assert.equal(window.location.hash, "#setup");
  assert.match(txt(".triphead"), /Parents’ 30th anniversary trip/); assert.match(txt(".triphead"), /5 travellers · from Brussels/);
  assert.equal($('[data-bind="travellers.0.limits.maxDayHighC"]').value, "33", "Mom's heat ceiling is in the people table");
  assert.equal($('[data-bind="travellers.0.limits.maxAltitudeM"]').value, "4200");
  gabrielTripId = store().current;

  await go("#destinations");
  // Mom's heat ceiling and crowd limit are flags on the cards, never a silent filter
  const geo = card("Georgia + Armenia"); assert.ok(geo, "Georgia + Armenia is still listed");
  assert.match(geo.querySelector(".alert.crit").textContent, /Yerevan: ~36°C is above the 33°C ceiling/);
  assert.match(card("Peru, acclimatised").querySelector(".alert.crit").textContent, /4,215 m is above the 4,200 m ceiling/);
  // FINDING: the flag never says whose limit it is; the person reading it has to know it's Mom's
  assert.doesNotMatch(geo.querySelector(".alert.crit").textContent, /Mom/);
  // FINDING: Mom's "no Balkans/Baltics/Central Asia" lives only in the notes; Kyrgyzstan is offered with no flag
  assert.equal(card("Kyrgyzstan").querySelector(".alert.crit"), null);
  // FINDING: winter trips are offered for a July trip
  assert.ok(card("Highlands in winter by sleeper"), "a winter destination is listed for a July trip");
  // Compare the shortlist
  change($('input[data-ui="compare"]'), true); await tick(60);
  const rows = all("table.cmp tbody tr").map(r => r.textContent.replace(/\s+/g, " "));
  assert.ok(rows.some(r => /Norway/.test(r) && /1 flag/.test(r)));
  assert.ok(rows.some(r => /Timor-Leste/.test(r) && /idea/.test(r)), "the template's idea sits in the comparison");
  change($('input[data-ui="compare"]'), false); await tick(60);
});
test.todo("family: say which traveller each flag is for (\"Mom: Yerevan ~36°C is above her 33°C ceiling\")");
test.todo("family: a 'places to avoid' limit (Mom: no Balkans, Baltics, Central Asia) that flags Kyrgyzstan instead of living in the notes");
test.todo("family: hide or flag library destinations whose season doesn't match the dates (winter trips offered for July)");

test("family: record the destination decision with options, settle it, and choose Norway", async () => {
  await go("#decisions");
  assert.equal(all(".view-decisions li.decision.open").length, 2, "the template's two open questions");
  assert.match(txt(".view-decisions .alert"), /Choose the destination/);
  await addDecision("Where do we go?", "Norway, Georgia + Armenia, Sweden", "Gabriel", "2026-12-31");
  const li = all("li.decision").find(l => /Where do we go\?/.test(l.textContent));
  assert.match(li.textContent, /Options: Norway, Georgia \+ Armenia, Sweden/); assert.match(li.textContent, /owner Gabriel/);
  // No way to vote: the only thing to type is the outcome, so the vote goes in the free text
  assert.equal(li.querySelectorAll("input[type=radio], [data-act*=vote]").length, 0, "no vote controls on a decision");
  await decide(/Where do we go\?/, "Norway (Mom, Dad, Gabriel, Sibling; Antoine wanted Sweden)");
  await decide(/Shortlist to vote on/, "Norway");
  assert.match(txt(".view-decisions"), /Decided \(2\)/);
  // FINDING: deciding "Norway" doesn't choose it; the setup still says the destination is open
  assert.match(txt(".view-decisions .alert"), /Choose the destination/);

  await go("#destinations");
  click(card("Norway: cities, a festival and the fjells").querySelector('[data-act="choose"]')); await tick(80);
  assert.match(txt(".nextbar"), /Chosen: Norway/); assert.equal(hrefOfNext(), "#build");
  await go("#decisions"); assert.match(txt(".view-decisions .alert.ok"), /Setup is complete/);
});
test.todo("family: each traveller votes on a decision's options (and sees who hasn't voted yet), and the tally decides it");
test.todo("family: deciding a 'where do we go' question chooses that destination (or offers to)");
test.todo("family: turn the compare shortlist into a decision in one click instead of retyping the names as options");

test("family: build days that suit Mom's limits and Antoine's hiking share, then the itinerary", async () => {
  await go("#build");
  assert.match(txt(".view-build"), /Limits broken: Bergen is crowded in season/);
  change($("#chk-bergen"), false); await tick(80);
  assert.doesNotMatch(txt(".view-build"), /Limits broken/, "dropping Bergen clears Mom's crowd flag");
  // Antoine: no more than 60% hiking. Push outdoor days up until the app warns.
  for (let i = 0; i < 6 && !/of planned days are outdoors/.test(txt(".view-build")); i++) {
    const plus = $('button[data-act="days-group"][data-g="outdoor"][data-d="1"]'); if (!plus || plus.disabled) break; click(plus); await tick(60);
  }
  assert.match(txt(".view-build"), /\d+% of planned days are outdoors; the limit set is 60%/, "Antoine's limit shows as a warning");
  assert.doesNotMatch(all(".view-build .alert").map(a => a.textContent).join(" "), /Antoine/, "FINDING: the warning doesn't name Antoine");
  while (/of planned days are outdoors/.test(txt(".view-build"))) { click($('button[data-act="days-group"][data-g="outdoor"][data-d="-1"]')); await tick(60); }

  await go("#itinerary");
  const rows = all("table.itin tbody tr"); assert.equal(rows.length, 15, "one row per day, 12–26 July");
  assert.match(rows[0].textContent, /12 Jul/); assert.match(rows[14].textContent, /26 Jul/);
  assert.ok(!rows.some(r => /City Bergen/.test(r.textContent.replace(/\s+/g, " "))), "Bergen is out of the itinerary");
  // FINDING: the "Festival + fjells" stop names Olavsfest 28 Jul–3 Aug, after these dates end
  assert.ok(rows.some(r => /Olavsfest/.test(r.textContent) && /28 Jul/.test(r.textContent)));
  change($('[data-bind="dayNotes.2027-07-12"]'), "Anniversary dinner booked for the evening"); await tick(40);
  assert.equal(storedTrip().dayNotes["2027-07-12"], "Anniversary dinner booked for the evening");
});

test("family: book lodging night by night on Plan & book", async () => {
  await go("#plan");
  const stays = all(".view-plan table.itin tbody tr"); assert.ok(stays.length >= 3, "a lodging row per stop");
  const a = stays[0].querySelector('a[href*="booking.com"]'); assert.ok(a, "prefilled Booking.com search");
  assert.match(a.getAttribute("href"), /checkin=2027-07-1\d/); assert.match(a.getAttribute("href"), /group_adults=5/);
  let i = 0; for (const input of all('.view-plan input[data-bind^="lodgingBooked."]')) { change(input, `BK-${++i} (Gabriel)`); await tick(30); }
  assert.equal(Object.keys(storedTrip().lodgingBooked).length, stays.length);
  // FINDING: a booked night with a reference isn't connected to Money; its price has to be typed again there
  await go("#money"); assert.equal(storedTrip().expenses.length, 0);
});
test.todo("family: a booked night (reference typed on Plan & book) asks for its price and who paid, and lands in Money");

test("family: expenses paid by different people, split among some, and the settle-up", async () => {
  await go("#money");
  await addExpense("Hotel deposits, all nights", 2000, "Gabriel", ["Mom", "Dad", "Gabriel", "Antoine", "Sibling"], "Lodging");
  await addExpense("Flights for Mom and Dad", 800, "Dad", ["Mom", "Dad"], "Transport");
  await addExpense("Kids' kayak trip", 300, "Antoine", ["Gabriel", "Antoine", "Sibling"], "Other");
  assert.equal(all("table.ledger tbody tr").length, 3);
  const ledger = txt("table.ledger"); assert.match(ledger, /Mom, Dad/); assert.match(ledger, /Gabriel, Antoine, Sibling/); assert.match(ledger, /everyone/);
  assert.match(txt(".view-money"), new RegExp("Committed so far \\(paid \\+ planned\\)" + fmt(3100)));
  const settle = all(".view-money .grid2 > div")[1].textContent.replace(/\s+/g, " ");
  assert.match(settle, /Mom → Gabriel: €800/); assert.match(settle, /Sibling → Gabriel: €500/); assert.match(settle, /Antoine → Gabriel: €200/);
  // Dad's balance is zero, yet Mom owes Gabriel €800 that Mom and Dad pay from one account
  assert.match(txt(".view-money"), /Dad: €0/);
  assert.match(txt(".view-money"), /Mom: €-800/, "Polish: a negative balance reads €-800 rather than −€800");
});
test.todo("family: treat Mom and Dad as one household in the settle-up (one transfer from the couple)");
test.todo("family: record an expense in NOK (or any other currency) and have it converted to the trip's euros");
test.todo("family: mark a transfer as paid back so the settle-up shows what is still owed");

test("family: share the link; Mom opens it, walks every step with Next, and sees the decisions, bookings and money", async () => {
  await go("#share");
  gabrielLink = $("#shareLink").value; assert.match(gabrielLink, /#s-[A-Za-z0-9-]+$/);
  const summary = txt("pre.summary"); assert.match(summary, /Destination: Norway/); assert.match(summary, /Open decisions:/); assert.match(summary, /Which window/);
  assert.doesNotMatch(summary, /Where do we go/, "decided questions aren't in the summary");
  // Mom opens the link (same browser stands in for hers: she gets a copy)
  const before = Object.keys(store().trips).length;
  window.location.hash = gabrielLink.split("#")[1]; await tick(200);
  assert.equal(window.location.hash, "#setup"); assert.equal(Object.keys(store().trips).length, before + 1);
  assert.match(txt("#toast"), /Trip imported from the link/);
  const steps = ["#destinations", "#build", "#itinerary", "#plan", "#money", "#decisions", "#share"];
  for (const expected of steps) { assert.equal(hrefOfNext(), expected, `Next from ${window.location.hash}`); await go(expected); }
  await go("#destinations"); assert.match(txt(".nextbar"), /Norway/, "she sees what was chosen");
  await go("#build"); assert.doesNotMatch(txt(".view-build"), /Limits broken/, "and that her limits are respected");
  await go("#plan"); assert.ok(all('.view-plan input[data-bind^="lodgingBooked."]').every(i => /^BK-\d/.test(i.value)), "Gabriel's booking refs travel in the link");
  await go("#money"); assert.match(txt(".view-money"), /Mom → Gabriel: €800/);
  await go("#decisions"); assert.match(txt(".view-decisions"), /Antoine wanted Sweden/);
});

test("family: Mom contributes (an expense and an opinion) and sends it back; Gabriel gets a second copy, not a merge", async () => {
  const momTrip = store().current; assert.notEqual(momTrip, gabrielTripId);
  await go("#money"); await addExpense("Anniversary dinner", 450, "Mom", ["Mom", "Dad", "Gabriel", "Antoine", "Sibling"], "Food");
  await go("#decisions");
  // Her opinion on the open window question can only go in as a new decision or as the final answer
  await addDecision("Mom: prefers 19 July – 1 August (cooler at home after)", "", "Mom", "");
  await go("#share"); const momLink = $("#shareLink").value;
  // Gabriel opens Mom's link in his browser
  window.location.hash = momLink.split("#")[1]; await tick(200);
  const s = store(); const names = Object.values(s.trips).map(t => t.name);
  assert.ok(names.filter(n => /^Parents’ 30th anniversary trip/.test(n)).length >= 3, "each link opens as one more copy");
  assert.match(s.trips[s.current].name, /\(imported\)/);
  assert.equal(s.trips[gabrielTripId].expenses.length, 3, "Gabriel's own trip doesn't get Mom's dinner");
  assert.ok(s.trips[s.current].expenses.some(e => e.desc === "Anniversary dinner"));
});
test.todo("family: opening a newer link of the same trip updates it (or shows what changed) instead of adding an '(imported)' copy");
test.todo("family: someone who got the link adds a comment or vote that the organiser can merge back into the master trip");
test.todo("family: on the shared trip, say who changed what (Mom added the dinner) and when");

/* ---------- 2. The live path: "somewhere in Japan" ---------- */
const jOpt = (name, over = {}) => Object.assign({ name, region: "Japan", countryCodes: ["JP"], lat: null, lon: null, why: "Culture, food and mountain walks", weather: { text: "26–28 °C by day", highC: 27, lowC: 19, source: { name: "JMA", url: "https://www.jma.go.jp/x", seenOn: "2026-11-13" } }, maxAltitudeM: 2450, activities: ["Kamikochi", "Nakasendo trail"], access: { from: "Brussels", mode: "flight", time: "15h via Helsinki", connections: "1", pricePP: 1100, currency: "EUR", seenOn: "2026-11-13", source: null }, lodging: [{ type: "ryokan", low: 18000, high: 30000, currency: "JPY" }], estimate: { perPerson: 2300000 / 5, group: 2300000, currency: "JPY", breakdown: [{ what: "Flights", amount: 900000 }, { what: "Lodging", amount: 800000 }] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: [{ name: "JNTO", url: "https://www.japan.travel", seenOn: "2026-11-13" }] }, over);
const toolReply = (name, input, text = "") => ({ stop_reason: "end_turn", usage: {}, content: [...(text ? [{ type: "text", text }] : []), { type: "tool_use", id: "tu1", name, input }] });
const japanPlan = () => {
  const days = []; const nights = [["Tokyo", "b_tokyo"], ["Tokyo", "b_tokyo"], ["Tokyo", "b_tokyo"], ["Matsumoto", "b_matsu"], ["Kamikochi", "b_kami"], ["Kamikochi", "b_kami"], ["Takayama", "b_taka"], ["Takayama", "b_taka"], ["Kanazawa", "b_kana"], ["Kanazawa", "b_kana"], ["Kyoto", "b_kyoto"], ["Kyoto", "b_kyoto"], ["Kyoto", "b_kyoto"], ["Tokyo", "b_tokyo2"], ["", null]];
  for (let i = 0; i < 15; i++) days.push({ id: "d_" + (i + 1), date: `2027-07-${12 + i}`, move: i === 0 ? "Fly Brussels → Tokyo" : i === 5 ? "Hike Kamikochi to Tokugo pass" : i === 14 ? "Fly home" : "Explore " + (nights[i][0] || "Tokyo"), km: i === 5 ? 14 : null, ascentM: i === 5 ? 900 : null, descentM: null, hours: i === 5 ? 6 : null, night: { name: nights[i][0], type: nights[i][1] ? "hotel" : "none", bookingId: nights[i][1] }, fallback: "", legs: i === 0 ? [{ id: "l_fly", mode: "flight", from: "Brussels", to: "Tokyo", time: "", bookingId: "b_flights", note: "" }] : [], points: [] });
  const b = (id, what, category, price, currency) => ({ id, what, category, pick: "", alternative: "", price, currency, seenOn: "2026-11-13", status: "idea", link: "https://www.booking.com", bookBy: "2027-03-01", details: "", source: null });
  return { days, bookings: [b("b_flights", "Flights Brussels ⇄ Tokyo for five", "transport", 5500, "EUR"), b("b_tokyo", "Tokyo hotel, 3 nights", "lodging", 210000, "JPY"), b("b_matsu", "Matsumoto inn", "lodging", 60000, "JPY"), b("b_kami", "Kamikochi lodge, 2 nights", "lodging", 240000, "JPY"), b("b_taka", "Takayama ryokan, 2 nights", "lodging", 300000, "JPY"), b("b_kana", "Kanazawa hotel", "lodging", 120000, "JPY"), b("b_kyoto", "Kyoto machiya, 3 nights", "lodging", 270000, "JPY"), b("b_tokyo2", "Tokyo airport hotel", "lodging", 70000, "JPY"), b("b_jr", "JR Pass x5", "transport", 250000, "JPY")],
    permits: [], admin: [{ id: "a_visa", traveller: "group", what: "No visa for Belgian passports up to 90 days", note: "" }], gear: [{ id: "g_shoes", name: "Walking shoes", note: "" }], food: "Konbini breakfasts, izakaya dinners",
    todo: [{ id: "t_tix", date: "2027-06-01", what: "Reserve Shinkansen seats" }], otherCosts: [{ id: "c_food", what: "Food and local transport", amount: 450000, currency: "JPY", seenOn: "2026-11-13" }],
    sources: [{ name: "JNTO", url: "https://www.japan.travel", seenOn: "2026-11-13" }], rates: [{ currency: "JPY", toTrip: 0.0062, seenOn: "2026-11-13", source: null }] };
};
const chooseOpt = name => all(".optcard").find(c => c.textContent.includes(name)).querySelector('[data-act="choose-option"]');

test("live: 'somewhere in Japan' on the family trip gives options with Mom's heat flagged", async () => {
  const { lockKey } = await import("../src/keylock.js");
  fakeFiles.set("/data/claude-key.json", await lockKey("sk-ant-test", "correct horse battery staple long", { iterations: 1000 }));
  await go("#home"); click($('[data-act="use-template"]')); await tick(200);
  assert.ok($("#livePass"), "the unlock card shows");
  $("#livePass").value = "correct horse battery staple long"; click($('[data-act="live-unlock"]')); await tick(200);
  assert.match(txt(".livestatus"), /Live search is on/);
  let sent = null;
  fakeApi = async (url, init) => { sent = JSON.parse(init.body); return toolReply("propose_options", { rates: [{ currency: "JPY", toTrip: 0.0062, seenOn: "2026-11-13", source: null }], options: [
    jOpt("Japan Alps + Kanazawa", { pick: true }),
    jOpt("Kyoto, Nara and Osaka", { weather: { text: "33–35 °C, humid", highC: 35, lowC: 26, source: null }, maxAltitudeM: 900, tradeOff: "Very crowded in July" }),
    jOpt("Hokkaido", { weather: { text: "24 °C", highC: 24, lowC: 16, source: null }, maxAltitudeM: 2291, estimate: { perPerson: 600000, group: 3000000, currency: "JPY", breakdown: [] } }),
    jOpt("Okinawa", { mention: true, mentionWhy: "Typhoon season" }) ] }, "Three ways to do Japan in July."); };
  $("#chatText").value = "Somewhere in Japan instead? Mom hates heat and crowds."; click($('[data-act="chat-send"]')); await tick(300);
  assert.ok(JSON.stringify(sent.messages).includes("Mom"), "the travellers and limits go to Claude");
  const cards = all(".optcard"); assert.equal(cards.length, 3);
  const kyoto = cards.find(c => /Kyoto/.test(c.textContent));
  assert.match(kyoto.textContent, /~35°C is above the 33°C ceiling/, "Mom's heat limit is flagged on a live option");
  const hok = cards.find(c => /Hokkaido/.test(c.textContent));
  assert.match(hok.textContent, /over the €15,000 budget/);
  // FINDING: Mom's crowd limit can't be checked on live options (no crowd field); Kyoto's crowds are only Claude's prose
  assert.doesNotMatch(kyoto.querySelector(".alert.crit")?.textContent || "", /crowd/i);
  assert.match(txt(".optmentions"), /Okinawa/);
});
test.todo("live: check Mom's crowd limit on live options (a crowd level per option or per day from Claude)");
test.todo("live: check Antoine's 60% hiking share against a live plan's days");

test("live: choose an option, get the plan, book a night, split money, record the decision", async () => {
  await go("#setup");
  fakeApi = async () => toolReply("write_plan", japanPlan(), "Here is the plan.");
  click(chooseOpt("Japan Alps + Kanazawa")); await tick(400);
  assert.equal(window.location.hash, "#build"); assert.match(txt(".triphead"), /Japan Alps \+ Kanazawa/);
  assert.equal(all(".daytable tbody tr").length, 15);
  assert.equal($(".view-build .alert.crit"), null, "no limit broken for the pick");
  await go("#itinerary"); assert.equal(all(".daytable tbody tr").length, 15);
  await go("#plan");
  change($('select[data-bind="livePlan.bookings.#b_taka.status"]'), "booked"); await tick(60);
  change($('input[data-bind="livePlan.bookings.#b_taka.confirmation"]'), "RYO-778"); await tick(60);
  assert.equal(storedTrip().livePlan.bookings.find(b => b.id === "b_taka").confirmation, "RYO-778");
  await go("#money");
  assert.match(txt(".view-money"), /Plan total/);
  await addExpense("Takayama ryokan deposit", 900, "Dad", ["Mom", "Dad"], "Lodging");
  await addExpense("JR passes", 1550, "Gabriel", ["Mom", "Dad", "Gabriel", "Antoine", "Sibling"], "Transport");
  const settle = all(".view-money .grid2 > div")[1].textContent.replace(/\s+/g, " ");
  assert.match(settle, /Mom → /); assert.match(settle, /→ Gabriel/);
  // FINDING: the ryokan marked booked on Plan & book is not in the ledger; the plan total and the ledger are two worlds
  assert.ok(!all("table.ledger tbody tr").some(r => /RYO-778/.test(r.textContent)));
  await go("#decisions");
  assert.match(txt(".view-decisions .alert.ok"), /Setup is complete/, "a live choice counts as chosen");
  await addDecision("Japan: Alps or Kyoto?", "Japan Alps + Kanazawa, Kyoto, Nara and Osaka", "Gabriel", "2027-01-15");
  await decide(/Alps or Kyoto/, "Alps: Mom can't do 35°C in Kyoto");
  assert.match(txt(".view-decisions"), /Decided \(1\)/);
});
test.todo("live: a booking marked booked in the live plan becomes an expense with who paid, so the split follows");

test("live: Mom opens the Japan link without the password and follows it with Next buttons", async () => {
  await go("#share"); const link = $("#shareLink").value;
  // FINDING: the Japan link is about 13,000 characters; WhatsApp/SMS may refuse or cut it
  assert.ok(link.length > 8000, "the live-plan link is very long: " + link.length);
  await go("#setup"); if ($('[data-act="live-forget"]')) { click($('[data-act="live-forget"]')); await tick(150); }
  fakeApi = null;
  window.location.hash = link.split("#")[1]; await tick(250);
  assert.equal(window.location.hash, "#setup");
  assert.match(all(".optcard").find(c => /Japan Alps/.test(c.textContent)).textContent, /Chosen ✓/);
  assert.equal(hrefOfNext(), "#destinations"); await go("#destinations");
  // On Destinations the library shows with no "Chosen" bar for a live choice: the only buttons choose a library place
  const next = hrefOfNext();
  assert.equal(next, undefined, "FINDING: no Next button on Destinations when the choice is a live option");
  assert.ok($('[data-act="choose"]'), "only 'Choose this destination' buttons, which would replace Japan");
  await go("#build"); assert.equal(all(".daytable tbody tr").length, 15, "the plan travels in the link and shows without the password");
  for (const expected of ["#itinerary", "#plan", "#money", "#decisions", "#share"]) { assert.equal(hrefOfNext(), expected, `Next from ${window.location.hash}`); await go(expected); }
  await go("#plan"); assert.equal($('input[data-bind="livePlan.bookings.#b_taka.confirmation"]').value, "RYO-778");
  await go("#money"); assert.match(txt(".view-money"), /Plan total/); assert.match(txt(".view-money"), /Mom → /);
});
test.todo("live: Destinations shows the chosen live option (with a Next button) instead of only library cards that would replace it");
