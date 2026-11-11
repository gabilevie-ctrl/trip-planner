import { esc, fmtDateY, fmtMoney, empty } from "../ui.js";
import { KINDS } from "../criteria.js";
import { tripLength } from "../compute.js";
import { readDescription, describeTurn } from "../describe.js";
import { suggestFor } from "./setup.js";
import { buildPrompt, readReply, tripFromReply } from "../chatbot.js";

// The "Ask a chatbot" panel lives here, not in the store: a reload simply closes it.
const panel = { text: "", open: false, prompt: "", reply: "", error: "" };
const resetPanel = () => Object.assign(panel, { text: "", open: false, prompt: "", reply: "", error: "" });
const localToday = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function chatbotPanel() {
  if (!panel.open) return "";
  return `<div class="chatbot" aria-label="Ask a chatbot">
        <h3>1. Copy this into Claude, ChatGPT or any chatbot</h3>
        <p class="muted small">What you wrote goes to that chatbot, not to this app.</p>
        <textarea id="chatbotPrompt" rows="6" readonly>${esc(panel.prompt)}</textarea>
        <button type="button" class="outline" data-act="chatbot-copy">Copy</button>
        <h3>2. Paste its whole reply here</h3>
        <textarea id="chatbotReply" rows="5" placeholder="The chatbot's answer, with the JSON block">${esc(panel.reply)}</textarea>
        ${panel.error ? `<p class="chatbot-error" role="alert">${esc(panel.error)}</p>` : ""}
        <button type="button" data-act="chatbot-fill">Fill in my trip</button>
        <button type="button" class="linklike" data-act="chatbot-close">Close</button>
      </div>`;
}

