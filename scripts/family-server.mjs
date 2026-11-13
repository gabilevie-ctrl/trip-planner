// npm run family — the trip planner on this Mac, with live search through Claude Code signed in with your
// Claude account (your subscription; no API key, no credits). Open the address it prints; keep this window open.
import path from "node:path"; import { fileURLToPath } from "node:url"; import { spawn } from "node:child_process";
import { startFamilyServer } from "./lib/helper.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.env.PORT) || 8787;

/* A tiny Claude Code call, so a missing sign-in shows now rather than in front of the family. */
function checkSignIn() {
  return new Promise(resolve => {
    let out = "";
    let child; try { child = spawn("claude", ["-p", "Reply with the single word OK.", "--output-format", "json", "--model", "haiku"], { stdio: ["ignore", "pipe", "ignore"] }); }
    catch (e) { return resolve("missing"); }
    const timer = setTimeout(() => { child.kill(); resolve("slow"); }, 60000);
    child.on("error", () => { clearTimeout(timer); resolve("missing"); });
    child.stdout.on("data", c => { out += c; });
    child.on("close", () => { clearTimeout(timer); try { const o = JSON.parse(out); resolve(o.is_error ? (/authenticat|401|oauth|log ?in/i.test(String(o.result)) ? "signed-out" : "error") : "ok"); } catch (e) { resolve("error"); } });
  });
}

try {
  const srv = await startFamilyServer({ port, root });
  console.log(`\nTrip planner with live search on this Mac: ${srv.url}\nKeep this window open while you use it. Stop with Ctrl+C.\n`);
  const s = await checkSignIn();
  if (s === "ok") console.log("Claude Code is signed in: live search is ready.");
  else if (s === "signed-out") console.log("Claude Code isn't signed in. In another terminal run: claude   then type /login and sign in with your Claude account.");
  else if (s === "missing") console.log("Claude Code isn't installed on this Mac, so live search won't work (the rest of the app does).");
  else console.log("Couldn't check Claude Code just now; live search will say if something is wrong.");
} catch (e) {
  console.error(e.code === "EADDRINUSE" ? `Port ${port} is busy: is the trip planner already running? Or run: PORT=8788 npm run family` : e.message);
  process.exit(1);
}
