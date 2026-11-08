// Checks one destination file. Pure: returns a list of problem messages, empty when valid.
const ZONES = ["europe", "asia", "americas", "africa", "oceania"];
const BLOCK_TYPES = ["city", "hike", "stage", "beach", "wildlife", "rest"];
const CROWDS = ["low", "med", "high"];
const MAX_AGE_MONTHS = 18;

function parseDate(s) {
  const m = typeof s === "string" && s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const [y, mo, d] = [+m[1], +m[2], +m[3]];
  const t = new Date(Date.UTC(y, mo - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === mo - 1 && t.getUTCDate() === d ? t : null;
}

const isObject = v => v !== null && typeof v === "object" && !Array.isArray(v);
// A field that must be a list: reports it once and returns [] so the checks after it still run.
function listOf(d, key, out) {
  if (!(key in d)) return [];
  if (!Array.isArray(d[key])) { out.push(`${key} must be an array`); return []; }
  return d[key];
}

function checkDestination(d, file, indexEntry, { today = new Date().toISOString().slice(0, 10), strict = false } = {}) {
  const out = [];
  if (!d.id || d.id + ".json" !== file) out.push("id does not match filename");
  for (const k of ["name", "region", "zone", "access", "rates", "blocks", "presets", "season"]) if (!(k in d)) out.push(`missing ${k}`);
  if (!ZONES.includes(d.zone)) out.push(`bad zone ${d.zone}`);

  const bids = new Set();
  const blocks = listOf(d, "blocks", out), presets = listOf(d, "presets", out);
  blocks.forEach((b, i) => {
    if (!isObject(b)) { out.push(`blocks[${i}] is not an object`); return; }
    if (bids.has(b.id)) out.push(`duplicate block ${b.id}`); bids.add(b.id);
    if (!BLOCK_TYPES.includes(b.type)) out.push(`block ${b.id}: bad type ${b.type}`);
    if (!(b.minDays <= b.defaultDays && b.defaultDays <= b.maxDays)) out.push(`block ${b.id}: days out of order`);
    if (typeof b.maxAltitudeM !== "number") out.push(`block ${b.id}: maxAltitudeM missing`);
    if (!CROWDS.includes(b.crowd)) out.push(`block ${b.id}: bad crowd ${b.crowd}`);
    if (typeof b.transitHours !== "number") out.push(`block ${b.id}: transitHours missing`);
  });
  presets.forEach((p, i) => {
    if (!isObject(p)) { out.push(`presets[${i}] is not an object`); return; }
    for (const k of Object.keys(isObject(p.picks) ? p.picks : {})) if (!bids.has(k)) out.push(`preset "${p.name}" references unknown block ${k}`);
  });

  const fit = d.season && d.season.fitByMonth;
  if (!Array.isArray(fit) || fit.length !== 12 || !fit.every(v => typeof v === "number" && v >= 0 && v <= 100)) out.push("season.fitByMonth must have 12 numbers 0–100");

  const reviewed = parseDate(d.lastReviewed), now = parseDate(today);
  if (!reviewed) out.push("lastReviewed is not a valid date");
  else if (reviewed > now) out.push("lastReviewed is in the future");
  else {
    const cutoff = new Date(now); cutoff.setUTCMonth(cutoff.getUTCMonth() - MAX_AGE_MONTHS);
    if (reviewed < cutoff) out.push(`lastReviewed older than ${MAX_AGE_MONTHS} months`);
  }

  if (!Array.isArray(d.sources)) out.push("sources must be an array");
  else {
    d.sources.forEach((s, i) => {
      if (!s || typeof s.name !== "string" || !s.name.trim()) out.push(`sources[${i}]: name missing`);
      if (!s || typeof s.url !== "string" || !s.url.startsWith("https://")) out.push(`sources[${i}]: url must start with https://`);
    });
    if (strict && d.sources.length === 0) out.push("sources is empty");
  }

  if (!indexEntry) out.push("not listed in data/index.json");
  else for (const k of ["kind", "name", "zone"]) if (indexEntry[k] !== d[k]) out.push(`index.json ${k} differs from file`);
  return out;
}

module.exports = { checkDestination, parseDate };
