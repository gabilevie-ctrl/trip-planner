#!/usr/bin/env node
// Validates data/destinations/*.json against the phase-0 shape. Exits 1 on problems.
const fs = require("fs"), path = require("path");
const dir = path.join(__dirname, "..", "data", "destinations");
const index = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "data", "index.json"), "utf8"));
let problems = 0;
const warn = (f, m) => { problems++; console.log(`${f}: ${m}`); };
const ids = new Set();
for (const f of fs.readdirSync(dir).filter(x => x.endsWith(".json"))) {
  const d = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
  if (!d.id || d.id + ".json" !== f) warn(f, "id does not match filename");
  if (ids.has(d.id)) warn(f, "duplicate id"); ids.add(d.id);
  for (const k of ["name", "region", "zone", "access", "rates", "blocks", "presets", "season"]) if (!(k in d)) warn(f, `missing ${k}`);
  if (!["europe", "asia", "americas", "africa", "oceania"].includes(d.zone)) warn(f, `bad zone ${d.zone}`);
  const bids = new Set();
  for (const b of d.blocks || []) {
    if (bids.has(b.id)) warn(f, `duplicate block ${b.id}`); bids.add(b.id);
    if (!["city", "hike", "stage", "beach", "wildlife", "rest"].includes(b.type)) warn(f, `block ${b.id}: bad type ${b.type}`);
    if (!(b.minDays <= b.defaultDays && b.defaultDays <= b.maxDays)) warn(f, `block ${b.id}: days out of order`);
    if (typeof b.maxAltitudeM !== "number") warn(f, `block ${b.id}: maxAltitudeM missing`);
    if (!["low", "med", "high"].includes(b.crowd)) warn(f, `block ${b.id}: bad crowd ${b.crowd}`);
    if (typeof b.transitHours !== "number") warn(f, `block ${b.id}: transitHours missing`);
  }
  for (const p of d.presets || []) for (const k of Object.keys(p.picks)) if (!bids.has(k)) warn(f, `preset "${p.name}" references unknown block ${k}`);
  if (!index.find(x => x.id === d.id)) warn(f, "not listed in data/index.json");
}
console.log(problems ? `${problems} problem(s)` : `OK: ${ids.size} destinations valid`);
process.exit(problems ? 1 : 0);
