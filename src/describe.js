// Reads a plain-English trip description into trip fields, applies it, and writes the reply.
// Pure, rule-based, no network: what it cannot read it asks about.
import { KINDS, TRAVEL_MODES, LODGING, HIKE_GRADES, SKI_GRADES, RANK, ORIGIN_REGIONS, criteriaFor } from "./criteria.js";
import { uid, newTrip } from "./state.js";

const NUM = { one: 1, a: 1, an: 1, two: 2, couple: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12 };
const NUMW = "\\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve";
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const MON = "(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)";
export { ORIGIN_REGIONS };
const CUR = { "€": "EUR", eur: "EUR", euro: "EUR", euros: "EUR", "£": "GBP", gbp: "GBP", pound: "GBP", pounds: "GBP", chf: "CHF", francs: "CHF", "$": "USD", usd: "USD", dollars: "USD" };
// Interest words per explore trip-type key (criteria.js TRIP_TYPES).
const INTERESTS = {
  cities: ["city", "cities", "town", "towns", "museum", "museums", "culture", "art", "architecture", "galleries"],
  hike: ["hike", "hikes", "hiking", "walk", "walks", "walking", "trek", "trekking", "mountain", "mountains", "outdoors", "nature"],
  coast: ["beach", "beaches", "coast", "sea", "swim", "swimming", "island", "islands", "seaside"],
  wildlife: ["wildlife", "animals", "birds", "whales", "safari", "bears"],
  history: ["history", "historic", "castle", "castles", "ruins", "roman", "medieval", "heritage"],
  food: ["food", "wine", "restaurants", "cuisine", "eating", "gastronomy", "foodie"],
  festival: ["festival", "festivals", "carnival", "concert", "concerts"]
};
const ORIGIN_ALIASES = { uk: "London", england: "London", britain: "London", scotland: "London", wales: "London", belgium: "Brussels", france: "Paris", netherlands: "Amsterdam", holland: "Amsterdam", switzerland: "Geneva" };
// Everyday names for countries in data/countries.json
const ALIASES = { GB: ["uk", "britain", "great britain", "england", "scotland", "wales", "northern ireland"], US: ["usa", "us", "america", "the states"], NL: ["holland"], CZ: ["czech republic"], AE: ["uae", "dubai"], KR: ["korea", "south korea"] };
const TYPE_LABEL = { cities: "cities & museums", hike: "mountains & walking", coast: "coast", wildlife: "wildlife", history: "history", food: "food & wine", festival: "a festival" };
const LEVEL = ["off", "a little", "yes", "a lot"];
// Placeholder values for vague limits; always reported as guesses.
const VAGUE = { warmC: 18, heatC: 28, altitudeM: 3000, hikeSharePct: 40, defaultDays: 7 };

const n = w => (w == null ? NaN : /^\d/.test(w) ? parseInt(w, 10) : NUM[w.toLowerCase()]);
const monthIdx = s => MONTHS.findIndex(m => m.startsWith(s.toLowerCase().slice(0, 3)));
const iso = (y, m, d) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
const plusDays = (isoDate, k) => { const [y, m, d] = isoDate.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d + k)); return t.toISOString().slice(0, 10); };
// "15,000", "15.000", "1.500,50", "2.5k", "2000": a group of three digits after a separator is thousands.
const money = s => {
  const t = String(s).toLowerCase().replace(/\s/g, "").replace(/[.,]+$/, "");
  let m = t.match(/^(\d{1,3}(?:[.,]\d{3})+)(?:[.,](\d{1,2}))?(k)?$/);
  if (m) return Math.round((parseInt(m[1].replace(/[.,]/g, ""), 10) + (m[2] ? parseFloat("0." + m[2]) : 0)) * (m[3] ? 1000 : 1));
  m = t.match(/^(\d+)(?:[.,](\d+))?(k)?$/);
  return m ? Math.round(parseFloat(m[1] + (m[2] ? "." + m[2] : "")) * (m[3] ? 1000 : 1)) : NaN;
};
const validDate = (y, mi, d) => { const t = new Date(Date.UTC(y, mi, d)); return t.getUTCMonth() === mi && t.getUTCDate() === d; };
const MAX_CHARS = 2000;
// Year for a month with no year: the next time that month starts after today.
const yearFor = (mi, today) => { const [ty, tm] = today.split("-").map(Number); return mi + 1 > tm ? ty : ty + 1; };

