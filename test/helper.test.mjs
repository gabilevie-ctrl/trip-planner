import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { buildHelperRequest, parseHelperResult, safePath, originAllowed, startFamilyServer } from "../scripts/lib/helper.mjs";
import { askHelper } from "../src/claude.js";
import { OPTIONS_TOOL } from "../src/options.js";
import { WRITE_PLAN_TOOL, UPDATE_PLAN_TOOL } from "../src/liveplan.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const TOOLS = [OPTIONS_TOOL, WRITE_PLAN_TOOL, UPDATE_PLAN_TOOL];
const req = { system: "You plan trips.", tools: TOOLS, maxTokens: 16000, messages: [
  { role: "user", content: "warm hiking in January" }, { role: "assistant", content: "Here are ideas." }, { role: "user", content: "Current trip:\n{\"x\":1}\n\nMessage:\ncheaper?" }] };

test("the helper turns an app request into one Claude Code call: the thread as the prompt, the tools as structured output", () => {
  const r = buildHelperRequest(req);
  assert.match(r.prompt, /warm hiking in January[\s\S]*Here are ideas\.[\s\S]*cheaper\?$/);
  assert.ok(r.systemPrompt.startsWith("You plan trips."));
  assert.match(r.systemPrompt, /propose_options/);
  assert.deepEqual(Object.keys(r.schema.properties).sort(), ["propose_options", "reply", "update_plan", "write_plan"]);
  assert.deepEqual(r.schema.required.sort(), ["propose_options", "reply", "update_plan", "write_plan"]);
  assert.deepEqual(r.schema.properties.write_plan.anyOf[1], { type: "null" });
  assert.deepEqual(r.schema.properties.write_plan.anyOf[0], WRITE_PLAN_TOOL.input_schema);
});

test("Claude Code's answer comes back in the app's shape; a sign-in problem and junk are named", () => {
  const ok = parseHelperResult(JSON.stringify({ is_error: false, structured_output: { reply: "Hi", propose_options: { options: [] }, write_plan: null, update_plan: null } }));
  assert.deepEqual(ok, { ok: true, text: "Hi", toolCalls: [{ name: "propose_options", input: { options: [] } }], searches: 0, usage: {} });
  const auth = parseHelperResult(JSON.stringify({ is_error: true, result: "Failed to authenticate. API Error: 401 OAuth access token is invalid." }));
  assert.equal(auth.ok, false); assert.equal(auth.error, "helper-auth"); assert.match(auth.message, /\/login/);
  assert.equal(parseHelperResult("not json").error, "bad-response");
  assert.equal(parseHelperResult(JSON.stringify({ is_error: false, result: "no structure" })).error, "bad-response");
  const limit = parseHelperResult(JSON.stringify({ is_error: true, result: "Claude AI usage limit reached|1731600000" }));
  assert.equal(limit.error, "rate");
});

test("only files inside the app are served, never git or the work folders", () => {
  assert.equal(safePath(root, "/src/main.js"), path.join(root, "src", "main.js"));
  assert.equal(safePath(root, "/"), path.join(root, "index.html"));
  for (const bad of ["/../etc/passwd", "/%2e%2e/%2e%2e/etc/passwd", "/.git/config", "/.superpowers/sdd/x", "/node_modules/jsdom/package.json", "/scripts/lib/helper.mjs"]) assert.equal(safePath(root, bad), null, bad);
});

test("only the app's own page may ask Claude", () => {
  assert.equal(originAllowed("http://localhost:8787", 8787), true);
  assert.equal(originAllowed("http://127.0.0.1:8787", 8787), true);
  for (const o of ["https://evil.example", "http://localhost:8000", "null", undefined, ""]) assert.equal(originAllowed(o, 8787), false, String(o));
});

test("the family server serves the app and runs Claude Code with web search only, for its own page only", async () => {
  const log = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "fam-")), "args.json");
  process.env.FAKE_CLAUDE_LOG = log; process.env.FAKE_CLAUDE_MODE = "ok";
  const srv = await startFamilyServer({ port: 0, root, claudeBin: [process.execPath, path.join(root, "test", "fixtures", "fake-claude.mjs")] });
  try {
    const page = await fetch(srv.url + "/"); assert.equal(page.status, 200); assert.match(await page.text(), /<title>/i);
    assert.equal((await fetch(srv.url + "/.git/config")).status, 404);
    const status = await (await fetch(srv.url + "/api/claude/status")).json(); assert.equal(status.ok, true);
    const own = srv.url; const post = (origin, body) => fetch(srv.url + "/api/claude/ask", { method: "POST", headers: { "content-type": "application/json", origin }, body: JSON.stringify(body) });
    assert.equal((await post("https://evil.example", req)).status, 403);
    const r = await (await post(own, req)).json();
    assert.equal(r.ok, true); assert.equal(r.text, "Here are three ideas."); assert.equal(r.toolCalls[0].name, "propose_options");
    const { args, stdin } = JSON.parse(fs.readFileSync(log, "utf8"));
    assert.ok(args.includes("-p") && args.includes("--json-schema") && args.includes("--system-prompt"));
    assert.equal(args[args.indexOf("--output-format") + 1], "json");
    assert.equal(args[args.indexOf("--allowedTools") + 1], "WebSearch WebFetch");
    assert.match(args[args.indexOf("--disallowedTools") + 1], /Bash/);
    assert.match(stdin, /cheaper\?$/);
    process.env.FAKE_CLAUDE_MODE = "auth";
    const a = await (await post(own, req)).json(); assert.equal(a.ok, false); assert.equal(a.error, "helper-auth");
  } finally { await srv.close(); delete process.env.FAKE_CLAUDE_MODE; delete process.env.FAKE_CLAUDE_LOG; }
});

test("the app asks the helper on its own page and gets the same result shape as the API", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => { calls.push({ url, body: JSON.parse(init.body) }); return { ok: true, status: 200, text: async () => JSON.stringify({ ok: true, text: "Hi", toolCalls: [], searches: 0, usage: {} }) }; };
  const r = await askHelper({ system: "s", messages: req.messages, tools: TOOLS, maxTokens: 32000, fetchImpl });
  assert.equal(r.ok, true); assert.equal(calls[0].url, "/api/claude/ask"); assert.equal(calls[0].body.maxTokens, 32000); assert.equal(calls[0].body.tools.length, 3);
  const down = await askHelper({ system: "s", messages: [], fetchImpl: async () => { throw new Error("refused"); } });
  assert.equal(down.ok, false); assert.equal(down.error, "helper-down"); assert.match(down.message, /npm run family/);
});
