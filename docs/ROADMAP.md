# Roadmap

## Phase 0 — Seed (done)
- Family dashboard as a single HTML file (`app/v0-family-dashboard.html`).
- Destination library exported to `data/destinations/*.json` (19 destinations).

## Phase 1 — Trip-agnostic core (done in v1)
Goal: the same engine works for any trip, not just July 2027 from Brussels for five.

1. **Data model** (`docs/DATA-MODEL.md`)
   - Replace `season.fitByWindow` with `fitByMonth[1..12]` and a list of structured `events` (festival, holiday, insects, smoke, road closures) with date ranges.
   - Replace single `access.fromOrigin: BRU` with `access[]` per origin region (`europe-west`, `uk`, `us-east`, …): cost, hours, mode.
   - Add `climate` per block by month (day high, night low, rain days) rather than one July figure.
   - Add `tags` per destination and block: `city`, `mountains`, `beach`, `wildlife`, `history`, `food`, `festival`, `roadtrip`, `island`.
2. **Trip model**: travellers (name optional, constraints), origin, dates or window+length, budget (total or per head), lodging style, trip type weights.
3. **Scoring**: `score(destination, trip)` from the trip's weights and constraints; explain every score in words (why this destination ranks where it does).
4. **App structure**: split the single file into ES modules (`state.js`, `scoring.js`, `render/*.js`, `data.js`) with no build step. Keep it to vanilla JS so Claude Code sessions stay cheap.

## Phase 2 — Wizard (`docs/WIZARD.md`) (done in v1: tabs, multiple trips, share by link, JSON import)
1. New trip → Basics → Travellers & limits → Trip type → Destinations (library + search + ideas) → Build → Book → Share.
2. Multiple trips in one browser (trip list on the home screen).
3. Share by link: compress trip state (lz-string from cdnjs) into the URL hash; "Copy link" button. Import on open.
4. JSON export/import of a trip.

## Phase 3 — Booking step (done in v1 as Plan & book: prefilled links and generated checklists; booking confirmation tracking is a text field per stay)
- Travel: deep links prefilled from the itinerary — Google Flights (origin, destination, dates, passengers), Rome2Rio, Trainline/Rail Europe for no-fly trips.
- Lodging: per stop, Booking.com and Airbnb search links with check-in/out, guests, rooms; a "what to look for" line from the block (e.g. "stay in Forks, not Port Angeles").
- Permits & guides: checklist generated from blocks (`bookAhead` field): Inca Trail permits, DNT huts, Kinabalu permits, Komodo boat, etc., each with lead time.
- Nothing is booked by the app; it opens the right page with the right fields filled.

## Phase 3b — Added in v1 beyond the original plan
- Money: expense ledger with split and settle-up; budget vs model estimate.
- Decisions log; Conditions tab with bulletin links and a daily danger / weather / decision log for mountain trips.
- Travel mode (any / trains only / drive) and access routes per origin city (Brussels, London).

## Phase 4 — Collaboration (next, optional)
- Shared trips with live edits need a backend. Candidate: Supabase (Postgres + auth, free tier). Keep the URL-hash sharing as the fallback.
- Per-traveller input forms (each person fills their own limits and votes).

## Phase 5 — Library growth
- A destination contribution template and a validation script (`scripts/validate.cjs`).
- Target: ~60 destinations covering all seasons; each with sources and a last-reviewed date.

## Open decisions
- **Hosting:** GitHub Pages (recommended, free, fits a static app) vs Vercel/Netlify.
- **Stack:** vanilla ES modules, no build (recommended for simplicity) vs Vite + Preact.
- **Sharing:** URL-hash state (phase 2) first; Supabase only if live collaboration is wanted.
- **Images:** generated placeholders now; later, allow a photo URL per destination (hosted in the repo under `app/img/`) so the shared page shows real pictures.
