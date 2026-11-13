// Trip kinds, the criteria asked at the start of a trip, how traveller limits combine,
// and the planning steps a trip generates. Pure module: no DOM.

export const KINDS = {
  explore: { label: "Explore a region", blurb: "Cities, mountains, coast, wildlife: a trip with several bases and a mix of days.", blockTypes: ["city", "hike", "beach", "wildlife"], groups: { city: "Cities & culture", hike: "Mountains & outdoors", beach: "Coast & water", wildlife: "Wildlife" } },
  hike: { label: "Hut-to-hut hiking", blurb: "One route walked in stages, sleeping in huts or refuges.", blockTypes: ["stage", "city"], groups: { stage: "Stages", city: "Towns at the ends" } },
  skitour: { label: "Ski touring", blurb: "Days on skins from huts or a base, with the avalanche bulletin deciding the plan each morning.", blockTypes: ["stage", "city"], groups: { stage: "Tours and hut days", city: "Base and rest days" } }
};

export const TRAVEL_MODES = {
  any: { label: "Anything", blurb: "Flights, trains or car, whichever fits" },
  train: { label: "Trains only", blurb: "No flights: train, ferry or bus from home" },
  drive: { label: "We drive ourselves", blurb: "Own car from home; fuel and tolls shared" }
};

/* Where a trip can leave from (access routes and costs are held per origin region), the explore interests, and budget currencies. */
export const ORIGINS = [["Brussels", "europe-west"], ["London", "uk"], ["Paris", "europe-west"], ["Amsterdam", "europe-west"], ["Geneva", "europe-west"], ["Other", "europe-west"]];
export const ORIGIN_REGIONS = Object.fromEntries(ORIGINS.filter(([c]) => c !== "Other"));
export const TRIP_TYPES = { cities: "Cities & museums", hike: "Mountains & walking", coast: "Coast & islands", wildlife: "Wildlife", history: "History", food: "Food & wine", festival: "A festival" };
export const CURRENCIES = ["EUR", "GBP", "CHF", "USD"];

export const LODGING = { bnb: { label: "B&B / Airbnb / huts", factor: 1.0 }, hotel: { label: "Hotels", factor: 1.4 }, camp: { label: "Camping where possible", factor: 0.8 } };

export const HIKE_GRADES = ["T1", "T2", "T3", "T3+", "T4", "T4+", "T5"];
export const SKI_GRADES = ["F", "WS", "WS+", "ZS-", "ZS", "ZS+", "S-", "S", "S+"];
export const SKI_GRADE_HELP = "SAC ski scale: WS easy (slopes to 30°), ZS moderate (to 35°, short steep passages), S difficult (to 40°, exposed).";

export function gradeRank(g, kind) { const scale = kind === "skitour" ? SKI_GRADES : HIKE_GRADES; const i = scale.indexOf(String(g || "").replace(/\s*\(.*\)$/, "")); return i < 0 ? 0 : i; }

