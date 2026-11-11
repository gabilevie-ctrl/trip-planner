// Trips store (localStorage), new-trip defaults, and share-link encoding.
// Pure except for localStorage access, which is guarded.
const KEY = "tripplanner.v1";
export const SCHEMA = 1;

export function uid(prefix = "t") { return prefix + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

export function newTrip(kind = "explore") {
  const now = new Date().toISOString();
  return {
    schema: SCHEMA, id: uid(), name: "", owner: "", kind, createdAt: now, updatedAt: now,
    origin: { city: "Brussels", region: "europe-west" },
    travel: { mode: "any" },
    travellers: [{ id: uid("p"), name: "", limits: {} }],
    dates: { start: "", end: "" },
    budget: { total: 0, currency: "EUR" },
    lodging: kind === "explore" ? "bnb" : "bnb",
    type: kind === "explore" ? { cities: 2, hike: 2, coast: 0, wildlife: 0, history: 1 } : {},
    pace: "normal", visited: [], visitedCountries: [], weights: {},
    plans: {}, chosen: null, ideas: [],
    steps: {}, expenses: [], decisions: [], dayNotes: {}, log: [], notes: "", brief: [],
    options: [], livePlan: null, rates: {}
  };
}

export function load() {
  try { const raw = localStorage.getItem(KEY); if (raw) { const s = JSON.parse(raw); if (s && s.trips) return s; } } catch (e) { /* storage unavailable */ }
  return { trips: {}, current: null };
}
export function save(store) { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ } }
export function touch(trip) { trip.updatedAt = new Date().toISOString(); return trip; }

/* ---- Share links: compress JSON to a hash-safe alphabet (letters, digits, hyphens). ---- */
export function encodeShare(trip, lz) {
  const json = JSON.stringify(stripForShare(trip));
  const s = lz.compressToEncodedURIComponent(json);
  // compressToEncodedURIComponent uses A-Z a-z 0-9 + - $ ; map + - $ to hyphen pairs
  return "s-" + s.replace(/-/g, "-M").replace(/\+/g, "-P").replace(/\$/g, "-D");
}
export function decodeShare(hash, lz) {
  if (!hash || !hash.startsWith("s-")) return null;
  const body = hash.slice(2).replace(/-P/g, "+").replace(/-D/g, "$").replace(/-M/g, "-");
  try { const json = lz.decompressFromEncodedURIComponent(body); const t = JSON.parse(json); return t && t.id ? t : null; } catch (e) { return null; }
}
export function stripForShare(trip) {
  // Everything but transient UI state and device-only history; photos are never in the trip.
  const copy = JSON.parse(JSON.stringify(trip));
  delete copy._ui; delete copy._local;
  return copy;
}

/* Trip migrations: add fields introduced after a trip was created. */
export function migrate(trip) {
  const fresh = newTrip(trip.kind || "explore");
  for (const k of Object.keys(fresh)) if (trip[k] === undefined) trip[k] = fresh[k];
  if (!trip.travel) trip.travel = { mode: "any" };
  if (!Array.isArray(trip.travellers)) trip.travellers = [];
  trip.schema = SCHEMA;
  return trip;
}
