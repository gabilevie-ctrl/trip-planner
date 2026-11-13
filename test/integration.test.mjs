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

test("end to end: create a ski trip, set it up, pick a destination, build, book, log, share", async () => {
  await import("../src/main.js"); await tick(80);
  assert.ok($(".kinds"), "home renders kinds");
  click($('[data-act="new-trip"][data-kind="skitour"]')); await tick(80);
  assert.equal(window.location.hash, "#setup");
  change($('[data-bind="name"]'), "Écrins week"); await tick(40);
  change($('[data-bind="dates.start"]'), "2027-03-20"); change($('[data-bind="dates.end"]'), "2027-03-26"); await tick(40);
  change($('[data-bind="budget.total"]'), "4000"); change($('[data-bind="travel.mode"]'), "drive"); await tick(40);
  change($('[data-bind="travellers.0.name"]'), "Gabriel"); await tick(40);
  change($('[data-bind="travellers.0.limits.maxDanger"]'), "3"); await tick(40);
  click($('[data-act="add-traveller"]')); await tick(40); change($('[data-bind="travellers.1.name"]'), "Friend"); await tick(40);
  await go("#destinations");
  assert.ok($(".dest"), "destination cards render"); assert.ok($("#q"));
  const choose = $('[data-act="choose"]'); const id = choose.dataset.id; click(choose); await tick(60);
  assert.ok($(".dest.chosen"), "a destination is chosen");
  await go("#build"); assert.ok($("ol.stages"), "stage list renders for ski trips");
  const plus = $('button[data-act="rest"][data-d="1"]'); click(plus); await tick(40);
  click($('input[data-act="guided"]') && (() => { const g = $('input[data-act="guided"]'); g.checked = true; return g; })()); await tick(10); change($('input[data-act="guided"]'), true); await tick(40);
  await go("#itinerary"); assert.ok($("table.itin"));
  await go("#plan"); const stepBox = $('input[data-act="step"]'); change(stepBox, true); await tick(40); assert.ok(/1 of \d+ done/.test($(".view-plan").textContent));
  await go("#money"); const f = $('form[data-form="expense"]'); f.querySelector('[name=desc]').value = "Fuel"; f.querySelector('[name=amount]').value = "120"; f.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await tick(40);
  assert.ok($("table.ledger"), "ledger has the expense"); assert.ok(/→/.test($(".view-money").textContent), "settle-up shows a transfer");
  await go("#decisions"); const df = $('form[data-form="decision"]'); df.querySelector('[name=title]').value = "Guide or not?"; df.dispatchEvent(new window.Event("submit", { bubbles: true, cancelable: true })); await tick(40); assert.ok(/Guide or not\?/.test($(".view-decisions").textContent));
  await go("#conditions"); const sel = $('select[data-k="danger"]'); change(sel, "3"); await tick(40); assert.ok($("tr.nogo"), "danger at the limit flags the day");
  await go("#share"); const link = $("#shareLink").value; assert.match(link, /#s-[A-Za-z0-9-]+$/);
  // import the link as a new trip in the same browser → becomes a copy
  window.location.hash = link.split("#")[1]; await tick(120);
  assert.equal(window.location.hash, "#setup");
  const store = JSON.parse(window.localStorage.getItem("tripplanner.v1")); assert.equal(Object.keys(store.trips).length, 2, "imported copy added");
  await go("#home"); assert.equal(window.document.querySelectorAll(".tripcard:not([data-act=use-template])").length, 2);
  click($('[data-act="delete-trip"]')); await tick(60); assert.ok($('[data-act="delete-trip-confirm"]'), "in-page confirm appears");
  click($('[data-act="delete-trip-confirm"]')); await tick(60); assert.equal(window.document.querySelectorAll(".tripcard:not([data-act=use-template])").length, 1, "trip deleted without window.confirm");
  click($('[data-act="use-template"]')); await tick(150); assert.equal(window.location.hash, "#setup"); assert.ok(/Parents/.test($(".triphead").textContent), "family template opened");
});

test("every page has a Send feedback link that opens an email", async () => {
  await import("../src/main.js"); await go("#home");
  for (const h of ["#home", "#setup"]) {
    await go(h);
    const a = $('header.apphead a[data-feedback]');
    assert.ok(a, `feedback link on ${h}`);
    assert.equal(a.textContent.trim(), "Send feedback");
    assert.equal(a.getAttribute("href"), "mailto:gabilevie@gmail.com?subject=Trip%20planner%20feedback");
  }
});

test("table cells carry their column name so rows can stack on a phone", async () => {
  await import("../src/main.js"); await go("#home");
  click($('[data-act="use-template"]')); await tick(150);
  await go("#itinerary");
  const table = $("table.itin"); assert.ok(table, "itinerary table renders");
  const heads = [...table.querySelectorAll("thead th")].map(th => th.textContent.trim());
  const row = table.querySelector("tbody tr");
  assert.deepEqual([...row.children].map(td => td.dataset.label), heads);
  await go("#setup");
  const people = $("table.people tbody tr td"); assert.equal(people.dataset.label, "Name");
});

test("describe a trip on home: the form fills in, the chat replies, step 1 shows ideas", async () => {
  await import("../src/main.js"); await go("#home");
  $("#describeText").value = "Five of us from Brussels, 12-26 July 2027, budget €15,000. We love old towns and food, avoid crowds, nothing above 30°C.";
  click($('[data-act="describe-new"]')); await tick(200);
  assert.equal(window.location.hash, "#setup");
  assert.equal($('[data-bind="dates.start"]').value, "2027-07-12");
  assert.equal($('[data-bind="budget.total"]').value, "15000");
  assert.equal(window.document.querySelectorAll("table.people tbody tr").length, 5);
  assert.equal($('[data-bind="travellers.0.limits.maxDayHighC"]').value, "30");
  const msgs = () => [...window.document.querySelectorAll(".chat .msg")];
  assert.equal(msgs().length, 2); assert.match(msgs()[1].textContent, /Filled in/);
  const ideas = window.document.querySelectorAll(".fitideas li");
  assert.equal(ideas.length, 3, "three ideas in step 1");
  $("#chatText").value = "Dad can't go higher than 2000 m";
  click($('[data-act="chat-send"]')); await tick(120);
  assert.equal(msgs().length, 4);
  assert.equal($('[data-bind="travellers.0.limits.maxAltitudeM"]').value, "2000");
  assert.match($('[data-bind="notes"]').value, /Dad can't go higher/);
});

test("choosing a destination offers a button to the next step", async () => {
  await import("../src/main.js"); await go("#home");
  click($('[data-act="new-trip"][data-kind="explore"]')); await tick(80);
  await go("#destinations");
  assert.equal(window.document.querySelectorAll("a.next-step").length, 0, "no next button before choosing");
  const choose = $('[data-act="choose"]'); const id = choose.dataset.id; click(choose); await tick(60);
  const next = $(`#d-${id} a.next-step`);
  assert.ok(next, "the chosen card has a next-step button");
  assert.equal(next.getAttribute("href"), "#build");
  assert.match(next.textContent, /Next: build the days/);
});

test("UX: over-long plan offers 'Fit to my dates' once; compare rows can be opened and chosen; summary and plan read well", async () => {
  await import("../src/main.js"); await go("#home");
  $("#describeText").value = "jan 2nd until jan 9th, situ and I"; click($('[data-act="describe-new"]')); await tick(200);
  await go("#build");
  click($('[data-act="preset"][data-i="0"]')); await tick(60);
  const long = () => [...window.document.querySelectorAll(".view-build .alert")].filter(a => /days planned in a/.test(a.textContent));
  assert.equal(long().length, 1, "the over-long warning shows once");
  click(long()[0].querySelector('[data-act="fit-dates"]')); await tick(60);
  assert.equal(long().length, 0, "fitting removes the warning");
  await go("#destinations");
  change($('input[data-ui="compare"]'), true); await tick(60);
  const row = $("table.cmp tbody tr");
  assert.ok(row.querySelector('[data-act="choose"]'), "each row can be chosen");
  const open = row.querySelector('[data-act="open-card"]'); assert.ok(open, "each row can be opened");
  const id = open.dataset.id; click(open); await tick(80);
  assert.ok(!$("table.cmp"), "opening a row goes back to the cards"); assert.ok($(`#d-${id}`));
  click($(`#d-${id} [data-act="choose"]`)); await tick(60);
  await go("#share"); assert.doesNotMatch($("pre.summary").textContent, /\?, \?/);
  await go("#plan"); assert.doesNotMatch($(".view-plan table.itin tbody td").textContent, /\d{4}-\d{2}-\d{2}/);
});

/* ---- Scenarios: people using the whole dashboard ---- */
const hrefOfNext = () => { const a = [...window.document.querySelectorAll("main a[role=button], main a.next-step")].find(x => /^Next/.test(x.textContent.trim())); return a && a.getAttribute("href"); };

test("scenario: Mom opens the family link on her phone and walks every step with Next buttons only", async () => {
  await import("../src/main.js"); await go("#home");
  click($('[data-act="use-template"]')); await tick(150);
  await go("#share"); const link = $("#shareLink").value;
  window.location.hash = link.split("#")[1]; await tick(150);
  assert.equal(window.location.hash, "#setup", "the shared link opens the trip");
  change($('[data-bind="travellers.0.limits.maxDayHighC"]'), "25"); await tick(60);
  const steps = ["#destinations", "#build", "#itinerary", "#plan", "#money", "#decisions", "#share"];
  for (const expected of steps) {
    if (window.location.hash === "#destinations" && !$(".nextbar")) { click($('[data-act="choose"]')); await tick(60); }
    const next = hrefOfNext(); assert.equal(next, expected, `from ${window.location.hash} the Next button should go to ${expected}`);
    await go(next);
  }
});

test("scenario: Situ and Gabriel describe a January trip, take the first idea, and get a plan that fits their 8 days", async () => {
  await import("../src/main.js"); await go("#home");
  $("#describeText").value = "jan 2nd until jan 9th, situ and I. low budget. want to be outside in nature as much as possible. Maybe somewhere warm in europe/shengen.";
  click($('[data-act="describe-new"]')); await tick(200);
  click($("#chatText") && (() => { $("#chatText").value = "give us options"; return $('[data-act="chat-send"]'); })()); await tick(120);
  const last = [...window.document.querySelectorAll(".chat .msg.app")].pop().textContent;
  assert.match(last, /best fits/); assert.match(last, /1\. /);
  click($('.fitideas [data-act="see-dest"]')); await tick(100);
  assert.equal(window.location.hash, "#destinations");
  const card = $(".dest"); click(card.querySelector('[data-act="choose"]')); await tick(60);
  await go(hrefOfNext());
  assert.equal(window.location.hash, "#build");
  assert.ok(![...window.document.querySelectorAll(".view-build .alert")].some(a => /days planned in a/.test(a.textContent)), "the plan already fits the dates");
  await go("#itinerary");
  const rows = window.document.querySelectorAll("table.itin tbody tr");
  assert.equal(rows.length, 8, "one row per day of the trip");
  assert.match(rows[rows.length - 1].textContent, /9 Jan/);
});

test("scenario: a friend sets up a ski touring week from a sentence and reaches the conditions log", async () => {
  await import("../src/main.js"); await go("#home");
  $("#describeText").value = "Ski touring week for 3 in March, we drive, max 1200 m up a day, nothing harder than ZS";
  click($('[data-act="describe-new"]')); await tick(200);
  assert.match($(".triphead").textContent, /Ski touring/);
  assert.equal($('[data-bind="travellers.0.limits.maxDailyAscentM"]').value, "1200");
  await go("#destinations"); click($('[data-act="choose"]')); await tick(60);
  await go("#decisions"); assert.equal(hrefOfNext(), "#conditions");
  await go("#conditions"); assert.ok($("table.log"), "a conditions log row per day"); assert.equal(hrefOfNext(), "#share");
});

test("live search: unlock with the family password, ask, see flagged options, and share them", async () => {
  const { lockKey } = await import("../src/keylock.js");
  const { encodeShare, decodeShare } = await import("../src/state.js");
  fakeFiles.set("/data/claude-key.json", await lockKey("sk-ant-test", "correct horse battery staple long", { iterations: 1000 }));
  const seen = [];
  const opt = (name, over = {}) => Object.assign({ name, region: "", countryCodes: ["ES"], lat: null, lon: null, why: "Warm and walkable", weather: { text: "20–22 °C by day", highC: 21, lowC: 14, source: { name: "AEMET", url: "https://www.aemet.es/x", seenOn: "2026-11-09" } }, maxAltitudeM: null, activities: ["GR131"], access: { from: "London", mode: "flight", time: "4h30", connections: "Tenerife South + ferry", pricePP: 36, currency: "GBP", seenOn: "2026-11-08", source: null }, lodging: [{ type: "camping", low: 0, high: 10, currency: "EUR" }], estimate: { perPerson: 600, group: 1200, currency: "GBP", breakdown: [{ what: "Flights", amount: 154 }] }, tradeOff: "Permits by email", pick: false, mention: false, mentionWhy: null, sources: [{ name: "Cabildo", url: "https://www.cabildodelapalma.es/", seenOn: "2026-11-09" }] }, over);
  fakeApi = async (url, init) => { seen.push(init.headers["x-api-key"]); return { stop_reason: "end_turn", usage: {}, content: [
    { type: "text", text: "Here are three ideas." },
    { type: "tool_use", id: "t1", name: "propose_options", input: { rates: [{ currency: "EUR", toTrip: 0.86, seenOn: "2026-11-09", source: null }], options: [
      opt("La Palma", { pick: true }), opt("Southern Morocco", { countryCodes: ["MA"] }), opt("Odd place", { why: "<script>x</script>" }),
      opt("Cape Verde", { countryCodes: ["CV"], mention: true, mentionWhy: "6h+ flights, over budget" }) ] } }] }; };
  await go("#home"); click($('[data-act="new-trip"][data-kind="explore"]')); await tick(120);
  click($('[data-act="add-traveller"]')); await tick(60);
  change($('[data-bind="travellers.1.name"]'), "Situ"); await tick(40);
  change($('[data-bind="travellers.1.limits.countryZone"]'), "schengen"); await tick(80);
  assert.ok($("#livePass"), "the unlock card shows when a locked key exists");
  $("#livePass").value = "not the family password"; click($('[data-act="live-unlock"]')); await tick(150);
  assert.match($("#toast").textContent, /doesn't unlock live search/);
  $("#livePass").value = "correct horse battery staple long"; click($('[data-act="live-unlock"]')); await tick(150);
  assert.match($(".livestatus").textContent, /Live search is on/); assert.equal($("#livePass"), null);
  $("#chatText").value = "warm hiking in January"; click($('[data-act="chat-send"]')); await tick(250);
  assert.deepEqual(seen, ["sk-ant-test"]);
  const cards = [...window.document.querySelectorAll(".optcard")];
  assert.equal(cards.length, 3, "pick + two options; the mention is listed apart");
  assert.match(cards[0].textContent, /Claude's pick/); assert.match(cards[0].textContent, /La Palma/);
  const morocco = cards.find(c => /Southern Morocco/.test(c.textContent)); assert.match(morocco.textContent, /outside the Schengen area/);
  assert.equal($(".optcards script"), null); assert.ok($(".optcards").textContent.includes("<script>x</script>"), "Claude's text is shown as text");
  assert.match($(".optmentions").textContent, /Cape Verde/);
  assert.equal($(".fitideas"), null, "library ideas give way to live options");
  const store = JSON.parse(window.localStorage.getItem("tripplanner.v1")); const t = store.trips[store.current];
  t._local = { optionHistory: [{ at: "x", options: [] }], lastSynced: null };
  const back = decodeShare(encodeShare(t, window.LZString), window.LZString);
  assert.equal(back.options.length, 4); assert.equal(back.rates.EUR.toTrip, 0.86); assert.equal(back._local, undefined);
});

test("review: a crafted share link can't inject HTML through option fields", async () => {
  const { newTrip, encodeShare } = await import("../src/state.js");
  const t = newTrip("explore"); t.name = "Crafted";
  t.options = [{ id: "o_x1", name: "Trap", weather: { text: "", highC: "<img id=pwn src=x>", lowC: null, source: null }, access: { from: "", currency: "<img id=pwn2 src=x>", pricePP: 5 }, estimate: { perPerson: 5, group: 10, currency: "<img id=pwn3 src=x>", breakdown: [] } }, { id: "o_x2", name: "No weather at all" }];
  t.budget = { total: 100, currency: "<img id=pwn4 src=x>" };
  window.location.hash = "#" + encodeShare(t, window.LZString).replace(/^#/, ""); await tick(250);
  await go("#setup"); await tick(100);
  assert.ok(window.document.querySelectorAll(".optcard").length >= 2, "imported options render without crashing");
  for (const id of ["pwn", "pwn2", "pwn3", "pwn4"]) assert.equal(window.document.getElementById(id), null, id + " must not be an element");
  await go("#home"); assert.equal(window.document.getElementById("pwn4"), null);
});
test("review: the typed message is saved before the answer arrives, busy is per trip, and a dead key locks again", async () => {
  let release; fakeApi = () => new Promise(r => { release = r; });
  await go("#home"); click($('[data-act="new-trip"][data-kind="explore"]')); await tick(150);
  if ($("#livePass")) { $("#livePass").value = "correct horse battery staple long"; click($('[data-act="live-unlock"]')); await tick(150); }
  $("#chatText").value = "tents only please"; click($('[data-act="chat-send"]')); await tick(120);
  const store = JSON.parse(window.localStorage.getItem("tripplanner.v1")); const t = store.trips[store.current];
  assert.ok(t.brief.some(m => m.text === "tents only please"), "saved before the answer");
  assert.ok($(".msg.busy"), "shows Searching live");
  release({ __status: 401, type: "error", error: { message: "invalid x-api-key" } }); await tick(250);
  assert.equal($(".msg.busy"), null);
  assert.match($(".thread").textContent, /no longer works/);
  assert.ok($("#livePass"), "the unlock card is back after a dead key");
});

test("describe with a chatbot: copy the prompt, a cut-off reply is refused, a good one opens Setup", async () => {
  await import("../src/main.js"); await go("#home");
  const count = () => Object.keys(JSON.parse(window.localStorage.getItem("tripplanner.v1") || '{"trips":{}}').trips).length;
  $("#describeText").value = "";
  click($('[data-act="describe-chatbot"]')); await tick(40);
  assert.ok(!$("#chatbotPrompt"), "no panel without a description");
  $("#describeText").value = "Mom and me from London in July, she can't do altitude";
  click($('[data-act="describe-chatbot"]')); await tick(40);
  assert.match($("#chatbotPrompt").value, /Mom and me from London/);
  assert.equal($("#describeText").value, "Mom and me from London in July, she can't do altitude", "description kept after the panel opens");
  const before = count();
  $("#chatbotReply").value = '```json\n{"name": "Bro';
  click($('[data-act="chatbot-fill"]')); await tick(60);
  assert.equal(window.location.hash, "#home");
  assert.match($(".chatbot-error").textContent, /cut off/);
  assert.equal(count(), before, "no trip from a bad reply");
  assert.equal($("#chatbotReply").value, '```json\n{"name": "Bro', "the pasted reply stays");
  $("#chatbotReply").value = 'Here it is:\n```json\n' + JSON.stringify({ name: "July with Mom", origin: "London", dates: { start: "2027-07-10", end: "2027-07-20" }, travellers: [{ name: "Mom", limits: { maxAltitudeM: 2000 } }, { name: "Gabriel", limits: {} }], assumptions: ["mid-July"] }) + "\n```";
  click($('[data-act="chatbot-fill"]')); await tick(200);
  assert.equal(window.location.hash, "#setup");
  assert.equal(count(), before + 1);
  assert.equal($('[data-bind="name"]').value, "July with Mom");
  assert.equal($('[data-bind="travellers.0.name"]').value, "Mom");
  assert.equal($('[data-bind="travellers.0.limits.maxAltitudeM"]').value, "2000");
  assert.equal($('[data-bind="travellers.1.limits.maxAltitudeM"]').value, "");
  assert.equal($('[data-bind="dates.start"]').value, "2027-07-10");
  assert.match($(".thread").textContent, /Filled in by the chatbot/);
  assert.match($(".thread").textContent, /mid-July/);
  await go("#home"); assert.ok(!$("#chatbotPrompt"), "panel closed after a trip was made");
});

/* ---------- The live plan ---------- */
const liveOpt = (name, over = {}) => Object.assign({ name, region: "", countryCodes: ["ES"], lat: null, lon: null, why: "Warm and walkable", weather: { text: "20–22 °C", highC: 21, lowC: 14, source: null }, maxAltitudeM: null, activities: [], access: { from: "London", mode: "flight", time: "4h30", connections: "", pricePP: 36, currency: "GBP", seenOn: "2026-11-08", source: null }, lodging: [], estimate: { perPerson: 600, group: 1200, currency: "GBP", breakdown: [] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: [] }, over);
const toolReply = (name, input, text = "") => ({ stop_reason: "end_turn", usage: {}, content: [...(text ? [{ type: "text", text }] : []), { type: "tool_use", id: "tu1", name, input }] });
async function liveTripWithOptions() {
  const { lockKey } = await import("../src/keylock.js");
  fakeFiles.set("/data/claude-key.json", await lockKey("sk-ant-test", "correct horse battery staple long", { iterations: 1000 }));
  fakeApi = async () => toolReply("propose_options", { rates: [{ currency: "EUR", toTrip: 0.86, seenOn: "2026-11-09", source: null }], options: [liveOpt("La Palma", { pick: true }), liveOpt("Southern Morocco", { countryCodes: ["MA"] }), liveOpt("Cape Verde", { mention: true, mentionWhy: "far" })] }, "Three ideas.");
  await go("#home"); click($('[data-act="new-trip"][data-kind="hike"]')); await tick(150);
  change($('[data-bind="travellers.0.name"]'), "Gabriel"); await tick(40);
  click($('[data-act="add-traveller"]')); await tick(60); change($('[data-bind="travellers.1.name"]'), "Situ"); await tick(40);
  change($('[data-bind="dates.start"]'), "2027-01-02"); change($('[data-bind="dates.end"]'), "2027-01-03"); await tick(40);
  change($('[data-bind="budget.total"]'), "1500"); change($('[data-bind="budget.currency"]'), "GBP"); await tick(60);
  if ($("#livePass")) { $("#livePass").value = "correct horse battery staple long"; click($('[data-act="live-unlock"]')); await tick(150); }
  $("#chatText").value = "warm hiking in January"; click($('[data-act="chat-send"]')); await tick(250);
}
const chooseBtn = name => [...window.document.querySelectorAll(".optcard")].find(c => c.textContent.includes(name)).querySelector('[data-act="choose-option"]');
const storedTrip = () => { const s = JSON.parse(window.localStorage.getItem("tripplanner.v1")); return s.trips[s.current]; };

test("choose a live option: Claude writes the plan, the header names it, another choice hides it", async () => {
  await import("../src/main.js");
  const { planInput } = await import("./plan-fixtures.mjs");
  await liveTripWithOptions();
  assert.equal(window.document.querySelectorAll('.optcard [data-act="choose-option"]').length, 2, "a Choose button on each card, none for mentions");
  let sent = null; fakeApi = async (url, init) => { sent = JSON.parse(init.body); return toolReply("write_plan", planInput(), "Here is your plan."); };
  click(chooseBtn("La Palma")); await tick(300);
  assert.equal(window.location.hash, "#build");
  assert.match($(".triphead").textContent, /La Palma/);
  assert.equal(sent.max_tokens, 32000); assert.match(JSON.stringify(sent.messages), /Write the full plan for La Palma\./);
  assert.ok(storedTrip().brief.some(m => m.text === "Write the full plan for La Palma."));
  assert.equal(storedTrip().livePlan.bookings.length, 3);
  assert.ok($(".daytable"), "the days show on Build");
  await go("#setup"); assert.match([...window.document.querySelectorAll(".optcard")].find(c => c.textContent.includes("La Palma")).textContent, /Chosen ✓/);
  let release; fakeApi = () => new Promise(r => { release = r; });
  click(chooseBtn("Southern Morocco")); await tick(200);
  assert.equal(window.location.hash, "#build");
  assert.equal($(".daytable"), null, "the first option's plan is hidden");
  assert.match($(".view-build").textContent, /Writing the plan/);
  assert.equal(storedTrip().livePlan, null); assert.equal(storedTrip()._local.planHistory.at(-1).plan.optionId.length > 0, true);
  release({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "Morocco needs more thought." }] }); await tick(200);
  await go("#home"); assert.match($('.tripcard[data-act="open-trip"]').textContent, /Southern Morocco/);
});

test("the live plan in the tabs: edit a status, a gear cell, a to-do; Money totals follow; a plan chat change updates them", async () => {
  await import("../src/main.js");
  const { planInput } = await import("./plan-fixtures.mjs");
  const { planTotals } = await import("../src/liveplan.js"); const { fmtMoney } = await import("../src/ui.js");
  await liveTripWithOptions();
  const input = planInput(); input.bookings.push({ id: "b_whale", what: "Whale trip", category: "activity", pick: "", alternative: "", price: 90, currency: "USD", seenOn: "2026-11-09", status: "idea", link: null, bookBy: null, details: "", source: null });
  fakeApi = async () => toolReply("write_plan", input, "Here is your plan.");
  click(chooseBtn("La Palma")); await tick(300);
  // Build: the days and the gear, one column per traveller
  assert.equal(window.document.querySelectorAll(".daytable tbody tr").length, 2);
  const heads = [...window.document.querySelectorAll(".geartable thead th")].map(th => th.textContent);
  assert.ok(heads.includes("Gabriel") && heads.includes("Situ"), heads.join("|"));
  const situ = storedTrip().travellers.find(p => p.name === "Situ").id;
  change($(`.geartable input[data-bind="livePlan.gear.#g_tent.per.${situ}"]`), "has one"); await tick(60);
  assert.equal(storedTrip().livePlan.gear[0].per[situ], "has one");
  assert.match($(".view-build").textContent, /Supermarket in Los Llanos/, "the food note shows under the gear");
  // Plan & book: mark the ferry booked; its to-do shows done
  await go("#plan");
  change($('select[data-bind="livePlan.bookings.#b_ferry.status"]'), "booked"); await tick(60);
  change($('input[data-bind="livePlan.bookings.#b_ferry.confirmation"]'), "ABC123"); await tick(60);
  const todo = [...window.document.querySelectorAll(".todolist li")].find(li => /Book Ferry/.test(li.textContent));
  assert.ok(todo && todo.classList.contains("done"), "the ferry to-do is done");
  assert.ok(/Caldera camping permit/.test($(".view-plan").textContent), "permits show");
  assert.ok(/Travel insurance/.test($(".view-plan").textContent), "Situ's admin shows");
  // Money: the plan total, and the USD booking named as missing
  await go("#money");
  const before = planTotals(storedTrip().livePlan, storedTrip()).total;
  assert.match($(".view-money").textContent, /Plan total/);
  assert.ok($(".view-money").textContent.includes(fmtMoney(before, "GBP")), "the plan total shows");
  assert.match($(".view-money").textContent, /No exchange rate[^]*Whale trip/);
  // Plan chat on Build: the campsite goes up to 40 EUR
  await go("#build");
  const nulls = Object.fromEntries(Object.keys(planInput()).map(k => [k, null]));
  fakeApi = async () => toolReply("update_plan", Object.assign(nulls, { bookings: input.bookings.map(b => b.id === "b_camp" ? Object.assign({}, b, { price: 40 }) : b.id === "b_ferry" ? Object.assign({}, b, { status: "idea" }) : b) }), "Updated.");
  $("#chatText").value = "the campsite is 40 now"; click($('[data-act="chat-send"]')); await tick(300);
  const after = storedTrip();
  assert.equal(planTotals(after.livePlan, after).total, before + Math.round(40 * 0.86) - Math.round(20 * 0.86));
  const ferry = after.livePlan.bookings.find(b => b.id === "b_ferry"); assert.equal(ferry.status, "booked"); assert.equal(ferry.confirmation, "ABC123");
  await go("#money"); assert.ok($(".view-money").textContent.includes(fmtMoney(planTotals(after.livePlan, after).total, "GBP")));
  // A library trip still shows the library picker
  await go("#home"); click($('[data-act="new-trip"][data-kind="hike"]')); await tick(150);
  await go("#build"); assert.ok($('select[data-act-change="pick-dest"]'), "library Build is unchanged"); assert.equal($(".daytable"), null);
});

test("review: a crafted share link with a hostile livePlan injects nothing", async () => {
  const { newTrip, encodeShare } = await import("../src/state.js");
  const { planInput } = await import("./plan-fixtures.mjs");
  const { normalizePlan } = await import("../src/liveplan.js");
  const t = newTrip("hike"); t.name = "Crafted plan";
  t.options = [{ id: "o_x", name: "<img id=pwn0 src=x>" }]; t.chosen = "o_x";
  const p = normalizePlan(planInput(), t, { optionId: "o_x" });
  p.bookings[0].what = "<img id=pwn1 src=x>"; p.days[0].move = "<img id=pwn2 src=x>"; p.days[0].night.name = "<img id=pwn3 src=x>";
  p.gear[0].name = "<img id=pwn4 src=x>"; p.food = "<img id=pwn5 src=x>"; p.bookings[1].link = "javascript:alert(1)";
  p.permits[0].what = "<img id=pwn6 src=x>"; p.todo[0].what = "<img id=pwn7 src=x>"; p.days[0].km = "<img id=pwn8 src=x>";
  t.livePlan = p;
  window.location.hash = "#" + encodeShare(t, window.LZString).replace(/^#/, ""); await tick(250);
  for (const h of ["#build", "#itinerary", "#plan", "#money", "#share", "#home"]) {
    await go(h); await tick(40);
    for (let n = 0; n <= 8; n++) assert.equal(window.document.getElementById("pwn" + n), null, `pwn${n} must not be an element on ${h}`);
    assert.equal(window.document.querySelector('a[href^="javascript"]'), null, h);
  }
  await go("#build"); assert.ok($(".daytable"), "the crafted plan still renders");
});

test("final I2: choosing another option asks first when the plan has bookings, and choosing back restores the plan", async () => {
  await import("../src/main.js");
  const { planInput } = await import("./plan-fixtures.mjs");
  await liveTripWithOptions();
  fakeApi = async () => toolReply("write_plan", planInput(), "Plan.");
  click(chooseBtn("La Palma")); await tick(300);
  await go("#plan"); change($('select[data-bind="livePlan.bookings.#b_ferry.status"]'), "booked"); await tick(60);
  const asked = []; window.confirm = msg => { asked.push(msg); return false; };
  await go("#setup"); click(chooseBtn("Southern Morocco")); await tick(200);
  assert.equal(asked.length, 1); assert.match(asked[0], /booked/);
  assert.equal(storedTrip().livePlan.bookings.find(b => b.id === "b_ferry").status, "booked", "kept when the person says no");
  window.confirm = () => true;
  fakeApi = async () => ({ stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "Morocco later." }] });
  click(chooseBtn("Southern Morocco")); await tick(300);
  let calls = 0; fakeApi = async () => { calls++; return { stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "x" }] }; };
  await go("#setup"); click(chooseBtn("La Palma")); await tick(300);
  assert.equal(calls, 0, "no new plan is asked for");
  assert.equal(storedTrip().livePlan.bookings.find(b => b.id === "b_ferry").status, "booked", "the La Palma plan is back");
  assert.ok($(".daytable"));
});

test("final I4 + M1: an edit in progress survives a finished turn and lands on the right row; a crafted id can't reach Object.prototype", async () => {
  await import("../src/main.js");
  const { planInput } = await import("./plan-fixtures.mjs");
  await liveTripWithOptions();
  fakeApi = async () => toolReply("write_plan", planInput(), "Plan.");
  click(chooseBtn("La Palma")); await tick(300);
  let release; fakeApi = () => new Promise(r => { release = r; });
  $("#chatText").value = "add a stove"; click($('[data-act="chat-send"]')); await tick(150);
  const situ = storedTrip().travellers.find(p => p.name === "Situ").id;
  const cell = $(`.geartable input[data-bind="livePlan.gear.#g_tent.per.${situ}"]`); cell.focus(); cell.value = "borrowing one";
  const nulls = Object.fromEntries(Object.keys(planInput()).map(k => [k, null]));
  release(toolReply("update_plan", Object.assign(nulls, { gear: [{ id: "g_stove", name: "Stove", note: "" }, { id: "g_tent", name: "Tent", note: "" }] })));
  await tick(300);
  assert.equal(window.document.activeElement, cell, "the page did not re-render under the person typing"); assert.equal(cell.value, "borrowing one");
  cell.dispatchEvent(new window.Event("change", { bubbles: true })); cell.blur(); await tick(200);
  const gear = storedTrip().livePlan.gear;
  assert.equal(gear.find(g => g.id === "g_tent").per[situ], "borrowing one"); assert.equal(gear.find(g => g.id === "g_stove").per[situ], undefined);
  assert.ok($(".geartable").textContent.includes("Stove"), "the page re-rendered once the edit was done");
  // a crafted traveller id
  const { newTrip, encodeShare } = await import("../src/state.js"); const { normalizePlan } = await import("../src/liveplan.js");
  const t = newTrip("hike"); t.travellers = [{ id: "__proto__.polluted", name: "Trap", limits: {} }]; t.options = [{ id: "o_x", name: "X" }]; t.chosen = "o_x";
  t.livePlan = normalizePlan(planInput({ admin: [] }), t, { optionId: "o_x" });
  window.location.hash = "#" + encodeShare(t, window.LZString).replace(/^#/, ""); await tick(250);
  await go("#build"); const trap = $(".geartable input"); assert.ok(trap);
  change(trap, "yes"); await tick(100);
  assert.equal(({}).polluted, undefined, "Object.prototype is untouched");
});
