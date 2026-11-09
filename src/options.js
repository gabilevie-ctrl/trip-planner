// Live options from Claude: the tool Claude fills, cleaning its input, and checking each option against the
// trip's limits with the library's wording. Pure module: no DOM, no network.
import { strictestLimits, countriesOutside, COUNTRY_ZONE_LABEL, COUNTRY_GROUPS } from "./criteria.js";
import { andList, countryName } from "./compute.js";
import { fmtMoney } from "./ui.js";
import { uid } from "./state.js";

const MAX_OPTIONS = 8;
const MODES = ["flight", "train", "ferry", "drive", "bus"];
const LODGING_TYPES = ["camping", "hut", "hostel", "guesthouse", "hotel", "apartment", "other"];
// Europe for the "Europe" country limit: EU, Schengen, and the rest of the continent's states.
const EUROPE = new Set([...COUNTRY_GROUPS.eu, ...COUNTRY_GROUPS.schengen, "GB", "IE", "AL", "BA", "ME", "MK", "RS", "MD", "UA", "AD", "MC", "SM", "VA", "GI"]);

/* ---------- The tool Claude calls ---------- */
const obj = properties => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
const S = { type: "string" }, N = { type: "number" }, NN = { type: ["number", "null"] }, B = { type: "boolean" };
const SOURCE = obj({ name: S, url: S, seenOn: S });
const MAYBE_SOURCE = { anyOf: [SOURCE, { type: "null" }] };
const OPTION = obj({
  name: S, region: S, countryCodes: { type: "array", items: S, description: "ISO 3166-1 alpha-2 codes" },
  lat: NN, lon: NN, why: S,
  weather: obj({ text: S, highC: NN, lowC: NN, source: MAYBE_SOURCE }),
  maxAltitudeM: NN, activities: { type: "array", items: S },
  access: obj({ from: S, mode: { type: "string", enum: MODES }, time: S, connections: S, pricePP: NN, currency: S, seenOn: S, source: MAYBE_SOURCE }),
  lodging: { type: "array", items: obj({ type: { type: "string", enum: LODGING_TYPES }, low: NN, high: NN, currency: S }) },
  estimate: obj({ perPerson: NN, group: NN, currency: S, breakdown: { type: "array", items: obj({ what: S, amount: N }) } }),
  tradeOff: S, pick: B, mention: B, mentionWhy: { type: ["string", "null"] },
  sources: { type: "array", items: SOURCE }
});
export const OPTIONS_TOOL = {
  name: "propose_options",
  description: "Save the shortlist of destination options for this trip so the app can show them as cards and check them against every traveller's limits. Call it whenever you suggest or revise options. Prices stay in their original currency; give a rate to the trip currency for every other currency used.",
  strict: true,
  input_schema: obj({
    options: { type: "array", items: OPTION },
    rates: { type: "array", items: obj({ currency: S, toTrip: N, seenOn: S, source: MAYBE_SOURCE }) }
  })
};

/* ---------- Cleaning Claude's input ---------- */
const isObj = v => v && typeof v === "object" && !Array.isArray(v);
const str = v => typeof v === "string" ? v.trim() : "";
const num = v => { if (typeof v === "number" && Number.isFinite(v)) return v; if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v); return null; };
const day = (v, today) => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : today;
const cur = v => /^[A-Za-z]{3}$/.test(str(v)) ? str(v).toUpperCase() : "";
const https = v => { try { const u = new URL(str(v)); return u.protocol === "https:" ? u.toString() : null; } catch (e) { return null; } };
function source(s, today) { if (!isObj(s)) return null; const url = https(s.url); if (!url) return null; return { name: str(s.name) || new URL(url).hostname, url, seenOn: day(s.seenOn, today) }; }
const list = (v, f) => Array.isArray(v) ? v.map(f).filter(x => x !== null && x !== undefined && x !== "") : [];

