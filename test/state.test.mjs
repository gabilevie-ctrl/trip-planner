import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import vm from "node:vm";
const lzSandbox = { module: { exports: {} } }; lzSandbox.exports = lzSandbox.module.exports; vm.runInNewContext(fs.readFileSync(new URL("../vendor/lz-string.min.js", import.meta.url), "utf8"), lzSandbox); const lz = lzSandbox.module.exports;
import { encodeShare, decodeShare, newTrip, migrate } from "../src/state.js";
import { familyTrip } from "./helpers.mjs";

test("share link round-trips a trip and uses only letters, digits and hyphens", () => {
  const t = familyTrip(); t.expenses.push({ id: "e1", desc: "Deposit", amount: 123.45, paidBy: "p1", split: ["p1", "p2"], status: "paid", category: "Huts", date: "2026-11-08" });
  const h = encodeShare(t, lz); assert.match(h, /^s-[A-Za-z0-9-]+$/);
  const back = decodeShare(h, lz); assert.deepEqual(back, t);
});
test("migrate fills new fields on an old trip", () => { const old = { id: "x", kind: "hike", name: "AV2" }; const t = migrate(old); assert.ok(Array.isArray(t.expenses)); assert.equal(t.travel.mode, "any"); assert.equal(newTrip("skitour").kind, "skitour"); });
