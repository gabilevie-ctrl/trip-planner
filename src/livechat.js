// One live chat turn: the rule-based reader fills the form at once, then Claude (with web search) answers
// and may replace the trip's options. Pure apart from the injected ask(); never throws.
import { describeTurn } from "./describe.js";
import { OPTIONS_TOOL, normalizeOptions } from "./options.js";
import { SYSTEM_PROMPT, tripContext } from "./prompts.js";

const HISTORY = 6, KEEP_SETS = 3;

/* Earlier thread entries as alternating user/assistant messages that start with a user turn. */
function historyMessages(brief) {
  const out = [];
  for (const m of brief.slice(-HISTORY)) {
    const role = m.who === "app" ? "assistant" : "user"; const text = String(m.text || "").trim(); if (!text) continue;
    if (out.length && out.at(-1).role === role) out.at(-1).content += "\n\n" + text; else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out;
}

export async function liveTurn(trip, text, { ask, apiKey, today = new Date().toISOString().slice(0, 10), countries = [] }) {
  const msg = String(text || "").trim(); if (!msg) return null;
  const before = (trip.brief || []).slice();
  // Library ideas would contradict live options, so the reader runs without them; its reply stays only when it filled something.
  const r = describeTurn(trip, msg, { countries, today });
  if (!r.changes.length && !(r.parsed.guesses || []).length) trip.brief.pop();

  const messages = historyMessages(before);
  const final = `Today is ${today}.\n\nCurrent trip:\n${tripContext(trip)}\n\nMessage:\n${msg}`;
  if (messages.length && messages.at(-1).role === "user") messages.at(-1).content += "\n\n" + final; else messages.push({ role: "user", content: final });

  const res = await ask({ apiKey, system: SYSTEM_PROMPT, messages, tools: [OPTIONS_TOOL] });
  if (!res || !res.ok) {
    trip.brief.push({ who: "app", text: res?.message || "Live search failed.", live: true, error: true });
    return { ok: false, error: res?.error || "bad-response", reply: res?.message || "", optionsChanged: false };
  }
  const call = res.toolCalls.find(c => c.name === "propose_options");
  let optionsChanged = false;
  const entry = { who: "app", text: res.text || (call ? "Here are the options." : "No new options this time."), live: true };
  if (call) {
    const { options, rates } = normalizeOptions(call.input, trip, { today });
    if (options.length) {
      trip._local = trip._local || { optionHistory: [], lastSynced: null };
      trip._local.optionHistory = (trip._local.optionHistory || []).concat(trip.options?.length ? [{ at: new Date().toISOString(), options: trip.options }] : []).slice(-KEEP_SETS);
      trip.options = options; trip.rates = rates; optionsChanged = true;
      entry.optionsRev = new Date().toISOString();
    }
  }
  trip.brief.push(entry);
  return { ok: true, reply: entry.text, optionsChanged };
}