function cleanOption(o, today) {
  if (!isObj(o) || !str(o.name)) return null;
  const w = isObj(o.weather) ? o.weather : {}, a = isObj(o.access) ? o.access : {}, e = isObj(o.estimate) ? o.estimate : {};
  return {
    id: uid("o"), name: str(o.name), region: str(o.region),
    countryCodes: list(o.countryCodes, c => /^[A-Za-z]{2}$/.test(str(c)) ? str(c).toUpperCase() : null),
    lat: num(o.lat), lon: num(o.lon), why: str(o.why),
    weather: { text: str(w.text), highC: num(w.highC), lowC: num(w.lowC), source: source(w.source, today) },
    maxAltitudeM: num(o.maxAltitudeM), activities: list(o.activities, str),
    access: { from: str(a.from), mode: MODES.includes(a.mode) ? a.mode : null, time: str(a.time), connections: str(a.connections), pricePP: num(a.pricePP), currency: cur(a.currency), seenOn: day(a.seenOn, today), source: source(a.source, today) },
    lodging: list(o.lodging, l => isObj(l) ? { type: LODGING_TYPES.includes(l.type) ? l.type : "other", low: num(l.low), high: num(l.high), currency: cur(l.currency) } : null),
    estimate: { perPerson: num(e.perPerson), group: num(e.group), currency: cur(e.currency), breakdown: list(e.breakdown, b => isObj(b) && str(b.what) ? { what: str(b.what), amount: num(b.amount) } : null) },
    tradeOff: str(o.tradeOff), pick: o.pick === true, mention: o.mention === true, mentionWhy: str(o.mentionWhy) || null,
    sources: list(o.sources, s => source(s, today))
  };
}

/* Clean Claude's propose_options input; returns the options and the trip's rates with the new ones merged in. */
export function normalizeOptions(input, trip, { today = new Date().toISOString().slice(0, 10) } = {}) {
  const options = list(isObj(input) ? input.options : null, o => cleanOption(o, today)).slice(0, MAX_OPTIONS);
  const first = options.findIndex(o => o.pick);
  const pickAt = first >= 0 ? first : Math.max(0, options.findIndex(o => !o.mention));
  options.forEach((o, i) => { o.pick = i === pickAt; });
  const rates = Object.assign({}, trip.rates || {});
  for (const r of isObj(input) && Array.isArray(input.rates) ? input.rates : []) {
    if (!isObj(r)) continue; const c = cur(r.currency), v = num(r.toTrip);
    if (c && v && v > 0) rates[c] = { toTrip: v, seenOn: day(r.seenOn, today), source: source(r.source, today) };
  }
  return { options, rates };
}

/* ---------- Checks ---------- */
export function toTripCurrency(amount, currency, trip) {
  if (amount === null || amount === undefined || !Number.isFinite(amount)) return null;
  const tc = trip.budget?.currency || "EUR";
  if (!currency || currency === tc) return amount;
  const r = trip.rates?.[currency]; return r && r.toTrip ? Math.round(amount * r.toTrip) : null;
}

export function checkOption(option, trip) {
  const limits = strictestLimits(trip); const flags = [];
  const codes = option.countryCodes || [];
  const destZone = codes.length && codes.every(c => EUROPE.has(c)) ? "europe" : "other";
  let countryBreach = false;
  for (const zone of limits.countryZone || []) {
    const out = countriesOutside(codes, zone, destZone);
    if (out.length) { countryBreach = true; flags.push(`${andList(out.map(countryName))} ${out.length > 1 ? "are" : "is"} outside ${COUNTRY_ZONE_LABEL[zone]}`); }
  }
  const high = option.weather?.highC;
  if (typeof high === "number") {
    if (limits.minDayHighC !== undefined && high < limits.minDayHighC) flags.push(`${option.name}: ~${high}°C in those months, below the ${limits.minDayHighC}°C floor`);
    if (limits.maxDayHighC && high > limits.maxDayHighC) flags.push(`${option.name}: ~${high}°C is above the ${limits.maxDayHighC}°C ceiling`);
  }
  if (limits.maxAltitudeM && option.maxAltitudeM > limits.maxAltitudeM) flags.push(`${option.name}: ${option.maxAltitudeM.toLocaleString("en-GB")} m is above the ${limits.maxAltitudeM.toLocaleString("en-GB")} m ceiling`);
  if (trip.travel?.mode === "train" && option.access?.mode === "flight") flags.push("Reaching this destination needs a flight; the trip is set to trains only");
  const est = option.estimate || {}; const tc = trip.budget?.currency || "EUR";
  const groupTotal = toTripCurrency(est.group, est.currency, trip);
  const missingRates = est.group !== null && est.group !== undefined && groupTotal === null && est.currency ? [est.currency] : [];
  if (missingRates.length) flags.push(`No exchange rate for ${est.currency} yet; the total is left out`);
  const budget = trip.budget?.total || 0;
  const overBudget = groupTotal !== null && budget > 0 && groupTotal > budget;
  if (overBudget) flags.push(`About ${fmtMoney(groupTotal, tc)} for the group, over the ${fmtMoney(budget, tc)} budget`);
  return { flags, countryBreach, overBudget, groupTotal, missingRates };
}
