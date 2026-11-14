// The app served by `npm run family` on this Mac: live search goes through the helper, with no password.
import test from "node:test"; import assert from "node:assert/strict";
import { JSDOM } from "jsdom"; import fs from "node:fs"; import vm from "node:vm"; import { fileURLToPath } from "node:url";
const dom = new JSDOM(fs.readFileSync(new URL("../index.html", import.meta.url), "utf8"), { url: "http://localhost:8787/index.html#home", pretendToBeVisual: true });
const { window } = dom;
for (const k of ["document", "window", "location", "localStorage", "HTMLElement", "FormData", "Event", "CustomEvent"]) { try { Object.defineProperty(globalThis, k, { value: window[k], configurable: true, writable: true }); } catch (e) {} }
Object.defineProperty(globalThis, "navigator", { value: window.navigator, configurable: true });
const asked = []; let anthropicCalls = 0;
const option = (name, over = {}) => Object.assign({ name, region: "", countryCodes: ["ES"], lat: null, lon: null, why: "Warm", weather: { text: "21 °C", highC: 21, lowC: 14, source: null }, maxAltitudeM: null, activities: [], access: { from: "London", mode: "flight", time: "4h", connections: "", pricePP: 80, currency: "GBP", seenOn: "2026-11-13", source: null }, lodging: [], estimate: { perPerson: 500, group: 1000, currency: "GBP", breakdown: [] }, tradeOff: "", pick: false, mention: false, mentionWhy: null, sources: [] }, over);
globalThis.fetch = async (u, init) => {
  const url = new URL(String(u), "http://localhost:8787/");
  if (url.hostname === "api.anthropic.com") { anthropicCalls++; return { ok: false, status: 500, text: async () => "" }; }
  if (url.pathname === "/api/claude/status") return { ok: true, status: 200, json: async () => ({ ok: true }), text: async () => JSON.stringify({ ok: true }) };
  if (url.pathname === "/api/claude/ask") { asked.push(JSON.parse(init.body)); const body = { ok: true, text: "La Palma is my pick.", toolCalls: [{ name: "propose_options", input: { options: [option("La Palma", { pick: true }), option("Madeira", { countryCodes: ["PT"] })], rates: [] } }], searches: 0, usage: {} }; return { ok: true, status: 200, text: async () => JSON.stringify(body), json: async () => body }; }
  if (url.pathname.endsWith("/data/claude-key.json")) return { ok: false, status: 404, json: async () => null };
  const file = url.protocol === "file:" ? fileURLToPath(url) : fileURLToPath(new URL("../" + url.pathname.replace(/^\//, ""), import.meta.url));
  return { ok: fs.existsSync(file), status: fs.existsSync(file) ? 200 : 404, json: async () => JSON.parse(fs.readFileSync(file, "utf8")) };
};
const sb = { module: { exports: {} } }; sb.exports = sb.module.exports; vm.runInNewContext(fs.readFileSync(new URL("../vendor/lz-string.min.js", import.meta.url), "utf8"), sb); window.LZString = sb.module.exports;
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const $ = s => window.document.querySelector(s);
const click = el => el.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));

test("on this Mac, live search runs through Claude Code with no password, and says so", async () => {
  await import("../src/main.js"); await tick(150);
  click($('[data-act="new-trip"][data-kind="explore"]')); await tick(200);
  assert.equal($("#livePass"), null, "no password card");
  assert.match($(".livestatus").textContent, /Claude Code on this Mac/);
  assert.equal($('[data-act="live-forget"]'), null, "nothing to forget on this device");
  $("#chatText").value = "warm hiking in January from London"; click($('[data-act="chat-send"]')); await tick(250);
  assert.equal(asked.length, 1); assert.equal(anthropicCalls, 0, "the API is never called");
  assert.match(asked[0].messages.at(-1).content, /warm hiking in January/);
  assert.equal(window.document.querySelectorAll(".optcard").length, 2);
  assert.match($(".thread").textContent, /La Palma is my pick\./);
});
