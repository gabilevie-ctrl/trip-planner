# Live options (stages 1–2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A family password unlocks Gabriel's Anthropic key in the browser, and Setup's chat then asks Claude (with web search) for 3–5 live destination options. The options are shown as cards and flagged against the trip's limits by the app.

**Architecture:**
- **Pure modules:**
  - `keylock.js`: lock and unlock the key with WebCrypto.
  - `claude.js`: Messages API over raw HTTP.
  - `options.js`: the options tool schema, normalising and checking options.
  - `livechat.js`: one live turn.

  These sit beside a small browser-only `vault.js` that holds the unlocked key.
- **Setup view:** renders the unlock card and the option cards through the existing `data-act` contract.
- **The fixed trip data model** for every later stage lands in Task 1.

**Tech Stack:**
- vanilla ES modules, WebCrypto, `fetch`;
- `node --test` and jsdom;
- Node 25 (`globalThis.crypto.subtle`).

**Spec:** `docs/superpowers/specs/2026-11-09-live-planning-design.md`

## Global Constraints
- No framework, no bundler, no new runtime library.
- **Claude is called over raw HTTP.** The SDK needs a bundler, which settles the spec's "decided at build time". Request details:
  - URL `https://api.anthropic.com/v1/messages`;
  - headers `x-api-key`, `anthropic-version: 2023-06-01`, `anthropic-dangerous-direct-browser-access: true`, `content-type: application/json`, `anthropic-beta: server-side-fallback-2026-07-01`;
  - body includes `fallbacks: "default"`.
- **Model and settings:**
  - model `claude-opus-5-5`;
  - `thinking: { type: "adaptive" }`;
  - `output_config: { effort: "medium" }`;
  - `max_tokens: 16000`;
  - web search tool `{ type: "web_search_20260209", name: "web_search", max_uses: 5 }`.
- **The lock:**
  - PBKDF2-SHA256, at least 600,000 iterations, AES-256-GCM;
  - file `data/claude-key.json` with `{ v: 1, salt, iv, iterations, ciphertext, createdAt }` (base64 strings);
  - passwords under 20 characters are refused.
- **The key's text is never written to localStorage, IndexedDB, the trip or a share link.** "Remember on this device" stores only a non-extractable AES CryptoKey plus the lock's `createdAt`. It defaults to off.
- **Live fetches go only to `api.anthropic.com` in this plan.** Open-Meteo, Wikivoyage and OSM come in later stages.
- **Data rules:**
  - Every price carries `currency` and `seenOn` (YYYY-MM-DD).
  - Every source carries `name`, an `https://` `url` and `seenOn`.
  - Totals are computed by the app in `trip.budget.currency` from `trip.rates`; a price whose currency has no rate is flagged and left out.
- **Limits are flags, never exclusion.** Flag wording matches `src/compute.js` where the same limit already exists.
- **Text from Claude or the web is rendered only through `esc()`.** Links are only `https://` URLs.
- **No password, or no lock file:** Setup behaves exactly as today (rule-based chat, library ideas), plus one line saying live search needs the family password.
- **Hash routes stay plain names.** Views return HTML strings, and interaction goes through `data-act`.

**Data-model ruling (spec deviation, recorded):** `rates` lives on the trip (`trip.rates`), not under `livePlan`, because options and the plan both convert with it. Task 1 updates the spec's Data section and DATA-MODEL.md to match.

**Adapter ruling (spec deviation, recorded):** options are checked by a dedicated `checkOption` that uses the same limit primitives (`strictestLimits`, `countriesOutside`) and the same flag wording. It does not go through a pseudo-destination in `computePlan`, which would recompute costs from library rates and overwrite Claude's sourced estimate.

## Review Focus
1. **Wrong password:** a clear "That password doesn't unlock live search" message, nothing stored, the app keeps working. Tested in Task 3.
2. **Claude replies with text only (no `propose_options` call):** the reply appears in the thread, and `trip.options` is unchanged. Tested in Task 6.
3. **Malformed option input** (missing `countryCodes`, a price as a string, an unknown currency, an `http:` or `javascript:` source URL): it is normalised or dropped field by field and never crashes. An unknown currency is flagged and left out of the total, and bad URLs are removed. Tested in Task 5.
4. **API failure** (401, 429, 5xx, a network error): the thread says what happened in plain words, the rule-based form fill from the same message still applies, and the typed text is kept in the thread. Tested in Tasks 4 and 6.
5. **Share and import of a trip with options:** the options and rates survive the share link, and device-only option history is not in it. Text from Claude containing `<script>` renders as text. Tested in Task 7.

