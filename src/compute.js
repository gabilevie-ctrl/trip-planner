// Plan computation: days, costs, flags and the day-by-day itinerary for one destination in one trip.
// Pure module: no DOM.
import { strictestLimits, gradeRank, selectedBlocks, LODGING, countriesOutside, COUNTRY_ZONE_LABEL } from "./criteria.js";
let regionNames = null; try { regionNames = new Intl.DisplayNames(["en"], { type: "region" }); } catch (e) { /* older browsers: show codes */ }
const countryName = code => { try { return (regionNames && regionNames.of(code)) || code; } catch (e) { return code; } };
const andList = xs => xs.length < 2 ? xs.join("") : xs.slice(0, -1).join(", ") + " and " + xs[xs.length - 1];

export const CONTINGENCY = 0.08;
const DAY = 86400000;
export const isoToDate = iso => { const [y, m, d] = iso.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d)); };
export const dateToIso = d => d.toISOString().slice(0, 10);
export const addDays = (d, n) => new Date(d.getTime() + n * DAY);
export function tripLength(trip) { if (!trip.dates?.start || !trip.dates?.end) return 0; return Math.round((isoToDate(trip.dates.end) - isoToDate(trip.dates.start)) / DAY) + 1; }
export function travellers(trip) { return Math.max(1, (trip.travellers || []).length || trip.partySize || 1); }

/* A destination counts as visited when it is ticked by id or when any of its countries is in the visited list. */
export function isVisited(dest, trip) { if ((trip.visited || []).includes(dest.id)) return true; const vc = trip.visitedCountries || []; return (dest.countries || []).some(c => vc.includes(c)); }

/* Access entry for the trip's origin, with a fallback and a note when none matches. */
export function accessFor(dest, trip) {
  const list = dest.access || [];
  const city = trip.origin?.city, region = trip.origin?.region;
  let a = list.find(x => x.originCity && city && x.originCity.toLowerCase() === city.toLowerCase());
  let approx = false;
  if (!a) { a = list.find(x => x.originRegion === region) || list[0]; approx = true; }
  if (!a) return { mode: "flight", costPerPerson: 0, route: "No access data", approx: true };
  return Object.assign({ approx }, a);
}

/* Make sure a plan exists for this destination in the trip; default to the first preset. */
export function ensurePlan(trip, dest) {
  trip.plans = trip.plans || {};
  let p = trip.plans[dest.id];
  if (!p) { p = applyPreset(dest, 0); trip.plans[dest.id] = p; }
  for (const b of dest.blocks) if (!p.picks[b.id]) p.picks[b.id] = { on: false, days: b.defaultDays };
  return p;
}
export function applyPreset(dest, idx) {
  const preset = dest.presets[idx] || { picks: {} };
  const picks = {};
  for (const b of dest.blocks) picks[b.id] = preset.picks[b.id] ? { on: true, days: preset.picks[b.id] } : { on: false, days: b.defaultDays };
  const order = dest.blocks.map(b => b.id);
  return { presetIdx: idx, picks, order, rest: dest.kind === "explore" ? 2 : 1, guided: false };
}

function flightFactor(trip) {
  // Rough seasonal factor on access cost by departure month.
  const m = trip.dates?.start ? isoToDate(trip.dates.start).getUTCMonth() + 1 : 7;
  return ({ 1: 0.85, 2: 0.9, 3: 0.95, 4: 1.0, 5: 0.95, 6: 1.0, 7: 1.05, 8: 1.0, 9: 0.95, 10: 0.9, 11: 0.85, 12: 1.05 })[m] || 1;
}

const OUTDOOR = new Set(["hike", "beach", "wildlife", "stage"]);

