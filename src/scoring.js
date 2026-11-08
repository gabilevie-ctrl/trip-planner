// Season fit and the weighted score of a destination for a trip, with reasons in words.
import { computePlan, climateFor, isoToDate, addDays } from "./compute.js";

export const CRITERIA_BY_KIND = {
  explore: { cost: "Cost", alt: "Low altitude", heat: "Cool weather", crowd: "Few crowds", hrs: "Short transfers", hist: "History", season: "Season fit", type: "Matches the trip type" },
  hike: { cost: "Cost", alt: "Low altitude", effort: "Within effort limits", grade: "Within difficulty", crowd: "Few crowds", hrs: "Short transfers", season: "Season fit", weather: "Dry weather" },
  skitour: { cost: "Cost", grade: "Within difficulty", effort: "Within effort limits", hrs: "Short transfers", season: "Snow season fit", crowd: "Few crowds", weather: "Settled weather" }
};
export const DEFAULT_WEIGHTS = {
  explore: { cost: 2, alt: 1, heat: 1, crowd: 1, hrs: 1, hist: 1, season: 2, type: 1 },
  hike: { cost: 1, alt: 1, effort: 2, grade: 2, crowd: 1, hrs: 1, season: 2, weather: 1 },
  skitour: { cost: 1, grade: 2, effort: 2, hrs: 1, season: 2, crowd: 1, weather: 1 }
};

const clamp = v => Math.max(0, Math.min(100, Math.round(v)));

/* Season fit 0–100 for the trip's dates: monthly fit weighted by days, adjusted by events inside the dates. */
export function seasonFit(dest, trip) {
  const fit = dest.season?.fitByMonth; if (!fit || !trip.dates?.start) return { score: 60, events: [] };
  const s = isoToDate(trip.dates.start), e = trip.dates.end ? isoToDate(trip.dates.end) : s;
  let sum = 0, n = 0; for (let d = s; d <= e; d = addDays(d, 1)) { sum += fit[d.getUTCMonth()] ?? 60; n++; }
  let score = n ? sum / n : 60;
  const hits = [];
  const y = s.getUTCFullYear();
  for (const ev of dest.season.events || []) {
    const [fm, fd] = ev.from.split("-").map(Number), [tm, td] = ev.to.split("-").map(Number);
    for (const yy of [y - 1, y, y + 1]) {
      const a = new Date(Date.UTC(yy, fm - 1, fd)), b = new Date(Date.UTC(tm < fm ? yy + 1 : yy, tm - 1, td));
      if (a <= e && b >= s) { hits.push(ev); break; }
    }
  }
  const crowdsAvoid = (trip.travellers || []).some(t => t.limits?.crowds === "avoid");
  for (const ev of hits) { if (ev.effect === "crowds") score -= 6; else if (ev.effect === "weather") score -= 8; else if (ev.effect === "closure") score -= 25; else if (ev.effect === "festival") score += crowdsAvoid ? -4 : 4; }
  return { score: clamp(score), events: hits };
}

export function criteria(dest, trip, c) {
  c = c || computePlan(dest, trip);
  const budgetPP = trip.budget?.total ? trip.budget.total / c.n : 0;
  const costScore = budgetPP ? (c.fits ? clamp(100 - ((c.pp / budgetPP) - 0.4) / 0.6 * 60) : Math.min(15, clamp(100 - (c.pp / budgetPP - 1) * 100))) : clamp(100 - (c.pp - 800) / 5000 * 100);
  const lim = c.limits;
  const altCeiling = lim.maxAltitudeM || 4500;
  const alt = c.maxAlt > altCeiling ? 0 : clamp(100 - (c.maxAlt - Math.min(1000, altCeiling * 0.4)) / (altCeiling - Math.min(1000, altCeiling * 0.4)) * 100);
  const heatCeiling = lim.maxDayHighC || 36;
  const heat = c.maxTemp > heatCeiling ? 0 : clamp(100 - (c.maxTemp - 20) / (heatCeiling - 20) * 100);
  const crowd = { low: 100, med: 60, high: 20 }[c.worstCrowd];
  const hrs = clamp(100 - (c.hrs - 8) / (36 - 8) * 100);
  const hist = clamp(c.histN / 6 * 100);
  const sf = seasonFit(dest, trip);
  const cl = climateFor(dest, trip);
  const weather = cl ? clamp(100 - cl.rainDays * 4) : 60;
  const typeW = trip.type || {};
  const tags = new Set(dest.tags || []);
  let typeScore = 60;
  const keys = Object.keys(typeW).filter(k => typeW[k] > 0);
  if (keys.length) { let tot = 0, got = 0; for (const k of keys) { tot += typeW[k]; if (tags.has(k) || (k === "hike" && tags.has("mountains")) || (k === "coast" && (tags.has("beach") || tags.has("coast") || tags.has("islands") || tags.has("fjords"))) || (k === "cities" && tags.has("cities")) || (k === "history" && tags.has("history")) || (k === "wildlife" && tags.has("wildlife"))) got += typeW[k]; } typeScore = clamp(got / tot * 100); }
  let grade = 100, effort = 100;
  if (dest.kind !== "explore") {
    const gl = dest.kind === "skitour" ? lim.maxGradeSki : lim.maxGradeHike;
    grade = c.flags.some(f => / is .* above the .* limit$/.test(f)) ? 10 : gl ? 100 : 80;
    const a = lim.maxDailyAscentM ? Math.min(1, c.maxAscent / lim.maxDailyAscentM) : c.maxAscent / 1500;
    const h = lim.maxDailyHours ? Math.min(1, c.maxHours / lim.maxDailyHours) : c.maxHours / 9;
    effort = (lim.maxDailyAscentM && c.maxAscent > lim.maxDailyAscentM) || (lim.maxDailyHours && c.maxHours > lim.maxDailyHours) ? 10 : clamp(100 - Math.max(a, h) * 60);
  }
  return { cost: costScore, alt, heat, crowd, hrs, hist, season: sf.score, type: typeScore, weather, grade, effort, _season: sf, _climate: cl };
}

export function score(dest, trip, c) {
  const k = criteria(dest, trip, c);
  const w = Object.assign({}, DEFAULT_WEIGHTS[dest.kind] || DEFAULT_WEIGHTS.explore, trip.weights || {});
  const labels = CRITERIA_BY_KIND[dest.kind] || CRITERIA_BY_KIND.explore;
  let tot = 0, wt = 0; const parts = [];
  for (const key of Object.keys(labels)) { const ww = w[key] ?? 1; if (!ww) continue; tot += ww * k[key]; wt += ww; parts.push({ key, label: labels[key], weight: ww, value: k[key] }); }
  let s = wt ? Math.round(tot / wt) : 0;
  const outOfSeason = k.season < 15;
  if (outOfSeason) s = Math.min(s, 30);
  const strong = parts.filter(p => p.value >= 75).sort((a, b) => b.value - a.value).slice(0, 2).map(p => p.label.toLowerCase());
  const weak = parts.filter(p => p.value < 45).sort((a, b) => a.value - b.value).slice(0, 2).map(p => p.label.toLowerCase());
  const reason = [outOfSeason ? "Out of season for these dates" : "", strong.length ? `Strong on ${strong.join(" and ")}` : "", weak.length ? `weak on ${weak.join(" and ")}` : ""].filter(Boolean).join("; ") || "Middling on every criterion";
  return { score: s, parts, reason, criteria: k };
}
