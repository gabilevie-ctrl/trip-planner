import test from "node:test"; import assert from "node:assert/strict";
import { ask } from "../src/claude.js";

const reply = (status, body) => async () => ({ ok: status < 400, status, text: async () => typeof body === "string" ? body : JSON.stringify(body) });
function recorder(responses) {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, init, body: JSON.parse(init.body) }); const r = responses.shift(); return r(); };
  return { calls, fetchImpl };
}
const base = { apiKey: "sk-ant-x", system: "You plan trips.", messages: [{ role: "user", content: "warm in January" }] };

test("sends the agreed model, settings, headers and web search first", async () => {
  const { calls, fetchImpl } = recorder([reply(200, { stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }], usage: {} })]);
  const tool = { name: "propose_options", description: "d", strict: true, input_schema: { type: "object", properties: {}, required: [], additionalProperties: false } };
  const r = await ask({ ...base, tools: [tool], fetchImpl });
  assert.equal(r.ok, true); assert.equal(r.text, "Hi");
  const { url, init, body } = calls[0];
  assert.equal(url, "https://api.anthropic.com/v1/messages");
  assert.equal(init.headers["x-api-key"], "sk-ant-x");
  assert.equal(init.headers["anthropic-version"], "2023-06-01");
  assert.equal(init.headers["anthropic-dangerous-direct-browser-access"], "true");
  assert.equal(init.headers["anthropic-beta"], "server-side-fallback-2026-07-01");
  assert.equal(body.model, "claude-opus-5-5"); assert.deepEqual(body.thinking, { type: "adaptive" });
  assert.deepEqual(body.output_config, { effort: "medium" }); assert.equal(body.max_tokens, 16000); assert.equal(body.fallbacks, "default");
  assert.deepEqual(body.tools[0], { type: "web_search_20260209", name: "web_search", max_uses: 5 });
  assert.equal(body.tools[1].name, "propose_options");
});
test("collects text, custom tool calls and the number of searches", async () => {
  const { fetchImpl } = recorder([reply(200, { stop_reason: "end_turn", usage: { output_tokens: 9 }, content: [
    { type: "server_tool_use", name: "web_search", id: "s1", input: { query: "x" } }, { type: "web_search_tool_result", tool_use_id: "s1", content: [] },
    { type: "text", text: "Three ideas." }, { type: "tool_use", id: "t1", name: "propose_options", input: { options: [{ name: "La Palma" }] } }] })]);
  const r = await ask({ ...base, fetchImpl });
  assert.equal(r.text, "Three ideas."); assert.equal(r.searches, 1);
  assert.equal(r.toolCalls[0].name, "propose_options"); assert.equal(r.toolCalls[0].input.options[0].name, "La Palma");
});
test("pause_turn is continued with the assistant content appended", async () => {
  const paused = [{ type: "server_tool_use", name: "web_search", id: "s1", input: {} }];
  const { calls, fetchImpl } = recorder([reply(200, { stop_reason: "pause_turn", content: paused, usage: {} }), reply(200, { stop_reason: "end_turn", content: [{ type: "text", text: "Done" }], usage: {} })]);
  const r = await ask({ ...base, fetchImpl });
  assert.equal(calls.length, 2); assert.equal(r.text, "Done"); assert.equal(r.searches, 1);
  const last = calls[1].body.messages.at(-1); assert.equal(last.role, "assistant"); assert.deepEqual(last.content, paused);
});
for (const [status, error] of [[401, "auth"], [429, "rate"], [529, "server"], [500, "server"]]) {
  test(`HTTP ${status} becomes error "${error}" with a plain message`, async () => {
    const { fetchImpl } = recorder([reply(status, { type: "error", error: { message: "x" } })]);
    const r = await ask({ ...base, fetchImpl }); assert.equal(r.ok, false); assert.equal(r.error, error); assert.ok(r.message.length > 10);
  });
}
test("a network failure becomes error network, never a throw", async () => {
  const r = await ask({ ...base, fetchImpl: async () => { throw new TypeError("Failed to fetch"); } });
  assert.equal(r.ok, false); assert.equal(r.error, "network");
});
test("a refusal becomes error refusal", async () => {
  const { fetchImpl } = recorder([reply(200, { stop_reason: "refusal", content: [], usage: {} })]);
  const r = await ask({ ...base, fetchImpl }); assert.equal(r.error, "refusal");
});
test("a 200 that is not JSON becomes bad-response", async () => {
  const { fetchImpl } = recorder([reply(200, "<html>oops</html>")]);
  const r = await ask({ ...base, fetchImpl }); assert.equal(r.error, "bad-response");
});
test("review I1: after propose_options the tool result is sent back so Claude can finish its reply", async () => {
  const first = { stop_reason: "tool_use", usage: {}, content: [{ type: "text", text: "Searching done. " }, { type: "tool_use", id: "t1", name: "propose_options", input: { options: [] } }] };
  const { calls, fetchImpl } = recorder([reply(200, first), reply(200, { stop_reason: "end_turn", usage: {}, content: [{ type: "text", text: "My pick is La Palma." }] })]);
  const r = await ask({ ...base, fetchImpl });
  assert.equal(calls.length, 2); assert.equal(r.toolCalls[0].name, "propose_options");
  assert.match(r.text, /My pick is La Palma\./);
  const msgs = calls[1].body.messages; assert.equal(msgs.at(-2).role, "assistant");
  const tr = msgs.at(-1); assert.equal(tr.role, "user"); assert.equal(tr.content[0].type, "tool_result"); assert.equal(tr.content[0].tool_use_id, "t1");
});
test("minor: an answer cut off by max_tokens becomes error cut-off, not a half answer", async () => {
  const { fetchImpl } = recorder([reply(200, { stop_reason: "max_tokens", usage: {}, content: [{ type: "text", text: "Here are" }] })]);
  const r = await ask({ ...base, fetchImpl }); assert.equal(r.ok, false); assert.equal(r.error, "cut-off"); assert.match(r.message, /cut off/);
});
test("maxTokens is sent when given", async () => {
  const { calls, fetchImpl } = recorder([reply(200, { stop_reason: "end_turn", content: [{ type: "text", text: "Hi" }], usage: {} })]);
  await ask({ ...base, maxTokens: 32000, fetchImpl });
  assert.equal(calls[0].body.max_tokens, 32000);
});
test("final I5: a call that hangs past the timeout ends with a clear message", async () => {
  const fetchImpl = (u, init) => new Promise((_, rej) => init.signal.addEventListener("abort", () => rej(new Error("aborted"))));
  const r = await ask({ ...base, fetchImpl, timeoutMs: 20 });
  assert.equal(r.ok, false); assert.equal(r.error, "timeout"); assert.match(r.message, /Keep this tab open/);
});
