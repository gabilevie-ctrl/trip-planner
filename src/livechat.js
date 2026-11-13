// One live chat turn: the rule-based reader fills the form at once, then Claude (with web search) answers
// and may replace the trip's options or write and change the chosen option's plan. Pure apart from the injected ask(); never throws.
import { describeTurn } from "./describe.js";
import { OPTIONS_TOOL, normalizeOptions } from "./options.js";
import { SYSTEM_PROMPT, tripContext } from "./prompts.js";
import { WRITE_PLAN_TOOL, UPDATE_PLAN_TOOL, mergePlan, liveChoice, currentPlan } from "./liveplan.js";

const HISTORY = 6, KEEP_SETS = 3, PLAN_TOKENS = 32000, OPTION_TOKENS = 16000;

/* Earlier thread entries as alternating user/assistant messages that start with a user turn. */
function historyMessages(brief) {
  const out = [];
  for (const m of brief.filter(m => !m.error).slice(-HISTORY)) {
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

  // A chosen option means a plan turn: its answer is much longer than a shortlist.
  const res = await ask({ apiKey, system: SYSTEM_PROMPT, messages, tools: [OPTIONS_TOOL, WRITE_PLAN_TOOL, UPDATE_PLAN_TOOL], maxTokens: liveChoice(trip) ? PLAN_TOKENS : OPTION_TOKENS });
  if (!res || !res.ok) {
    trip.brief.push({ who: "app", text: res?.message || "Live search failed.", live: true, error: true });
    return { ok: false, error: res?.error || "bad-response", reply: res?.message || "", optionsChanged: false, planChanged: false };
  }
  const call = res.toolCalls.find(c => c.name === "propose_options");
  let optionsChanged = false, planChanged = false;
  if (call) {
    const { options, rates } = normalizeOptions(call.input, trip, { today });
    if (options.length) {
      trip._local = trip._local || { optionHistory: [], lastSynced: null };
      trip._local.optionHistory = (trip._local.optionHistory || []).concat(trip.options?.length ? [{ at: new Date().toISOString(), options: trip.options }] : []).slice(-KEEP_SETS);
      trip.options = options; trip.rates = rates; optionsChanged = true;
    }
  }
  // Plan calls, in order, only while an option is chosen (new options may have replaced the chosen one).
  for (const c of res.toolCalls.filter(c => c.name === "write_plan" || c.name === "update_plan")) {
    if (!liveChoice(trip)) break;
    const existing = currentPlan(trip);
    const { plan, rates } = mergePlan(existing, c.input, trip, { today, partial: c.name === "update_plan" && !!existing, optionId: trip.chosen });
    trip._local = trip._local || { optionHistory: [], lastSynced: null };
    if (trip.livePlan) trip._local.planHistory = (trip._local.planHistory || []).concat([{ at: new Date().toISOString(), plan: trip.livePlan }]).slice(-KEEP_SETS);
    trip.livePlan = plan; trip.rates = rates; planChanged = true;
  }
  const fallback = planChanged ? (call && optionsChanged ? "Here are the options and the plan." : res.toolCalls.some(c => c.name === "write_plan") ? "Here is the plan." : "The plan is updated.")
    : call ? "Here are the options." : "No new options this time.";
  const entry = { who: "app", text: res.text || fallback, live: true };
  if (optionsChanged) entry.optionsRev = new Date().toISOString();
  if (planChanged) entry.planRev = new Date().toISOString();
  trip.brief.push(entry);
  return { ok: true, reply: entry.text, optionsChanged, planChanged };
}
