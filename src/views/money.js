import { esc, fmtMoney, fmtDate, empty } from "../ui.js";
import { computePlan } from "../compute.js";
import { uid } from "../state.js";
import { liveChoice } from "../liveplan.js";
import { totalsFacts } from "./liveplan.js";

const CATS = ["Transport", "Lodging", "Huts", "Food", "Guide", "Gear", "Permits & tickets", "Other"];

export function settle(trip) {
  // Equal split among the listed participants of each expense; returns balances and transfers.
  const people = trip.travellers; const bal = Object.fromEntries(people.map(p => [p.id, 0]));
  for (const e of trip.expenses) {
    const parts = (e.split && e.split.length ? e.split : people.map(p => p.id)).filter(id => bal[id] !== undefined);
    if (!parts.length) continue;
    const share = e.amount / parts.length;
    if (bal[e.paidBy] !== undefined) bal[e.paidBy] += e.amount;
    for (const id of parts) bal[id] -= share;
  }
  const debtors = Object.entries(bal).filter(([, v]) => v < -0.5).map(([id, v]) => ({ id, v: -v })).sort((a, b) => b.v - a.v);
  const creditors = Object.entries(bal).filter(([, v]) => v > 0.5).map(([id, v]) => ({ id, v })).sort((a, b) => b.v - a.v);
  const transfers = []; let i = 0, j = 0;
  while (i < debtors.length && j < creditors.length) { const x = Math.min(debtors[i].v, creditors[j].v); transfers.push({ from: debtors[i].id, to: creditors[j].id, amount: x }); debtors[i].v -= x; creditors[j].v -= x; if (debtors[i].v < 0.5) i++; if (creditors[j].v < 0.5) j++; }
  return { bal, transfers };
}

