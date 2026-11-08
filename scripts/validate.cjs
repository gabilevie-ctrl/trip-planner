#!/usr/bin/env node
// Validates data/destinations/*.json with scripts/lib/check-destination.cjs. Exits 1 on problems.
// --strict also fails destinations that list no sources (required for new destinations).
const fs = require("fs"), path = require("path");
const { checkDestination } = require("./lib/check-destination.cjs");
const strict = process.argv.includes("--strict");
const dir = path.join(__dirname, "..", "data", "destinations");
const index = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "index.json"), "utf8"));
let problems = 0, noSources = 0;
const ids = new Set();
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json")).sort()) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  const found = checkDestination(d, f, index.find(x => x.id === d.id), { strict });
  if (ids.has(d.id)) found.push("duplicate id"); ids.add(d.id);
  for (const m of found) { problems++; console.log(`${f}: ${m}`); }
  if (Array.isArray(d.sources) && d.sources.length === 0) noSources++;
}
for (const e of index) if (!ids.has(e.id)) { problems++; console.log(`data/index.json: ${e.id} has no file in data/destinations/`); }
if (noSources && !strict) console.log(`${noSources} destinations have no sources yet`);
console.log(problems ? `${problems} problem(s)` : `OK: ${ids.size} destinations valid`);
process.exit(problems ? 1 : 0);
