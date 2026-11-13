// The family server's pieces: serve the app on this Mac, and answer the app's live requests through Claude Code
// signed in with Gabriel's Claude account (his subscription), instead of the paid API.
// Each request becomes one `claude -p` run: the thread is the prompt, the app's tools become the structured output,
// and only web search and web fetch are allowed.
import http from "node:http"; import fs from "node:fs"; import os from "node:os"; import path from "node:path"; import { spawn } from "node:child_process";

const HELPER_NOTE = `

In this session the app's tools reach you as fields of your structured output, not as tool calls. To call propose_options, write_plan or update_plan, put exactly the input you would give that tool in its field, and leave the others null. Put your text reply to the traveller in "reply". Use web search and web fetch for every current fact, price and date.`;

const MESSAGES = {
  "helper-auth": "Claude Code on this Mac isn't signed in. In a terminal, run claude, type /login, sign in with your Claude account, then try again.",
  rate: "Your Claude plan's usage limit is reached for now. Try again later.",
  server: "Claude Code had a problem answering. Try again.",
  timeout: "Claude took too long to answer. Keep this tab open while it works, then try again.",
  "helper-missing": "Claude Code isn't installed on this Mac, so live search can't run here.",
  "bad-response": "Live search sent back something unexpected."
};
const fail = error => ({ ok: false, error, message: MESSAGES[error] });
const text = c => typeof c === "string" ? c : Array.isArray(c) ? c.map(b => b && b.type === "text" ? b.text : "").join("") : "";

/* One Claude Code run for one app request. */
export function buildHelperRequest({ system = "", messages = [], tools = [] }) {
  const msgs = Array.isArray(messages) ? messages : [];
  const last = msgs.length ? text(msgs.at(-1).content) : "";
  const earlier = msgs.slice(0, -1).map(m => `${m.role === "assistant" ? "You" : "Traveller"}: ${text(m.content)}`).join("\n\n");
  const prompt = earlier ? `Earlier in this conversation:\n\n${earlier}\n\nNow:\n\n${last}` : last;
  const properties = { reply: { type: "string", description: "Your reply to the traveller, shown in the chat." } };
  for (const t of tools) if (t && t.name && t.input_schema) properties[t.name] = { anyOf: [t.input_schema, { type: "null" }], description: t.description || "" };
  const schema = { type: "object", properties, required: Object.keys(properties), additionalProperties: false };
  return { prompt, systemPrompt: String(system) + HELPER_NOTE, schema };
}

/* Claude Code's JSON output, in the shape the app's ask() returns. */
export function parseHelperResult(stdout) {
  let o; try { o = JSON.parse(String(stdout).trim()); } catch (e) { return fail("bad-response"); }
  if (!o || typeof o !== "object") return fail("bad-response");
  if (o.is_error) {
    const r = String(o.result || "");
    if (/authenticat|401|oauth|log ?in/i.test(r)) return fail("helper-auth");
    if (/usage limit|rate limit|429|overloaded/i.test(r)) return fail("rate");
    return fail("server");
  }
  const s = o.structured_output;
  if (!s || typeof s !== "object") return fail("bad-response");
  const toolCalls = Object.entries(s).filter(([k, v]) => k !== "reply" && v && typeof v === "object").map(([name, input]) => ({ name, input }));
  return { ok: true, text: typeof s.reply === "string" ? s.reply.trim() : "", toolCalls, searches: 0, usage: {} };
}

/* A request path mapped to a file of the app, or null: only index.html, src/, data/ and vendor/, no dot-folders. */
const SERVED = new Set(["index.html", "src", "data", "vendor"]);
export function safePath(root, urlPath) {
  let p; try { p = decodeURIComponent(String(urlPath).split("?")[0].split("#")[0]); } catch (e) { return null; }
  if (p === "/" || p === "") p = "/index.html";
  const parts = p.split("/").filter(Boolean);
  if (!parts.length || parts.some(s => s.startsWith(".") || s.includes("\\")) || !SERVED.has(parts[0])) return null;
  const full = path.resolve(root, ...parts);
  return full.startsWith(path.resolve(root) + path.sep) ? full : null;
}

export function originAllowed(origin, port) {
  return origin === `http://localhost:${port}` || origin === `http://127.0.0.1:${port}`;
}

const TYPES = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".ico": "image/x-icon" };
const MAX_BODY = 3 * 1024 * 1024;

/* Run Claude Code once; resolves to the app's result shape, never rejects. */
function runClaude(claudeBin, req, timeoutMs) {
  const { prompt, systemPrompt, schema } = buildHelperRequest(req);
  const args = [...claudeBin.slice(1), "-p", "--output-format", "json", "--json-schema", JSON.stringify(schema), "--system-prompt", systemPrompt,
    "--allowedTools", "WebSearch WebFetch", "--disallowedTools", "Bash Edit Write NotebookEdit Task", "--model", "opus"];
  // An empty folder: Claude Code reads no project files and no CLAUDE.md from here.
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), "trip-claude-"));
  return new Promise(resolve => {
    let out = "", done = false;
    const finish = r => { if (done) return; done = true; clearTimeout(timer); fs.rm(cwd, { recursive: true, force: true }, () => {}); resolve(r); };
    let child;
    try { child = spawn(claudeBin[0], args, { cwd, env: process.env, stdio: ["pipe", "pipe", "pipe"] }); }
    catch (e) { return finish(fail("helper-missing")); }
    const timer = setTimeout(() => { child.kill("SIGTERM"); finish(fail("timeout")); }, timeoutMs);
    child.on("error", e => finish(fail(e.code === "ENOENT" ? "helper-missing" : "server")));
    child.stdout.on("data", c => { out += c; });
    child.stderr.on("data", () => {});
    child.on("close", () => finish(parseHelperResult(out)));
    child.stdin.end(prompt);
  });
}

const json = (res, status, body) => { res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }); res.end(JSON.stringify(body)); };

/* The app and its Claude helper on 127.0.0.1. Resolves to { url, port, close }. */
export function startFamilyServer({ port = 8787, root, claudeBin = ["claude"], timeoutMs = 450000 } = {}) {
  let actualPort = port;
  const server = http.createServer((req, res) => {
    const url = req.url || "/";
    if (url === "/api/claude/status" && req.method === "GET") return json(res, 200, { ok: true });
    if (url === "/api/claude/ask") {
      if (req.method !== "POST") return json(res, 405, { ok: false, error: "method" });
      if (!originAllowed(req.headers.origin, actualPort)) return json(res, 403, { ok: false, error: "origin" });
      let body = "", size = 0;
      req.on("data", c => { size += c.length; if (size > MAX_BODY) { req.destroy(); } else body += c; });
      req.on("end", async () => {
        let r; try { r = JSON.parse(body); } catch (e) { return json(res, 400, fail("bad-response")); }
        json(res, 200, await runClaude(claudeBin, r || {}, timeoutMs));
      });
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") return json(res, 405, { ok: false });
    const file = safePath(root, url);
    if (!file || !fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404, { "content-type": "text/plain" }); return res.end("Not found"); }
    // No caching: an update to the app is seen on the next reload.
    res.writeHead(200, { "content-type": TYPES[path.extname(file)] || "application/octet-stream", "cache-control": "no-store" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve, reject) => {
    server.on("error", reject);
    server.listen(port, "127.0.0.1", () => {
      actualPort = server.address().port;
      resolve({ url: `http://localhost:${actualPort}`, port: actualPort, close: () => new Promise(r => server.close(() => r())) });
    });
  });
}
