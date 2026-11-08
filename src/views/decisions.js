import { esc, fmtDate, empty } from "../ui.js";
import { uid } from "../state.js";

export function auto(trip, ctx) {
  const items = [];
  if (!trip.dates.start || !trip.dates.end) items.push({ title: "Fix the dates", go: "#setup" });
  if (!trip.chosen) items.push({ title: "Choose the destination", go: "#destinations" });
  if (!trip.budget.total) items.push({ title: "Agree a budget", go: "#setup" });
  if (trip.travellers.some(p => !p.name)) items.push({ title: "Name every traveller", go: "#setup" });
  if (trip.kind !== "explore" && trip.chosen) { const p = trip.plans[trip.chosen]; if (p && p.guided === undefined) items.push({ title: "Guided or self-led?", go: "#build" }); }
  return items;
}

export function render(ctx) {
  const t = ctx.trip; const open = t.decisions.filter(d => d.status !== "decided"); const done = t.decisions.filter(d => d.status === "decided");
  const a = auto(t, ctx); const name = id => (t.travellers.find(p => p.id === id)?.name) || "";
  const row = d => `<li class="decision ${d.status}"><div class="row between"><strong>${esc(d.title)}</strong><span class="muted small">${d.owner ? "owner " + esc(name(d.owner)) + " · " : ""}${d.due ? "by " + fmtDate(d.due) : ""}</span></div>${d.options ? `<p class="small">Options: ${esc(d.options)}</p>` : ""}${d.status === "decided" ? `<p><span class="pill good">decided</span> ${esc(d.decision)}</p>` : `<form class="row" data-form="decide" data-id="${d.id}"><input name="decision" placeholder="The decision…" required><button type="submit" class="small">Mark decided</button><button type="button" class="linklike" data-act="del-decision" data-id="${d.id}">remove</button></form>`}</li>`;
  return `
  <section class="card">
    <h2>Decisions</h2>
    ${a.length ? `<div class="alert"><strong>Still open from the setup:</strong> ${a.map(x => `<a href="${x.go}">${esc(x.title)}</a>`).join(" · ")}</div>` : `<div class="alert ok">Setup is complete: dates, destination, budget and travellers are all set.</div>`}
    <form class="grid4" data-form="decision">
      <input name="title" required placeholder="What needs deciding (e.g. Inca Trail or Choquequirao?)">
      <input name="options" placeholder="Options, comma-separated">
      <select name="owner"><option value="">Owner</option>${t.travellers.map(p => `<option value="${p.id}">${esc(p.name || "Traveller")}</option>`).join("")}</select>
      <input name="due" type="date" aria-label="Due date">
      <button type="submit">Add</button>
    </form>
  </section>
  <section class="card"><h3>Open (${open.length})</h3>${open.length ? `<ul class="decisions">${open.map(row).join("")}</ul>` : empty("Nothing open", "Add the questions the group still has to settle.")}</section>
  ${done.length ? `<section class="card"><h3>Decided (${done.length})</h3><ul class="decisions">${done.map(row).join("")}</ul></section>` : ""}`;
}

export const actions = { "del-decision": (el, ctx) => { ctx.trip.decisions = ctx.trip.decisions.filter(d => d.id !== el.dataset.id); ctx.commit(); } };
export const forms = {
  "decision": (data, ctx) => { ctx.trip.decisions.push({ id: uid("d"), title: data.title, options: data.options, owner: data.owner, due: data.due, status: "open", created: new Date().toISOString().slice(0, 10) }); ctx.commit(); },
  "decide": (data, ctx, form) => { const d = ctx.trip.decisions.find(x => x.id === form.dataset.id); if (d) { d.status = "decided"; d.decision = data.decision; d.decidedOn = new Date().toISOString().slice(0, 10); } ctx.commit(); }
};