export function computePlan(dest, trip) {
  const plan = ensurePlan(trip, dest);
  const limits = strictestLimits(trip);
  const len = tripLength(trip);
  const n = travellers(trip);
  const factor = LODGING[trip.lodging || "bnb"]?.factor || 1;
  const rates = dest.rates || {};
  const sel = selectedBlocks(dest, plan);
  const flags = [], warnings = [];
  // Stops carry one typical afternoon high; with dates and a monthly climate, the warmth floor uses those months instead.
  const climate = climateFor(dest, trip);
  let city = 0, outdoor = 0, cityCost = 0, outdoorCost = 0, extra = 0, maxAlt = 0, maxTemp = -99, minTemp = 99, hrs = 0, longest = 0, histN = 0, worstCrowd = "low";
  let totalAscent = 0, maxAscent = 0, maxHours = 0, maxGrade = 0, maxGradeLabel = "";
  const rank = { low: 0, med: 1, high: 2 };
  for (const b of sel) {
    const days = plan.picks[b.id].days;
    const defaultRate = b.type === "city" ? (rates.city ?? rates.transit ?? 100) : b.type === "stage" ? (rates.stage ?? 100) + (plan.guided ? (rates.guide || 0) : 0) : (rates.hike ?? rates.stage ?? 100);
    const rate = (b.ratePerDay || defaultRate) + (b.type === "stage" && b.ratePerDay && plan.guided ? (rates.guide || 0) : 0);
    if (b.type === "city") { city += days; cityCost += days * rate; } else { outdoor += days; outdoorCost += days * rate; }
    extra += b.extraTransportCost || 0;
    maxAlt = Math.max(maxAlt, b.maxAltitudeM || 0);
    if (typeof b.dayHighC === "number") { maxTemp = Math.max(maxTemp, b.dayHighC); minTemp = Math.min(minTemp, b.dayHighC); }
    hrs += b.transitHours || 0; longest = Math.max(longest, b.transitHours || 0);
    if (b.history) histN++;
    if (rank[b.crowd] > rank[worstCrowd]) worstCrowd = b.crowd;
    if (b.type === "stage") { totalAscent += b.ascentM || 0; maxAscent = Math.max(maxAscent, b.ascentM || 0); maxHours = Math.max(maxHours, b.hours || 0); const g = gradeRank(b.difficulty, dest.kind); if (g > maxGrade) { maxGrade = g; maxGradeLabel = b.difficulty; } }
    // flags against the strictest limits
    if (limits.maxAltitudeM && b.maxAltitudeM > limits.maxAltitudeM) flags.push(`${b.name}: ${b.maxAltitudeM.toLocaleString("en-GB")} m is above the ${limits.maxAltitudeM.toLocaleString("en-GB")} m ceiling`);
    if (limits.maxDayHighC && typeof b.dayHighC === "number" && b.dayHighC > limits.maxDayHighC) flags.push(`${b.name}: ~${b.dayHighC}°C is above the ${limits.maxDayHighC}°C ceiling`);
    if (limits.minDayHighC !== undefined && !climate && typeof b.dayHighC === "number" && b.dayHighC < limits.minDayHighC) flags.push(`${b.name}: ~${b.dayHighC}°C is below the ${limits.minDayHighC}°C floor`);
    if (limits.crowds === "avoid" && b.crowd === "high") flags.push(`${b.name} is crowded in season`);
    if (limits.maxDailyAscentM && b.ascentM > limits.maxDailyAscentM) flags.push(`${b.name}: ${b.ascentM} m of ascent is above the ${limits.maxDailyAscentM} m daily limit`);
    if (limits.maxDailyHours && b.hours > limits.maxDailyHours) flags.push(`${b.name}: ${b.hours} h is above the ${limits.maxDailyHours} h daily limit`);
    const gl = dest.kind === "skitour" ? limits.maxGradeSki : limits.maxGradeHike;
    if (gl && b.difficulty && gradeRank(b.difficulty, dest.kind) > gradeRank(gl, dest.kind)) flags.push(`${b.name} is ${b.difficulty}, above the ${gl} limit`);
  }
  if (minTemp === 99) { minTemp = 0; maxTemp = 0; }
  const coldTemp = climate ? climate.high : minTemp;
  if (limits.minDayHighC !== undefined && climate && climate.high < limits.minDayHighC) flags.push(`${climate.place.split(";")[0]}: ~${climate.high}°C on average in those months, below the ${limits.minDayHighC}°C floor`);
  for (const zone of limits.countryZone || []) {
    const out = countriesOutside(dest.countries || [], zone, dest.zone);
    if (out.length) flags.push(`${andList(out.map(countryName))} ${out.length > 1 ? "are" : "is"} outside ${COUNTRY_ZONE_LABEL[zone]}`);
  }
  const rest = plan.rest || 0;
  const alloc = city + outdoor + rest;
  const noDates = !len;
  const lenEff = len || alloc + 2;
  const free = lenEff - alloc;
  const transitRate = rates.transit ?? 100;
  const transitCost = (Math.max(free, 0) + rest) * transitRate;
  const access = accessFor(dest, trip);
  const accessCost = (access.costPerPerson || 0) * (access.mode === "flight" ? flightFactor(trip) : 1);
  const ground = (cityCost + outdoorCost + transitCost) * factor;
  const sub = accessCost + extra + ground;
  const cont = sub * CONTINGENCY;
  const pp = sub + cont, total = pp * n;
  const budget = trip.budget?.total || 0;
  const fits = budget ? total <= budget : true;
  const hikeShare = (city + outdoor) ? outdoor / (city + outdoor) : 0;
  if (limits.maxHikeShare && hikeShare * 100 > limits.maxHikeShare) warnings.push(`${Math.round(hikeShare * 100)}% of planned days are outdoors; the limit set is ${limits.maxHikeShare}%.`);
  const mode = trip.travel?.mode || "any";
  if (mode === "train" && access.mode === "flight") flags.push("Reaching this destination needs a flight; the trip is set to trains only");
  if (mode === "drive" && access.mode === "flight") flags.push("Not reachable by car from home");
  if (access.approx) warnings.push(`No access data from ${trip.origin?.city || "your origin"}; using ${access.originCity || "the default origin"} as an estimate.`);
  if (noDates) warnings.push("No dates yet: costed for the planned days plus 2 travel days; add dates in Setup to score the season and get a calendar.");
  else if (alloc > len) warnings.push(`${alloc} days planned in a ${len}-day trip.`);
  else if (free < 1 && (dest.kind === "explore" ? free < 2 : free < 1)) warnings.push(`Only ${free} travel day${free === 1 ? "" : "s"}; arrival and departure usually need ${dest.kind === "explore" ? 2 : 1}.`);
  return { coldTemp, plan, limits, len: lenEff, noDates, n, sel, city, outdoor, rest, free, alloc, accessCost, access, extra, cityCost: cityCost * factor, outdoorCost: outdoorCost * factor, transitCost: transitCost * factor, cont, pp, total, budget, fits, over: total - budget, maxAlt, maxTemp, minTemp, hrs: hrs + 1, longest, histN, worstCrowd, hikeShare, totalAscent, maxAscent, maxHours, maxGrade, maxGradeLabel, flags, warnings };
}

