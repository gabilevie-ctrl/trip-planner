# Next Three Tasks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the destination library trustworthy and fuller across the year, and let each traveller give their own limits and votes without a server.

**Architecture:** Three independent tasks, each its own branch and pull request. Task 1 turns `scripts/validate.cjs` into a tested pure checker plus a contribution template, and shows sources and review dates in the app. Task 2 adds winter and shoulder-season destinations under that stricter check. Task 3 adds two new hash routes (`#r-…` request, `#a-…` answer) that carry a small traveller form and its answer, reusing the share-link encoding.

**Tech Stack:** Vanilla ES modules, no build; Node's built-in test runner (`node --test`), jsdom for integration tests; vendored lz-string.

**Spec:** `docs/ROADMAP.md` (Phase 4 "Per-traveller input forms", Phase 5 "Library growth") and `docs/superpowers/specs/2026-11-08-trip-planner-design.md`. Hosting is settled: GitHub Pages at https://gabilevie-ctrl.github.io/trip-planner/ serves `main`.

## Global Constraints

- No framework, no bundler, no new dependency.
- The app never fetches cross-site; link out instead.
- Every number shown has a source: a destination field, a trip input, or a formula in `src/compute.js` / `src/scoring.js`.
- Traveller limits are flags, never silent exclusion.
- Hash routes use plain names only: letters, digits, hyphens; no slashes or query strings.
- Views return HTML strings; interaction goes through `data-act`, `data-bind`, `data-ui`, `data-form`, `data-log` handled in `src/main.js`.
- Trip shape changes update `docs/DATA-MODEL.md`, `scripts/validate.cjs` and `state.migrate()`.
- `npm test` green before every commit; `npm run validate` after any data change. One topic per commit, imperative subject.
- Work on a branch per task, never on `main`.

## Review Focus

1. A destination file with a `sources` entry missing its `url`, or a `lastReviewed` like `2026-13-01`: the validator should name the file and field, not crash. (Task 1, test `rejects malformed sources and dates`.)
2. A request link opened in a browser that has never seen the trip: the form must still render from the link alone. (Task 3, test `request link renders in an empty browser`.)
3. An answer link opened twice, or for a traveller who has since been removed: the second open changes nothing; a removed traveller is re-added by name with a toast, never silently dropped. (Task 3, test `answer merge is idempotent and keeps unknown travellers`.)
4. An answer link from a different trip id: it is refused with a toast, and nothing is merged. (Task 3, test `answer for another trip is refused`.)
5. Votes on a destination that is no longer in the library: they are kept in the trip and ignored in the view, with no error. (Task 3, test `votes for unknown destinations are ignored in the view`.)

---

### Task 1: Library quality gate (sources, review dates, contribution template)

**Files:**
- Create: `scripts/lib/check-destination.cjs`
- Modify: `scripts/validate.cjs` (becomes a thin loop over the checker)
- Create: `docs/destination-template.jsonc` (outside `data/destinations/` so the validator does not read it)
- Modify: `src/views/destinations.js` (sources and "reviewed" line on each card)
- Modify: `docs/DATA-MODEL.md` (`sources` and `lastReviewed` move from "→ phase 5" to shipped; document the template)
- Modify: `README.md` ("Adding a destination" points to the template and `npm run validate`)
- Test: `test/validate.test.mjs`

**Interfaces:**
- Produces: `checkDestination(d, file, indexEntry, { today, strict }) -> string[]` (problem messages, empty when valid). `strict` turns empty `sources` from a warning into a problem.
- Produces: `npm run validate` (unchanged, non-strict) and `npm run validate:strict` (`node scripts/validate.cjs --strict`).

Rules the checker adds to today's checks:
- `season.fitByMonth` is an array of 12 numbers, each 0–100.
- `lastReviewed` is a real `YYYY-MM-DD` date not in the future; older than 18 months → message `"lastReviewed older than 18 months"`.
- `sources` is an array; each entry has a `name` string and an `https://` `url`. Empty array → warning (printed, does not fail) unless `strict`.
- The index entry's `kind`, `name` and `zone` equal the file's.

- [ ] **Step 1: Write the failing tests** in `test/validate.test.mjs`, loading the checker with `createRequire`:
  - `valid destination passes`: `checkDestination(dest("norway") with sources:[{name:"Visit Norway",url:"https://www.visitnorway.com/"}], …, {today:"2026-11-08"})` deep-equals `[]`.
  - `rejects malformed sources and dates`: `sources:[{name:"x"}]` → contains `"sources[0]: url must start with https://"`; `lastReviewed:"2026-13-01"` → contains `"lastReviewed is not a valid date"`.
  - `fitByMonth must have 12 values`: 11 values → contains `"season.fitByMonth must have 12 numbers 0–100"`.
  - `index entry must match`: index `name` differs → contains `"index.json name differs from file"`.
  - `empty sources fails only in strict mode`: `{strict:false}` → `[]`; `{strict:true}` → contains `"sources is empty"`.
