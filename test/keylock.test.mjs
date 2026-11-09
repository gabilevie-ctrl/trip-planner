import test from "node:test"; import assert from "node:assert/strict";
import { lockKey, unlockKey } from "../src/keylock.js";

test("a locked key opens with the right password", async () => {
  const lock = await lockKey("sk-ant-test-123", "correct horse battery staple", { iterations: 1000 });
  assert.equal(lock.v, 1); assert.equal(lock.iterations, 1000);
  assert.ok(!JSON.stringify(lock).includes("sk-ant-test-123"));
  assert.equal(await unlockKey(lock, "correct horse battery staple"), "sk-ant-test-123");
});
test("a wrong password is refused as wrong-password", async () => {
  const lock = await lockKey("sk-ant-test-123", "correct horse battery staple", { iterations: 1000 });
  await assert.rejects(unlockKey(lock, "correct horse battery stapler"), /wrong-password/);
});
test("short passwords are refused when locking", async () => {
  await assert.rejects(lockKey("sk-ant-x", "short pass"), /at least 20 characters/);
});
test("the default strength is at least 600,000 iterations", async () => {
  const lock = await lockKey("sk-ant-x", "a".repeat(20)); assert.ok(lock.iterations >= 600000);
});