export function readDescription(text, { today = new Date().toISOString().slice(0, 10), countries = [] } = {}) {
  const raw = String(text || "").slice(0, MAX_CHARS), s = raw.toLowerCase().replace(/[–—]/g, "-").replace(/\s+/g, " ");
  const out = { guesses: [], limits: {} };

  // Kind
  // A kind word only counts when no "no / not / don't" sits just before it in the same clause, or "not for us" just after.
  const said = re => { for (const m of s.matchAll(new RegExp(re, "g"))) { const before = s.slice(Math.max(0, m.index - 25), m.index), after = s.slice(m.index + m[0].length, m.index + m[0].length + 25); if (/\b(no|not|never|don't|dont|without|hate|instead of)\b[^.,;]*$/.test(before) || /^[^.,;]*\b(not for us|no thanks|is out|isn't for us)\b/.test(after)) continue; return true; } return false; };
  if (said("ski[- ]?tour\\w*|skitour\\w*|skinning|on skins|splitboard\\w*|ski mountaineering")) { out.kind = "skitour"; out.kindSaid = true; }
  else if (said("hut[- ]to[- ]hut|\\btrek\\w*|multi[- ]day hike|long[- ]distance (?:hike|walk)|refuges?|thru[- ]hike")) { out.kind = "hike"; out.kindSaid = true; }
  else out.kind = "explore";
  if (out.kind === "explore" && said("\\bski(?:ing)?\\b")) out.guesses.push(`this app plans ski touring (on skins, hut to hut), not resort skiing; say "ski touring" and start a new trip if that is what you mean`);

  // Travellers
  // An explicit group size wins; otherwise add up roles, plus the speaker ("me", "I") and a partner when named.
  const ROLES = "adults?|kids?|children|teenagers?|teens|people|persons|friends|grown-ups|parents|grandparents|sons?|daughters?|cousins";
  const group = s.match(new RegExp(`\\b(${NUMW}) of us\\b|\\bwe(?:'re| are)(?: a)? (?:family |group )?(?:of )?(${NUMW})\\b(?! (?:${ROLES})\\b)|\\bfamily of (${NUMW})\\b|\\bgroup of (${NUMW})\\b|\\bfor (${NUMW})\\b(?! (?:days?|weeks?|nights?|hours?|h|m|months?|years?|${ROLES})\\b)`));
  let people = group ? n(group.slice(1).find(Boolean)) : 0;
  if (!people) {
    let roles = 0, grownUps = false;
    for (const m of s.matchAll(new RegExp(`\\b(${NUMW}) (${ROLES})\\b`, "g"))) { roles += n(m[1]) || 0; if (/adult|parent|grown/.test(m[2])) grownUps = true; }
    const me = /\b(me|i|i'm|myself)\b/.test(s), partner = /\bmy (wife|husband|partner|girlfriend|boyfriend)\b/.test(s);
    if (roles) people = roles + (grownUps ? 0 : (me ? 1 : 0) + (partner ? 1 : 0));
    else if (/\b(just me|solo|on my own|alone)\b/.test(s)) people = 1;
    else if (partner || /\b(a couple|the two of us|both of us)\b/.test(s)) people = 2;
    else {
      // "Situ and I", "Anna, Tom and I", "me and my brother": the names listed plus the speaker
      const named = s.match(/\b((?:[a-z']+, )*[a-z']+) and (?:i|me|myself)\b/) || s.match(/\bme and ((?:my )?[a-z']+(?:, (?:my )?[a-z']+)*)\b/);
      if (named && !/^(you|we|they|he|she|it|us)$/.test(named[1])) people = named[1].split(", ").length + 1;
    }
  }
  if (people > 0 && people < 40) out.travellers = people;

  // Length
  // "a day" is a rate ("1200 m up a day"), not a length
  const len = [...s.matchAll(new RegExp(`\\b(${NUMW}|a) (days?|nights?|weeks?)\\b`, "g"))].find(m => !(m[1] === "a" && /day|night/.test(m[2]))) || s.match(/\b(fortnight|week)\b/);
  if (len) {
    if (len[1] === "fortnight") out.days = 14;
    else if (len[1] === "week") out.days = 7;
    else { const k = n(len[1]); out.days = /week/.test(len[2]) ? k * 7 : /night/.test(len[2]) ? k + 1 : k; }
  }

  // Dates: "12-26 July 2027", "12 to 26 July", "July 12-26", "2-8 March"
  const cross = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? ${MON}(?: (\\d{4}))? ?(?:-|to|until|till|through) ?(\\d{1,2})(?:st|nd|rd|th)? ${MON}\\b(?: (\\d{4}))?`));
  const crossB = s.match(new RegExp(`\\b${MON} (\\d{1,2})(?:st|nd|rd|th)?(?:,? (\\d{4}))? ?(?:-|to|until|till|through) ?${MON} (\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`));
  const rangeA = s.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)? ?(?:-|to|until|till|through) ?(\\d{1,2})(?:st|nd|rd|th)? ${MON}\\b(?: (\\d{4}))?`));
  const rangeB = s.match(new RegExp(`\\b${MON} (\\d{1,2})(?:st|nd|rd|th)? ?(?:-|to|until|till|through) ?(\\d{1,2})(?:st|nd|rd|th)?\\b(?:,? (\\d{4}))?`));
  if (cross || crossB || rangeA || rangeB) {
    let d1, m1, y1, d2, m2, y2;
    if (cross || crossB) {
      // both as [day1, month1, year1?, day2, month2, year2?]
      const c = cross ? [cross[1], cross[2], cross[3], cross[4], cross[5], cross[6]] : [crossB[2], crossB[1], crossB[3], crossB[5], crossB[4], crossB[6]];
      [d1, m1, d2, m2] = [+c[0], monthIdx(c[1]), +c[3], monthIdx(c[4])];
      y2 = c[5] ? +c[5] : c[2] ? +c[2] + (m2 < m1 ? 1 : 0) : null;
      y1 = c[2] ? +c[2] : y2 ? y2 - (m2 < m1 ? 1 : 0) : yearFor(m1, today);
      if (!y2) y2 = y1 + (m2 < m1 ? 1 : 0);
    } else {
      const [a, b2, mon, yr] = rangeA ? [rangeA[1], rangeA[2], rangeA[3], rangeA[4]] : [rangeB[2], rangeB[3], rangeB[1], rangeB[4]];
      d1 = +a; d2 = +b2; m1 = m2 = monthIdx(mon); y1 = y2 = yr ? +yr : yearFor(m1, today);
    }
    const start = iso(y1, m1, d1), end = iso(y2, m2, d2);
    if (validDate(y1, m1, d1) && validDate(y2, m2, d2) && start <= end) { out.start = start; out.end = end; out.days = Math.round((Date.UTC(y2, m2, d2) - Date.UTC(y1, m1, d1)) / 864e5) + 1; }
    else out.guesses.push(`I couldn't make sense of the dates "${(cross || crossB || rangeA || rangeB)[0]}", so I left them; pick them in the form`);
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
    const after = s.slice(b.index + b[0].length, b.index + b[0].length + 20);
    // "€500 a night" is a price, not the trip budget
    if (total > 0 && !/^\s*(a|per|\/) ?(night|day|room)\b/.test(after)) {
      out.budget = { total, currency: curTok ? CUR[curTok.trim()] : "EUR", perPerson: /^\s*(per person|pp|each|a head|per head|a person)\b/.test(after) };
    }
  }

  if (!out.budget && /\b(low|tight|small|limited|modest) budget\b|\bon a budget\b|\bbudget (trip|travel)\b|\bcheap(ly)?\b|\bshoestring\b|\bnot (too )?expensive\b/.test(s)) out.lowBudget = true;

  // Origin and travel
  const from = s.match(/\b(?:from|leaving(?: from)?|starting (?:in|from)|based in|live in|living in)\s+(?:the\s+)?([a-z][a-z-]+)/);
  if (from) {
    const w = from[1], city = Object.keys(ORIGIN_REGIONS).find(c => c.toLowerCase() === w) || ORIGIN_ALIASES[w];
    if (city) out.origin = city;
    else if (!/^(home|here|there|us|our|my|a|an)$/.test(w)) { out.origin = "Other"; out.otherOrigin = w; }
  }
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
      else if (/\b(love|loves|lots of|a lot of|really|mostly|mainly|big on|must|plenty of|adore)\b/.test(before) || /\b(as much as possible|as often as possible|a lot|lots|above all|all day|every day)\b/.test(clause)) lvl = 3;
      if (key === "hike" && lvl === 1 && /walk|hik/.test(w) && /not too much|not much|not a lot/.test(before)) { out.limits.maxHikeShare = VAGUE.hikeSharePct; out.guesses.push(`hiking days capped at ${VAGUE.hikeSharePct}% (a guess from "${clause.trim()}")`); }
      type[key] = lvl; // a later mention wins
    }
  }
  if (Object.keys(type).length) out.type = type;

  // Limits
  const L = out.limits;
  const alt = s.match(/(\d[\d,.]*)\s?m\b(?! (?:up|ascent|of ascent|climb|gain|elevation gain|a day|per day))/);
  const altCtx = alt && (/(altitude|high|above|over|below|under|max|higher|ceiling|nothing above|not above|up to)/.test(s.slice(Math.max(0, alt.index - 30), alt.index)) || /^ ?(altitude|high|max|ceiling|above sea|elevation)\b/.test(s.slice(alt.index + alt[0].length, alt.index + alt[0].length + 20)));
  if (alt && altCtx) L.maxAltitudeM = money(alt[1]);
  else if (new RegExp(`altitude sickness|not too high|low altitude|altitude is a problem|\\b(?:can't|cannot|can not|no|not|avoid|hate|bad with|problems? with|don't like|doesn't like|struggles? with|sensitive to)\\b[^.,;]{0,25}\\baltitude`).test(s)) { L.maxAltitudeM = VAGUE.altitudeM; out.guesses.push(`altitude ceiling ${VAGUE.altitudeM} m (set your own number in the limits)`); }
  // Temperatures: "between 18 and 28°C" sets both; "at least 20 degrees" is a floor; any other is a ceiling.
  const DEG = "\\s?(?:°\\s?c?|degrees?|ºc?)";
  const between = s.match(new RegExp(`between (-?\\d{1,2})(?:${DEG})? ?(?:and|-|to) ?(-?\\d{1,2})${DEG}`));
  if (between) { L.minDayHighC = +between[1]; L.maxDayHighC = +between[2]; }
  else for (const m of s.matchAll(new RegExp(`(-?\\d{1,2})${DEG}`, "g"))) {
    const before = s.slice(Math.max(0, m.index - 25), m.index);
    if (/(at least|minimum|min\.?|warmer than|no colder than|not colder than|not below|no lower than|above)\s*$/.test(before) && !/(nothing|not|no|never|heat)\b[^.,;]*$/.test(before)) L.minDayHighC ??= +m[1];
    else L.maxDayHighC ??= +m[1];
  }
  if (L.minDayHighC === undefined && /\b(hate|can't do|cannot do|don't like|avoid|no|not too|sensitive to|bad with)\b[^.,;]{0,15}\bcold\b|somewhere warm|warm weather|want (?:some )?(?:sun|warmth)/.test(s)) { L.minDayHighC = VAGUE.warmC; out.guesses.push(`warmth floor ${VAGUE.warmC} °C (set your own number in the limits)`); }
  if (/\bsc?hen?ge?n\b/.test(s)) L.countryZone = "schengen";
  else if (/\b(?:stay in|stay within|within|only in|inside) (?:the )?eu\b|\beu only\b|\bonly (?:the )?eu\b|european union/.test(s)) L.countryZone = "eu";
  else if (/\b(?:stay in|stay within|within|only in|inside|in) europe\b|\beurope only\b|\bonly europe\b/.test(s)) L.countryZone = "europe";
  if (/\b(options|ideas|suggest|suggestions|recommend|recommendations|where (?:should|could|can) we go|what (?:do|would) you (?:suggest|recommend))\b/.test(s)) out.wantsIdeas = true;
  if (L.maxDayHighC !== undefined) { /* explicit number already read */ }
  else if (new RegExp(`heat is a problem|\\b(?:can't|cannot|can not|no|not|avoid|hate|bad with|problems? with|don't like|doesn't like|struggles? with|sensitive to)\\b[^.,;]{0,25}\\b(heat|hot)\\b`).test(s)) { L.maxDayHighC = VAGUE.heatC; out.guesses.push(`heat ceiling ${VAGUE.heatC} °C (set your own number in the limits)`); }
  if (/avoid (the )?crowds|no crowds|hate crowds|not touristy|no tourist traps|avoid tourists/.test(s)) L.crowds = "avoid";
  else if (/\bquiet\b|off the beaten (track|path)|less touristy|few tourists|not too busy|fewer crowds/.test(s)) L.crowds = "prefer";
  const asc = s.match(/(\d[\d,.]*)\s?m (?:up|ascent|of ascent|climb|gain|elevation gain)|(?:ascent|climb(?:ing)?|elevation gain)[a-z ]{0,12}?(\d[\d,.]*)\s?m\b/);
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
    if (trip.budget.perPerson && !p.budget) { trip.budget.total = trip.budget.perPerson * trip.travellers.length; changes.push(`budget ${fmtN(trip.budget.total)} ${trip.budget.currency} for the group (still ${fmtN(trip.budget.perPerson)} each)`); }
  }
  if (p.start) { trip.dates.start = p.start; trip.dates.end = p.end; changes.push(`${fmtD(p.start)} → ${fmtD(p.end)}${p.guessedDates ? " (a guess)" : ""}`); }
  else if (p.days && trip.dates.start) { trip.dates.end = plusDays(trip.dates.start, p.days - 1); changes.push(`${p.days} days, ending ${fmtD(trip.dates.end)}`); }
  if (p.budget) {
    const total = p.budget.perPerson ? p.budget.total * (trip.travellers.length || 1) : p.budget.total;
    trip.budget.total = total; trip.budget.currency = p.budget.currency;
    if (p.budget.perPerson) trip.budget.perPerson = p.budget.total; else delete trip.budget.perPerson;
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
      const have = trip.travellers.map(t => t.limits?.[k]).filter(x => x !== undefined && x !== null && x !== "");
      if (have.length && label[k].combine === "min") { const strictest = Math.min(...have.map(Number)); if (v > strictest) { kept.push(say(k, strictest)); continue; } }
      if (label[k].combine === "all") {
        // A country limit is per person: give it to everyone who has none, never replace someone else's.
        const free = trip.travellers.filter(t => !t.limits?.[k] || t.limits[k] === "any");
        if (!free.length) { if (!have.includes(v)) kept.push(say(k, have[0]) + " (add another in a traveller's row below)"); continue; }
        for (const t of free) { t.limits = t.limits || {}; t.limits[k] = v; }
        set.push(say(k, v)); continue;
      }
      if (have.length && label[k].combine === "rank") { const order = RANK[k]; const strictest = have.slice().sort((a, b) => order.indexOf(String(b)) - order.indexOf(String(a)))[0]; if (order.indexOf(String(v)) < order.indexOf(String(strictest))) { kept.push(say(k, strictest)); continue; } }
      for (const t of trip.travellers) { t.limits = t.limits || {}; t.limits[k] = v; }
      set.push(say(k, v));
    }
    if (set.length) changes.push("limits for the group: " + set.join(", "));
    if (kept.length) changes.push("kept the stricter " + kept.join(", ") + " already set (edit a traveller's limits below to change it)");
  }
  if (p.lowBudget) { trip.weights = Object.assign({}, trip.weights, { cost: 3 }); changes.push("low budget: cheaper places now rank higher (cost weighs the most)"); }
  if (p.visited?.length) {
    const vc = trip.visitedCountries = trip.visitedCountries || [];
    for (const c of p.visited) if (!vc.includes(c.code)) vc.push(c.code);
    changes.push(`already visited: ${p.visited.map(c => c.name).join(", ")} (hidden from ideas)`);
  }
  if (!trip.name && changes.length) trip.name = trip.dates.start ? `${cap(MONTHS[+trip.dates.start.slice(5, 7) - 1])} ${trip.dates.start.slice(0, 4)} trip` : "New trip";
  return changes;
}

