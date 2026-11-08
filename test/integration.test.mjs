import test from "node:test"; import assert from "node:assert/strict";
import { JSDOM } from "jsdom"; import fs from "node:fs"; import vm from "node:vm";
const dom = new JSDOM(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), { url: "https://example.test/index.html#home", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["document", "window", "location", "localStorage", "HTMLElement", "FormData", "Event", "CustomEvent"]) { try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } catch (e) {} }
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
import { fileURLToPath } from "node:url";
globalThis.fetch = async (u) => { const url = new URL(String(u)); const file = url.protocol === "file:" ? fileURLToPath(url) : fileURLToPath(new URL("../" + url.pathname.replace(/^\//, ""), import.meta.url)); return { ok: fs.existsSync(file), json: async () => JSON.parse(fs.readFileSync(file, "utf8")) }; };
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