export function render(ctx) {
  const trips = Object.values(ctx.store.trips).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const cards = trips.map(t => {
    const n = (t.travellers || []).length;
    const when = t.dates?.start ? `${fmtDateY(t.dates.start)} → ${fmtDateY(t.dates.end)} · ${tripLength(t)} days` : "Dates not set";
    const chosen = t.chosen ? (ctx.names[t.chosen] || t.chosen) : "No destination chosen yet";
    return `<article class="tripcard" data-act="open-trip" data-id="${t.id}" tabindex="0" role="button">
      <header><span class="kind">${esc(KINDS[t.kind]?.label || t.kind)}</span><h3>${esc(t.name || "Untitled trip")}</h3></header>
      <p>${esc(when)}</p>
      <p class="muted">${t.owner ? "Owner " + esc(t.owner) + " · " : ""}${n} traveller${n === 1 ? "" : "s"} · ${t.budget?.total ? fmtMoney(t.budget.total, t.budget.currency) + " budget" : "no budget set"} · from ${esc(t.origin?.city || "?")}</p>
      <p><strong>${esc(chosen)}</strong></p>
      <footer>${t._ui?.confirmDelete ? `<span class="small">Delete this trip? </span><button type="button" class="small" data-act="delete-trip-confirm" data-id="${t.id}">Yes, delete</button> <button type="button" class="outline secondary small" data-act="delete-trip-cancel" data-id="${t.id}">Keep</button>` : `<button type="button" class="outline secondary small" data-act="delete-trip" data-id="${t.id}">Delete</button>`}</footer>
    </article>`;
  }).join("");
  return `
  <section class="hero">
    <h1>Plan a trip together</h1>
    <p class="lead">Set who is coming and their limits once. Get destinations that fit, build the days, book from prefilled links, track the money and the decisions. Share the link; whoever opens it gets the whole plan.</p>
    <div class="card describe">
      <h2>Describe your trip</h2>
      <p class="muted">In your own words: who is coming, when and for how long, the budget, where from, what you love and what someone can't do. The form fills itself in; you check it next.</p>
      <textarea id="describeText" rows="4" placeholder="e.g. Five of us from Brussels, two weeks in July. Mom can't do heat or altitude. We love old towns and food, a bit of walking, no flights. About €15,000.">${esc(panel.text)}</textarea>
      <div class="describebtns"><button type="button" data-act="describe-new">Start from my description</button>
      <button type="button" class="outline" data-act="describe-chatbot">Ask a chatbot to fill it in</button></div>
      <p class="muted small">The chatbot way understands names and who has which limit; it takes two copy-and-pastes.</p>
      ${chatbotPanel()}
    </div>
    <p class="muted">Or pick a kind of trip and fill the form yourself:</p>
    <div class="kinds">
      ${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="kindbtn" data-act="new-trip" data-kind="${k}"><strong>${esc(v.label)}</strong><span>${esc(v.blurb)}</span></button>`).join("")}
    </div>
    <p class="muted">Or <button type="button" class="linklike" data-act="import-prompt">import a trip from a link or a JSON file</button>.</p>
    <div id="importBox" class="hidden"><label>Paste a share link or JSON<textarea id="importText" rows="3" placeholder="https://…#s-… or {…}"></textarea></label><button type="button" data-act="import-go">Import</button></div>
  </section>
  <section>
    <h2>Start from a prepared trip</h2>
    <div class="grid3">${ctx.templates.map(tp => `<article class="tripcard" data-act="use-template" data-file="${esc(tp.file)}" tabindex="0" role="button"><header><span class="kind">${esc(tp.kindLabel)}</span><h3>${esc(tp.name)}</h3></header><p class="muted">${esc(tp.blurb)}</p><p><strong>Open a copy →</strong></p></article>`).join("")}</div>
  </section>
  <section>
    <h2>Your trips</h2>
    ${trips.length ? `<div class="grid3">${cards}</div>` : empty("No trips yet", "Pick a kind of trip above to start. Everything is saved in this browser; share a link to move it elsewhere.")}
  </section>`;
}

export const actions = {
  "describe-new": (el, ctx) => {
    const txt = document.getElementById("describeText").value.trim();
    if (!txt) { ctx.toast("Write a few words about the trip first."); return; }
    const t = ctx.createTrip(readDescription(txt).kind);
    if (ctx.liveStatus === "unlocked") { ctx.open(t.id, "setup"); ctx.runLive(t, txt); return; }
    describeTurn(t, txt, { countries: ctx.countries, suggest: suggestFor(ctx) }); ctx.open(t.id, "setup");
  },
  "describe-chatbot": (el, ctx) => {
    const txt = document.getElementById("describeText").value.trim();
    if (!txt) { ctx.toast("Write a few words about the trip first."); return; }
    Object.assign(panel, { text: txt, open: true, prompt: buildPrompt(txt, { today: localToday() }), error: "" });
    ctx.rerender();
  },
  "chatbot-copy": (el, ctx) => ctx.copy(panel.prompt, el),
  "chatbot-close": (el, ctx) => { const txt = document.getElementById("describeText")?.value || ""; resetPanel(); panel.text = txt; ctx.rerender(); },
  "chatbot-fill": (el, ctx) => {
    panel.reply = document.getElementById("chatbotReply").value;
    panel.text = document.getElementById("describeText").value.trim() || panel.text;
    let r;
    try { const read = readReply(panel.reply); r = read.error ? read : tripFromReply(read.obj, { text: panel.text, today: localToday() }); }
    catch (e) { console.error(e); r = { error: "Something in that reply could not be read, so nothing was filled. Ask the chatbot for the JSON again." }; }
    if (r.error) { panel.error = r.error; ctx.rerender(); return; }
    const t = ctx.addTrip(r.trip); resetPanel(); ctx.open(t.id, "setup");
  },
  "new-trip": (el, ctx) => { const t = ctx.createTrip(el.dataset.kind); ctx.open(t.id, "setup"); },
  "open-trip": (el, ctx) => ctx.open(el.dataset.id, "setup"),
  "delete-trip": (el, ctx, ev) => { ev.stopPropagation(); const t = ctx.store.trips[el.dataset.id]; t._ui = t._ui || {}; t._ui.confirmDelete = true; ctx.rerender(); },
  "delete-trip-cancel": (el, ctx, ev) => { ev.stopPropagation(); const t = ctx.store.trips[el.dataset.id]; if (t && t._ui) delete t._ui.confirmDelete; ctx.rerender(); },
  "delete-trip-confirm": (el, ctx, ev) => { ev.stopPropagation(); delete ctx.store.trips[el.dataset.id]; if (ctx.store.current === el.dataset.id) ctx.store.current = null; ctx.save(); ctx.rerender(); ctx.toast("Trip deleted."); },
  "use-template": async (el, ctx) => { const t = await ctx.loadTemplate(el.dataset.file); if (t) ctx.open(t.id, "setup"); else ctx.toast("Could not load that template."); },
  "import-prompt": () => document.getElementById("importBox").classList.toggle("hidden"),
  "import-go": (el, ctx) => { const txt = document.getElementById("importText").value.trim(); const t = ctx.importText(txt); if (t) ctx.open(t.id, "setup"); else ctx.toast("Could not read that link or JSON."); }
};