/* The chat reply: what was filled, guesses, and the next question. */
export function replyFor(changes, trip, p, ideas) {
  const parts = [];
  if (changes.length) parts.push(`Filled in:\n${changes.map(c => "• " + c).join("\n")}`);
  else if (!ideas) parts.push("Nothing new to fill in from that.");
  if (ideas) parts.push(ideasText(ideas));
  if (p.guesses?.length) parts.push(`Guesses to check: ${p.guesses.join("; ")}.`);
  if (p.kindSaid && p.kind !== trip.kind) parts.push(`That sounds like ${KINDS[p.kind].label.toLowerCase()}; this trip is "${KINDS[trip.kind].label}". Start a new trip from the home page to switch.`);
  const ask = !trip.dates.start ? "When would you like to go, and for how long?"
    : trip.travellers.length <= 1 && !p.travellers ? "How many of you are going?"
    : !trip.budget.total ? (trip.weights?.cost === 3 ? "Roughly how much can each of you spend, all in?" : "Roughly what budget, for the group or per person?")
    : trip.kind === "explore" && !p.type && JSON.stringify(trip.type) === JSON.stringify(newTrip("explore").type) && !(trip.brief || []).some(m => m.who === "app" && /what do you love/i.test(m.text)) ? "What do you love on a trip, and what would you rather skip?"
    : "Anything else, like limits for someone (heat, altitude, walking), or places you've already been? Check the form below.";
  parts.push(ask);
  return parts.join("\n\n");
}