- [ ] **Step 2: Run** `node --test test/validate.test.mjs`. Expected: FAIL, module not found.
- [ ] **Step 3: Implement `checkDestination`** in `scripts/lib/check-destination.cjs`, moving today's per-file checks out of `validate.cjs` unchanged and adding the rules above. `validate.cjs` keeps the cross-file checks (duplicate ids) and prints empty-sources warnings with a count line: `"N destinations have no sources yet"`.
- [ ] **Step 4: Run** `npm test && npm run validate`. Expected: all tests pass; validate prints `OK: 38 destinations valid` and `38 destinations have no sources yet`.
- [ ] **Step 5: Write the failing view test** in `test/views.test.mjs`, `destination card shows sources and review date`: render the destinations view with norway given one source; the HTML contains `Reviewed 8 Nov 2026` and a link to the source URL with `rel="noopener"`.
- [ ] **Step 6: Implement** in `src/views/destinations.js`: one muted line per card, `Reviewed <fmtDateY(lastReviewed)> · Sources: <links>` or `· No sources yet`. Use `esc()` and `fmtDateY` from `ui.js` (it gives `8 Nov 2026`).
- [ ] **Step 7: Run** `npm test`. Expected: PASS.
- [ ] **Step 8: Write `docs/destination-template.jsonc`**: every field from DATA-MODEL with a one-line comment, `sources` with one example entry, and a short "how to add" header (copy to `data/destinations/<id>.json`, add to `data/index.json`, run `npm run validate`). Update DATA-MODEL and README.
- [ ] **Step 9: Commit** in two commits: `Extract destination checker and require sources and review dates` (scripts, test, package.json), then `Show sources and review date on destination cards` (view, docs, template).

### Task 2: Fill the winter and shoulder-season gaps

**Depends on:** Task 1 merged (new destinations must pass `npm run validate:strict`).

**Files:**
- Create: `data/destinations/<id>.json` × 8 (explore kind), or seed blocks in `scripts/seed-routes.cjs` for hike/skitour kinds
- Modify: `data/index.json`
- Create: `scripts/coverage.cjs` and `"coverage"` script in `package.json`
- Test: `test/coverage.test.mjs`

**Interfaces:**
- Produces: `monthCoverage(dests, threshold = 70) -> number[12]` in `scripts/coverage.cjs` (CommonJS, exported), and `npm run coverage` printing one line per month.

Today's count of destinations with `fitByMonth >= 70`, Jan–Dec: `3, 7, 13, 17, 20, 27, 29, 27, 28, 15, 5, 3`. Target after this task: **at least 8 in every month**. Nov, Dec and Jan need the most.

Candidate list for Gabriel to approve or replace before any data is written (from Brussels or London, no-fly first where possible): Canary Islands (La Palma / Tenerife walking), Madeira levada walks, Andalucía cities + Sierra Nevada foothills, Sicily + Aeolian islands (shoulder), Morocco Atlas + Marrakech, Oman, Jordan (Petra + Wadi Rum), Lapland northern lights by train.

- [ ] **Step 1: Write the failing test** `test/coverage.test.mjs`, `every month has at least 8 good-fit destinations`: `monthCoverage(allDests()).every(n => n >= 8)` is true. Also `monthCoverage counts fitByMonth >= 70` on two hand-made destinations → exact array.
- [ ] **Step 2: Run** `node --test test/coverage.test.mjs`. Expected: the counting test fails (no module); after Step 3 the coverage test still fails with today's counts.
- [ ] **Step 3: Implement** `monthCoverage` and `npm run coverage`.
- [ ] **Step 4: Ask Gabriel to confirm the eight destinations.** Do not write data before he answers.
- [ ] **Step 5: For each approved destination**, write the JSON from `docs/destination-template.jsonc`: blocks with days, altitude, monthly climate, crowd, transit hours; `access[]` from Brussels and London; `fitByMonth`; at least two `sources` (tourist board, rail or ferry operator, climate normals). Every number must come from a listed source. One commit per destination: `Add <name> destination`.
- [ ] **Step 6: Run** after each: `npm run validate:strict && npm test`. Expected: green once the last destination is in; `npm run coverage` shows ≥ 8 for every month.

### Task 3: Each traveller fills in their own limits and votes, by link

