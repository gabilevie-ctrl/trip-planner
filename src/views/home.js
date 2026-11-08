import { esc, fmtDateY, fmtMoney, empty } from "../ui.js";
import { KINDS } from "../criteria.js";
import { tripLength } from "../compute.js";

export function render(ctx) {
  const trips = Object.values(ctx.store.trips).sort((a, b) => (b.updatedAt || "").localeCompare(a.updatedAt || ""));
  const cards = trips.map(t => {
    const n = (t.travellers || []).length;
    const when = t.dates?.start ? `${fmtDateY(t.dates.start)} → ${fmtDateY(t.dates.end)} · ${tripLength(t)} days` : "Dates not set";
    const chosen = t.chosen ? (ctx.names[t.chosen] || t.chosen) : "No destination chosen yet";
    return `<article class="tripcard" data-act="open-trip" data-id="${t.id}" tabindex="0" role="button">
      <header><span class="kind">${esc(KINDS[t.kind]?.label || t.kind)}</span><h3>${esc(t.name || "Untitled trip")}</h3></header>
      <p>${esc(when)}</p>
      <p class="muted">${n} traveller${n === 1 ? "" : "s"} · ${t.budget?.total ? fmtMoney(t.budget.total, t.budget.currency) + " budget" : "no budget set"} · from ${esc(t.origin?.city || "?")}</p>
      <p><strong>${esc(chosen)}</strong></p>
      <footer><button type="button" class="outline secondary small" data-act="delete-trip" data-id="${t.id}">Delete</button></footer>
    </article>`;
  }).join("");
  return `
  <section class="hero">
    <h1>Plan a trip together</h1>
    <p class="lead">Set who is coming and their limits once. Get destinations that fit, build the days, book from prefilled links, track the money and the decisions. Share the link; whoever opens it gets the whole plan.</p>
    <div class="kinds">
      ${Object.entries(KINDS).map(([k, v]) => `<button type="button" class="kindbtn" data-act="new-trip" data-kind="${k}"><strong>${esc(v.label)}</strong><span>${esc(v.blurb)}</span></button>`).join("")}
    </div>
    <p class="muted">Or <button type="button" class="linklike" data-act="import-prompt">import a trip from a link or a JSON file</button>.</p>
    <div id="importBox" class="hidden"><label>Paste a share link or JSON<textarea id="importText" rows="3" placeholder="https://…#s-… or {…}"></textarea></label><button type="button" data-act="import-go">Import</button></div>
  </section>
  <section>
    <h2>Your trips</h2>
    ${trips.length ? `<div class="grid3">${cards}</div>` : empty("No trips yet", "Pick a kind of trip above to start. Everything is saved in this browser; share a link to move it elsewhere.")}
  </section>`;
}

export const actions = {
  "new-trip": (el, ctx) => { const t = ctx.createTrip(el.dataset.kind); ctx.open(t.id, "setup"); },
  "open-trip": (el, ctx) => ctx.open(el.dataset.id, "setup"),
  "delete-trip": (el, ctx, ev) => { ev.stopPropagation(); if (!ctx.confirm("Delete this trip? This cannot be undone.")) return; delete ctx.store.trips[el.dataset.id]; if (ctx.store.current === el.dataset.id) ctx.store.current = null; ctx.save(); ctx.rerender(); },
  "import-prompt": () => document.getElementById("importBox").classList.toggle("hidden"),
  "import-go": (el, ctx) => { const txt = document.getElementById("importText").value.trim(); const t = ctx.importText(txt); if (t) ctx.open(t.id, "setup"); else ctx.toast("Could not read that link or JSON."); }
};
