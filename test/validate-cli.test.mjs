import test from "node:test"; import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import fs from "node:fs"; import os from "node:os"; import path from "node:path";
const script = new URL("../scripts/validate.cjs", import.meta.url).pathname;
const run = (...args) => spawnSync(process.execPath, [script, ...args], { encoding: "utf8" });
const tmp = () => fs.mkdtempSync(path.join(os.tmpdir(), "tp-validate-"));
const norway = () => JSON.parse(fs.readFileSync(new URL("../data/destinations/norway.json", import.meta.url), "utf8"));

test("a file that is not valid JSON is named and the run carries on", () => {
  const f = path.join(tmp(), "norway.json"); fs.writeFileSync(f, "{ not json");
  const r = run(f); assert.equal(r.status, 1); assert.match(r.stdout, /norway\.json: invalid JSON/);
});

test("strict mode checks only the files given", () => {
  const good = Object.assign(norway(), { sources: [{ name: "Visit Norway", url: "https://www.visitnorway.com/" }], lastReviewed: new Date().toISOString().slice(0, 10) });
  const f = path.join(tmp(), "norway.json"); fs.writeFileSync(f, JSON.stringify(good));
  const ok = run("--strict", f); assert.equal(ok.status, 0, ok.stdout); assert.match(ok.stdout, /OK: 1 destinations valid/);
  fs.writeFileSync(f, JSON.stringify(Object.assign(good, { sources: [] })));
  const bad = run("--strict", f); assert.equal(bad.status, 1); assert.match(bad.stdout, /norway\.json: sources is empty/);
});

test("with no files, the whole library is checked", () => {
  const r = run(); assert.equal(r.status, 0, r.stdout); assert.match(r.stdout, /OK: 38 destinations valid/);
});
