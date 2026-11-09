// Holds the unlocked Anthropic key for this tab. "Remember on this device" keeps only the
// non-extractable AES key a password derives (never the key text), tied to the lock's createdAt.
import { deriveKey, openLock } from "./keylock.js";

const ENTRY = "family";

export function createVault({ loadLock, store }) {
  let lockP = null, key = null;
  const lock = () => (lockP = lockP || Promise.resolve().then(loadLock).catch(() => null));

  async function fromRemembered(l) {
    const saved = await store.get(ENTRY).catch(() => null);
    if (!saved) return null;
    if (saved.createdAt !== l.createdAt) { await store.del(ENTRY).catch(() => {}); return null; }
    try { return await openLock(l, saved.cryptoKey); } catch (e) { await store.del(ENTRY).catch(() => {}); return null; }
  }

  return {
    async status() {
      const l = await lock(); if (!l) return "none";
      if (key) return "unlocked";
      key = await fromRemembered(l);
      return key ? "unlocked" : "locked";
    },
    async unlock(password, { remember = false } = {}) {
      const l = await lock(); if (!l) return { ok: false, reason: "no-lock" };
      let ck;
      try { ck = await deriveKey(password, l); key = await openLock(l, ck); }
      catch (e) { return { ok: false, reason: "wrong-password" }; }
      if (remember) await store.set(ENTRY, { cryptoKey: ck, createdAt: l.createdAt }).catch(() => {});
      return { ok: true };
    },
    async apiKey() { return (await this.status()) === "unlocked" ? key : null; },
    async forget() { key = null; await store.del(ENTRY).catch(() => {}); }
  };
}

/* IndexedDB store "tripplanner-vault"/"keys"; an in-memory Map where IndexedDB is missing (jsdom, some private modes). */
function idbStore() {
  if (typeof indexedDB === "undefined") { const m = new Map(); return { get: async k => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; }
  const db = new Promise((res, rej) => { const r = indexedDB.open("tripplanner-vault", 1); r.onupgradeneeded = () => r.result.createObjectStore("keys"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  const run = (mode, fn) => db.then(d => new Promise((res, rej) => { const tx = d.transaction("keys", mode); const req = fn(tx.objectStore("keys")); tx.oncomplete = () => res(req.result); tx.onerror = () => rej(tx.error); }));
  return { get: k => run("readonly", s => s.get(k)), set: (k, v) => run("readwrite", s => s.put(v, k)), del: k => run("readwrite", s => s.delete(k)) };
}

export function browserVault() {
  return createVault({
    loadLock: async () => { const r = await fetch(new URL("../data/claude-key.json", import.meta.url)); return r.ok ? r.json() : null; },
    store: idbStore()
  });
}