/* Redistribute days of one group (city | outdoor) across selected blocks to hit a target. */
export function rebalance(dest, plan, group, target) {
  const picks = plan.picks;
  const all = dest.blocks.filter(b => group === "city" ? b.type === "city" : OUTDOOR.has(b.type));
  const sel = () => all.filter(b => picks[b.id].on);
  const sum = () => sel().reduce((a, b) => a + picks[b.id].days, 0);
  target = Math.max(0, target);
  if (!sel().length && target > 0) { const f = all[0]; if (f) picks[f.id] = { on: true, days: f.minDays }; }
  let guard = 300;
  for (let pass = 0; pass < 2; pass++) {
    while (sum() < target && guard--) { const c = sel().filter(b => picks[b.id].days < b.maxDays); if (!c.length) { const off = all.find(b => !picks[b.id].on); if (!off) break; picks[off.id] = { on: true, days: off.minDays }; continue; } c.sort((a, b) => picks[a.id].days / a.defaultDays - picks[b.id].days / b.defaultDays); picks[c[0].id].days++; }
    while (sum() > target && guard--) { const c = sel().filter(b => picks[b.id].days > b.minDays); if (!c.length) { const on = sel(); if (!on.length) break; picks[on[on.length - 1].id].on = false; continue; } c.sort((a, b) => picks[b.id].days / b.defaultDays - picks[a.id].days / a.defaultDays); picks[c[0].id].days--; }
  }
  plan.presetIdx = -1;
}

