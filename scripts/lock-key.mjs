// npm run lock-key — lock Gabriel's Anthropic API key with the family password into data/claude-key.json.
// Prompts without echo; never prints the key. See docs/LIVE-SETUP.md.
import fs from "node:fs"; import path from "node:path"; import readline from "node:readline"; import { fileURLToPath } from "node:url";
import { lockKey, MIN_PASSWORD } from "../src/keylock.js";

const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "data", "claude-key.json");

function ask(question) {
  return new Promise(resolve => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl.stdoutMuted = false;
    rl._writeToOutput = s => { if (!rl.stdoutMuted) rl.output.write(s); };
    rl.question(question, answer => { rl.close(); process.stdout.write("\n"); resolve(answer.trim()); });
    rl.stdoutMuted = true;
  });
}

const key = await ask("Anthropic API key: ");
if (!key.startsWith("sk-ant-")) { console.error("That does not look like an Anthropic API key (it should start with sk-ant-)."); process.exit(1); }
const pass = await ask(`Family password (${MIN_PASSWORD}+ characters, e.g. five random words): `);
if (pass.length < MIN_PASSWORD) { console.error(`The password must be at least ${MIN_PASSWORD} characters.`); process.exit(1); }
const again = await ask("Same password again: ");
if (again !== pass) { console.error("The two passwords differ; nothing was written."); process.exit(1); }
const lock = await lockKey(key, pass);
fs.writeFileSync(out, JSON.stringify(lock, null, 2) + "\n");
console.log("Locked. Commit data/claude-key.json and push; tell the family the password.");
