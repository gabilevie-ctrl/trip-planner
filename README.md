# Trip Planner

A shareable planner for trips with other people. Set once who is coming and what each person can and cannot do (altitude, heat, crowds, difficulty, avalanche danger, no flights), where you leave from and how you travel, the dates, the budget. Get destinations scored against all of that, build the days, book from prefilled links, track the money and the decisions, log the daily conditions on a mountain trip, and share the whole thing as one link.

Three kinds of trip, chosen at creation:

| Kind | For | What changes |
|---|---|---|
| **Explore a region** | a two-week country trip, a family holiday, a January week by train | city / mountain / coast / wildlife blocks, history and guidebook picks |
| **Hut-to-hut hiking** | Alta Via 2, Tour du Mont Blanc, GR20, Kungsleden | ordered stages with huts, ascent, hours and difficulty (T-scale) |
| **Ski touring** | an Écrins or Vanoise week, the Haute Route, Lyngen | stages with huts, SAC ski grades, avalanche and weather bulletins, a daily danger / decision log |

Library today: 38 destinations (19 explore, 6 hiking routes, 8 ski-touring areas, 5 short train trips from London or Brussels), each with climate by month, season fit by month, events, access routes and costs from Brussels and London, and per-block altitude, crowd level, transit hours and booking lead times.

## Use it

- **Hosted:** open the published link, pick a kind of trip, follow the numbered steps. Everything is saved in your browser. **Share** makes a link that carries the whole trip; whoever opens it gets an editable copy.
- **Locally:** `npm run serve` (or any static server) and open `http://localhost:8000/`. No build step.
- **Tests:** `npm test` (pure modules plus a jsdom end-to-end run through the real router). `npm run validate` checks the data files.
- **Add a destination:** copy `docs/destination-template.jsonc` to `data/destinations/<id>.json`, list it in `data/index.json`, then run `npm run validate:strict -- data/destinations/<id>.json` (new destinations must cite their sources), `npm run validate` and `npm test`.

## Repository layout

```
index.html           the app shell and styles
src/
  main.js            router, trip shell, event delegation
  state.js           trips store, new-trip defaults, share-link encoding
  data.js            loads data/index.json and data/destinations/*.json
  criteria.js        trip kinds, criteria per kind, strictest-limit merge, planning steps
  compute.js         days, costs, flags, itinerary, stays, climate for the dates
  scoring.js         season fit, criteria normalisation, weighted score with reasons
  links.js           Google Flights, Rome2Rio, Booking, Airbnb, hut portals
  ui.js              rendering helpers
  views/             home, setup, destinations, build, itinerary, plan, money, decisions, conditions, share
data/
  index.json         list of destinations
  destinations/      one JSON file per destination (schema in docs/DATA-MODEL.md)
vendor/              pico.min.css, lz-string.min.js (vendored, pinned)
scripts/             validate.cjs (checks in lib/check-destination.cjs), seed-routes.cjs
test/                node --test files
docs/                ROADMAP, DATA-MODEL, WIZARD, superpowers/specs and plans
legacy/              the original single-file family dashboard this grew from
CLAUDE.md            working notes for Claude Code sessions
```

## Hosting

GitHub Pages: Settings → Pages → deploy from `main`, folder `/`. The app then lives at `https://<user>.github.io/trip-planner/`. 

## Principles

- Nobody goes where they don't want to: limits are first-class inputs, and a destination or a day that breaks one is flagged, never hidden.
- Honest budgets: per-day rates are built from lodging style, meals, local transport and guides, with the assumption written next to the number. Figures are ±25% planning numbers.
- Data over opinion: destination files carry the facts; the app computes fit for the trip in hand and says in words why something ranks where it does.
- The app books nothing. It opens the right page with the right fields filled.

## Live search

With the family password, the trip chat asks Claude (with web search) for real destination options, shown as cards and checked against everyone's limits. Without it the app works as before. One-time setup for the key owner: [docs/LIVE-SETUP.md](docs/LIVE-SETUP.md).
