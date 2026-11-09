// "Ask a chatbot to fill it in": the prompt to paste into any chatbot, and the checks on the JSON it sends back.
// Pure, no network. Every value from a reply is checked against the definitions the Setup form uses before it
// reaches a trip; what fails a check is dropped and said back, never applied.
import { KINDS, TRAVEL_MODES, LODGING, ORIGINS, ORIGIN_REGIONS, TRIP_TYPES, CURRENCIES, CRITERIA, criteriaFor } from "./criteria.js";
import { newTrip, migrate, uid } from "./state.js";

const MAX_TEXT = 2000, MAX_DAYS = 60, MAX_TRAVELLERS = 20, MAX_BUDGET = 1000000;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
// Sane bounds per number limit; a value outside is dropped as a likely misreading.
export const NUMBER_RANGES = { maxAltitudeM: [0, 9000], maxDayHighC: [-30, 50], minDayHighC: [-30, 50], maxHikeShare: [0, 100], maxDailyAscentM: [0, 4000], maxDailyHours: [1, 16] };
const ERR = {
  none: "That reply has no trip in it. Ask the chatbot to answer with only the JSON block, then paste again.",
  garbled: "The reply looks cut off or garbled, so nothing was filled. Ask the chatbot for the full JSON again.",
  empty: "Nothing in that reply matched a trip, so no trip was made. Check you pasted the chatbot's JSON answer, or ask it to fill in the fields from the prompt."
};

/* ---------- The prompt ---------- */
function limitLine(c) {
  const kinds = c.kinds.join(", ");
  const what = c.type === "number" ? `number${c.unit ? " in " + c.unit : ""}` : c.type === "bool" ? "true or false" : "one of " + c.options.map(o => `"${o[0]}"`).join(", ");
  return `  - ${c.key} (${kinds}): ${c.label}, ${what}.${c.help ? " " + c.help : ""}`;
}

export function buildPrompt(text, { today }) {
  const desc = String(text || "").trim().slice(0, MAX_TEXT);
  const q = o => Object.keys(o).map(k => `"${k}"`).join(", ");
  return [
    "You are helping fill in a trip-planning app. Read the trip description at the end and turn it into one JSON object.",
    "Reply with only that JSON object inside a ```json code block, nothing else.",
    `Today is ${today}. A month with no year means the next time that month comes.`,
    "",
    "Fields (leave out any field the description does not say anything about):",
    `- kind: one of ${Object.entries(KINDS).map(([k, v]) => `"${k}" (${v.label})`).join(", ")}. Use "explore" unless they clearly want hut-to-hut hiking or ski touring.`,
    "- name: a short trip name.",
    `- origin: the city they leave from, one of ${ORIGINS.map(([c]) => `"${c}"`).join(", ")}. Use "Other" for anywhere else and put the real city in notes.`,
    `- travelMode: one of ${Object.entries(TRAVEL_MODES).map(([k, v]) => `"${k}" (${v.blurb})`).join(", ")}.`,
    `- lodging: one of ${Object.entries(LODGING).map(([k, v]) => `"${k}" (${v.label})`).join(", ")}.`,
    `- dates: { "start": "YYYY-MM-DD", "end": "YYYY-MM-DD" }, at most ${MAX_DAYS} days.`,
    `- budget: { "total": number for the whole group, "currency": one of ${CURRENCIES.map(c => `"${c}"`).join(", ")} }. If they give an amount per person, send "perPerson" instead of "total".`,
    `- type (only for "explore"): what they enjoy, each from 0 (not wanted) to 3 (a lot). Keys: ${Object.entries(TRIP_TYPES).map(([k, v]) => `"${k}" (${v})`).join(", ")}. Only include the ones they mention.`,
    "- travellers: a list with one entry per person: { \"name\": their name or \"\" if not given, \"limits\": { … } }. Don't invent names.",
    "  Put a limit only on the person it concerns. Limit keys, with the kinds of trip they apply to:",
    ...CRITERIA.map(limitLine),
    "- notes: anything useful the fields above can't hold.",
    "- assumptions: a list of short sentences, one per guess you made.",
    "",
    "Numbers must be plain numbers, without units.",
    "",
    "Trip description:",
    "<<<",
    desc,
    ">>>"
  ].join("\n");
}