/* Ideas as chat text: [{ name, score, pp, currency?, reason, flags }] from the destination ranking. */
function ideasText(ideas) {
  if (!ideas.length) return "No destination in the library fits yet; see all of them in Destinations.";
  const lines = ideas.map((d, i) => `${i + 1}. ${d.name}: ${d.score}/100, about ${fmtN(Math.round(d.pp))} ${d.currency || "EUR"} each. ${d.reason}.${d.flags.length ? `\n   ⚠ ${d.flags.slice(0, 2).join("; ")}${d.flags.length > 2 ? ` (+${d.flags.length - 2} more)` : ""}` : ""}`);
  const allFlagged = ideas.every(d => d.flags.length);
  return `The best fits in the library so far:\n${lines.join("\n")}${allFlagged ? "\n\nEach of these breaks at least one of your limits. The library may not have a destination that fits everything yet; loosen a limit, or add your own idea in Destinations." : ""}\n\nTap a name in "Ideas that fit so far" below to look closer.`;
}

/* One chat turn: read the message, fill the trip, keep the message in the notes, add both sides to the thread. */
export function describeTurn(trip, text, opts) {
  const msg = String(text || "").trim(); if (!msg) return null;
  const p = readDescription(msg, opts);
  const changes = applyDescription(trip, p);
  const ideas = p.wantsIdeas && opts?.suggest ? opts.suggest(trip) : null;
  const reply = replyFor(changes, trip, p, ideas);
  trip.brief = trip.brief || [];
  trip.brief.push({ who: "you", text: msg }, { who: "app", text: reply });
  trip.notes = trip.notes ? `${trip.notes}\n${msg}` : msg;
  return { parsed: p, changes, reply };
}