export function render(ctx) {
  const t = ctx.trip; const cur = t.budget.currency; const d = ctx.dests.find(x => x.id === t.chosen);
  const est = d ? computePlan(d, t) : null;
  const spent = t.expenses.reduce((a, e) => a + (e.amount || 0), 0);
  const planned = t.expenses.filter(e => e.status === "planned").reduce((a, e) => a + e.amount, 0);
  const paid = spent - planned;
  const byCat = {}; for (const e of t.expenses) byCat[e.category] = (byCat[e.category] || 0) + e.amount;
  const name = id => (t.travellers.find(p => p.id === id)?.name) || "?";
  const { bal, transfers } = settle(t);
  const budget = t.budget.total || 0;
  // A live option's plan total replaces the library model's estimate.
  const lt = liveChoice(t) ? totalsFacts(t) : null; const mark = lt ? lt.total : est ? est.total : null;
  return `
  <section class="card">
    <h2>Budget</h2>
    <div class="facts">
      <div class="fact"><span class="k">Budget</span><span class="v num">${budget ? fmtMoney(budget, cur) : "not set"}</span></div>
      ${lt ? lt.fact : `<div class="fact"><span class="k">Model estimate${d ? " (" + esc(d.name) + ")" : ""}</span><span class="v num">${est ? fmtMoney(est.total, cur) : "choose a destination"}</span></div>`}
      <div class="fact"><span class="k">Committed so far (paid + planned)</span><span class="v num">${fmtMoney(spent, cur)}</span></div>
      <div class="fact"><span class="k">${budget ? "Left in the budget" : "Paid so far"}</span><span class="v num ${budget && spent > budget ? "crit" : "good"}">${budget ? fmtMoney(budget - spent, cur) : fmtMoney(paid, cur)}</span></div>
    </div>
    ${budget ? `<div class="track"><div class="fill ${spent > budget ? "over" : ""}" style="width:${Math.min(100, spent / budget * 100)}%"></div>${mark !== null ? `<div class="mark" style="left:${Math.min(100, mark / budget * 100)}%" title="${lt ? "plan total" : "model estimate"}"></div>` : ""}</div><p class="muted small">Bar = committed; tick = ${lt ? "plan total" : "model estimate"}.</p>` : ""}
    ${lt ? lt.notes : ""}
    ${Object.keys(byCat).length ? `<p class="small">${Object.entries(byCat).map(([k, v]) => `${esc(k)} ${fmtMoney(v, cur)}`).join(" · ")}</p>` : ""}
  </section>
  <section class="card">
    <h3>Add an expense</h3>
    <form class="grid4" data-form="expense">
      <input name="desc" required placeholder="What (e.g. Eurostar, Rifugio Puez deposit)">
      <input name="amount" type="number" min="0" step="0.01" required placeholder="Amount">
      <select name="category">${CATS.map(c => `<option>${c}</option>`).join("")}</select>
      <select name="status"><option value="paid">Paid</option><option value="planned">Planned / quoted</option></select>
      <select name="paidBy">${t.travellers.map(p => `<option value="${p.id}">${esc(p.name || "Traveller")}</option>`).join("")}</select>
      <input name="date" type="date" value="${new Date().toISOString().slice(0, 10)}">
      <fieldset class="split-fs"><legend class="small muted">Split among</legend>${t.travellers.map(p => `<label class="chk"><input type="checkbox" name="split" value="${p.id}" checked> ${esc(p.name || "Traveller")}</label>`).join("")}</fieldset>
      <button type="submit">Add</button>
    </form>
  </section>
  <section class="card">
    <h3>Ledger</h3>
    ${t.expenses.length ? `<div class="scroller"><table class="ledger"><thead><tr><th>Date</th><th>What</th><th>Category</th><th>Paid by</th><th>Split</th><th>Status</th><th class="num">Amount</th><th></th></tr></thead><tbody>${t.expenses.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).map(e => `<tr><td class="small">${fmtDate(e.date)}</td><td>${esc(e.desc)}</td><td class="small">${esc(e.category)}</td><td>${esc(name(e.paidBy))}</td><td class="small">${(e.split || []).length && e.split.length !== t.travellers.length ? e.split.map(name).map(esc).join(", ") : "everyone"}</td><td><span class="pill ${e.status === "paid" ? "good" : "warn"}">${e.status}</span></td><td class="num">${fmtMoney(e.amount, cur)}</td><td><button type="button" class="linklike" data-act="del-expense" data-id="${e.id}">remove</button></td></tr>`).join("")}</tbody></table></div>` : empty("No expenses yet", "Add deposits and bookings as they happen; the split and the settle-up follow.")}
  </section>
  <section class="card grid2">
    <div><h3>Balances</h3><ul>${t.travellers.map(p => `<li>${esc(p.name || "Traveller")}: <span class="num ${bal[p.id] > 0.5 ? "good" : bal[p.id] < -0.5 ? "crit" : ""}">${bal[p.id] > 0 ? "+" : ""}${fmtMoney(bal[p.id], cur)}</span></li>`).join("")}</ul><p class="muted small">Positive = paid more than their share.</p></div>
    <div><h3>Settle up</h3>${transfers.length ? `<ul>${transfers.map(x => `<li>${esc(name(x.from))} → ${esc(name(x.to))}: <strong class="num">${fmtMoney(x.amount, cur)}</strong></li>`).join("")}</ul>` : `<p class="muted">Everyone is square.</p>`}</div>
  </section>
  <p class="row"><a href="#decisions" role="button">Next: decisions →</a></p>`;
}

export const actions = { "del-expense": (el, ctx) => { ctx.trip.expenses = ctx.trip.expenses.filter(e => e.id !== el.dataset.id); ctx.commit(); } };
export const forms = {
  "expense": (data, ctx, form) => {
    const split = [...form.querySelectorAll('input[name="split"]:checked')].map(i => i.value);
    ctx.trip.expenses.push({ id: uid("e"), desc: data.desc, amount: +data.amount || 0, category: data.category, status: data.status, paidBy: data.paidBy, date: data.date, split });
    ctx.commit();
  }
};
