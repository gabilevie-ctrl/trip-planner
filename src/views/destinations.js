import { esc, fmtMoney, fmtDateY, chip, altClass, tempClass, hrsClass, CROWD, hrs, scoreClass, empty, splitBar } from "../ui.js";
import { computePlan, climateFor, tripLength, isVisited } from "../compute.js";
import { score, CRITERIA_BY_KIND, DEFAULT_WEIGHTS } from "../scoring.js";
import { uid } from "../state.js";

export function render(ctx) {
  const t = ctx.trip; const f = t._ui = Object.assign({ q: "", fit: false, mode: false, zone: "all", showVisited: false, compare: false }, t._ui || {});
  const len = tripLength(t);
  const noDates = !len ? `<div class="alert">No dates yet, so the season column is neutral and budgets assume the planned days plus two travel days. <a href="#setup">Add dates</a> whenever you know them.</div>` : "";
  const rows = ctx.dests.map(d => { const c = computePlan(d, t); const s = score(d, t, c); const cl = climateFor(d, t); return { d, c, s, cl }; })
    .filter(r => f.showVisited || !isVisited(r.d, t))
    .filter(r => !f.q || hay(r.d).includes(f.q.toLowerCase()))
    .filter(r => !f.fit || r.c.fits)
    .filter(r => !f.mode || !r.c.flags.some(x => /needs a flight|Not reachable by car/.test(x)))
    .filter(r => f.zone === "all" || r.d.zone === f.zone)
    .sort((a, b) => b.s.score - a.s.score);
  const labels = CRITERIA_BY_KIND[t.kind]; const w = Object.assign({}, DEFAULT_WEIGHTS[t.kind], t.weights || {});
  const zones = [...new Set(ctx.dests.map(d => d.zone))];
  return `${noDates}
  <section class="card toolbar">
    <input type="search" id="q" placeholder="Search a country, a region, a place, a hut…" value="${esc(f.q)}" data-ui="q" aria-label="Search destinations">
    <label class="chk"><input type="checkbox" data-ui="fit" ${f.fit ? "checked" : ""}> Within budget</label>
    <label class="chk"><input type="checkbox" data-ui="mode" ${f.mode ? "checked" : ""}> Reachable by our travel mode</label>
    <label class="chk"><input type="checkbox" data-ui="showVisited" ${f.showVisited ? "checked" : ""}> Include visited</label>
    <select data-ui="zone" aria-label="Region"><option value="all">All regions</option>${zones.map(z => `<option value="${z}" ${f.zone === z ? "selected" : ""}>${esc(z)}</option>`).join("")}</select>
    <label class="chk"><input type="checkbox" data-ui="compare" ${f.compare ? "checked" : ""}> Compare table</label>
    <span class="muted">${rows.length} of ${ctx.dests.length}</span>
  </section>
  <details class="card"><summary>Rank by what matters (${Object.keys(labels).length} criteria)</summary>
    <div class="grid4">${Object.entries(labels).map(([k, l]) => `<label>${esc(l)} <span class="muted num">${["off", "low", "medium", "high"][w[k]] || w[k]}</span><input type="range" min="0" max="3" step="1" data-bind="weights.${k}" data-type="number" value="${w[k]}"></label>`).join("")}</div>
  </details>
  ${f.compare ? compareTable(rows, t) : rows.map(r => card(r, t, ctx)).join("")}
  ${!rows.length ? `<section class="card">${empty("Nothing matches", "Loosen a filter, or add the place as an idea below.")}</section>` : ""}
  <section class="card">
    <h3>Ideas to explore</h3>
    <p class="muted">A place not in the library yet. It stays in the comparison as a "to explore" row with whatever rough cost you give it.</p>
    <form class="grid4" data-form="idea">
      <input name="name" required placeholder="Destination (e.g. Timor-Leste)">
      <input name="region" placeholder="Country / region">
      <input name="pp" type="number" min="0" step="100" placeholder="Rough cost pp (optional)">
      <input name="note" placeholder="Why / what to check">
      <button type="submit">Add idea</button>
    </form>
    ${t.ideas.length ? `<ul class="ideas">${t.ideas.map(i => `<li><strong>${esc(i.name)}</strong> ${i.region ? "· " + esc(i.region) : ""} ${i.pp ? "· ~" + fmtMoney(i.pp, t.budget.currency) + " pp" : ""} ${i.note ? `<br><span class="muted">${esc(i.note)}</span>` : ""} <button type="button" class="linklike" data-act="remove-idea" data-id="${i.id}">remove</button></li>`).join("")}</ul>` : ""}
  </section>`;
}

