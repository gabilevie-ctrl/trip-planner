// Loads the destination library (data/index.json + one file per destination), cached in memory.
const base = new URL("../data/", import.meta.url);
let index = null; const cache = new Map();

export async function loadIndex() {
  if (index) return index;
  const r = await fetch(new URL("index.json", base)); if (!r.ok) throw new Error("Could not load data/index.json");
  index = await r.json(); return index;
}
export async function loadDestination(id) {
  if (cache.has(id)) return cache.get(id);
  const idx = await loadIndex(); const e = idx.find(x => x.id === id); if (!e) return null;
  const r = await fetch(new URL(e.file, base)); if (!r.ok) throw new Error("Could not load " + e.file);
  const d = await r.json(); cache.set(id, d); return d;
}
export async function loadAll(kind) {
  const idx = await loadIndex();
  const list = kind ? idx.filter(x => x.kind === kind) : idx;
  return Promise.all(list.map(x => loadDestination(x.id)));
}
let countries = null;
export async function loadCountries() { if (countries) return countries; const r = await fetch(new URL("countries.json", base)); countries = r.ok ? await r.json() : []; return countries; }
