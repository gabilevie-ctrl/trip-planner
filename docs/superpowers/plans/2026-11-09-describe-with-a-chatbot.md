# Describe your trip with a chatbot — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** From the Home describe box, build a prompt for any chatbot, read its pasted JSON reply, and open a checked, migrated trip on Setup.

**Architecture:** A pure module `src/chatbot.js` (prompt builder, reply reader, reply-to-trip checker) driven by definitions in `src/criteria.js`. `src/views/home.js` adds a two-step panel held in module state; `src/main.js` gains `ctx.addTrip`.

**Tech Stack:** Vanilla JS ES modules, node --test, jsdom.

**Spec:** `docs/superpowers/specs/2026-11-09-describe-with-a-chatbot-design.md`

## Global Constraints
- No network call, no key, no personal text in a URL.
- Field lists in the prompt are generated from `criteria.js` / `state.js`, never hand-copied.
- Interest weights from the reply are added on top of the `newTrip` defaults (`Object.assign`).
- Every trip from a reply passes `state.migrate` before it is stored; a failed reply stores nothing.
- Views return HTML strings; interaction through `data-act` handled via `home.actions`.
- `npm test` green before each commit.

## Review Focus
- A reply wrapped in chatter before and after the JSON block → still read (Task 2 test `reads JSON with chatter around it`).
- A reply whose `travellers` is not an array, or whose limits is not an object → dropped with a reason, no crash (Task 2 test `odd shapes are dropped, not thrown`).
- Numbers sent as strings ("3000") → accepted when they are clean numbers (Task 2 test `numeric strings are accepted`).
- Very long pasted text → prompt still built; description capped at 2000 chars like the reader (Task 2 test `prompt caps the description`).
- The panel re-rendering (another toast/rerender) must not wipe the pasted reply (Task 3 integration: reply text survives a failed attempt).

---

### Task 1: Shared definitions in criteria.js

**Files:**
- Modify: `src/criteria.js` (add `TRIP_TYPES`, `ORIGINS`, `ORIGIN_REGIONS`, `CURRENCIES`)
- Modify: `src/views/setup.js:8-9` (import instead of local `ORIGINS`, `TYPE_TAGS`)
- Modify: `src/describe.js:10` (import `ORIGIN_REGIONS`, re-export it for existing callers)

**Interfaces:**
- Produces: `TRIP_TYPES: { cities, hike, coast, wildlife, history, food, festival } → label`; `ORIGINS: [[city, region], …]` incl. `["Other","europe-west"]`; `ORIGIN_REGIONS: { city → region }` (without Other); `CURRENCIES: ["EUR","GBP","CHF","USD"]`.

- [ ] Move the constants; values unchanged.
- [ ] Run `npm test` → all pass (pure refactor).
- [ ] Commit "Share trip types, origins and currencies from criteria.js".

### Task 2: src/chatbot.js with unit tests

**Files:**
- Create: `src/chatbot.js`
- Test: `test/chatbot.test.mjs`

**Interfaces:**
- Consumes: Task 1 constants; `KINDS, TRAVEL_MODES, LODGING, CRITERIA, criteriaFor` from criteria.js; `newTrip, migrate, uid` from state.js.
- Produces:
  - `buildPrompt(text: string, { today: "YYYY-MM-DD" }) → string`
  - `readReply(reply: string) → { obj } | { error: string }`
  - `tripFromReply(obj, { text, today }) → { trip, filled: string[], dropped: string[], assumptions: string[], summary: string } | { error: string }`
  - `NUMBER_RANGES: { maxAltitudeM:[0,9000], maxDayHighC:[-30,50], minDayHighC:[-30,50], maxHikeShare:[0,100], maxDailyAscentM:[0,4000], maxDailyHours:[1,16] }`

