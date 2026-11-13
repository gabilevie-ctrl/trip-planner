# CLAUDE.md — working notes for Claude Code

## What this is
A static, no-build web app for planning group trips (README.md). Vanilla JS ES modules, `index.html` at the root, data as JSON under `data/`, vendored CSS and lz-string. Hosted on GitHub Pages (the Claude-artifact copy is retired).

## Workflow (superpowers conventions, as in polaris-events)
- Spec first: `docs/superpowers/specs/`. Plan with checkbox tasks: `docs/superpowers/plans/`. Implement task by task; tests on pure modules before UI.
- `npm test` must be green before a commit; `npm run validate` after any data change.
- Commits: imperative subject, one topic per commit.

## Ground rules
- No framework, no bundler. A library only when it does substantial work; vendor a pinned build under `vendor/`.
- Live fetches only to this allow-list: `api.anthropic.com` (live search, through `src/claude.js` with the family-password key, see `docs/LIVE-SETUP.md`), `*.open-meteo.com`, `en.wikivoyage.org`, OSM tile servers; and, when the app is served by `npm run family` on Gabriel's Mac, its own `/api/claude/*` (Claude Code signed in with his Claude subscription, `scripts/lib/helper.mjs`; web search and web fetch only, own-page requests only). Everything must still work without them: no lock file or no password means the rule-based chat and the library, as before.
- The Anthropic key is never in the repo in clear, in localStorage, in a trip or in a share link; only `data/claude-key.json` (locked) is committed.
- Every number shown has a source: a destination field, a trip input, or a formula in `src/compute.js` / `src/scoring.js`. No magic constants in views.
- Traveller limits are flags, never silent exclusion.
- Hash routing uses plain names only (`#build`, `#s-…`); no slashes or query strings in the hash.
- Views return HTML strings; interaction goes through `data-act`, `data-bind`, `data-ui`, `data-form`, `data-log` attributes handled in `src/main.js`. Keep that contract.
- Schema changes: update `docs/DATA-MODEL.md`, `scripts/validate.cjs`, and `state.migrate()` when the trip shape changes.

## Where things are
- `src/criteria.js` is the single place that defines kinds, criteria and planning steps. Adding a criterion = one entry there plus its use in `compute.js` flags and `scoring.js`.
- `scripts/seed-routes.cjs` holds the hiking, ski-touring and short-trip destinations as code; re-run after editing. The 19 explore destinations were exported from `legacy/` and then enriched in place (climate, access per origin).
- `test/integration.test.mjs` drives the real router in jsdom; extend it when adding a view.

## Defaults
- Contingency 8%; rest days default 2 (explore) or 1 (hike/skitour); lodging factor hotel 1.4, camping 0.8.
- Score: weighted mean of 0–100 criteria per kind (`scoring.js`), capped at 30 when season fit < 15; over-budget cost score capped at 15.
- Altitude/heat/transit chip colours: thresholds in `ui.js`; a traveller limit replaces the generic threshold when set.
