// Reads a plain-English trip description into trip fields, applies it, and writes the reply.
// Pure, rule-based, no network: what it cannot read it asks about.
import { KINDS, TRAVEL_MODES, LODGING, HIKE_GRADES, SKI_GRADES, criteriaFor } from "./criteria.js";
import { uid, newTrip } from "./state.js";

const NUM = { one: 1, a: 1, an: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUMW = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
export const ORIGIN_REGIONS = { Brussels: "europe-west", London: "uk", Paris: "europe-west", Amsterdam: "europe-west", Geneva: "europe-west" };
const CUR = { "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR", "£": "GBP", gbp: "GBP", pound: "GBP", pounds: "GBP", chf: "CHF", francs: "CHF", "$": "USD", usd: "USD", dollars: "USD" };
// Interest words per explore trip-type key (setup.js TYPE_TAGS).
const INTERESTS = {
  cities: ["city", "cities", "town", "towns", "museum", "museums", "culture", "art", "architecture", "galleries"],
  hike: ["hike", "hikes", "hiking", "walk", "walks", "walking", "trek", "trekking", "mountain", "mountains", "outdoors", "nature"],
  coast: ["beach", "beaches", "coast", "sea", "swim", "swimming", "island", "islands", "seaside"],
  wildlife: ["wildlife", "animals", "birds", "whales", "safari", "bears"],
  history: ["history", "historic", "castle", "castles", "ruins", "roman", "medieval", "heritage"],
  food: ["food", "wine", "restaurants", "cuisine", "eating", "gastronomy", "foodie"],
  festival: ["festival", "festivals", "carnival", "concert", "concerts"]
};
// Everyday names for countries in data/countries.json
const ALIASES = { GB: ["uk", "britain", "great britain", "england", "scotland", "wales", "northern ireland"], US: ["usa", "us", "america", "the states"], NL: ["holland"], CZ: ["czech republic"], AE: ["uae", "dubai"], KR: ["korea", "south korea"] };
const TYPE_LABEL = { cities: "cities & museums", hike: "mountains & walking", coast: "coast", wildlife: "wildlife", history: "history", food: "food & wine", festival: "a festival" };
const LEVEL = ["off", "a little", "yes", "a lot"];
// Placeholder values for vague limits; always reported as guesses.
const VAGUE = { heatC: 28, altitudeM: 3000, hikeSharePct: 40, defaultDays: 7 };

const n = w => (w == null ? NaN : /^\d/.test(w) ? parseInt(w, 10) : NUM[w.toLowerCase()]);
const monthIdx = s => MONTHS.findIndex(m => m.startsWith(s.toLowerCase().slice(0, 3)));
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const plusDays = (isoDate, k) => { const [y, m, d] = isoDate.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + k)); return t.toISOString().slice(0, 10); };
const money = s => { const m = String(s).toLowerCase().replace(/[,\s]/g, "").replace(/\.+$/, "").match(/^(\d+(?:\.\d+)?)(k)?$/); return m ? Math.round(parseFloat(m[1]) * (m[2] ? 1000 : 1)) : NaN; };
// Year for a month with no year: the next time that month starts after today.
const yearFor = (mi, today) => { const [ty, tm] = today.split("-").map(Number); return mi + 1 > tm ? ty : ty + 1; };