/* Criteria: asked per traveller in Setup. `combine` says how several travellers' values merge. */
export const CRITERIA = [
  { key: "maxAltitudeM", label: "Altitude ceiling", unit: "m", type: "number", kinds: ["explore", "hike", "skitour"], combine: "min", placeholder: "e.g. 4200", help: "Highest point anyone is happy to reach for a day; sleeping altitude should stay lower." },
  { key: "maxDayHighC", label: "Heat ceiling", unit: "°C", type: "number", kinds: ["explore", "hike"], combine: "min", placeholder: "e.g. 33", help: "Afternoon high above which a stop is flagged." },
  { key: "minDayHighC", label: "Warmth floor", unit: "°C", type: "number", kinds: ["explore", "hike"], combine: "max", placeholder: "e.g. 18", help: "Afternoon high below which a stop is flagged as too cold." },
  { key: "countryZone", label: "Countries", type: "select", kinds: ["explore", "hike", "skitour"], combine: "all", options: [["any", "Anywhere"], ["europe", "Europe only"], ["eu", "EU only"], ["schengen", "Schengen area only"]], help: "For a passport, visa or residence permit that limits where someone can go. A destination outside it is flagged, not hidden." },
  { key: "avoidRegions", label: "Places to avoid", type: "multi", kinds: ["explore", "hike", "skitour"], combine: "union", options: [["balkans", "Balkans"], ["baltics", "Baltics"], ["caucasus", "Caucasus"], ["centralAsia", "Central Asia"]], help: "Regions someone doesn't want to go to. Balkans: Albania, Bosnia, Bulgaria, Croatia, Kosovo, Montenegro, North Macedonia, Serbia. Baltics: Estonia, Latvia, Lithuania. Caucasus: Georgia, Armenia, Azerbaijan. Central Asia: Kazakhstan, Kyrgyzstan, Tajikistan, Turkmenistan, Uzbekistan. A destination there is flagged, not hidden." },
  { key: "crowds", label: "Crowds", type: "select", kinds: ["explore", "hike", "skitour"], combine: "rank", options: [["any", "Don't mind"], ["prefer", "Prefer quiet"], ["avoid", "Avoid crowded places"]], help: "Affects scoring; crowded stops are flagged when 'avoid'." },
  { key: "maxHikeShare", label: "Max share of hiking days", unit: "%", type: "number", kinds: ["explore"], combine: "min", placeholder: "e.g. 60", help: "For someone who does not want a full-hike trip." },
  { key: "maxDailyAscentM", label: "Max ascent per day", unit: "m", type: "number", kinds: ["hike", "skitour"], combine: "min", placeholder: "e.g. 1200" },
  { key: "maxDailyHours", label: "Max hours per day", unit: "h", type: "number", kinds: ["hike", "skitour"], combine: "min", placeholder: "e.g. 7" },
  { key: "maxGradeHike", label: "Max difficulty (hiking)", type: "select", kinds: ["hike"], combine: "rank", options: HIKE_GRADES.map(g => [g, g]), help: "SAC hiking scale: T2 mountain path, T3 demanding with hands in places, T4 alpine with exposure." },
  { key: "maxGradeSki", label: "Max difficulty (ski)", type: "select", kinds: ["skitour"], combine: "rank", options: SKI_GRADES.map(g => [g, g]), help: SKI_GRADE_HELP },
  { key: "maxDanger", label: "Max avalanche danger level", type: "select", kinds: ["skitour"], combine: "rank", options: [["1", "1 low"], ["2", "2 moderate"], ["3", "3 considerable (only with easy terrain)"]], help: "The bulletin level above which the day is a no-go for this person." },
  { key: "hutsOnly", label: "Huts only (no camping)", type: "bool", kinds: ["hike", "skitour"], combine: "or" }
];

export const RANK = { crowds: ["any", "prefer", "avoid"], maxDanger: ["3", "2", "1"], maxGradeHike: [...HIKE_GRADES].reverse(), maxGradeSki: [...SKI_GRADES].reverse() };

/* Country groups for the "Countries" limit (ISO 3166-1 alpha-2).
   EU: the 27 member states. Schengen: the 29 members, with Bulgaria and Romania in full since 1 January 2025.
   Sources: european-union.europa.eu (member countries); home-affairs.ec.europa.eu (Schengen area). */
