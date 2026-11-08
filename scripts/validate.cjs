#!/usr/bin/env node
// Validates destination files with scripts/lib/check-destination.cjs. Exits 1 on problems.
//   node scripts/validate.cjs                     every file in data/destinations/
//   node scripts/validate.cjs <file.json> …       only those files (use this for a new destination)
//   --strict                                      also fail files that list no sources
const fs = require("fs"), path = require("path");
const { checkDestination } = require("./lib/check-destination.cjs");
const args = process.argv.slice(2);
const strict = args.includes("--strict");
const given = args.filter(a => a !== "--strict");
const dir = path.join(__dirname, "..", "data", "destinations");
const index = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "index.json"), "utf8"));
const files = given.length ? given : fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort().map(f => path.join(dir, f));
let problems = 0, noSources = 0;
const ids = new Set();
const report = (f, m) => { problems++; console.log(`${f}: ${m}`); };
for (const file of files) {
  const f = path.basename(file);
  let d;
  try { d = JSON.parse(fs.readFileSync(file, "utf8")); } catch (e) { report(f, e.code === "ENOENT" ? "file not found" : `invalid JSON (${e.message})`); continue; }
  if (d === null || typeof d !== "object" || Array.isArray(d)) { report(f, "not a JSON object"); continue; }
  const found = checkDestination(d, f, index.find(x => x.id === d.id), { strict });
  if (ids.has(d.id)) found.push("duplicate id"); ids.add(d.id);
  for (const m of found) report(f, m);
  if (Array.isArray(d.sources) && d.sources.length === 0) noSources++;
}
if (!given.length) for (const e of index) if (!ids.has(e.id)) report("data/index.json", `${e.id} has no file in data/destinations/`);
if (noSources && !strict) console.log(`${noSources} destinations have no sources yet`);
console.log(problems ? `${problems} problem(s)` : `OK: ${ids.size} destinations valid`);
process.exit(problems ? 1 : 0);
