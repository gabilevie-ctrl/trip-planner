// Calls Claude (Messages API) from the browser with web search, over raw HTTP: the official SDK needs a bundler,
// and this app has none. Never throws: failures come back as { ok: false, error, message } in plain words.
export const API_URL = "https://api.anthropic.com/v1/messages";
export const MODEL = "claude-opus-5-5";
export const WEB_SEARCH = { type: "web_search_20260209", name: "web_search", max_uses: 5 };
const MAX_CONTINUES = 3;
const TOOL_ACK = "Saved. The app now shows it and checks it against every traveller's limits. Now reply to the traveller in text only, as the instructions say.";

export const MESSAGES = {
  auth: "The saved key no longer works. Ask Gabriel for the new password.",
  rate: "Live search is busy or over this month's limit. Try again in a minute.",
  server: "Claude's servers had a problem. Try again shortly.",
  network: "No connection to live search. Check the internet connection.",
  refusal: "Claude declined that request.",
  "bad-response": "Live search sent back something unexpected.",
  "cut-off": "Claude's answer was cut off before the end. Try again, or ask for fewer options.",
  timeout: "Claude took too long to answer, or the connection dropped. Keep this tab open while it works, then try again."
};
const fail = error => ({ ok: false, error, message: MESSAGES[error] });

// A plan can take minutes; past this the call is given up with a clear message instead of "busy" forever.
export const TIMEOUT_MS = 8 * 60 * 1000;
export async function ask({ timeoutMs = TIMEOUT_MS, ...rest }) {
  const ctl = new AbortController(); const timer = setTimeout(() => ctl.abort(), timeoutMs);
  try { return await askOnce({ ...rest, signal: ctl.signal }); }
  finally { clearTimeout(timer); }
}
async function askOnce({ apiKey, system, messages, tools = [], maxTokens = 16000, signal, fetchImpl = (...a) => fetch(...a) }) {
  const convo = messages.slice();
  const content = []; let usage = {};
  for (let i = 0; i <= MAX_CONTINUES; i++) {
    const body = {
      model: MODEL, max_tokens: maxTokens, thinking: { type: "adaptive" }, output_config: { effort: "medium" }, fallbacks: "default",
      system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
      tools: [WEB_SEARCH, ...tools], messages: convo
    };
    let res;
    try {
      res = await fetchImpl(API_URL, { method: "POST", headers: {
        "content-type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true", "anthropic-beta": "server-side-fallback-2026-07-01"
      }, body: JSON.stringify(body), signal });
    } catch (e) { return fail(signal?.aborted ? "timeout" : "network"); }
    if (res.status === 401 || res.status === 403) return fail("auth");
    if (res.status === 429) return fail("rate");
    if (res.status >= 500) return fail("server");
    let data;
    try { data = JSON.parse(await res.text()); } catch (e) { return fail(signal?.aborted ? "timeout" : "bad-response"); }
    if (!res.ok || !data || !Array.isArray(data.content)) return fail("bad-response");
    if (data.stop_reason === "refusal") return fail("refusal");
    if (data.stop_reason === "max_tokens") return fail("cut-off");
    content.push(...data.content); usage = data.usage || usage;
    if (data.stop_reason === "pause_turn") { convo.push({ role: "assistant", content: data.content }); continue; }
    // Claude waits for our tool result before writing its reply: acknowledge every app tool call once, then let it finish.
    const uses = data.stop_reason === "tool_use" ? data.content.filter(b => b.type === "tool_use") : [];
    if (!uses.length) break;
    convo.push({ role: "assistant", content: data.content });
    convo.push({ role: "user", content: uses.map(b => ({ type: "tool_result", tool_use_id: b.id, content: TOOL_ACK })) });
  }
  return {
    ok: true,
    text: content.filter(b => b.type === "text").map(b => b.text).join("").trim(),
    toolCalls: content.filter(b => b.type === "tool_use").map(b => ({ name: b.name, input: b.input })),
    searches: content.filter(b => b.type === "server_tool_use" && b.name === "web_search").length,
    usage
  };
}
