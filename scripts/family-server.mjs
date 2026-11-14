// npm run family — the trip planner on this Mac, with live search through Claude Code signed in with your
// Claude account (your subscription; no API key, no credits). Open the address it prints; keep this window open.
import path from "node:path"; import { fileURLToPath } from "node:url"; import { spawn } from "node:child_process";
import { startFamilyServer, claudeArgs, claudeEnv, parseHelperResult } from "./lib/helper.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8787;

/* A tiny call made exactly like the real ones (same model, flags and structured output), so a missing sign-in,
   a usage limit or a broken setup shows now rather than in front of the family. */
function checkSignIn() {
  return new Promise(resolve => {
    let out = "";
    const schema = { type: "object", properties: { reply: { type: "string" } }, required: ["reply"], additionalProperties: false };
    let child; try { child = spawn("claude", claudeArgs(schema, "Reply with the single word OK in reply. Do not search."), { cwd: process.env.TMPDIR || "/tmp", env: claudeEnv(process.env), stdio: ["pipe", "pipe", "ignore"] }); }
    catch (e) { return resolve("missing"); }
    const timer = setTimeout(() => { child.kill(); resolve("slow"); }, 120000);
    child.on("error", () => { clearTimeout(timer); resolve("missing"); });
    child.stdout.on("data", c => { out += c; });
    child.stdin.on("error", () => {}); child.stdin.end("Say OK.");
    child.on("close", () => { clearTimeout(timer); const r = parseHelperResult(out); resolve(r.ok ? "ok" : r.error === "helper-auth" ? "signed-out" : r.error === "rate" ? "limit" : "error"); });
  });
}

try {
  const srv = await startFamilyServer({ port, root });
  console.log(`\nTrip planner with live search on this Mac: ${srv.url}\nKeep this window open while you use it. Stop with Ctrl+C.\n`);
  const s = await checkSignIn();
  if (s === "ok") console.log("Claude Code is signed in: live search is ready.");
  else if (s === "signed-out") console.log("Claude Code isn't signed in. In another terminal run: claude   then type /login and sign in with your Claude account.");
  else if (s === "limit") console.log("Your Claude plan's usage limit is reached for now; live search will work again after it resets.");
  else if (s === "missing") console.log("Claude Code isn't installed on this Mac, so live search won't work (the rest of the app does).");
  else console.log("Couldn't check Claude Code just now; live search will say if something is wrong.");
} catch (e) {
  console.error(e.code === "EADDRINUSE" ? `Port ${port} is busy: is the trip planner already running? Or run: PORT=8788 npm run family` : e.message);
  process.exit(1);
}
