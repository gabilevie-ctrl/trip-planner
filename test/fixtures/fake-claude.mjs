#!/usr/bin/env node
// Stands in for the `claude` command line in tests: records its arguments and stdin, then answers like `claude -p --output-format json`.
import fs from "node:fs";
if (process.env.FAKE_CLAUDE_MODE === "exit-early") { process.stdout.write("{}"); process.exit(0); }
let input = "";
process.stdin.on("data", c => { input += c; });
process.stdin.on("end", () => {
  if (process.env.FAKE_CLAUDE_LOG) fs.writeFileSync(process.env.FAKE_CLAUDE_LOG, JSON.stringify({ args: process.argv.slice(2), stdin: input, env: Object.keys(process.env), cwd: process.cwd() }));
  const mode = process.env.FAKE_CLAUDE_MODE || "ok";
  if (mode === "auth") { process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: true, result: "Failed to authenticate. API Error: 401 OAuth access token is invalid." })); process.exit(1); }
  if (mode === "garbage") { process.stdout.write("not json"); return; }
  process.stdout.write(JSON.stringify({ type: "result", subtype: "success", is_error: false, result: "", total_cost_usd: 0,
    structured_output: { reply: "Here are three ideas.", propose_options: { options: [], rates: [] }, write_plan: null, update_plan: null } }));
});