/* ---------- Reading the reply ---------- */
const isObj = v => v !== null && typeof v === "object" && !Array.isArray(v);

export function readReply(reply) {
  const s = String(reply || "");
  const fence = s.match(/```(?:json)?\s*\n?([\s\S]*?)(?:```|$)/i);
  let body = fence ? fence[1] : null;
  if (!body || !/[{[]/.test(body)) {
    // No fence: from the first "{" to the last "}" (chatter around it is common); a bare "[" only to report it.
    const i = s.indexOf("{"), j = s.lastIndexOf("}");
    body = i >= 0 ? s.slice(i, j > i ? j + 1 : s.length) : s.includes("[") ? s.slice(s.indexOf("[")) : null;
  }
  if (!body || !body.trim()) return { error: ERR.none };
  body = body.trim();
  const parse = t => { try { return { v: JSON.parse(t) }; } catch (e) { return null; } };
  const r = parse(body) || parse(body.replace(/[“”„]/g, '"').replace(/[‘’]/g, "'").replace(/,\s*([}\]])/g, "$1"));
  if (!r) return { error: ERR.garbled };
  return isObj(r.v) ? { obj: r.v } : { error: ERR.none };
}

/* ---------- Checking a reply into a trip ---------- */
const realDate = s => { if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return false; const [y, m, d] = s.split("-").map(Number); const t = new Date(Date.UTC(y, m - 1, d)); return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d; };
const daysBetween = (a, b) => Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1;
// A number, or a string that is only a number ("3000"); "3000m" is not.
const num = v => typeof v === "number" ? (Number.isFinite(v) ? v : NaN) : typeof v === "string" && /^\s*-?\d+(\.\d+)?\s*$/.test(v) ? parseFloat(v) : NaN;
const str = (v, max) => typeof v === "string" ? v.trim().slice(0, max) : "";

function sayLimit(k, v) {
  const c = CRITERIA.find(x => x.key === k);
  const val = v === true ? "yes" : v === false ? "no" : c.unit ? `${v} ${c.unit}` : (c.options?.find(o => o[0] === v)?.[1] || v);
  return `${c.label.toLowerCase()} ${val}`;
}

function checkLimits(raw, kind, who, dropped) {
  const out = {};
  if (raw === undefined) return out;
  if (!isObj(raw)) { dropped.push(`${who}'s limits (not a list of limits)`); return out; }
  const allowed = Object.fromEntries(criteriaFor(kind).map(c => [c.key, c]));
  for (const [k, v] of Object.entries(raw)) {
    const c = allowed[k];
    if (!c) { dropped.push(`${who}: ${k} (not a limit for ${KINDS[kind].label.toLowerCase()})`); continue; }
    if (v === null || v === "") continue;
    if (c.type === "number") {
      const n = num(v), [lo, hi] = NUMBER_RANGES[k] || [-Infinity, Infinity];
      if (Number.isFinite(n) && n >= lo && n <= hi) out[k] = n; else dropped.push(`${who}: ${k} ${JSON.stringify(v)} (needs a number from ${lo} to ${hi}${c.unit ? " " + c.unit : ""})`);
    } else if (c.type === "bool") {
      if (typeof v === "boolean") out[k] = v; else dropped.push(`${who}: ${k} ${JSON.stringify(v)} (needs true or false)`);
    } else {
      const sv = String(v);
      if (c.options.some(o => o[0] === sv)) out[k] = sv; else dropped.push(`${who}: ${k} ${JSON.stringify(v)} (not one of ${c.options.map(o => o[0]).join(", ")})`);
    }
  }
  return out;
}

