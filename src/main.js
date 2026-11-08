// Router, shell and event delegation. Views render HTML strings; actions mutate the trip and call ctx.commit().
import * as state from "./state.js";
import * as data from "./data.js";
import * as compute from "./compute.js";
import { KINDS } from "./criteria.js";
import { esc, fmtDateY, labelCells } from "./ui.js";
import { feedbackMailto } from "./links.js";
import * as home from "./views/home.js";
import * as setup from "./views/setup.js";
import * as destinations from "./views/destinations.js";
import * as build from "./views/build.js";
import * as itinerary from "./views/itinerary.js";
import * as plan from "./views/plan.js";
import * as money from "./views/money.js";
import * as decisions from "./views/decisions.js";
import * as conditions from "./views/conditions.js";
import * as share from "./views/share.js";

const VIEWS = { setup, destinations, build, itinerary, plan, money, decisions, conditions, share };
const TABS = [["setup", "Setup"], ["destinations", "Destinations"], ["build", "Build"], ["itinerary", "Itinerary"], ["plan", "Plan & book"], ["money", "Money"], ["decisions", "Decisions"], ["conditions", "Conditions"], ["share", "Share"]];
const app = document.getElementById("app");
const HEAD = `<header class="apphead"><a class="brand" href="#home">Trip<span>Planner</span></a><span class="muted small">Every change is saved automatically in this browser · <a href="#share">share by link</a> to move it elsewhere <span id="saved" class="savedflag"></span></span><a class="feedback small" data-feedback href="${feedbackMailto()}">Send feedback</a></header>`;
const store = state.load();
for (const id of Object.keys(store.trips)) state.migrate(store.trips[id]);
let destsLite = [], dests = [], destsKind = null, templates = [], countries = [];
const lz = window.LZString;

const ctx = {
  store, compute, get templates() { return templates; }, get countries() { return countries; },
  loadTemplate: async file => { try { const r = await fetch(new URL("../data/trips/" + file, import.meta.url)); if (!r.ok) return null; const t = await r.json(); t.id = state.uid(); t.createdAt = t.updatedAt = new Date().toISOString(); return importTrip(t); } catch (e) { return null; } },
  get trip() { return store.trips[store.current]; }, get dests() { return dests; }, get destsLite() { return destsLite; }, get names() { return Object.fromEntries(destsLite.map(d => [d.id, d.name])); },
  save: () => state.save(store),
  commit: (rerender = true) => { if (ctx.trip) state.touch(ctx.trip); state.save(store); savedFlash(); if (rerender) render(); },
  rerender: () => render(),
  nav: tab => { location.hash = "#" + tab; },
  open: (id, tab) => { store.current = id; state.save(store); if (location.hash === "#" + tab) render(); else location.hash = "#" + tab; },
  createTrip: kind => { const t = state.newTrip(kind); store.trips[t.id] = t; store.current = t.id; state.save(store); return t; },
  importText: txt => { let t = null; const m = txt.match(/#(s-[A-Za-z0-9-]+)/); if (m) t = state.decodeShare(m[1], lz); else { try { t = JSON.parse(txt); } catch (e) { t = null; } } if (!t || !t.id) return null; return importTrip(t); },
  shareLink: () => { const url = new URL(location.href); url.hash = state.encodeShare(ctx.trip, lz); return url.toString(); },
  copy: (text, el) => { const done = () => { if (el) { const old = el.textContent; el.textContent = "Copied"; setTimeout(() => el.textContent = old, 1500); } }; if (navigator.clipboard) navigator.clipboard.writeText(text).then(done).catch(() => toast("Copy failed; select the text and copy it yourself.")); else toast("Copy is not available here; select the text and copy it yourself."); },
  toast, confirm: msg => window.confirm ? window.confirm(msg) : true
};

function importTrip(t) {
  state.migrate(t);
  if (store.trips[t.id] && JSON.stringify(store.trips[t.id]) !== JSON.stringify(t)) { t.id = state.uid(); t.name = (t.name || "Trip") + " (imported)"; }
  store.trips[t.id] = t; store.current = t.id; state.save(store); return t;
}

function savedFlash() { const el = document.getElementById("saved"); if (!el) return; el.textContent = "Saved " + new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }); el.classList.add("show"); clearTimeout(savedFlash._t); savedFlash._t = setTimeout(() => el.classList.remove("show"), 1800); }
function toast(msg) { const el = document.getElementById("toast"); el.textContent = msg; el.classList.add("show"); clearTimeout(toast._t); toast._t = setTimeout(() => el.classList.remove("show"), 2600); }

async function ensureDests(kind) {
  if (destsKind === kind && dests.length) return;
  dests = await data.loadAll(kind); destsKind = kind;
}

function currentView() { const h = (location.hash || "#home").slice(1); if (h.startsWith("s-")) return "import"; return h; }

