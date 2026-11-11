# Describe your trip with a chatbot

## Why
Family members starting a trip think in sentences. The app already reads those sentences with a rule-based reader (`src/describe.js`, PR #4 and #7): a "Describe your trip" box on Home creates the trip and the Setup chat says back what it filled. That reader cannot take names, cannot give a limit to one person ("Mom can't do altitude" sets it for everyone), and misses wordings its rules don't expect.

A chatbot reads that kind of text well. This adds a second way through the same box: the app writes a prompt, the person pastes it into Claude or any chatbot they already use, and pastes the JSON reply back. The app checks every field and opens the trip on the Setup form to review.

## The decision: how text becomes a trip
| | (a) Paste into a chatbot | (b) In-app chat through a proxy | (c) Rule-based reader |
|---|---|---|---|
| Status | **This spec** | Not now | Already shipped |
| Running cost | Free; people use their own chatbot | Claude API per trip, plus a Worker | Free |
| Works on Pages and the artifact copy | Both | Pages only (artifact blocks cross-site fetch) | Both |
| Security | No key anywhere | Key safe in the Worker, but the endpoint is public: needs a family passphrase and a spend cap | Nothing to protect |
| Upkeep | None | A second deploy to keep alive | Rules to extend |
| Names, per-person limits, odd wording | Yes | Yes | No |
| Friction | Copy, switch tab, paste, copy, paste | None | None |

Gabriel chose to keep this work in this session; (a) is the recommendation put to him and is what this spec builds. (b) can come later and reuse everything below except the copy/paste UI, because the reply checking is the same.

## Goals
- A "Ask a chatbot to fill it in" path from the Home describe box, ending on the Setup form with the trip prefilled.
- The chatbot can fill: name, kind, origin, travel mode, travellers with names and **per-person** limits, dates, budget, lodging, explore `type` weights, notes.
- Every value from the reply is checked against the same definitions the form uses (`src/criteria.js`) before it touches a trip; the result always passes through `state.migrate`.
- A bad, partial or cut-off reply gives a clear message in place and creates no trip.
- What was filled, what was dropped and why, and the chatbot's own guesses are said back in the Setup chat (`trip.brief`), so nothing is filled silently.

## Non-goals
- No server, no API key, no network call from the app (that is option b).
- No chatbot path for editing an existing trip; the Setup chat keeps using the rule-based reader.
- No visited places, weights or destinations from the reply.
- The existing "Start from my description" button and reader stay as they are.

## Anti-goals
- A reply that half-applies and leaves a trip with impossible values (end before start, a limit key the kind doesn't have, a grade not on the scale).
- Personal text in a URL (no `claude.ai/new?q=…` prefill).
- A prompt that drifts from the app: the field lists in the prompt are generated from `criteria.js` and `state.js`, never hand-copied.

## Flow (Home)
1. The describe card keeps its textarea and "Start from my description". A second button, **"Ask a chatbot to fill it in"**, sits next to it.
2. Clicking it with text in the box opens a panel under the card (no route change; Home re-renders with the panel open). With an empty box it toasts "Write a few words about the trip first."
3. Panel, step 1: "Copy this and paste it into Claude, ChatGPT or any chatbot." A read-only textarea holds the prompt, a **Copy** button (`ctx.copy`), and a one-line note: "What you wrote goes to that chatbot, not to this app."
4. Panel, step 2: "Paste its whole reply here." A textarea and **Fill in my trip**.
5. On success: a new trip is stored, opened on `#setup`; its chat thread shows the person's description and the app's summary of what the chatbot filled. On failure: an inline message under step 2 (not only a toast), the pasted text stays, no trip is created. A **Close** link hides the panel.

The panel state (open, prompt text, last error) lives in a module-level variable in `home.js`, not in the store, so a reload simply closes it.

## The prompt (`buildPrompt(text, { today })`)
Plain text, in this order:
- Role: turn a trip description into JSON for a trip-planning app; reply with **one JSON object in a ```json block and nothing else**.
- Today's date, so "July" resolves to the next July.
- The field list, generated from code:
  - `kind`: keys and labels of `KINDS`.
  - `name`, `notes`: strings.
  - `origin`: one of the Setup origin cities, or "Other" with the real city in `notes`.
  - `travelMode`: keys of `TRAVEL_MODES` with blurbs.
  - `lodging`: keys of `LODGING`.
  - `dates`: `{ start, end }` as `YYYY-MM-DD`.
  - `budget`: `{ total, currency, perPerson }` with currencies EUR, GBP, CHF, USD; `total` for the group, or `perPerson` alone.
  - `type` (explore only): the interest keys, each 0–3.
  - `travellers`: array of `{ name, limits }`; for each kind, the limit keys from `CRITERIA` with unit, allowed options and the help line. "Put a limit only on the person it concerns."
  - `assumptions`: strings, one per guess the chatbot made.
- Rules: leave out anything the description doesn't say; don't invent names (use "" or "Person 2"); numbers as numbers.
- The person's text, fenced between clear markers.

The interest keys and labels move from `setup.js` (`TYPE_TAGS`) to `criteria.js` as `TRIP_TYPES`, and the origin list (`ORIGINS`) moves there too, so the prompt, the form and the checker share one definition.

## Reading a reply (`src/chatbot.js`, pure)
`readReply(replyText)` → `{ obj } | { error }`:
- Takes the content of the first ```json (or ```) fence; otherwise the text from the first `{` to the last `}`.
- `JSON.parse`; on failure, one retry after replacing curly quotes and removing trailing commas before `}`/`]`.
- Errors, in words a family member can act on:
  - nothing that looks like JSON → "That reply has no trip in it. Ask the chatbot to answer with only the JSON block, then paste again."
  - parse fails (often a cut-off reply) → "The reply looks cut off or garbled, so nothing was filled. Ask the chatbot for the full JSON again."
  - parsed but not an object, or an array → same as nothing found.

`tripFromReply(obj, { text, today })` → `{ trip, filled, dropped, assumptions } | { error }`:
- Starts from `state.newTrip(kind)` (kind checked first; unknown → explore, dropped with reason) and copies in only checked values:
  - `name` string, trimmed, ≤ 80 chars.
  - `origin` one of the origin cities → `{ city, region }`; anything else → "Other", noted.
  - `travelMode`, `lodging`: must be a key of `TRAVEL_MODES` / `LODGING`.
  - `dates`: both real `YYYY-MM-DD` dates, end ≥ start, at most 60 days, start not before today. Otherwise both dropped with the reason.
  - `budget.currency` one of the four; `total` / `perPerson` numbers 0–1,000,000. `perPerson` alone sets `total = perPerson × travellers` and keeps `perPerson`, as the reader does.
  - `type`: explore only; keys in `TRIP_TYPES`; integers 0–3 (a decimal is rounded; out of range dropped). Accepted weights are **added on top of** the `newTrip` defaults (`Object.assign`, as the reader does): keys the reply doesn't mention keep their default (Gabriel's choice). The prompt keeps "leave out what isn't said" for interests too.
  - `travellers`: array of 1–20; each gets `id: uid("p")`, `name` string ≤ 40, and `limits` filtered to `criteriaFor(kind)`:
    - number criteria: finite numbers within a sane range per key (altitude 0–9000 m, °C −30–50, ascent 0–4000 m, hours 1–16, hike share 0–100 %);
    - select criteria: the value (as a string) must be one of its options;
    - bool criteria: must be `true`/`false`.
    An empty or missing list keeps the single blank traveller of `newTrip`.
  - `notes`: string ≤ 2000. The person's own description is always added to `notes` too, as the reader does.
  - `assumptions`: up to 10 strings ≤ 200 chars.
- Unknown top-level keys are listed as ignored.
- If **no real field** was accepted → `{ error: "Nothing in that reply matched a trip…" }`. Real fields: kind, name, origin, travel mode, lodging, dates, budget, type, a traveller with a name or a limit. `notes`, `assumptions` and blank travellers alone don't count (builder's call).
- `trip.name` falls back to "<Month> <year> trip" from the dates, else "New trip".
- `state.migrate(trip)` runs last; the caller stores the trip only after this returns.
- `trip.brief` gets `{ who: "you", text }` and `{ who: "app", text: summary }`, where the summary lists "Filled in by the chatbot", "Not used" with reasons, and "Its guesses to check".

`main.js` gains `ctx.addTrip(trip)` (store, set current, save) so `home.js` doesn't reach into the store; `importTrip` is reused for the id clash case.

## Data
No change to the trip shape: everything filled already exists. `docs/DATA-MODEL.md` gets a line that the brief can come from the chatbot path, and its `maxHikeShare` example is corrected to a percentage (the code uses 0–100, the doc shows 0.6).

## Tests
- `test/chatbot.test.mjs`:
  - `buildPrompt` contains the person's text, today's date, every `CRITERIA` key and every `KINDS` key.
  - `readReply`: fenced JSON, bare JSON with chatter around it, curly quotes, trailing comma, cut-off JSON (error), no JSON (error), an array (error).
  - `tripFromReply`: a full good reply (per-person limits land on the right person); bad values dropped with reasons (unknown kind, end before start, past dates, grade not on the scale, a limit key from another kind, type weight 7, unknown origin → Other); per-person budget; empty object (error); the result is unchanged by a second `state.migrate`.
- `test/integration.test.mjs`: Home → type a description → "Ask a chatbot" → prompt contains the text → paste a malformed reply → inline error, no new trip → paste a good reply → lands on `#setup` with names, per-person limits and dates in the form and the summary in the chat.

## Left to the builder
Exact wording of labels and messages within the tone above; layout of the panel; whether "Copy" also selects the text as a fallback.