---

### Task 1: Trip data model for live planning
**Files:**
- Modify: `src/state.js` (`newTrip`, `migrate`, `stripForShare`)
- Modify: `docs/DATA-MODEL.md`, and `docs/superpowers/specs/2026-11-09-live-planning-design.md` (Data section: `rates` moves to the trip)
- Test: `test/state.test.mjs`

**Interfaces:**
- **Produces:** `newTrip()` gains `options: []`, `livePlan: null` and `rates: {}`. `migrate(trip)` fills them on old trips. `stripForShare` keeps them and drops `_ui` and `_local`.
- **Data shapes, documented in DATA-MODEL.md exactly as follows** (every id is a string from `uid(prefix)`):
  - `option`: `{ id: "o_…", name, region, countryCodes: ["ES"], lat, lon, why, weather: { text, highC, lowC, source: {name,url,seenOn} | null }, maxAltitudeM: number|null, activities: [string], access: { from, mode: "flight"|"train"|"ferry"|"drive"|"bus", time, connections, pricePP: number|null, currency, seenOn, source }, lodging: [ { type: "camping"|"hut"|"hostel"|"guesthouse"|"hotel"|"apartment"|"other", low, high, currency } ], estimate: { perPerson, group, currency, breakdown: [ { what, amount } ] }, tradeOff, pick: bool, mention: bool, mentionWhy: string|null, sources: [ {name,url,seenOn} ] }`
  - `trip.rates`: `{ "<ISO currency>": { toTrip: number, seenOn, source: {name,url,seenOn} } }`, where `toTrip` is the number of trip-currency units for 1 unit of that currency.
  - `livePlan` (filled in stage 3, shape fixed now):
    - `{ optionId, days: [ { id: "d_…", date, move, km, ascentM, descentM, hours, night: { name, type, bookingId: string|null }, fallback, legs: [ { id: "l_…", mode, from, to, time, bookingId: string|null, note } ], points: [ { name, lat, lon, kind } ] } ], bookings: [ { id: "b_…", what, pick, alternative, price, currency, seenOn, status: "idea"|"decided"|"booked"|"not-needed", confirmation, link, bookBy, details } ], permits: [ { id, what, who, how, leadTime, bookBy, note } ], admin: { "<travellerId>": [ { id, what, status, note } ] }, gear: [ { id, name, note, per: { "<travellerId>": string } } ], food: string, todo: [ { id, date, what, done } ], sources: [ {name,url,seenOn} ] }`
  - `trip._local` (device only, never shared): `{ optionHistory: [ { at, options } ], lastSynced: object|null }`

- [ ] **Step 1: Write the failing tests** in `test/state.test.mjs`:
```js
test("new trips carry the live-planning fields", () => {
  const t = newTrip("hike");
  assert.deepEqual(t.options, []); assert.equal(t.livePlan, null); assert.deepEqual(t.rates, {});
});
test("migrate adds live fields to an old trip without touching the rest", () => {
  const old = familyTrip(); delete old.options; delete old.rates;
  migrate(old); assert.deepEqual(old.options, []); assert.deepEqual(old.rates, {}); assert.equal(old.livePlan, null); assert.equal(old.name, "Parents' 30th");
});
test("share strips device-only history but keeps options and rates", () => {
  const t = newTrip(); t.options = [{ id: "o_1", name: "La Palma" }]; t.rates = { GBP: { toTrip: 1.17, seenOn: "2026-11-09", source: null } };
  t._local = { optionHistory: [{ at: "x", options: [] }] };
  const s = stripForShare(t); assert.equal(s._local, undefined); assert.equal(s.options[0].name, "La Palma"); assert.equal(s.rates.GBP.toTrip, 1.17);
});
```
- [ ] **Step 2:** Run `npm test`. Expected: the 3 new tests FAIL. The others pass.
- [ ] **Step 3:** Implement the fields in `src/state.js`, then write the DATA-MODEL.md section "Live options and plan" with the shapes above, and the spec edit.
- [ ] **Step 4:** Run `npm test` and `npm run validate`. Expected: all pass.
- [ ] **Step 5:** Commit `Add live-planning fields to the trip (options, rates, livePlan)`.

