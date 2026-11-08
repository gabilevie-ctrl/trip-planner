# Describe your trip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A rule-based chat that fills a new trip from plain sentences, and destination ideas in step 1.
**Architecture:** Pure reader in `src/describe.js`; Home and Setup views render the box/thread via `data-act`; ideas reuse `scoring.score`.
**Tech Stack:** vanilla ES modules, node --test, jsdom.
**Spec:** docs/superpowers/specs/2026-11-08-describe-your-trip-design.md

## Global Constraints
- No network calls; no new libraries.
- Every value set is said back in the reply; guesses are labelled "guess".
- Hash routes stay plain names.

## Review Focus
- Numbers that are not money ("3000 m", "30°C", "2 weeks", years) must not be read as a budget.
- A month with no year means the next one after today.
- Negations ("no hiking", "not too much walking") lower interests instead of raising them.
- A kind word in a later message does not change the trip's kind.
- Old trips without `brief` still render Setup.

### Task 1: The reader
**Files:** Create `src/describe.js`, `test/describe.test.mjs`.
**Produces:** `readDescription(text, { today }) -> { kind?, travellers?, start?, end?, days?, guessedDates?, budget?: { total, currency, perPerson }, origin?, travel?, lodging?, type?: {key: 0..3}, limits?: {key: value}, guesses: string[] }`; `applyDescription(trip, parsed) -> string[]` (what changed, in words); `replyFor(changes, trip, parsed) -> string`.
- [ ] Write tests for: the family sentence; ski touring; month-only dates as a guess; per-person budget; non-money numbers; negations; no-change kind.
- [ ] Run, see them fail; implement; run green; commit.

### Task 2: Chat on Home and Setup, ideas in step 1
**Files:** Modify `src/state.js` (brief), `src/views/home.js`, `src/views/setup.js`, `index.html` (chat styles), `docs/DATA-MODEL.md`; test in `test/integration.test.mjs`.
- [ ] Integration test: describe on Home → lands on Setup with fields filled, thread shows reply, ideas card lists 3 destinations; a follow-up message adds the budget.
- [ ] Run, fail; implement; run green; commit.