const hay = d => [d.name, d.region, d.tagline, d.zone, ...(d.tags || []), ...(d.blocks || []).flatMap(b => [b.name, b.place, b.hut?.name || "", b.history || "", ...(b.see || [])])].join(" ").toLowerCase();

function card({ d, c, s, cl }, t, ctx) {
  const chosen = t.chosen === d.id; const cur = t.budget.currency;
  const limits = c.limits;
  const weather = cl ? `${cl.high}° / ${cl.low}°C, ${cl.rainDays} rain days a month${cl.snow ? ", snow" : ""}` : "";
  return `<article class="card dest ${chosen ? "chosen" : ""} ${c.fits ? "" : "dim"}" id="d-${d.id}">
    <header class="desthead">
      <div><span class="kind">${esc(d.region)}${d.noFlights ? " · no flights" : ""}${isVisited(d, t) ? " · visited" : ""}</span><h3>${esc(d.name)}</h3><p class="muted">${esc(d.tagline)}</p></div>
      <div class="scorebox"><span class="score ${scoreClass(s.score)}">${s.score}</span><div class="pp num">${fmtMoney(c.pp, cur)} pp</div><div class="muted num">${fmtMoney(c.total, cur)} for ${c.n}</div>${t.budget.total ? `<span class="pill ${c.fits ? "good" : "crit"}">${c.fits ? "within budget" : "over by " + fmtMoney(c.over, cur)}</span>` : ""}</div>
    </header>
    <p class="reason">${esc(s.reason)}.</p>
    <div class="facts">
      <div class="fact"><span class="k">Highest point</span><span class="v ${altClass(c.maxAlt, limits.maxAltitudeM)} num">${c.maxAlt.toLocaleString("en-GB")} m</span></div>
      <div class="fact"><span class="k">Weather then${cl ? " (" + esc(cl.place.split(" (")[0]) + ")" : ""}</span><span class="v ${tempClass(cl ? cl.high : c.maxTemp, limits.maxDayHighC)}">${weather || "—"}</span></div>
      <div class="fact"><span class="k">Crowds</span><span class="v ${CROWD[c.worstCrowd][0]}">${CROWD[c.worstCrowd][1]}</span></div>
      <div class="fact"><span class="k">In transit</span><span class="v ${hrsClass(c.hrs)} num">${hrs(c.hrs)}${c.longest ? ` · longest ${hrs(c.longest)}` : ""}</span></div>
      ${d.kind !== "explore" ? `<div class="fact"><span class="k">Hardest day</span><span class="v">${esc(c.maxGradeLabel || "—")} · ${c.maxAscent} m up · ${c.maxHours} h</span></div>` : ""}
      <div class="fact"><span class="k">Season fit</span><span class="v ${scoreClass(s.criteria.season)} num">${s.criteria.season}/100</span></div>
      <div class="fact"><span class="k">Days</span><span class="v num">${c.city} ${d.kind === "explore" ? "cities" : "town"} · ${c.outdoor} ${d.kind === "explore" ? "outdoors" : "stages"} · ${c.rest} rest · ${Math.max(c.free, 0)} travel</span>${splitBar(c)}</div>
      <div class="fact"><span class="k">Getting there</span><span class="v small">${esc(c.access.route)}</span></div>
    </div>
    ${c.flags.length ? `<div class="alert crit"><strong>Limits:</strong> ${c.flags.map(esc).join("; ")}.</div>` : ""}
    ${s.criteria._season.events.length ? `<div class="alert"><strong>In your dates:</strong> ${s.criteria._season.events.map(e => esc(e.name) + (e.note ? " (" + esc(e.note) + ")" : "")).join("; ")}.</div>` : ""}
    <div class="row">
      <span class="muted">Itinerary:</span>${d.presets.map((p, i) => `<button type="button" class="outline secondary small" data-act="preset" data-id="${d.id}" data-i="${i}" aria-pressed="${c.plan.presetIdx === i}">${esc(p.name)}</button>`).join("")}
    </div>
    <footer class="row">
      <button type="button" data-act="choose" data-id="${d.id}" ${chosen ? 'class="secondary"' : ""}>${chosen ? "Chosen ✓ (unchoose)" : "Choose this destination"}</button>
      <button type="button" class="outline" data-act="build" data-id="${d.id}">Build the days →</button>
      ${(d.guides || []).map(g => `<a href="${esc(g.url)}" target="_blank" rel="noopener" class="small">${esc(g.name)}</a>`).join(" · ")}
    </footer>
    <p class="muted small">${provenance(d)}</p>
  </article>`;
}