/* Day-by-day itinerary: travel day(s), blocks in order, rest days before the return. */
export function itinerary(dest, trip) {
  const c = computePlan(dest, trip);
  const hasDates = !!trip.dates?.start;
  const start = hasDates ? isoToDate(trip.dates.start) : null;
  const days = [];
  let i = 0;
  const push = (kind, label, block, extra) => { days.push(Object.assign({ n: i + 1, date: start ? dateToIso(addDays(start, i)) : "day-" + (i + 1), kind, label, block: block || null }, extra || {})); i++; };
  const arrival = c.access.mode === "flight" || (c.access.route || "").includes("night") ? 1 : 1;
  for (let k = 0; k < arrival; k++) push("travel", `Travel: ${trip.origin?.city || "home"} → ${dest.name}`, null, { route: c.access.route });
  for (const b of c.sel) { const d = c.plan.picks[b.id].days; for (let k = 0; k < d; k++) push(b.type, d > 1 ? `${b.name} (day ${k + 1} of ${d})` : b.name, b, { lodging: b.hut ? b.hut.name : (b.place || ""), night: k === d - 1 ? null : undefined }); }
  for (let k = 0; k < (c.plan.rest || 0); k++) push("rest", "Rest or spare day", null, {});
  const left = c.len - i;
  for (let k = 0; k < Math.max(left - 1, 0); k++) push("spare", "Unplanned day", null, {});
  if (c.len > i) push("travel", `Travel home`, null, {});
  else if (days.length && days[days.length - 1].kind !== "travel") days[days.length - 1].label += " · travel home in the evening";
  return days;
}

/* Lodging stays grouped from the itinerary: consecutive nights at one block. */
export function stays(dest, trip) {
  const days = itinerary(dest, trip);
  const out = [];
  for (const d of days) {
    if (!d.block) continue;
    const last = out[out.length - 1];
    if (last && last.blockId === d.block.id) { last.nights++; last.checkout = dateToIso(addDays(isoToDate(d.date), 1)); }
    else out.push({ blockId: d.block.id, name: d.block.name, place: d.block.place, hut: d.block.hut || null, checkin: d.date, checkout: dateToIso(addDays(isoToDate(d.date), 1)), nights: 1, note: d.block.note || "" });
  }
  return out;
}

/* Climate for the trip's months from the destination's monthly data. */
export function climateFor(dest, trip) {
  const cl = dest.climate; if (!cl || !trip.dates?.start) return null;
  const s = isoToDate(trip.dates.start), e = trip.dates.end ? isoToDate(trip.dates.end) : s;
  const months = new Set(); for (let d = s; d <= e; d = addDays(d, 1)) months.add(d.getUTCMonth());
  const ms = [...months];
  const avg = arr => Math.round(ms.reduce((a, m) => a + (arr[m] || 0), 0) / ms.length);
  const snow = ms.some(m => (cl.snowMonths || []).includes(m + 1));
  return { place: cl.representative, high: avg(cl.dayHighC), low: avg(cl.nightLowC), rainDays: avg(cl.rainDays), snow, months: ms.map(m => m + 1) };
}