### Task 2: Locking the key, and Gabriel's setup command
**Files:**
- Create: `src/keylock.js`, `scripts/lock-key.mjs`, `docs/LIVE-SETUP.md`
- Modify: `package.json` (script `"lock-key": "node scripts/lock-key.mjs"`), `.gitignore` (nothing new expected; confirm `data/claude-key.json` is NOT ignored)
- Test: `test/keylock.test.mjs`

**Interfaces:**
- **Produces:**
  - `lockKey(apiKey: string, password: string, { iterations = 600000 } = {}) -> Promise<{ v:1, salt, iv, iterations, ciphertext, createdAt }>`. It throws `Error("Password must be at least 20 characters")` when the password is shorter.
  - `deriveKey(password: string, lock) -> Promise<CryptoKey>`: AES-GCM, non-extractable, usage `["decrypt"]`.
  - `openLock(lock, cryptoKey) -> Promise<string>`. It throws `Error("wrong-password")` when decryption fails.
  - `unlockKey(lock, password) -> Promise<string>`, equal to `openLock(lock, await deriveKey(password, lock))`.
  - All four use `globalThis.crypto.subtle` and `btoa`/`atob`, so the same file runs in Node and the browser.
- **The script** `scripts/lock-key.mjs`:
  - prompts "Anthropic API key:" and then "Family password (20+ characters, e.g. five random words):" twice, with no echo, using `node:readline` and muted output;
  - writes `data/claude-key.json` pretty-printed;
  - prints "Locked. Commit data/claude-key.json and push; tell the family the password." It never prints the key.
- **`docs/LIVE-SETUP.md`** is for Gabriel, in plain words:
  1. create a key in the Anthropic Console;
  2. set a monthly spend limit there;
  3. run `npm run lock-key`;
  4. commit and push;
  5. if the password leaks: revoke the key, make a new one, rerun, push.

- [ ] **Step 1: Write the failing tests** (iterations lowered for speed only in tests):
```js
test("a locked key opens with the right password", async () => {
  const lock = await lockKey("sk-ant-test-123", "correct horse battery staple", { iterations: 1000 });
  assert.equal(lock.v, 1); assert.equal(lock.iterations, 1000);
  assert.ok(!JSON.stringify(lock).includes("sk-ant-test-123"));
  assert.equal(await unlockKey(lock, "correct horse battery staple"), "sk-ant-test-123");
});
test("a wrong password is refused as wrong-password", async () => {
  const lock = await lockKey("sk-ant-test-123", "correct horse battery staple", { iterations: 1000 });
  await assert.rejects(unlockKey(lock, "correct horse battery stapler"), /wrong-password/);
});
test("short passwords are refused when locking", async () => {
  await assert.rejects(lockKey("sk-ant-x", "short pass"), /at least 20 characters/);
});
test("the default strength is at least 600,000 iterations", async () => {
  const lock = await lockKey("sk-ant-x", "a".repeat(20)); assert.ok(lock.iterations >= 600000);
});
```
- [ ] **Step 2:** Run `node --test test/keylock.test.mjs`. Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `src/keylock.js` (random 16-byte salt and 12-byte iv), then the script, the doc and the npm script.
- [ ] **Step 4:** Run `npm test`. Expected: all pass. The script's input is muted, so it can't be fed by a pipe. Instead, smoke-test the same code path with `node -e`: import `lockKey`, write a lock for a dummy key to the scratchpad, and check its fields.
- [ ] **Step 5:** Commit `Lock the Anthropic key with a family password (keylock + npm run lock-key)`.

### Task 3: The vault: unlock once, remember on this device
**Files:**
- Create: `src/vault.js`
- Test: `test/vault.test.mjs`

