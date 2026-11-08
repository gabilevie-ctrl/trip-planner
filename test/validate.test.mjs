import test from "node:test"; import assert from "node:assert/strict";
import { createRequire } from "node:module";
import fs from "node:fs";
import { dest } from "./helpers.mjs";
const require = createRequire(import.meta.url);
const { checkDestination } = require("../scripts/lib/check-destination.cjs");
const index = JSON.parse(fs.readFileSync(new URL("../data/index.json", import.meta.url), "utf8"));
const TODAY = { today: "2026-11-08" };

function norway(over = {}) {
  return Object.assign(dest("norway"), { sources: [{ name: "Visit Norway", url: "https://www.visitnorway.com/" }], lastReviewed: "2026-11-08" }, over);
}
const entry = (over = {}) => Object.assign({}, index.find(e => e.id === "norway"), over);

test("valid destination passes", () => {
  assert.deepEqual(checkDestination(norway(), "norway.json", entry(), TODAY), []);
});

test("rejects malformed sources and dates", () => {
  assert.ok(checkDestination(norway({ sources: [{ name: "x" }] }), "norway.json", entry(), TODAY).includes("sources[0]: url must start with https://"));
  assert.ok(checkDestination(norway({ sources: [{ url: "https://a.example/" }] }), "norway.json", entry(), TODAY).includes("sources[0]: name missing"));
  assert.ok(checkDestination(norway({ sources: "none" }), "norway.json", entry(), TODAY).includes("sources must be an array"));
  for (const bad of ["2026-13-01", "2026-02-30", "8 Nov 2026", undefined]) {
    assert.ok(checkDestination(norway({ lastReviewed: bad }), "norway.json", entry(), TODAY).includes("lastReviewed is not a valid date"), String(bad));
  }
});

test("lastReviewed must not be in the future or older than 18 months", () => {
  assert.ok(checkDestination(norway({ lastReviewed: "2026-11-09" }), "norway.json", entry(), TODAY).includes("lastReviewed is in the future"));
  assert.ok(checkDestination(norway({ lastReviewed: "2025-05-07" }), "norway.json", entry(), TODAY).includes("lastReviewed older than 18 months"));
  assert.deepEqual(checkDestination(norway({ lastReviewed: "2025-05-08" }), "norway.json", entry(), TODAY), []);
});

test("fitByMonth must have 12 values", () => {
  const msg = "season.fitByMonth must have 12 numbers 0–100";
  const fit = n => norway({ season: Object.assign({}, dest("norway").season, { fitByMonth: n }) });
  assert.ok(checkDestination(fit(Array(11).fill(50)), "norway.json", entry(), TODAY).includes(msg));
  assert.ok(checkDestination(fit([...Array(11).fill(50), 101]), "norway.json", entry(), TODAY).includes(msg));
  assert.ok(checkDestination(fit(undefined), "norway.json", entry(), TODAY).includes(msg));
});

test("index entry must match", () => {
  assert.ok(checkDestination(norway(), "norway.json", entry({ name: "Other" }), TODAY).includes("index.json name differs from file"));
  assert.ok(checkDestination(norway(), "norway.json", entry({ kind: "hike" }), TODAY).includes("index.json kind differs from file"));
  assert.ok(checkDestination(norway(), "norway.json", undefined, TODAY).includes("not listed in data/index.json"));
});

test("empty sources fails only in strict mode", () => {
  assert.deepEqual(checkDestination(norway({ sources: [] }), "norway.json", entry(), { ...TODAY, strict: false }), []);
  assert.ok(checkDestination(norway({ sources: [] }), "norway.json", entry(), { ...TODAY, strict: true }).includes("sources is empty"));
});

test("existing block checks still apply", () => {
  const d = norway(); d.blocks[0] = Object.assign({}, d.blocks[0], { type: "spa" });
  assert.ok(checkDestination(d, "norway.json", entry(), TODAY).some(m => m.endsWith("bad type spa")));
});