function compareTable(rows, t) {
  const cur = t.budget.currency;
  return `<section class="card scroller"><table class="cmp"><thead><tr><th>Score</th><th>Destination</th><th>Per person</th><th>Group</th><th>Days</th><th>Highest</th><th>Weather</th><th>Crowds</th><th>Transit</th><th>Season</th><th>Flags</th></tr></thead><tbody>
  ${rows.map(({ d, c, s, cl }) => `<tr class="${c.fits ? "" : "over"}"><td><span class="score ${scoreClass(s.score)}">${s.score}</span></td><td><strong>${esc(d.name)}</strong><br><span class="muted small">${esc(d.region)}</span></td><td class="num">${fmtMoney(c.pp, cur)}</td><td class="num">${fmtMoney(c.total, cur)}${t.budget.total ? `<br><span class="pill ${c.fits ? "good" : "crit"}">${c.fits ? "fits" : "+" + fmtMoney(c.over, cur)}</span>` : ""}</td><td class="num">${c.city}/${c.outdoor}/${c.rest}/${Math.max(c.free, 0)}${splitBar(c)}</td><td>${chip(altClass(c.maxAlt, c.limits.maxAltitudeM), c.maxAlt.toLocaleString("en-GB") + " m")}</td><td>${cl ? `${cl.high}°/${cl.low}° · ${cl.rainDays} rain d${cl.snow ? " · snow" : ""}` : "—"}</td><td>${chip(CROWD[c.worstCrowd][0], CROWD[c.worstCrowd][1])}</td><td>${chip(hrsClass(c.hrs), hrs(c.hrs))}</td><td>${chip(scoreClass(s.criteria.season), s.criteria.season)}</td><td class="small">${c.flags.length ? c.flags.length + " flag" + (c.flags.length > 1 ? "s" : "") : "—"}</td></tr>`).join("")}
  ${t.ideas.map(i => `<tr class="over"><td><span class="pill warn">idea</span></td><td><strong>${esc(i.name)}</strong><br><span class="muted small">${esc(i.region || "")}</span></td><td class="num">${i.pp ? "~" + fmtMoney(i.pp, cur) : "—"}</td><td class="num">${i.pp ? fmtMoney(i.pp * (t.travellers.length || 1), cur) : "—"}</td><td colspan="7" class="small muted">${esc(i.note || "Not built out yet.")}</td></tr>`).join("")}
  </tbody></table><p class="muted small">Days = ${t.kind === "explore" ? "cities / outdoors" : "town / stages"} / rest / travel.</p></section>`;
}

export const actions = {
  "preset": (el, ctx) => { const d = ctx.dests.find(x => x.id === el.dataset.id); const { applyPreset } = ctx.compute; ctx.trip.plans[d.id] = applyPreset(d, +el.dataset.i); ctx.commit(); },
  "choose": (el, ctx) => { ctx.trip.chosen = ctx.trip.chosen === el.dataset.id ? null : el.dataset.id; ctx.commit(); },
  "build": (el, ctx) => { ctx.trip._ui = ctx.trip._ui || {}; ctx.trip._ui.buildId = el.dataset.id; ctx.commit(false); ctx.nav("build"); },
  "remove-idea": (el, ctx) => { ctx.trip.ideas = ctx.trip.ideas.filter(i => i.id !== el.dataset.id); ctx.commit(); }
};
export const forms = {
  "idea": (data, ctx) => { if (!data.name) return; ctx.trip.ideas.push({ id: uid("i"), name: data.name, region: data.region, pp: +data.pp || 0, note: data.note }); ctx.commit(); }
};

/* Where a destination's figures come from and when they were last checked. */
function provenance(d) {
  const reviewed = d.lastReviewed ? `Reviewed ${fmtDateY(d.lastReviewed)}` : "Not reviewed yet";
  const srcs = (d.sources || []).map(s => `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.name)}</a>`).join(", ");
  return `${reviewed} · ${srcs ? "Sources: " + srcs : "No sources yet"}`;
}
