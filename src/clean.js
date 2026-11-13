// Shared helpers for cleaning what Claude or a share link sends, and for building strict tool schemas.
// Pure module: no DOM, no network.
export const MODES = ["flight", "train", "ferry", "drive", "bus"];
export const LODGING_TYPES = ["camping", "hut", "hostel", "guesthouse", "hotel", "apartment", "other"];

/* ---------- Schema building ---------- */
export const obj = properties => ({ type: "object", properties, required: Object.keys(properties), additionalProperties: false });
export const S = { type: "string" }, N = { type: "number" }, NN = { type: ["number", "null"] }, B = { type: "boolean" }, SN = { type: ["string", "null"] };
export const SOURCE = obj({ name: S, url: S, seenOn: S });
export const MAYBE_SOURCE = { anyOf: [SOURCE, { type: "null" }] };

/* ---------- Cleaning ---------- */
export const isObj = v => !!v && typeof v === "object" && !Array.isArray(v);
export const str = v => typeof v === "string" ? v.trim() : "";
export const num = v => { if (typeof v === "number" && Number.isFinite(v)) return v; if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v); return null; };
export const day = (v, today) => /^\d{4}-\d{2}-\d{2}$/.test(str(v)) ? str(v) : today;
export const cur = v => /^[A-Za-z]{3}$/.test(str(v)) ? str(v).toUpperCase() : "";
export const https = v => { try { const u = new URL(str(v)); return u.protocol === "https:" ? u.toString() : null; } catch (e) { return null; } };
export function source(s, today) { if (!isObj(s)) return null; const url = https(s.url); if (!url) return null; return { name: str(s.name) || new URL(url).hostname, url, seenOn: day(s.seenOn, today) }; }
export const list = (v, f) => Array.isArray(v) ? v.map(f).filter(x => x !== null && x !== undefined && x !== "") : [];