export function readDescription(text, { today = new Date().toISOString().slice(0, 10), countries = [] } = {}) {
  const raw = String(text || ""), s = raw.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  const out = { guesses: [], limits: {} };

  // Kind
  if (/ski[- ]?tour|skitour|skinning|on skins|splitboard|ski mountaineering|\bski(ing)?\b/.test(s)) { out.kind = "skitour"; out.kindSaid = true; }
  else if (/hut[- ]to[- ]hut|\bhuts?\b.*\btrek|\btrek\b|multi[- ]day hike|long[- ]distance (hike|walk)|refuge|thru[- ]hike/.test(s)) { out.kind = "hike"; out.kindSaid = true; }
  else out.kind = "explore";

  // Travellers
  let people = 0;
  for (const m of s.matchAll(new RegExp(`\\b(${NUMW}) (adults?|kids?|children|teenagers?|teens|people|persons|friends|grown-ups)\\b`, "g"))) people += n(m[1]) || 0;
  const group = s.match(new RegExp(`\\b(${NUMW}) of us\\b|\\bwe(?:'re| are) (${NUMW})\\b|\\bfamily of (${NUMW})\\b|\\bgroup of (${NUMW})\\b|\\bfor (${NUMW})\\b(?! (?:days?|weeks?|nights?|hours?|h|m|months?|years?)\\b)`));
  if (!people && group) people = n(group.slice(1).find(Boolean));
  if (!people && /\b(just me|solo|on my own|alone)\b/.test(s)) people = 1;
  if (!people && /\b(a couple|my (wife|husband|partner|girlfriend|boyfriend)|the two of us|both of us)\b/.test(s)) people = 2;
  if (people > 0 && people < 40) out.travellers = people;

  // Length
  // "a day" is a rate ("1200 m up a day"), not a length
  const len = [...s.matchAll(new RegExp(`\\b(${NUMW}|a) (days?|nights?|weeks?)\\b`, "g"))].find(m => !(m[1] === "a" && /day/.test(m[2]))) || s.match(/\b(fortnight|week)\b/);
  if (len) {
    if (len[1] === "fortnight") out.days = 14;
    else if (len[1] === "week") out.days = 7;
    else { const k = n(len[1]); out.days = /week/.test(len[2]) ? k * 7 : /night/.test(len[2]) ? k + 1 : k; }
  }

  // Dates: "12-26 July 2027", "12 to 26 July", "July 12-26", "2-8 March"
  const rangeA = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? ?(?:-|to|until) ?(\\d{1,2})(?:st|nd|rd|th)? ${MON}\\b(?: (\\d{4}))?`));
  const rangeB = s.match(new RegExp(`\\b${MON} (\\d{1,2})(?:st|nd|rd|th)? ?(?:-|to|until) ?(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`));
  if (rangeA || rangeB) {
    const [d1, d2, mon, yr] = rangeA ? [rangeA[1], rangeA[2], rangeA[3], rangeA[4]] : [rangeB[2], rangeB[3], rangeB[1], rangeB[4]];
    const mi = monthIdx(mon), y = yr ? +yr : yearFor(mi, today);
    out.start = iso(y, mi, +d1); out.end = iso(y, mi, +d2);
    out.days = +d2 - +d1 + 1;
  } else {
    const mm = s.match(new RegExp(`\\b(?:(early|beginning of|mid|middle of|late|end of) )?${MON}\\b(?: (\\d{4}))?`));
    // "may" is only a month when it looks like one ("in may", "may 2027")
    if (mm && !(mm[2] === "may" && !/\b(in|early|mid|late|of|during) may\b|\bmay \d{4}\b/.test(s))) {
      const mi = monthIdx(mm[2]), y = mm[3] ? +mm[3] : yearFor(mi, today);
      const day = /early|beginning/.test(mm[1] || "") ? 1 : /mid|middle/.test(mm[1] || "") ? 10 : /late|end/.test(mm[1] || "") ? 20 : 1;
      const days = out.days || VAGUE.defaultDays;
      out.start = iso(y, mi, day); out.end = plusDays(out.start, days - 1); out.guessedDates = true;
      out.guesses.push(`the dates, from "${mm[0].trim()}"${out.days ? "" : ` with a ${VAGUE.defaultDays}-day length`}`);
    }
  }

  // Budget: a currency, or the word budget, next to a number
  const curRe = "(€|£|\\$|eur|euros?|gbp|pounds?|chf|francs|usd|dollars)";
  const amt = "(\\d[\\d,.]*\\s?k?)";
  const b = s.match(new RegExp(`${curRe} ?${amt}`)) || s.match(new RegExp(`${amt} ?${curRe}`)) || s.match(new RegExp(`budget(?: is| of| around| about| roughly| up to| max(?:imum)?)*:? ?${amt}(?! ?(m|km|°|degrees|days|weeks))`));
  if (b) {
    const curTok = [b[1], b[2]].find(x => x && CUR[x.trim()]);
    const numTok = [b[1], b[2]].find(x => x && /\d/.test(x));
    const total = money(numTok);
    if (total > 0) {
      const after = s.slice(b.index + b[0].length, b.index + b[0].length + 20);
      out.budget = { total, currency: curTok ? CUR[curTok.trim()] : "EUR", perPerson: /^\s*(per person|pp|each|a head|per head|a person)\b/.test(after) };
    }
  }

  // Origin and travel
  const from = s.match(/\b(?:from|leaving|starting in|based in|live in|living in)\s+([a-z][a-z-]+)/);
  if (from) { const city = Object.keys(ORIGIN_REGIONS).find(c => c.toLowerCase() === from[1]); out.origin = city || "Other"; if (!city) out.otherOrigin = from[1]; }
  if (/\b(no (flights?|flying|planes?)|not fly|don't fly|do not fly|without flying|by train|trains? only|only trains?|by rail|night trains?)\b/.test(s)) out.travel = "train";
  else if (/\b(we drive|drive there|driving|by car|our car|road ?trip)\b/.test(s)) out.travel = "drive";

  // Lodging
  if (/\bhotels?\b/.test(s)) out.lodging = "hotel";
  else if (/\bcamp(ing|site)?\b|\btents?\b/.test(s) && !/no camping/.test(s)) out.lodging = "camp";
  else if (/\b(b&b|airbnb|guesthouse)/.test(s)) out.lodging = "bnb";

  // Interests, clause by clause
  const type = {};
  for (const clause of s.split(/[.;!?,]| but | and also /)) {
    for (const [key, words] of Object.entries(INTERESTS)) {
      const w = words.find(x => new RegExp(`\\b${x}\\b`).test(clause)); if (!w) continue;
      const before = clause.slice(0, clause.search(new RegExp(`\\b${w}\\b`)));
      let lvl = 2;
      if (/\b(not too much|not much|not a lot of|limited|light|easy|a bit of|a little|some|bit of)\b[^]*$/.test(before)) lvl = 1;
      else if (/\b(no|not|without|hate|avoid|don't want|dont want|nothing|skip|none)\b[^]*$/.test(before)) lvl = 0;
      else if (/\b(love|loves|lots of|a lot of|really|mostly|mainly|big on|must|plenty of|adore)\b/.test(before)) lvl = 3;
      if (key === "hike" && lvl === 1 && /walk|hik/.test(w) && /not too much|not much|not a lot/.test(before)) { out.limits.maxHikeShare = VAGUE.hikeSharePct; out.guesses.push(`hiking days capped at ${VAGUE.hikeSharePct}% (a guess from "${clause.trim()}")`); }
      type[key] = lvl; // a later mention wins
    }
  }
  if (Object.keys(type).length) out.type = type;

  // Limits
  const L = out.limits;
  const alt = s.match(/(\d[\d,.]*)\s?m\b(?! (?:up|ascent|of ascent|climb|gain|elevation gain|a day|per day))/);
  const altCtx = alt && /(altitude|high|above|over|below|under|max|higher|ceiling|nothing above|not above|up to)/.test(s.slice(Math.max(0, alt.index - 30), alt.index));
  if (alt && altCtx) L.maxAltitudeM = money(alt[1]);
  else if (new RegExp(`altitude sickness|not too high|low altitude|altitude is a problem|\\b(?:can't|cannot|can not|no|not|avoid|hate|bad with|problems? with|don't like|doesn't like|struggles? with|sensitive to)\\b[^.,;]{0,25}\\baltitude`).test(s)) { L.maxAltitudeM = VAGUE.altitudeM; out.guesses.push(`altitude ceiling ${VAGUE.altitudeM} m (set your own number in the limits)`); }
  const heat = s.match(/(\d{2})\s?(?:°\s?c?|degrees?|ºc?)/);
  if (heat) L.maxDayHighC = +heat[1];
  else if (new RegExp(`heat is a problem|\\b(?:can't|cannot|can not|no|not|avoid|hate|bad with|problems? with|don't like|doesn't like|struggles? with|sensitive to)\\b[^.,;]{0,25}\\b(heat|hot)\\b`).test(s)) { L.maxDayHighC = VAGUE.heatC; out.guesses.push(`heat ceiling ${VAGUE.heatC} °C (set your own number in the limits)`); }
  if (/avoid (the )?crowds|no crowds|hate crowds|not touristy|no tourist traps|avoid tourists/.test(s)) L.crowds = "avoid";
  else if (/\bquiet\b|off the beaten (track|path)|less touristy|few tourists|not too busy|fewer crowds/.test(s)) L.crowds = "prefer";
  const asc = s.match(/(\d[\d,.]*)\s?m (?:up|ascent|of ascent|climb|gain|elevation gain)|(?:ascent|climb|up)[a-z ]{0,12}?(\d[\d,.]*)\s?m\b/);
  if (asc) L.maxDailyAscentM = money(asc[1] || asc[2]);
  const hrs = s.match(/(\d{1,2})\s?(?:hours?|hrs?|h)\b(?: (?:a|per) day| walking| of walking| max| at most)?/);
  if (hrs && /(day|max|at most|walking|no more)/.test(s.slice(hrs.index, hrs.index + 30))) L.maxDailyHours = +hrs[1];
  const hg = s.match(/\b(t[1-5]\+?)\b/); if (hg && HIKE_GRADES.includes(hg[1].toUpperCase())) L.maxGradeHike = hg[1].toUpperCase();
  const sg = raw.match(/\b(F|WS\+?|ZS[+-]?|S[+-]?)\b(?=[^a-z]|$)/); if (sg && out.kind === "skitour" && SKI_GRADES.includes(sg[1])) L.maxGradeSki = sg[1];
  if (/huts? only|only huts?|no camping/.test(s)) L.hutsOnly = true;

  // Countries already visited, matched against the app's country list when given
  const been = s.match(/\b(?:been to|visited|already did|we did|went to|have done)\b([^.;!?]*)/);
  if (been && countries.length) { const tail = been[1]; out.visited = countries.filter(c => (ALIASES[c.code] || []).some(a => new RegExp(`\\b${a}\\b`).test(tail)) || new RegExp(`\\b${c.name.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`).test(tail)).map(c => ({ code: c.code, name: c.name })); if (!out.visited.length) delete out.visited; }
  return out;
}

const fmtN = v => Number(v).toLocaleString("en-GB");
const cap = w => w.charAt(0).toUpperCase() + w.slice(1);
const fmtD = d => { const [y, m, dd] = d.split("-").map(Number); return `${dd} ${cap(MONTHS[m - 1].slice(0, 3))} ${y}`; };

/* Applies what was read to the trip. Returns what changed, in words. */
export function applyDescription(trip, p) {
  const changes = [];
  if (p.travellers && p.travellers !== trip.travellers.length) {
    while (trip.travellers.length < p.travellers) trip.travellers.push({ id: uid("p"), name: "", limits: Object.assign({}, trip.travellers[0]?.limits) });
    if (trip.travellers.length > p.travellers && trip.travellers.slice(p.travellers).every(x => !x.name)) trip.travellers.length = p.travellers;
    changes.push(`${trip.travellers.length} traveller${trip.travellers.length > 1 ? "s" : ""}`);
  }
  if (p.start) { trip.dates.start = p.start; trip.dates.end = p.end; changes.push(`${fmtD(p.start)} → ${fmtD(p.end)}${p.guessedDates ? " (a guess)" : ""}`); }
  else if (p.days && trip.dates.start) { trip.dates.end = plusDays(trip.dates.start, p.days - 1); changes.push(`${p.days} days, ending ${fmtD(trip.dates.end)}`); }
  if (p.budget) {
    const total = p.budget.perPerson ? p.budget.total * (trip.travellers.length || 1) : p.budget.total;
    trip.budget.total = total; trip.budget.currency = p.budget.currency;
    changes.push(`budget ${fmtN(total)} ${p.budget.currency} for the group${p.budget.perPerson ? ` (${fmtN(p.budget.total)} each)` : ""}`);
  }
  if (p.origin) { trip.origin = { city: p.origin, region: ORIGIN_REGIONS[p.origin] || "europe-west" }; changes.push(`leaving from ${p.otherOrigin && p.origin === "Other" ? `${p.otherOrigin} (set as Other: costs use Brussels)` : p.origin}`); }
  if (p.travel) { trip.travel.mode = p.travel; changes.push(TRAVEL_MODES[p.travel].label.toLowerCase()); }
  if (p.lodging) { trip.lodging = p.lodging; changes.push(LODGING[p.lodging].label); }
  if (p.type && trip.kind === "explore") {
    trip.type = Object.assign({}, trip.type, p.type);
    changes.push("interests: " + Object.entries(p.type).map(([k, v]) => `${TYPE_LABEL[k]} ${LEVEL[v]}`).join(", "));
  }
  const allowed = new Set(criteriaFor(trip.kind).map(c => c.key));
  const lim = Object.entries(p.limits || {}).filter(([k]) => allowed.has(k));
  if (lim.length) {
    const label = Object.fromEntries(criteriaFor(trip.kind).map(c => [c.key, c]));
    const say = (k, v) => `${label[k].label.toLowerCase()} ${v === true ? "yes" : label[k].unit ? fmtN(v) + " " + label[k].unit : (label[k].options?.find(o => o[0] === v)?.[1] || v)}`;
    const set = [], kept = [];
    for (const [k, v] of lim) {
      // The strictest limit wins anyway; a looser number later must not quietly relax someone's limit.
      const strictest = label[k].combine === "min" ? Math.min(...trip.travellers.map(t => t.limits?.[k]).filter(x => typeof x === "number")) : Infinity;
      if (v > strictest) { kept.push(say(k, strictest)); continue; }
      for (const t of trip.travellers) { t.limits = t.limits || {}; t.limits[k] = v; }
      set.push(say(k, v));
    }
    if (set.length) changes.push("limits for the group: " + set.join(", "));
    if (kept.length) changes.push("kept the stricter " + kept.join(", ") + " already set (edit a traveller's limits below to change it)");
  }
  if (p.visited?.length) {
    const vc = trip.visitedCountries = trip.visitedCountries || [];
    for (const c of p.visited) if (!vc.includes(c.code)) vc.push(c.code);
    changes.push(`already visited: ${p.visited.map(c => c.name).join(", ")} (hidden from ideas)`);
  }
  if (!trip.name && changes.length) trip.name = trip.dates.start ? `${cap(MONTHS[+trip.dates.start.slice(5, 7) - 1])} ${trip.dates.start.slice(0, 4)} trip` : "New trip";
  return changes;
}

/* The chat reply: what was filled, guesses, and the next question. */
export function replyFor(changes, trip, p) {
  const parts = [];
  if (changes.length) parts.push(`Filled in:\n${changes.map(c => "• " + c).join("\n")}`);
  else parts.push("I didn't catch anything I can fill in from that. Try who is coming, when, for how long, the budget, what you love and what to avoid.");
  if (p.guesses?.length) parts.push(`Guesses to check: ${p.guesses.join("; ")}.`);
  if (p.kindSaid && p.kind !== trip.kind) parts.push(`That sounds like ${KINDS[p.kind].label.toLowerCase()}; this trip is "${KINDS[trip.kind].label}". Start a new trip from the home page to switch.`);
  const ask = !trip.dates.start ? "When would you like to go, and for how long?"
    : trip.travellers.length <= 1 && !p.travellers ? "How many of you are going?"
    : !trip.budget.total ? "Roughly what budget, for the group or per person?"
    : trip.kind === "explore" && !p.type && JSON.stringify(trip.type) === JSON.stringify(newTrip("explore").type) && !(trip.brief || []).some(m => m.who === "app" && /what do you love/i.test(m.text)) ? "What do you love on a trip, and what would you rather skip?"
    : "Anything else, like limits for someone (heat, altitude, walking), or places you've already been? Check the form below.";
  if (changes.length) parts.push(ask);
  return parts.join("\n\n");
}

/* One chat turn: read the message, fill the trip, keep the message in the notes, add both sides to the thread. */
export function describeTurn(trip, text, opts) {
  const msg = String(text || "").trim(); if (!msg) return null;
  const p = readDescription(msg, opts);
  const changes = applyDescription(trip, p);
  const reply = replyFor(changes, trip, p);
  trip.brief = trip.brief || [];
  trip.brief.push({ who: "you", text: msg }, { who: "app", text: reply });
  trip.notes = trip.notes ? `${trip.notes}\n${msg}` : msg;
  return { parsed: p, changes, reply };
}