**Files:**
- Modify: `src/state.js` (generic hash packing, `votes` field, migrate)
- Create: `src/invite.js` (pure: build request, build answer, merge answer)
- Create: `src/views/respond.js` (the traveller's form, shown for `#r-…`)
- Modify: `src/main.js` (routes `r-` and `a-`)
- Modify: `src/views/setup.js` ("Ask <name>" button per traveller → copies the request link)
- Modify: `src/views/destinations.js` (vote tally chip per card; sort option "Most votes")
- Modify: `docs/DATA-MODEL.md`, `docs/ROADMAP.md` (`scripts/validate.cjs` checks destinations only, so it does not change)
- Test: `test/invite.test.mjs`, `test/integration.test.mjs`

**Interfaces:**
- Produces in `src/state.js`: `packHash(prefix: "s"|"r"|"a", obj, lz) -> string` and `unpackHash(prefix, hash, lz) -> object|null`, with today's `-M/-P/-D` alphabet mapping. `encodeShare`/`decodeShare` become `packHash("s", …)`/`unpackHash("s", …)`; existing share links keep working (the `share link round-trips` test must still pass).
- Produces trip field: `votes: { [travellerId]: { [destId]: -1 | 0 | 1 } }`, default `{}`, added in `newTrip` and filled by `migrate`.
- Produces in `src/invite.js`:
  - `buildRequest(trip, travellerId, shortlist: string[]) -> { v: 1, tripId, tripName, travellerId, travellerName, kind, criteria: string[], limits, shortlist: {id,name}[] }`. `criteria` are the keys from `criteria.js` for the trip's kind. `shortlist` is the trip's plans' destination ids, at most 8, so the link stays short.
  - `buildAnswer(request, { name, limits, votes }) -> { v: 1, tripId, travellerId, name, limits, votes }`.
  - `mergeAnswer(trip, answer) -> { ok: boolean, message: string }`. Refuses a different `tripId`. Overwrites that traveller's `limits` and `votes[travellerId]`; if the traveller id is gone, re-adds them with that id and name. Running it twice leaves the trip unchanged the second time.

- [ ] **Step 1: Write the failing tests** in `test/invite.test.mjs`:
  - `pack and unpack round-trip for each prefix`: for `"s"`, `"r"`, `"a"`, the hash matches `/^[sra]-[A-Za-z0-9-]+$/` and unpacks deep-equal.
  - `request carries only what the form needs`: `buildRequest(familyTrip({plans:{norway:{},scotland:{}}}), "p1", …)` has `travellerName:"Mom"`, `limits.maxAltitudeM:4200`, two shortlist entries, and no `expenses`, `budget` or other travellers.
  - `answer merge is idempotent and keeps unknown travellers`: merge sets Mom's `maxAltitudeM` to 3000 and `votes.p1.norway` to 1; a second merge leaves `JSON.stringify(trip)` unchanged; an answer for `"p9"` re-adds a traveller with id `p9`.
  - `answer for another trip is refused`: `mergeAnswer(trip, {...answer, tripId:"t_other"})` → `{ ok:false }` and the trip is unchanged.
- [ ] **Step 2: Run** `node --test test/invite.test.mjs test/state.test.mjs`. Expected: FAIL on the missing functions; `state.test.mjs` still passes.
- [ ] **Step 3: Implement** `packHash`/`unpackHash` in `src/state.js`, the `votes` field and its migration, then `src/invite.js`.
- [ ] **Step 4: Run** `npm test`. Expected: PASS.
- [ ] **Step 5: Write the failing integration tests** in `test/integration.test.mjs`:
  - `request link renders in an empty browser`: with empty localStorage, set the hash to a `#r-…` built from the family trip; the page shows `Hi Mom`, one input per criterion and a vote control per shortlisted destination; nothing is written to the trips store.
  - `submitting the form shows an answer link`: fill altitude 3000, vote Norway up, submit; the page shows a read-only input whose value contains `#a-`.
  - `opening the answer link merges into the owner's trip`: with the family trip stored, open that `#a-…`; the toast says `Mom's answers added`, the hash becomes `#setup`, and Mom's altitude limit reads 3000.
  - `votes for unknown destinations are ignored in the view`: a trip with `votes.p1.atlantis = 1` renders the destinations view without error.
- [ ] **Step 6: Implement** routing in `src/main.js` (`r-` renders `respond.render(request)` without needing a stored trip; `a-` unpacks, calls `mergeAnswer`, toasts the message, goes to `#setup`), the form in `src/views/respond.js` (export `critInput(c, value, bind)` from `setup.js` and add a fourth argument `{ name: true }` that emits `name="<c.key>"` instead of `data-bind`, because the respond page has no stored trip to bind to; votes as three buttons 👎/–/👍 with `aria-pressed`; submit through `data-form="answer"`), the "Ask" button in `setup.js` (copies the request link with `ctx.copy`), and the vote tally chip plus "Most votes" sort in `destinations.js`. Copy on the respond page: one sentence saying the answers go back to the trip owner only when the traveller sends them the link.
- [ ] **Step 7: Run** `npm test`. Expected: PASS. Then `npm run serve` and walk through it by hand: ask Mom, open the request in a private window, answer, paste the answer link back into the main window.
- [ ] **Step 8: Update `docs/DATA-MODEL.md`** (trip `votes`; request and answer shapes) and `docs/ROADMAP.md` (Phase 4 per-traveller input: done without a backend).
- [ ] **Step 9: Commit** in three commits: `Generalise share-link packing and add trip votes`, `Add traveller request and answer links`, `Show vote tallies on destinations`.