**Interfaces:**
- **Consumes:** `deriveKey`, `openLock` (Task 2).
- **Produces:** `createVault({ loadLock: () => Promise<lock|null>, store: { get(k), set(k,v), del(k) } }) -> vault`, with:
  - `vault.status() -> Promise<"none"|"locked"|"unlocked">`: "none" when there is no lock file.
  - `vault.unlock(password: string, { remember = false } = {}) -> Promise<{ ok: true } | { ok: false, reason: "wrong-password"|"no-lock" }>`.
  - `vault.apiKey() -> Promise<string|null>`: it opens with the remembered CryptoKey if there is one, and returns null when that fails or when the stored `createdAt` differs from the lock's (a re-locked key). The stored entry is then deleted.
  - `vault.forget() -> Promise<void>`.
  - The key text is cached only in a closure variable.
- **Produces:** `browserVault()`: `loadLock` fetches `data/claude-key.json` (404 → null), and `store` uses IndexedDB database `tripplanner-vault`, store `keys`. When `indexedDB` is undefined (jsdom, private mode) it falls back to an in-memory Map, so "remember" then lasts only for the tab.

- [ ] **Step 1: Write the failing tests** with a Map-backed store and a lock made with `iterations: 1000`:
  - "no lock file → status none, unlock returns no-lock";
  - "wrong password → { ok:false, reason:'wrong-password' } and nothing in the store";
  - "right password without remember → apiKey works in this vault; a new vault on the same store is locked";
  - "remember → a new vault on the same store returns the key without a password, and the store holds no string containing the key";
  - "after the key is re-locked (new createdAt) the remembered entry is dropped and status is locked";
  - "forget clears the store".
- [ ] **Step 2:** Run `node --test test/vault.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/vault.js`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `Unlock live search once per device (vault)`.

### Task 4: The Claude client
**Files:**
- Create: `src/claude.js`
- Test: `test/claude.test.mjs`

**Interfaces:**
- **Produces:** `ask({ apiKey, system, messages, tools, fetchImpl = fetch }) -> Promise<{ ok: true, text: string, toolCalls: [{ name, input }], searches: number, usage } | { ok: false, error: "auth"|"rate"|"server"|"network"|"refusal"|"bad-response", message: string }>`.
  - It sends the constants from Global Constraints.
  - `tools` is appended after the web search tool.
  - On `stop_reason: "pause_turn"`, it re-sends with the assistant content appended, at most 3 times.
  - `text` joins all `text` blocks.
  - `toolCalls` collects `tool_use` blocks (custom tools only).
  - `searches` counts `server_tool_use` blocks named `web_search`.
- **The plain-words messages:**
  - auth: "The saved key no longer works. Ask Gabriel for the new password."
  - rate: "Live search is busy or over this month's limit. Try again in a minute."
  - server: "Claude's servers had a problem. Try again shortly."
  - network: "No connection to live search. Check the internet connection."
  - refusal: "Claude declined that request."
  - bad-response: "Live search sent back something unexpected."
- `ask` never throws.

- [ ] **Step 1: Write the failing tests** with a fake `fetchImpl` that records requests:
  - the headers and body contain the model, `thinking`, `effort`, `fallbacks: "default"` and the web search tool first;
  - text plus a `tool_use` block → `toolCalls[0].input` parsed;
  - `pause_turn` then `end_turn` → 2 requests, the second containing the first's assistant content;
  - 401 → `error:"auth"`;
  - 429 → `"rate"`;
  - 529 → `"server"`;
  - a rejected fetch → `"network"`;
  - `stop_reason:"refusal"` → `"refusal"`;
  - a 200 with non-JSON → `"bad-response"`.
- [ ] **Step 2:** Run `node --test test/claude.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/claude.js`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `Call Claude with web search from the browser (claude.js)`.

### Task 5: Options: tool schema, normalising, checks
**Files:**
- Create: `src/options.js`
- Modify: `src/compute.js` (export the existing `andList` and `countryName`)
- Test: `test/options.test.mjs`