export function tripFromReply(obj, { text = "", today }) {
  if (!isObj(obj)) return { error: ERR.none };
  const filled = [], dropped = [], extraNotes = [];
  let real = false;
  const KNOWN = ["kind", "name", "origin", "travelMode", "lodging", "dates", "budget", "type", "travellers", "notes", "assumptions"];
  for (const k of Object.keys(obj)) if (!KNOWN.includes(k)) dropped.push(`${k} (not a trip field)`);

  // Kind first: it decides which limits and interests exist.
  let kind = "explore";
  if (obj.kind !== undefined) { if (typeof obj.kind === "string" && KINDS[obj.kind]) { kind = obj.kind; real = true; filled.push(KINDS[kind].label); } else dropped.push(`kind ${JSON.stringify(obj.kind)} (not a kind of trip here; set to ${KINDS.explore.label})`); }
  const trip = newTrip(kind);

  const name = str(obj.name, 80);
  if (name) { trip.name = name; real = true; filled.push(`name "${name}"`); } else if (obj.name !== undefined && obj.name !== "") dropped.push("name (not text)");

  if (obj.origin !== undefined) {
    const o = str(obj.origin, 60), city = ORIGINS.find(([c]) => c.toLowerCase() === o.toLowerCase());
    if (city) { trip.origin = { city: city[0], region: city[1] }; real = true; filled.push(`leaving from ${city[0]}`); }
    else if (o) { trip.origin = { city: "Other", region: ORIGINS.find(([c]) => c === "Other")[1] }; extraNotes.push(`Leaving from ${o}.`); real = true; filled.push(`leaving from ${o} (set as Other: costs use Brussels)`); }
    else dropped.push("origin (not a city)");
  }

  const pick = (key, table, apply, label) => {
    if (obj[key] === undefined) return;
    if (typeof obj[key] === "string" && table[obj[key]]) { apply(obj[key]); real = true; filled.push(label(obj[key])); }
    else dropped.push(`${key} ${JSON.stringify(obj[key])} (not one of ${Object.keys(table).join(", ")})`);
  };
  pick("travelMode", TRAVEL_MODES, v => { trip.travel.mode = v; }, v => TRAVEL_MODES[v].label.toLowerCase());
  pick("lodging", LODGING, v => { trip.lodging = v; }, v => LODGING[v].label);

  if (obj.dates !== undefined) {
    const d = obj.dates, why = !isObj(d) ? "not a start and end date"
      : !realDate(d.start) || !realDate(d.end) ? "need two real dates as YYYY-MM-DD"
      : d.end < d.start ? "the end is before the start"
      : d.start < today ? "they are in the past"
      : daysBetween(d.start, d.end) > MAX_DAYS ? `longer than ${MAX_DAYS} days` : "";
    if (why) dropped.push(`dates (${why})`);
    else { trip.dates = { start: d.start, end: d.end }; real = true; filled.push(`${d.start} → ${d.end} (${daysBetween(d.start, d.end)} days)`); }
  }

  if (obj.type !== undefined) {
    if (kind !== "explore") dropped.push("interests (only used for explore trips)");
    else if (!isObj(obj.type)) dropped.push("interests (not a list of interests)");
    else {
      const ok = {};
      for (const [k, v] of Object.entries(obj.type)) {
        const n = num(v);
        if (!TRIP_TYPES[k]) dropped.push(`interest ${k} (not one the app knows)`);
        else if (!Number.isFinite(n) || n < 0 || n > 3) dropped.push(`interest ${k} ${JSON.stringify(v)} (needs 0 to 3)`);
        else ok[k] = Math.round(n);
      }
      if (Object.keys(ok).length) { trip.type = Object.assign({}, trip.type, ok); real = true; filled.push("interests: " + Object.entries(ok).map(([k, v]) => `${TRIP_TYPES[k]} ${v}`).join(", ")); }
    }
  }

  if (obj.travellers !== undefined) {
    if (!Array.isArray(obj.travellers)) dropped.push("travellers (not a list of people)");
    else {
      const list = obj.travellers.slice(0, MAX_TRAVELLERS).filter((p, i) => { if (isObj(p)) return true; dropped.push(`traveller ${i + 1} (not a person)`); return false; });
      if (obj.travellers.length > MAX_TRAVELLERS) dropped.push(`travellers after the first ${MAX_TRAVELLERS}`);
      if (list.length) {
        trip.travellers = list.map((p, i) => { const nm = str(p.name, 40); return { id: uid("p"), name: nm, limits: checkLimits(p.limits, kind, nm || `person ${i + 1}`, dropped) }; });
        const named = trip.travellers.filter(p => p.name).length, limited = trip.travellers.filter(p => Object.keys(p.limits).length);
        if (named || limited.length) real = true;
        filled.push(`${trip.travellers.length} traveller${trip.travellers.length > 1 ? "s" : ""}${named ? ": " + trip.travellers.map(p => p.name || "(no name)").join(", ") : ""}`);
        for (const p of limited) filled.push(`limits for ${p.name || "a traveller"}: ${Object.entries(p.limits).map(([k, v]) => `${sayLimit(k, v)}`).join(", ")}`);
      }
    }
  }

  if (obj.budget !== undefined) {
    const b = obj.budget;
    if (!isObj(b)) dropped.push("budget (not an amount and currency)");
    else {
      if (b.currency !== undefined) { if (CURRENCIES.includes(b.currency)) trip.budget.currency = b.currency; else dropped.push(`currency ${JSON.stringify(b.currency)} (use ${CURRENCIES.join(", ")}; amounts kept in ${trip.budget.currency})`); }
      const total = num(b.total), pp = num(b.perPerson), inRange = n => Number.isFinite(n) && n >= 0 && n <= MAX_BUDGET;
      if (b.total !== undefined && inRange(total)) { trip.budget.total = Math.round(total); real = true; filled.push(`budget ${trip.budget.total} ${trip.budget.currency} for the group`); }
      else if (b.perPerson !== undefined && inRange(pp)) { trip.budget.perPerson = Math.round(pp); trip.budget.total = trip.budget.perPerson * trip.travellers.length; real = true; filled.push(`budget ${trip.budget.total} ${trip.budget.currency} for the group (${trip.budget.perPerson} each)`); }
      else if (b.total !== undefined || b.perPerson !== undefined) dropped.push(`budget (needs a number from 0 to ${MAX_BUDGET})`);
    }
  }

  const assumptions = Array.isArray(obj.assumptions) ? obj.assumptions.filter(a => typeof a === "string" && a.trim()).slice(0, 10).map(a => a.trim().slice(0, 200)) : [];
  if (!real) return { error: ERR.empty };

  const desc = String(text || "").trim().slice(0, MAX_TEXT);
  trip.notes = [desc, str(obj.notes, MAX_TEXT), ...extraNotes].filter(Boolean).join("\n");
  if (!trip.name) trip.name = trip.dates.start ? `${MONTHS[+trip.dates.start.slice(5, 7) - 1]} ${trip.dates.start.slice(0, 4)} trip` : "New trip";

  const list = (title, items) => items.length ? `${title}\n${items.map(x => "• " + x).join("\n")}` : "";
  const summary = [list("Filled in by the chatbot:", filled), list("Not used:", dropped), list("Its guesses to check:", assumptions), "Check everything in the form below."].filter(Boolean).join("\n\n");
  trip.brief = [];
  if (desc) trip.brief.push({ who: "you", text: desc });
  trip.brief.push({ who: "app", text: summary });
  migrate(trip);
  return { trip, filled, dropped, assumptions, summary };
}