export const COUNTRY_GROUPS = {
  eu: ["AT", "BE", "BG", "HR", "CY", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IE", "IT", "LV", "LT", "LU", "MT", "NL", "PL", "PT", "RO", "SK", "SI", "ES", "SE"],
  schengen: ["AT", "BE", "BG", "HR", "CZ", "DK", "EE", "FI", "FR", "DE", "GR", "HU", "IS", "IT", "LV", "LI", "LT", "LU", "MT", "NL", "NO", "PL", "PT", "RO", "SK", "SI", "ES", "SE", "CH"]
};
/* Regions for the "Places to avoid" limit (ISO 3166-1 alpha-2; XK is Kosovo's common user-assigned code). */
export const REGION_GROUPS = {
  balkans: ["AL", "BA", "BG", "HR", "XK", "ME", "MK", "RS"],
  baltics: ["EE", "LV", "LT"],
  caucasus: ["GE", "AM", "AZ"],
  centralAsia: ["KZ", "KG", "TJ", "TM", "UZ"]
};
export const REGION_LABEL = { balkans: "the Balkans", baltics: "the Baltics", caucasus: "the Caucasus", centralAsia: "Central Asia" };
export const COUNTRY_ZONE_LABEL = { europe: "Europe", eu: "the EU", schengen: "the Schengen area" };
/* The destination's countries that break a country limit. "europe" uses the destination's zone. */
export function countriesOutside(codes, zone, destZone) {
  if (zone === "europe") return destZone === "europe" ? [] : codes.slice();
  const ok = COUNTRY_GROUPS[zone]; return ok ? codes.filter(c => !ok.includes(c)) : [];
}

/* The named travellers whose own limit is this value (the one being applied), so a flag can say whose it is. */
export function limitOwners(trip, key, value) {
  return (trip.travellers || []).filter(p => {
    const v = (p.limits || {})[key]; if (v === undefined || v === null || v === "") return false;
    return Array.isArray(v) ? v.map(String).includes(String(value)) : String(v) === String(value);
  }).map(p => String(p.name || "").trim()).filter(Boolean);
}

export function criteriaFor(kind) { return CRITERIA.filter(c => c.kinds.includes(kind)); }

/* Merge every traveller's limits into the strictest set. */
export function strictestLimits(trip) {
  const out = {};
  for (const c of criteriaFor(trip.kind)) {
    const vals = (trip.travellers || []).map(t => (t.limits || {})[c.key]).filter(v => v !== undefined && v !== null && v !== "");
    if (!vals.length) continue;
    if (c.combine === "min") out[c.key] = Math.min(...vals.map(Number));
    else if (c.combine === "max") out[c.key] = Math.max(...vals.map(Number));
    else if (c.combine === "all") { const set = [...new Set(vals.map(String))].filter(v => v !== "any"); if (set.length) out[c.key] = set; }
    else if (c.combine === "or") out[c.key] = vals.some(Boolean);
    else if (c.combine === "union") { const set = [...new Set(vals.flatMap(v => Array.isArray(v) ? v : [v]).map(String))].filter(v => REGION_GROUPS[v]); if (set.length) out[c.key] = set; }
    else if (c.combine === "rank") { const order = RANK[c.key]; out[c.key] = vals.slice().sort((a, b) => order.indexOf(String(b)) - order.indexOf(String(a)))[0]; }
  }
  return out;
}

/* Planning steps generated for a trip (and, once chosen, its destination and plan). */
export function planningSteps(trip, dest, plan) {
  const s = [];
  const add = (phase, key, label, detail) => s.push({ phase, key, label, detail: detail || "" });
  const mode = trip.travel?.mode || "any";
  const n = (trip.travellers || []).length || 1;

  add("Decide", "dates", "Fix the dates", trip.dates?.start ? `${trip.dates.start} → ${trip.dates.end}` : "Not set yet");
  add("Decide", "destination", "Choose the destination", dest ? dest.name : "Not chosen yet");
  add("Decide", "budget", "Agree the budget and who pays what", trip.budget?.total ? `${trip.budget.total} ${trip.budget.currency || "EUR"} for the group` : "Not set yet");
  if (trip.kind !== "explore") add("Decide", "guide", "Guided or self-led?", plan?.guided ? "Guided: book the guide first, huts follow" : "Self-led: someone owns navigation and the bulletin");

  if (mode === "drive") {
    add("Travel", "car", "Agree who drives and the fuel and toll split", "Check winter tyres or chains if needed");
    add("Travel", "parking", "Parking at the trailhead or village", "Many alpine villages have paid long-stay car parks");
  } else if (mode === "train" || (dest && dest.noFlights)) {
    add("Travel", "trains", "Book trains out and back", "Advance fares open 2–4 months ahead; night trains sell out first");
  } else {
    add("Travel", "flights", "Book flights", "Compare dates ±2 days; book by the lead time the destination notes give");
  }
  if (dest) {
    const acc = (dest.access || []).find(a => a.originCity === trip.origin?.city) || (dest.access || [])[0];
    if (acc) add("Travel", "route", `Route: ${acc.route}`, "");
    const internal = (dest.blocks || []).filter(b => b.extraTransportCost);
    if (internal.length) add("Travel", "internal", "Internal flights or boats", internal.map(b => b.name).join(", "));
  }

  if (dest && plan) {
    const sel = selectedBlocks(dest, plan);
    const huts = sel.filter(b => b.hut);
    if (huts.length) add("Lodging", "huts", `Book ${huts.length} hut night${huts.length > 1 ? "s" : ""}`, huts.map(b => `${b.hut.name}${b.hut.bookAheadMonths ? ` (${b.hut.bookAheadMonths} months ahead)` : ""}`).join(" · "));
    const stays = sel.filter(b => !b.hut && b.type !== "rest");
    if (stays.length) add("Lodging", "stays", `Book lodging at ${stays.length} stop${stays.length > 1 ? "s" : ""}`, stays.map(b => b.name).join(" · "));
    const permits = sel.filter(b => b.bookAhead);
    for (const b of permits) add("Permits", "permit-" + b.id, b.bookAhead.what, b.bookAhead.leadMonths ? `${b.bookAhead.leadMonths} months ahead` : "");
    if (trip.kind !== "explore") {
      add("Food", "halfboard", "Order half board when booking huts; plan lunches", "Most huts sell a packed lunch; carry a day of emergency food");
      if (dest.tags?.includes("no-huts") || dest.tags?.includes("lodge")) add("Food", "shopping", "Shopping list for the lodge week", `${n} people, ${plan ? Object.keys(plan.picks || {}).length : 0} days`);
    }
  }

  if (trip.kind === "skitour") {
    add("Gear", "avy", "Transceiver, shovel, probe for everyone; check batteries", "Practise a search on day 0");
    add("Gear", "glacier", "Harness, rope, crampons, ice axe if any stage is glaciated", dest ? (dest.blocks || []).some(b => b.maxAltitudeM > 3000) ? "This area has glaciated stages" : "" : "");
    add("Conditions", "bulletin", "Read the avalanche bulletin every evening from D-5", dest ? (dest.bulletins || []).filter(b => b.type === "avalanche").map(b => b.name).join(", ") : "");
    add("Conditions", "log", "Keep the daily conditions log", "Danger level, weather, decision, in the Conditions tab");
  }
  if (trip.kind === "hike") {
    add("Gear", "hut", "Sheet sleeping-bag liner, hut shoes, cash for huts without cards", "");
    add("Conditions", "forecast", "Check the mountain forecast from D-3; know the bail-out valleys", "");
  }
  if (trip.kind === "explore") add("Admin", "visas", "Passports, visas and vaccinations for everyone", "Check non-EU passports separately");
  add("Admin", "insurance", "Travel and mountain-rescue insurance", trip.kind === "skitour" || trip.kind === "hike" ? "Alpine club membership covers rescue in most of the Alps" : "");
  add("Admin", "money", "Set up the expense ledger and the split", "Money tab");
  return s;
}

export function selectedBlocks(dest, plan) {
  if (!dest || !plan) return [];
  const picks = plan.picks || {};
  const order = plan.order && plan.order.length ? plan.order : dest.blocks.map(b => b.id);
  const byId = Object.fromEntries(dest.blocks.map(b => [b.id, b]));
  return order.map(id => byId[id]).filter(b => b && picks[b.id] && picks[b.id].on);
}
