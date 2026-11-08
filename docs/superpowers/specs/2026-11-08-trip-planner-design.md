# Trip Planner — design spec (v1)

**Date:** 2026-11-08 · **Status:** implemented as v1 in this repo

## Problem
One person usually ends up holding the whole plan for a group trip in their head: who can do what, where it is in season, what it costs, which huts to book, what was decided. The family dashboard (legacy/) solved this for one trip. This app makes the same engine work for any trip and lets anyone in the family or a group of friends create and share their own.

## Trip kinds
A trip has a kind, chosen at creation. The kind decides which criteria are asked at the start, which destinations are offered, how the itinerary is built, and which planning steps are generated.

| Kind | Example | Blocks | Extra |
|---|---|---|---|
| `explore` | the 2027 family trip, a two-week country trip | city, mountain, beach, wildlife, rest | guidebook picks, history tags |
| `hike` | Alta Via 2, Tour du Mont Blanc, Kungsleden | stage (hut to hut), city, rest | huts, ascent, hours, difficulty (T-scale) |
| `skitour` | a week in the Écrins or the Vanoise, the Haute Route | stage, rest | huts, ascent, difficulty (SAC ski scale), avalanche and weather bulletins, a daily conditions log |

## Criteria at the start of a trip
Set once in Setup, per traveller; the strictest value applies. Hard limits produce flags on destinations and blocks, never silent exclusion.

- All kinds: travel mode (anything / no flights / we drive ourselves), altitude ceiling, crowd tolerance, places already visited.
- explore: heat ceiling, maximum share of hiking days.
- hike and skitour: maximum daily ascent, maximum hours per day, maximum difficulty, huts only vs camping, group has a guide or not.
- skitour: maximum acceptable avalanche danger level (bulletin scale 1–5).

## Steps of a trip
Setup → Destinations → Build → Itinerary → Plan & book → Money → Decisions → (Conditions for hike/skitour) → Share.

- **Setup**: name, kind, people and limits, origin and travel mode, dates, budget, lodging style, trip type weights.
- **Destinations**: the library filtered to the kind, scored against the trip, searchable; "ideas to explore" for places not in the library; one destination is *chosen* to unlock the later steps (the others stay comparable).
- **Build**: blocks and days (explore: three columns; hike/skitour: an ordered list of stages with huts), presets, warnings, budget table.
- **Itinerary**: a day-by-day calendar generated from the build, with lodging per night, notes per day, and links.
- **Plan & book**: a generated checklist of planning steps for this kind and travel mode (decide, travel, lodging, food, gear, permits, conditions, admin) with tick state, and prefilled deep links (Google Flights, Rome2Rio, Booking, Airbnb, hut-reservation.org, bulletin sites). The app books nothing.
- **Money**: model estimate vs budget; an expense ledger (who paid, split among whom); per-person balance and a settle-up.
- **Decisions**: open questions with options, owner and due date; decided ones kept with the answer.
- **Conditions** (hike/skitour): bulletin links for the area, and a daily log: danger level, weather, go/no-go, note. A danger level at or above the group's limit is flagged.
- **Share**: a link with the whole trip encoded in it; JSON export and import.

## Non-goals (v1)
Live multi-user editing (needs a backend; see ROADMAP phase 4), real bookings, photos fetched from the web, weather or bulletin data fetched live (the app runs where cross-site fetch is blocked; it links instead).

## Technical
Static site, vanilla ES modules, no build. Pico CSS (vendored) for sane defaults; a small stylesheet on top. lz-string (vendored) for share links. Tests with `node --test` on the pure modules (`compute`, `scoring`, `criteria`, `state` encoding). Hosted on GitHub Pages or as a Claude artifact. Data in JSON under `data/`.