- [ ] **Write failing tests** (`today = "2026-11-09"`):
  - `prompt names every kind and criterion`: for each `KINDS` key and each `CRITERIA` key, `buildPrompt("x",{today}).includes(key)`; includes `"2026-11-09"` and the text.
  - `prompt caps the description`: 5000-char text → prompt contains at most 2000 of it.
  - `reads fenced JSON`, `reads JSON with chatter around it`, `repairs curly quotes and trailing commas` → `obj` deep-equals expected.
  - `cut-off reply is an error`: `'```json\n{"name":"A", "dates": {'` → `error` matches /cut off/.
  - `no JSON is an error`, `an array is an error` → `error` matches /no trip/.
  - `good reply`: kind explore, name "Summer with Mom", origin London, travelMode train, lodging hotel, dates 2027-07-10..2027-07-24, budget {total:12000,currency:"GBP"}, type {coast:3, food:3}, travellers [{name:"Mom",limits:{maxAltitudeM:2000,maxDayHighC:30}},{name:"Gabriel",limits:{}}], assumptions ["July means mid-July"] → trip.origin `{city:"London",region:"uk"}`, travellers[0].limits.maxAltitudeM 2000, travellers[1].limits `{}`, both have ids, `type` = `{cities:2,hike:2,coast:3,wildlife:0,history:1,food:3}`, notes contains the text, brief length 2 with who "you"/"app", `migrate(structuredClone(trip))` deep-equals trip.
  - `bad values are dropped with reasons`: kind "beach" → explore + dropped mentions kind; end before start → no dates, dropped mentions dates; start 2025-01-01 → dropped; skitour with `maxGradeSki:"Z9"` dropped; explore traveller with `maxDailyHours` dropped; type `{coast:7}` dropped; origin "Lyon" → city "Other", notes mention Lyon; currency "JPY" dropped.
  - `per-person budget`: 3 travellers, `budget:{perPerson:1000,currency:"EUR"}` → total 3000, perPerson 1000.
  - `numeric strings are accepted`: `maxAltitudeM:"3000"` → 3000; `"3000m"` dropped.
  - `odd shapes are dropped, not thrown`: `travellers:"two"`, `limits:[1]`, `dates:"July"` → no throw; dropped lists them.
  - `nothing real is an error`: `{}`, `{notes:"x"}`, `{assumptions:["a"]}`, `{travellers:[{name:"",limits:{}}]}` → `error` matches /Nothing in that reply/.
- [ ] Run `node --test test/chatbot.test.mjs` → FAIL (module missing).
- [ ] Implement per the spec's "Reading a reply" section; error copy exactly as the spec words it. Summary text: "Filled in by the chatbot:\n• …", then "Not used:\n• …" and "Its guesses to check:\n• …" when non-empty, then "Check everything in the form below."
- [ ] Run → PASS; `npm test` → PASS.
- [ ] Commit "Read a chatbot's JSON reply into a checked trip".

### Task 3: Home panel, ctx.addTrip, integration test

**Files:**
- Modify: `src/main.js` (add `addTrip: t => importTrip(t)` to ctx)
- Modify: `src/views/home.js` (button `data-act="describe-chatbot"`, panel, actions `chatbot-copy`, `chatbot-fill`, `chatbot-close`)
- Modify: `test/integration.test.mjs` (new test)

**Interfaces:**
- Consumes: Task 2 `buildPrompt`, `readReply`, `tripFromReply`.
- Panel ids: `#chatbotPrompt` (readonly textarea), `#chatbotReply`, `.chatbot-error` (role="alert").

- [ ] **Write failing integration test** `describe with a chatbot: prompt, a bad reply, then a good one`: on `#home` set `#describeText` to "Mom and me from London in July, she can't do altitude"; click `[data-act="describe-chatbot"]`; `#chatbotPrompt.value` includes "Mom and me"; set `#chatbotReply` to `'{"name": "Bro'`, click `[data-act="chatbot-fill"]` → `.chatbot-error` text matches /cut off/, trip count unchanged, `#chatbotReply.value` still the bad text; set a good reply (two named travellers, Mom with maxAltitudeM 2000, dates 2027-07-10..20); click fill → hash `#setup`, `[data-bind="travellers.0.name"]` value "Mom", `[data-bind="travellers.0.limits.maxAltitudeM"]` value "2000", `[data-bind="travellers.1.limits.maxAltitudeM"]` value "", `.thread` text matches /Filled in by the chatbot/.
- [ ] Run → FAIL.
- [ ] Implement: module `panel = { open, prompt, reply, error }`; `describe-chatbot` reads the textarea (toast if empty), sets prompt with `today` = local date, rerenders; `chatbot-fill` reads `#chatbotReply`, stores it in `panel.reply`, runs readReply → tripFromReply, on error sets `panel.error` and rerenders, on success `ctx.addTrip(trip)`, resets panel, `ctx.open(trip.id,"setup")`; `chatbot-copy` → `ctx.copy(panel.prompt, el)`; `chatbot-close` resets panel. Also keep the description textarea value across rerenders (render it from `panel.text`).
- [ ] Run → PASS; `npm test` → PASS.
- [ ] Commit "Add 'Ask a chatbot to fill it in' to the Home describe box".

### Task 4: Docs and wrap-up

**Files:**
- Modify: `docs/DATA-MODEL.md` (brief may come from the chatbot path; `maxHikeShare` example → 60)
- Modify: `README.md` if it lists features (one line)

- [ ] Edit docs; `npm test` and `npm run validate` → green.
- [ ] Commit "Document the chatbot path"; push; open PR into main.
