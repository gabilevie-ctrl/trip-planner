import { esc, fmtMoney, fmtDateY } from "../ui.js";
import { computePlan, itinerary, tripLength } from "../compute.js";
import { planningSteps } from "../criteria.js";

export function render(ctx) {
  const t = ctx.trip; const link = ctx.shareLink();
  const d = ctx.dests.find(x => x.id === t.chosen);
  return `
  <section class="card">
    <h2>Share this trip</h2>
    <p class="muted">The link carries the whole trip (people, limits, dates, plans, expenses, decisions, log). Whoever opens it gets a copy they can edit in their own browser; send a new link when things change. Nothing is stored on a server.</p>
    <div class="row"><input type="text" id="shareLink" value="${esc(link)}" readonly aria-label="Share link"><button type="button" data-act="copy-link">Copy link</button></div>
    <p class="muted small">${link.length.toLocaleString("en-GB")} characters. Very long links can be refused by some messaging apps; the JSON export below always works.</p>
    <div class="row"><button type="button" class="outline" data-act="export-json">Copy trip as JSON</button><button type="button" class="outline" data-act="copy-summary">Copy a text summary</button></div>
    <textarea id="exportBox" rows="6" class="hidden" readonly></textarea>
  </section>
  <section class="card">
    <h3>Summary</h3>
    <pre class="summary">${esc(summary(t, d))}</pre>
  </section>`;
}

export function summary(t, d) {
  const lines = [];
  lines.push(`${t.name || "Trip"} (${t.kind})`);
  lines.push(`${t.travellers.map(p => p.name || "?").join(", ")} · from ${t.origin.city} · ${t.travel.mode}`);
  if (t.dates.start) lines.push(`${fmtDateY(t.dates.start)} → ${fmtDateY(t.dates.end)} (${tripLength(t)} days)`);
  if (t.budget.total) lines.push(`Budget ${fmtMoney(t.budget.total, t.budget.currency)} for the group`);
  if (d) {
    const c = computePlan(d, t);
    lines.push("", `Destination: ${d.name} — ${fmtMoney(c.pp, t.budget.currency)} pp, ${fmtMoney(c.total, t.budget.currency)} total${t.budget.total ? (c.fits ? " (within budget)" : " (over budget)") : ""}`);
    lines.push(`${c.city} city/town days · ${c.outdoor} outdoor/stage days · ${c.rest} rest · ${Math.max(c.free, 0)} travel · highest ${c.maxAlt} m · ${hrsTxt(c.hrs)} in transit`);
    if (c.flags.length) lines.push(`Flags: ${c.flags.join("; ")}`);
    lines.push("", "Day by day:");
    for (const day of itinerary(d, t)) lines.push(`  ${day.n}. ${day.date}  ${day.label}${day.block?.hut ? " — " + day.block.hut.name : ""}`);
    const steps = planningSteps(t, d, c.plan); const open = steps.filter(s => !t.steps[s.key]);
    lines.push("", `Planning steps: ${steps.length - open.length}/${steps.length} done`);
    for (const s of open.slice(0, 12)) lines.push(`  [ ] ${s.phase}: ${s.label}`);
  } else lines.push("", "No destination chosen yet.");
  const openD = t.decisions.filter(x => x.status !== "decided");
  if (openD.length) { lines.push("", "Open decisions:"); for (const x of openD) lines.push(`  - ${x.title}${x.due ? " (by " + x.due + ")" : ""}`); }
  return lines.join("\n");
}
const hrsTxt = h => (Math.round(h * 2) / 2) + " h";

export const actions = {
  "copy-link": (el, ctx) => ctx.copy(document.getElementById("shareLink").value, el),
  "export-json": (el, ctx) => { const box = document.getElementById("exportBox"); box.classList.remove("hidden"); box.value = JSON.stringify(ctx.trip, (k, v) => k === "_ui" ? undefined : v, 2); ctx.copy(box.value, el); },
  "copy-summary": (el, ctx) => { const d = ctx.dests.find(x => x.id === ctx.trip.chosen); const box = document.getElementById("exportBox"); box.classList.remove("hidden"); box.value = summary(ctx.trip, d); ctx.copy(box.value, el); }
};