**Interfaces:**
- **Produces:** `OPTIONS_TOOL`: `{ name: "propose_options", description, strict: true, input_schema }`.
  - The input is `{ options: [option without id], rates: [ { currency, toTrip, seenOn, source } ] }`.
  - The option fields are as in Task 1. Every property is listed in `required`; fields that may be unknown are typed `[T, "null"]`. `additionalProperties: false` is set at every object level.
- **Produces:** `normalizeOptions(input, trip, { today }) -> { options: option[], rates: object }`. It:
  - assigns `id = uid("o")`;
  - coerces numeric strings to numbers and sets anything else non-numeric to null;
  - upper-cases currency and country codes, and drops codes that aren't 2 letters;
  - keeps only `https://` URLs (dropping the source otherwise);
  - fills a missing `seenOn` with `today`;
  - caps the list at 8;
  - ensures exactly one `pick` (the first option if none or several are marked);
  - merges rates into a copy of `trip.rates`, where the new rate for a currency replaces the old one.
- **Produces:** `toTripCurrency(amount, currency, trip) -> number|null`. It returns the amount itself when the currency is the trip's currency, `amount * trip.rates[cur].toTrip` when a rate exists, and null otherwise.
- **Produces:** `checkOption(option, trip) -> { flags: string[], countryBreach: bool, overBudget: bool, groupTotal: number|null, missingRates: string[] }`, using `strictestLimits(trip)`:
  - **Countries:** for each zone in `limits.countryZone`, `countriesOutside(option.countryCodes, zone, isEurope ? "europe" : "other")`, where `isEurope` means every code is in `COUNTRY_GROUPS.eu ∪ COUNTRY_GROUPS.schengen ∪ ["GB","IE","AL","BA","ME","MK","RS","MD","UA","AD","MC","SM","VA","GI"]`. Flag: `${andList(names)} ${is/are} outside ${COUNTRY_ZONE_LABEL[zone]}`.
  - **Warmth floor:** `weather.highC < limits.minDayHighC` → `${option.name}: ~${highC}°C in those months, below the ${floor}°C floor`.
  - **Heat ceiling:** `weather.highC > limits.maxDayHighC` → `${option.name}: ~${highC}°C is above the ${ceil}°C ceiling`.
  - **Altitude:** `maxAltitudeM > limits.maxAltitudeM` → the same text as `compute.js`.
  - **Trains only:** `trip.travel.mode === "train"` and `access.mode === "flight"` → "Reaching this destination needs a flight; the trip is set to trains only".
  - **Budget:** `groupTotal = toTripCurrency(estimate.group, estimate.currency, trip)`. When it is non-null and `trip.budget.total > 0` and `groupTotal > trip.budget.total` → `About ${fmtMoney(groupTotal, cur)} for the group, over the ${fmtMoney(budget, cur)} budget`.
  - **Missing rate:** when the estimate's currency has no rate → `No exchange rate for ${currency} yet; the total is left out`, and it is listed in `missingRates`.

- [ ] **Step 1: Write the failing tests.**
  - Fixtures: a two-traveller trip (Gabriel with no limits; Situ with `countryZone: "schengen"` and `minDayHighC: 18`), GBP budget 1500, dates 2027-01-02 → 2027-01-09. Two options:
    - La Palma: ES, 21 °C, estimate group 1300 GBP;
    - Southern Morocco: MA, 22 °C, group 1100 GBP.
  - Assert:
    - Morocco flags `"Morocco is outside the Schengen area"` with `countryBreach` true;
    - La Palma has no flags;
    - a Madeira option at 17 °C flags `"Madeira: ~17°C in those months, below the 18°C floor"`;
    - an estimate of 2000 EUR with no EUR rate gives `missingRates: ["EUR"]` and the "No exchange rate for EUR yet" flag, with `groupTotal` null;
    - with `rates.EUR = { toTrip: 0.86 }` it gives `groupTotal` 1720 and the over-budget flag "About £1,720 for the group, over the £1,500 budget".
  - Normalise tests:
    - `pricePP: "120"` becomes 120;
    - `countryCodes: ["es", "Spain"]` becomes `["ES"]`;
    - sources with `http://x` and `javascript:alert(1)` are dropped;
    - two `pick: true` leave only the first;
    - 10 options are capped to 8;
    - every id starts with `o_`.
  - `OPTIONS_TOOL.input_schema` has `additionalProperties: false` at the top level and in the option item.
