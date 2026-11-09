# Live planning: Claude behind the chat, any destination, a plan you can book from

## Why
Gabriel tried the app for a January trip with Situ ("warm, Schengen, nature, cheap") and got barely any options: the fixed library of 24 explore destinations has nothing warm inside Schengen in January. His conclusion: the library should be "any trip possible", not a list set in stone.

He then showed how he actually plans, in a Claude chat that produced "La Palma GR131 — 2–8 Jan 2027 trip summary":
1. **Wishes in one sentence.** "2–9 Jan with Situ, maximum time outdoors, somewhere warm, budget reasonable."
2. **A ranked shortlist, researched.** Three options plus honourable mentions, with Claude's own pick on top. Each option had:
   - January weather in numbers;
   - named routes and things to do;
   - flight time and connections from London;
   - a budget broken into flights per person, lodging per night, transport per day, and a total for two;
   - its trade-off in one line;
   - for the honourable mentions, why each is not on top.

   It ended with "If I had to book tonight: …" and two sharpening questions.
3. **A new constraint reshuffles it.** "Public transport and tent only" became feasibility research: wild camping is illegal there, so which official camping zones lie on the route, which permits they need and how far ahead, and where buses don't reach. Each option got a verdict, with source links.
4. **Pick one, get a full plan.** The plan document had:
   - a day-by-day table (move or walk with distance and climb, the night's lodging, bail-outs, a rain fallback);
   - a bookings shortlist (each item with a pick, an alternative, a status and a dated live price) and totals from the picks;
   - flights and ferry sailings, including dead ends ("no direct flight this winter");
   - permits with lead times, local buses and taxi phone numbers, water points, cold and daylight;
   - per-person admin (Situ's visa and insurance) and a gear table with one column per person;
   - a food plan, a dated to-do list in order, and sources with the date they were checked.
5. **Then:**
   - a map of the route and every transport leg by day;
   - export to one document for Drive;
   - "what's the priority?" answered as a booking order: what gets dearer first, then what sells out, free-cancellation beds, admin with lead times, gear last;
   - offers to draft the permit email in Spanish.

The app should work like that, with the trip's limits checked on every option, and with everything kept as structured, shareable trip data instead of scrolling chat.

## Goals
- Any destination. Options come from a live search for the wishes and limits, not from the library.
- Step 1 (Setup) is the shortlist conversation. Each option is a card with the fields above, flagged against the trip's traveller limits by the app's own checks (warmth floor, heat ceiling, country zone, budget, altitude).
- Choosing an option produces the plan: days, bookings with pick/alternative/status, transport, permits, per-person admin and gear, food, a dated to-do list, and sources with dates. All of it can be refined by chat ("move the beach day", "cheaper beds").
- A map of the chosen plan, with each day's legs.
- A booking-priority view, and an export to one document.
- Family members use it with only a password. Gabriel prepares the setup.

## What the app must do better than the chat (otherwise there is no point)
Gabriel, after the La Palma chat: the app must be more helpful than talking to Claude directly. Claude does the research either way; the app's job is everything a chat is bad at. The La Palma doc that the chat produced already shows the failure, because it drifted out of step with itself as the plan changed:
- "Plan at a glance" says ≈ £550 for two, while the bookings totals say about £600.
- The taxi section says "pre-book … the Thu 4×4", but the 4×4 is on Wed.
- The admin note still lists pensions from an earlier plan (El Paso Mon, Los Canarios Tue–Wed).
- The gear table says a tent can be skipped, although two nights are in camping zones.

So the app must do these things, and each is a requirement, not a nice-to-have:

1. **One source of truth, numbers computed.**
   - Days, nights, bookings and prices are structured data.
   - Totals, the "at a glance" summary, the to-do list, the priority list and the map are derived from that data by the app, never written as prose by Claude.
   - Changing one booking updates every place it appears.
2. **Consistency checks after every change,** shown as flags like today's limit flags:
   - a night with no lodging, or with lodging of a type that needs gear nobody has ticked (for example a camping night with no tent);
   - a leg with no way to get there;
   - a booking referenced on a day it isn't on;
   - the total over the budget;
   - a price older than 30 days;
   - a permit whose lead time has passed its "book by" date.
3. **Every traveller's limits checked on every option and plan.**
   - The checks are warmth floor, heat, altitude, country zone and budget.
   - A visa, insurance or health card need is per traveller (as with Situ's visa and GHIC) and appears in that person's admin list.
4. **Comparison side by side.** Options sit in one table with the same fields (weather, getting there, lodging, total, trade-off, flags), not in paragraphs that scroll away.
5. **Both people work on the same trip.**
   - Situ opens the share link and fills her own gear column and her admin items.
   - Statuses move from idea to decided to booked, with a confirmation number per booking.
   - The share link carries it all back. Live sync stays a non-goal, but the app must handle importing a newer copy of the same trip without losing either person's edits. It merges by field and asks only when both changed the same field.
6. **Booking made concrete.** Each booking has a prefilled link (dates, travellers, places) where the site allows it, the exact details to enter, and a "book by" date. The priority list orders them.
7. **Dates that remind you.** To-dos and "book by" dates export as a calendar file (.ics), so "email the Cabildo before 15 Dec" and "check the rim weather on 1 Jan" land in the calendar.
8. **Works offline on the trip.** The chosen plan, map tiles already viewed, phone numbers and permits are readable with no signal, through a service worker on GitHub Pages. On the trip, the existing Money (spent vs planned, split), day notes and Conditions log apply to live plans too.
9. **Nothing to re-explain.**
   - Claude always gets the current trip data (travellers, limits, choices, statuses) with each message, so nobody restates "two of us, Situ needs Schengen".
   - A finished trip can be the starting point of the next one.

These shape the design below: Claude writes structured data through tools; the app renders, computes, checks and remembers.

## Non-goals
- The app does not book or pay for anything. It links to the exact search or booking page.
- No live prices from Booking.com, Airbnb or airlines inside the app. Claude finds prices through web search and the app stores them with the date seen.
- No shared live editing between devices. Share links stay the way to pass a trip on.
- No Claude-artifact hosting. GitHub Pages is the only host from now on.

## Anti-goals (a failure even if it works)
- A number with no source or date. Every price, time and temperature from Claude carries the page it came from and when it was seen.
- Options silently dropped for breaking a limit. Limits stay flags, as today.
- The API key readable in the repository, or in a share link.
- The app useless without the password. Without it, it must still work as today, plus the free live lookups.

## Decisions
### Gabriel's
- **All on GitHub.** No Cloudflare, no other server. The app stays on GitHub Pages.
- **Family members type a password, never an API key. Gabriel prepares it.** He runs a command once that takes his Anthropic key and a family password and writes a locked (encrypted) copy of the key into the repo. He pushes it, and tells the family the password.
- **He accepts the trade-off.** Anyone with the password could, with effort, extract the key in their browser. A monthly spend limit on the key is the safety net. The leak response is a new key, a new password, rerun the command.
- **The flow is wishes, then live options, then pick, then the plan.** The current scored library becomes the fallback when there is no password.

### Builder's calls (stated to Gabriel)
- **Model:** `claude-opus-5-5` (the current default), with adaptive thinking. Web search is the server tool `web_search_20260209`. Check both against the claude-api skill at build time.
- **Prompting the model:** the browser calls the Messages API directly, with the browser-access header. It uses the official SDK if a single-file ESM build can be vendored under `vendor/`, otherwise raw HTTP, decided at build time.
- **Getting structured results back:** Claude returns them by calling app-defined tools with `strict: true`, alongside web search:
  - `propose_options` for the shortlist;
  - `write_plan` for the plan;
  - `update_plan` for partial changes.

  The app validates the input and renders it. Prose replies go to the chat thread.
- **The lock:** WebCrypto PBKDF2-SHA256 (at least 600,000 iterations) derives an AES-256-GCM key from the password. The file is `data/claude-key.json` with `{ v, salt, iv, iterations, ciphertext, createdAt }`.
  - The script `scripts/lock-key.mjs` runs in Node, reads the key and the password without echoing them, and refuses a password under 20 characters.
  - In the browser, the decrypted key lives in memory for the tab. "Remember on this device" stores a non-extractable CryptoKey in IndexedDB, never the key text, so re-entering the password isn't needed.
- **Free live lookups** (no password needed), each source named next to its numbers:
  - Open-Meteo geocoding and climate normals (monthly day highs) for any place;
  - Wikivoyage summaries;
  - OpenStreetMap for the map tiles.
- **Map:** Leaflet, vendored, with OSM tiles and attribution. Places carry `lat`/`lon`, set by Claude or by Open-Meteo geocoding.
- **Export:**
  - a print-friendly page, saved as PDF by the browser, and a Markdown download;
  - a .docx is deferred unless it's cheap.
- **All trip kinds.** Live options and live plans work the same way for explore, hike, ski-touring and short trips.
  - One day-table shape covers all of them, since a day has km, ascent and the night's lodging, which can be a hut.
  - Library routes keep their stage-based views; only live plans use the new shape.
- **One currency for totals.**
  - Claude quotes each price in its original currency and also gives the rate to the trip's currency, with the date and source. These are stored in `livePlan.rates: { "GBP": { toTrip, seenOn, source } }`.
  - The app converts and totals in the trip currency (`budget.currency`) and shows the original next to each price.
  - A price whose currency has no rate is flagged and left out of the total, never guessed.
- **Only the current version is shared.**
  - The trip, and so the share link, holds only the current options and plan.
  - The last three earlier versions stay on the device that made them, in local storage outside the shared trip, so the thread can show "earlier options".
- **Ids and links everywhere.**
  - Days, bookings, gear items, to-dos and admin items get stable ids.
  - Nights and legs carry a `bookingId`.
  - `update_plan` edits by id, and the consistency checks follow these links.
- **Merge on import.** The device keeps a copy of the trip as last exported or imported. Importing a newer copy merges item by item against that base, and asks only when both sides changed the same field.
- **The project rule "never fetch live" is replaced** by an allow-list: `api.anthropic.com`, `*.open-meteo.com`, `en.wikivoyage.org`, and the OSM tile servers. CLAUDE.md is updated to match.

## How it works for a person
1. **Home → "Describe your trip".** They type wishes. The rule-based reader (`src/describe.js`) still fills the form fields at once, as today.
2. **Setup asks for the password once** if the device doesn't have it ("Unlock live search").
   - With it, Claude searches and replies in the thread, and the options appear as cards under "Options".
   - Without it, the cards come from the library, as today, with a note that live search needs the password.
3. **Each option card shows:**
   - name and region, and why it fits;
   - weather for the trip's months, with the source;
   - the main routes or activities;
   - getting there from the trip's origin: time, connections, price per person with the date seen;
   - lodging types with a nightly price range;
   - a total estimate per person and for the group, broken down;
   - the trade-off;
   - flags from the app's checks (for example "outside the Schengen area" for a traveller with that limit);
   - sources.

   Claude's own pick is marked. Honourable mentions are a short list with the reason each one isn't on top. Further messages ("tent only, public transport") update the cards; replaced versions are kept in the thread, not deleted.
4. **"Choose" on a card** sets `trip.chosen` and asks Claude for the plan.
   - Build, Plan & book, Money and Decisions show the plan's days, bookings, totals and to-dos instead of the library-computed ones.
   - Library destinations keep today's views.
5. **The plan views:**
   - **Days:** a table per day with the move or walk, distance, climb and hours, the night, the fallback, and the transport legs.
   - **Bookings:** pick, alternative, price with date seen, status (idea / decided / booked / not needed), link, and "book by".
   - **Getting there:** flight and ferry options.
   - **Permits and admin:** per traveller, with lead times.
   - **Gear:** a table with one column per traveller, each cell editable.
   - **Food.**
   - **To-do:** dated and ordered.
   - **Sources.**
   - **A chat box** at the top of the plan sends changes, and Claude answers with `update_plan`.
6. **Priority:** a "What to book first" list, ordered by rising price risk, sell-out risk, free cancellation, lead time, then gear. Each entry carries the exact booking details ("2 adults, one 22 kg hold bag each way") and its link.
7. **Map:** a Map tab for a chosen plan. Each day is a colour, walking is solid and transport dashed, nights are pins, and clicking a day isolates it.
8. **Export and share:** "Export" gives the print page and the Markdown. Share links work as today.

## Data
Trip gains these fields (documented in `docs/DATA-MODEL.md`, with `state.migrate()` and `scripts/validate.cjs` updated):
- `options: [ { id, name, region, countryCodes[], lat, lon, why, weather: { text, highC, lowC, source }, activities[], access: { from, time, connections, pricePP, seenOn, source }, lodging: [ { type, perNight: [low, high], currency } ], estimate: { perPerson, group, currency, breakdown: [ { what, amount } ] }, tradeOff, pick: bool, mention: bool, sources: [ { name, url, seenOn } ] } ]`.
- `livePlan` (when `chosen` is an option id):
  - `{ days: [ { date, move, km, ascentM, descentM, hours, night: { name, type, price, booked }, fallback, legs: [ { mode, from, to, time, cost, note } ], points: [ { name, lat, lon, kind } ] } ], bookings: [ { what, pick, alternative, price, currency, seenOn, status, link, bookBy, details } ], transport: [...], permits: [ { what, who, how, leadTime, note } ], admin: { <travellerId>: [ { what, status, note } ] }, gear: { items: [ { name, note, per: { <travellerId>: text } } ] }, food: text, todo: [ { date, what, done } ], sources: [ { name, url, seenOn } ] }`.
  - Every price carries its currency and `seenOn`.
- `brief` keeps the thread; app messages gain an optional `options`/`plan` revision tag so old versions can be shown.

Library destinations are unchanged. The existing scoring and flag code runs on options through a small adapter that turns an option into what `computePlan`/`criteria` need (country codes, a day high per month, cost per person).

## Cost and limits
- Each Claude turn with search costs real money. That's tokens plus per-search fees; check current rates in the claude-api skill and the pricing page at build time.
- The app shows a small "uses live search" note, never the price per message.
- Gabriel sets the monthly spend limit in his Anthropic Console. The spec does not depend on its exact value.
- Searches per turn are capped (`max_uses`) at a builder-chosen number.
- The system prompt and tool definitions are cached.

## Build order (each its own plan and PR)
The first plan covers stages 1 and 2, and it fixes the whole trip data model above (ids, rates, `livePlan` shape), so later stages build on it without migrations.
1. **Key lock and Claude client.** The script, `data/claude-key.json`, the unlock UI, "remember on this device", and a test call. Plus the CLAUDE.md rule change.
2. **Live options in Setup.** The tools, cards, flags via the adapter, and the fallback to the library.
3. **Live plan.** Days, bookings, totals, to-dos and sources in the existing tabs; the plan chat; gear per traveller.
4. **Consistency checks, side-by-side comparison, per-traveller admin, and merge-on-import** (requirements 2–5 above).
5. **Map, priority list, export, calendar file, offline.**
6. **Free live lookups.** Open-Meteo weather for options and stops without Claude data, and the Wikivoyage summary.

## Left to the builder
- Exact prompts, `max_uses`, `max_tokens` and effort level.
- How much thread history is sent each turn. A summary of the trip plus the last few messages is fine.
- Card and table layout, within the existing Pico and phone rules (`.pair` grids, stacked tables).
- Whether "remember on this device" defaults on or off. Default off.

## Open risks
- Share-link length grows with a full plan. If links get too long for messaging apps, a "share without sources" option, or a file export/import, may be needed.
- Claude's prices go stale; `seenOn` makes that visible, but nothing refreshes them automatically.
- A public locked key can be attacked offline. The 20-character minimum and high iteration count are the defence, plus the spend limit.
