import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import vm from "node:vm";
const lzSandbox = { module: { exports: {} } }; lzSandbox.exports = lzSandbox.module.exports; vm.runInNewContext(fs.readFileSync(new URL("../vendor/lz-string.min.js", import.meta.url), "utf8"), lzSandbox); const lz = lzSandbox.module.exports;
import { encodeShare, decodeShare, newTrip, migrate, stripForShare } from "../src/state.js";
import { familyTrip } from "./helpers.mjs";

test("share link round-trips a trip and uses only letters, digits and hyphens", () => {
  const t = familyTrip(); t.expenses.push({ id: "e1", desc: "Deposit", amount: 123.45, paidBy: "p1", split: ["p1", "p2"], status: "paid", category: "Huts", date: "2026-11-08" });
  const h = encodeShare(t, lz); assert.match(h, /^s-[A-Za-z0-9-]+$/);
  const back = decodeShare(h, lz); assert.deepEqual(back, t);
});
test("migrate fills new fields on an old trip", () => { const old = { id: "x", kind: "hike", name: "AV2" }; const t = migrate(old); assert.ok(Array.isArray(t.expenses)); assert.equal(t.travel.mode, "any"); assert.equal(newTrip("skitour").kind, "skitour"); });

test("new trips carry the live-planning fields", () => {
  const t = newTrip("hike");
  assert.deepEqual(t.options, []); assert.equal(t.livePlan, null); assert.deepEqual(t.rates, {});
});
test("migrate adds live fields to an old trip without touching the rest", () => {
  const old = familyTrip(); delete old.options; delete old.rates;
  migrate(old); assert.deepEqual(old.options, []); assert.deepEqual(old.rates, {}); assert.equal(old.livePlan, null); assert.equal(old.name, "Parents' 30th");
});
test("share strips device-only history but keeps options and rates", () => {
  const t = newTrip(); t.options = [{ id: "o_1", name: "La Palma" }]; t.rates = { GBP: { toTrip: 1.17, seenOn: "2026-11-09", source: null } };
  t._local = { optionHistory: [{ at: "x", options: [] }] };
  const s = stripForShare(t); assert.equal(s._local, undefined); assert.equal(s.options[0].name, "La Palma"); assert.equal(s.rates.GBP.toTrip, 1.17);
});