- [ ] **Step 2:** Run `node --test test/options.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/options.js` and export `andList` and `countryName` from compute.js.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `Live options: schema, normalising, and the same limit flags as the library`.

### Task 6: One live chat turn
**Files:**
- Create: `src/prompts.js`, `src/livechat.js`
- Test: `test/livechat.test.mjs`

**Interfaces:**
- **Consumes:** `describeTurn` (describe.js), `ask` (Task 4), `OPTIONS_TOOL` and `normalizeOptions` (Task 5).
- **Produces:** `SYSTEM_PROMPT` (a stable string, so it caches). It must tell Claude to:
  - search live;
  - propose 3–5 options through `propose_options` whenever the traveller asks for ideas or adds a constraint that changes them, with one `pick` and honourable mentions as `mention: true` with `mentionWhy`;
  - give weather, routes, getting there from the trip's origin, lodging types with nightly ranges, and a broken-down estimate, each with its source and `seenOn`;
  - quote prices in their original currency and supply `rates` to the trip currency with a source;
  - never hide an option for breaking a limit, but say so in `tradeOff`;
  - treat the trip JSON in the message as the truth about travellers, limits, dates and budget, without asking for what it already holds;
  - keep the text reply under 120 words, since the cards carry the detail;
  - end with at most two sharpening questions.
- **Produces:** `tripContext(trip) -> string`: JSON with:
  - kind, origin, travel mode, dates, length, budget and currency, lodging, interests;
  - each traveller's name and limits;
  - visited country codes;
  - the names of current options, and `chosen`.

  It excludes `brief`, `_ui`, `_local` and `livePlan`.
- **Produces:** `liveTurn(trip, text, { ask, apiKey, today, countries, suggest }) -> Promise<{ ok: bool, reply: string, optionsChanged: bool }>`. In order:
  1. Run `describeTurn` (the form fill and its reply, exactly as today).
  2. Build `messages` from the last 6 `brief` entries before this turn, mapped you → user and app → assistant, with consecutive same-role entries merged. Then add the final user message `Current trip:\n${tripContext(trip)}\n\nMessage:\n${text}`.
  3. Call `ask` with `tools: [OPTIONS_TOOL]`.
  4. On a `propose_options` call: push the old `trip.options` onto `trip._local.optionHistory`, keeping the last 3, and set `trip.options` and `trip.rates` from `normalizeOptions`.
  5. Append `{ who: "app", text: result.text || "Here are the options.", live: true, optionsRev: <ISO time> }` to `brief`.
  6. On `ok: false`, append `{ who: "app", text: result.message, live: true, error: true }`. Options stay unchanged.
  7. `trip.livePlan` is never modified in this stage.

- [ ] **Step 1: Write the failing tests** with a fake `ask`:
  - "a propose_options call replaces options and rates, keeps the old ones in _local.optionHistory, and the thread gets both the form-fill reply and the live reply";
  - "text-only reply: thread gets the text, options unchanged";
  - "ask returns {ok:false,error:'rate'}: thread shows the rate message, the form fill from the same message still applied (dates read from '2–9 January' are set), the user's text is in the thread";
  - "the user message sent to Claude contains the trip JSON with Situ's countryZone and not the brief";
  - "history beyond 3 is trimmed".
- [ ] **Step 2:** Run `node --test test/livechat.test.mjs`. Expected: FAIL.
- [ ] **Step 3:** Implement `src/prompts.js` and `src/livechat.js`.
- [ ] **Step 4:** Run `npm test`. Expected: all pass.
- [ ] **Step 5:** Commit `One live chat turn: fill the form, ask Claude, keep the options`.

### Task 7: Setup: unlock card, live send, option cards
**Files:**
- Modify:
  - `src/views/setup.js`: the unlock card, async `chat-send`, an `options` section in place of `fitIdeas` when `trip.options.length`, and a note when there is no vault.
  - `src/views/home.js`: `describe-new` runs a live turn when unlocked.
  - `src/main.js`: create one `browserVault()` and expose `ctx.vault`; `ctx.busy` flag; re-render after the async action resolves.
  - `index.html`: `.optcards`, `.optcard`, `.pickbadge` and `.busy` styles that stack on phones.
  - `CLAUDE.md`: replace the "never fetch" rule with the allow-list from the spec, and drop the artifact-host mention.
  - `README.md`: one paragraph on live search and a link to docs/LIVE-SETUP.md.
