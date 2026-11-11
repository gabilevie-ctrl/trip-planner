import test from "node:test"; import assert from "node:assert/strict";
import { lockKey } from "../src/keylock.js";
import { createVault } from "../src/vault.js";

const PASS = "correct horse battery staple";
const mapStore = () => { const m = new Map(); return { m, get: async k => m.get(k), set: async (k, v) => { m.set(k, v); }, del: async k => { m.delete(k); } }; };
const lockP = lockKey("sk-ant-vault-test", PASS, { iterations: 1000 });
const holdsKeyText = store => [...store.m.values()].some(v => JSON.stringify(v ?? null).includes("sk-ant-vault-test") || String(v).includes("sk-ant-vault-test"));

test("no lock file: status none, unlock says no-lock", async () => {
  const v = createVault({ loadLock: async () => null, store: mapStore() });
  assert.equal(await v.status(), "none");
  assert.deepEqual(await v.unlock(PASS), { ok: false, reason: "no-lock" });
});
test("wrong password: refused, nothing stored", async () => {
  const lock = await lockP; const store = mapStore();
  const v = createVault({ loadLock: async () => lock, store });
  assert.deepEqual(await v.unlock("not the family password at all", { remember: true }), { ok: false, reason: "wrong-password" });
  assert.equal(store.m.size, 0); assert.equal(await v.status(), "locked"); assert.equal(await v.apiKey(), null);
});
test("right password without remember: works in this tab only", async () => {
  const lock = await lockP; const store = mapStore();
  const v = createVault({ loadLock: async () => lock, store });
  assert.deepEqual(await v.unlock(PASS), { ok: true });
  assert.equal(await v.status(), "unlocked"); assert.equal(await v.apiKey(), "sk-ant-vault-test");
  const v2 = createVault({ loadLock: async () => lock, store });
  assert.equal(await v2.status(), "locked");
});
test("remember: a new vault on the same device opens without the password, and the key text is never stored", async () => {
  const lock = await lockP; const store = mapStore();
  await createVault({ loadLock: async () => lock, store }).unlock(PASS, { remember: true });
  assert.ok(store.m.size > 0); assert.ok(!holdsKeyText(store));
  const v2 = createVault({ loadLock: async () => lock, store });
  assert.equal(await v2.status(), "unlocked"); assert.equal(await v2.apiKey(), "sk-ant-vault-test");
});
test("a re-locked key drops the remembered entry", async () => {
  const lock = await lockP; const store = mapStore();
  await createVault({ loadLock: async () => lock, store }).unlock(PASS, { remember: true });
  const relocked = await lockKey("sk-ant-new", PASS, { iterations: 1000 });
  const v2 = createVault({ loadLock: async () => ({ ...relocked, createdAt: "2099-01-01T00:00:00.000Z" }), store });
  assert.equal(await v2.status(), "locked"); assert.equal(store.m.size, 0);
});
test("forget clears the device", async () => {
  const lock = await lockP; const store = mapStore();
  const v = createVault({ loadLock: async () => lock, store });
  await v.unlock(PASS, { remember: true }); await v.forget();
  assert.equal(store.m.size, 0); assert.equal(await v.status(), "locked");
});
