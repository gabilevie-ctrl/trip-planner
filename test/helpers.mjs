import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export function dest(id) { return JSON.parse(fs.readFileSync(path.join(root, "data", "destinations", id + ".json"), "utf8")); }
export function allDests() { const idx = JSON.parse(fs.readFileSync(path.join(root, "data", "index.json"), "utf8")); return idx.map(e => dest(e.id)); }
export function familyTrip(over = {}) {
  return Object.assign({
    schema: 1, id: "t_test", name: "Parents' 30th", kind: "explore", origin: { city: "Brussels", region: "europe-west" }, travel: { mode: "any" },
    travellers: [{ id: "p1", name: "Mom", limits: { maxAltitudeM: 4200, maxDayHighC: 33, crowds: "avoid" } }, { id: "p2", name: "Dad", limits: {} }, { id: "p3", name: "Gabriel", limits: {} }, { id: "p4", name: "Antoine", limits: { maxHikeShare: 60 } }, { id: "p5", name: "Sib", limits: {} }],
    dates: { start: "2027-07-12", end: "2027-07-26" }, budget: { total: 15000, currency: "EUR" }, lodging: "bnb", type: { cities: 2, hike: 2, history: 1 }, visited: [], weights: {}, plans: {}, chosen: null, ideas: [], steps: {}, expenses: [], decisions: [], dayNotes: {}, log: [], notes: ""
  }, over);
}
export function skiTrip(over = {}) {
  return familyTrip(Object.assign({ id: "t_ski", name: "Écrins week", kind: "skitour", travel: { mode: "drive" }, dates: { start: "2027-03-20", end: "2027-03-26" }, budget: { total: 4000, currency: "EUR" },
    travellers: [{ id: "a", name: "Gabriel", limits: { maxGradeSki: "ZS", maxDanger: "3", maxDailyAscentM: 1300 } }, { id: "b", name: "Friend", limits: { maxDanger: "2" } }], type: {} }, over));
}