async function render() {
  let view = currentView();
  if (view === "import") { const t = state.decodeShare(location.hash.slice(1), lz); if (t) { importTrip(t); toast("Trip imported from the link."); location.hash = "#setup"; return; } view = "home"; }
  const trip = ctx.trip;
  if (view !== "home" && view !== "new" && !trip) { location.hash = "#home"; return; }
  if (view === "new") view = "home";
  try {
    if (trip) await ensureDests(trip.kind);
    let html;
    if (view === "home") html = home.render(ctx);
    else {
      const v = VIEWS[view] || setup;
      const tabs = TABS.filter(([k]) => k !== "conditions" || trip.kind !== "explore");
      const head = `<header class="triphead">
        <div><a href="#home" class="back">← All trips</a><h1>${esc(trip.name || "Untitled trip")} <span class="kind">${esc(KINDS[trip.kind].label)}</span></h1>
        <p class="muted">${trip.dates.start ? `${fmtDateY(trip.dates.start)} → ${fmtDateY(trip.dates.end)} · ${compute.tripLength(trip)} days` : "Dates not set"} · ${trip.travellers.length} traveller${trip.travellers.length === 1 ? "" : "s"} · from ${esc(trip.origin.city)}${trip.chosen ? ` · <strong>${esc(ctx.names[trip.chosen] || trip.chosen)}</strong>` : ""}</p></div>
      </header>
      <nav class="tabs" aria-label="Trip steps" title="Every step is optional; go in any order">${tabs.map(([k, l], i) => `<a href="#${k}" aria-current="${k === view ? "page" : "false"}"><span class="n">${i + 1}</span> ${l}</a>`).join("")}</nav>`;
      html = head + `<main class="view view-${view}">${v.render(ctx)}</main>`;
    }
    app.innerHTML = HEAD + html;
    labelCells(app);
  } catch (e) { console.error(e); app.innerHTML = `<section class="card"><h2>Something went wrong</h2><p>${esc(e.message)}</p><p><a href="#home">Back to trips</a></p></section>`; }
}

/* ---------- Event delegation ---------- */
function setPath(obj, path, value) { const parts = path.split("."); let o = obj; for (let i = 0; i < parts.length - 1; i++) { const k = parts[i]; if (o[k] === undefined || o[k] === null) o[k] = /^\d+$/.test(parts[i + 1]) ? [] : {}; o = o[k]; } o[parts[parts.length - 1]] = value; }
function bound(el) { const t = ctx.trip; if (!t) return; let v = el.value; if (el.dataset.type === "number") v = el.value === "" ? undefined : +el.value; if (el.dataset.type === "bool") v = el.checked; setPath(t, el.dataset.bind, v); }

document.addEventListener("click", e => {
  const el = e.target.closest("[data-act]"); if (!el) return;
  if (el.tagName === "INPUT" && el.type === "checkbox") return; // handled on change
  const act = el.dataset.act; const view = currentView(); const mod = view === "home" ? home : (VIEWS[view] || setup);
  const fn = (mod.actions && mod.actions[act]) || home.actions[act];
  if (fn) { if (el.tagName !== "BUTTON" && el.tagName !== "A") e.preventDefault(); fn(el, ctx, e); }
});
document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.matches("[role=button][data-act]")) e.target.click(); });
document.addEventListener("change", e => {
  const el = e.target;
  if (el.matches("input[type=checkbox][data-act]")) { const view = currentView(); const mod = view === "home" ? home : (VIEWS[view] || setup); const fn = mod.actions && mod.actions[el.dataset.act]; if (fn) fn(el, ctx, e); return; }
  if (el.matches("[data-act-change]")) { const view = currentView(); const mod = VIEWS[view]; const fn = mod && mod.actions[el.dataset.actChange]; if (fn) fn(el, ctx, e); return; }
  if (el.matches("[data-bind]")) { bound(el); const rerender = !(el.tagName === "INPUT" && (el.type === "text" || el.type === "search")) || el.dataset.bind === "name" || el.dataset.bind.startsWith("travellers"); ctx.commit(rerender); if (!rerender) ctx.save(); return; }
  if (el.matches("[data-ui]")) { const t = ctx.trip; t._ui = t._ui || {}; t._ui[el.dataset.ui] = el.type === "checkbox" ? el.checked : el.value; render(); return; }
  if (el.matches("[data-log]")) { conditions.onLogChange(el, ctx); return; }
});
document.addEventListener("input", e => {
  const el = e.target;
  if (el.matches("input[type=search][data-ui]")) { const t = ctx.trip; t._ui = t._ui || {}; const key = el.dataset.ui; t._ui[key] = el.value; clearTimeout(render._q); render._q = setTimeout(() => { const pos = el.selectionStart; render().then(() => { const q = document.querySelector(`input[type=search][data-ui="${key}"]`); if (q) { q.focus(); q.setSelectionRange(pos, pos); } }); }, 250); }
  if (el.matches("input[type=range][data-bind]")) { bound(el); const lbl = el.previousElementSibling; if (lbl && lbl.classList.contains("num")) lbl.textContent = ["off", "low", "medium", "high"][el.value] || el.value; clearTimeout(render._r); render._r = setTimeout(() => ctx.commit(true), 400); }
});
document.addEventListener("submit", e => {
  const form = e.target.closest("form[data-form]"); if (!form) return; e.preventDefault();
  const view = currentView(); const mod = VIEWS[view]; const fn = mod && mod.forms && mod.forms[form.dataset.form]; if (!fn) return;
  const data = Object.fromEntries(new FormData(form).entries()); fn(data, ctx, form); form.reset();
});
window.addEventListener("hashchange", render);

data.loadIndex().then(async idx => { destsLite = idx; try { countries = await data.loadCountries(); } catch (e) { countries = []; } try { const r = await fetch(new URL("../data/trips/index.json", import.meta.url)); if (r.ok) templates = await r.json(); } catch (e) { templates = []; } render(); }).catch(e => { app.innerHTML = `<section class="card"><h2>Could not load the destination library</h2><p>${esc(e.message)}. If you opened this file directly, serve the folder over HTTP (for example <code>python3 -m http.server</code>).</p></section>`; });