- Test: `test/integration.test.mjs`

**Interfaces:**
- **Consumes:** `browserVault` (Task 3), `liveTurn` (Task 6), `checkOption` and `toTripCurrency` (Task 5).
- **UI contract:**
  - **Unlock card.** Shown at the top of Setup when `await ctx.vault.status() === "locked"`. Main.js resolves the status before render into `ctx.liveStatus`. It holds:
    - the title "Live search";
    - a password field `#livePass` with a "Remember on this device" checkbox `#liveRemember`;
    - a button `data-act="live-unlock"`;
    - the text "Uses Gabriel's Claude account to search the web for options. Ask him for the family password."
  - **Unlock results.** On wrong-password, a toast says "That password doesn't unlock live search." When unlocked, the card is replaced by a one-line status "Live search is on" and a `data-act="live-forget"` link "Forget on this device".
  - **`chat-send` when unlocked:**
    - sets `ctx.busy` and renders "Searching live… this can take a minute" in the thread;
    - disables the Send button;
    - awaits `liveTurn`, then commits;
    - keeps the input text in the box if the call fails before anything is appended.
  - **When locked or with no lock:** today's behaviour. When the lock exists but is locked, the chat card adds "Unlock live search above for real options from the web."
  - **Option cards.** Under the heading "Options", the pick first with a "Claude's pick" badge, then the others. Each card shows:
    - name, region, `why`;
    - weather text and highC, with a source link;
    - activities as a short list;
    - access: from, mode, time, connections, price per person in its own currency and in trip currency when converted, "seen" date;
    - lodging types with ranges;
    - the estimate per person and for the group, plus a breakdown in `<details>`;
    - the trade-off;
    - `checkOption` flags as `chip crit`;
    - sources as links.

    Mentions render after the cards as a short list "Also considered: name — mentionWhy". The library's "Ideas that fit so far" is shown only when there are no options.

- [ ] **Step 1: Write the failing integration test** "live search: unlock, ask, see flagged options, survive a share link":
  1. Write a lock made with `lockKey("sk-ant-test", "correct horse battery staple long", { iterations: 1000 })` to the fake fetch map for `data/claude-key.json`, by extending the test's fetch fake with an in-memory map checked before disk.
  2. Route `https://api.anthropic.com/v1/messages` to a fake that asserts the header `x-api-key: sk-ant-test`. It returns text "Here are three ideas." plus a `propose_options` `tool_use`: La Palma (pick, ES, 21 °C) and Southern Morocco (MA), plus the GBP rate.
  3. Create a trip from Home, set traveller 2's country limit to schengen, open Setup, and type the wrong password and click → assert the toast text.
  4. Type the right one → assert "Live search is on".
  5. Type "warm hiking in January" and click Send → wait, then assert:
     - `.optcard` count 2;
     - the first contains "Claude's pick";
     - the Morocco card contains "outside the Schengen area".
  6. Add a third option whose `why` is `<script>x</script>` → assert it renders as text (no `script` element in `.optcards`).
  7. Encode the share link with `state.encodeShare`, decode it, and assert options and rates are there and `_local` is absent.
  8. With the lock file removed and the vault forgotten, Setup shows today's "Ideas that fit so far" and no unlock card.
- [ ] **Step 2:** Run `node --test test/integration.test.mjs`. Expected: the new test FAILS; existing tests pass.
- [ ] **Step 3:** Implement the view, main.js, styles and doc changes.
- [ ] **Step 4:** Run `npm test` and `npm run validate`. Expected: all pass. Then open http://localhost:8000/#setup at phone width (375 px) and desktop and check the unlock card and a fake-option render (temporarily paste options into the trip from devtools), then remove the paste.
- [ ] **Step 5:** Commit `Setup: unlock live search and show Claude's options as flagged cards`.
