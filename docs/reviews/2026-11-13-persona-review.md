# Persona review: from the idea to booked (13 November 2026)

Five testers each played one real situation of Gabriel's through the app as it is live now (`main` at `d387d67`, live plan included). Each walked from the first idea to an itinerary with things booked.

How they tested:
- They drove the real app in a simulated browser (jsdom), with a stand-in for Claude. The real API was never called.
- Each journey is now a scenario test in `test/scenario-*.test.mjs`.
- What the app couldn't do is recorded there as a to-do test (`test.todo`), 67 in all.

"The describe box" below is the rule-based reader that fills Setup from a sentence, without Claude.

| Persona | Situation | Path |
|---|---|---|
| Gabriel alone | 5–6 days hut-to-hut in September, no dates, train from Brussels, ~€900 | library, no password |
| The family | Parents' 30th template: 5 people, Mom's limits, €15,000, July | library, then live (Japan) |
| Gabriel and Situ | warm hiking and camping in January, from London, £1,500, Situ Schengen-only | live, start to booked |
| Friends | ski-touring week, 4 people with different limits, two candidate weeks, Georgia vs Écrins | library and live |
| Weekend away (Gabriel and Situ) | cheapest warm long weekend in March or April, train if possible, £600 | no password first, then live |

## The short answer

- **A live plan already beats a chat for one person** (seen in the Situ and weekend scenarios).
  - The app computes the totals.
  - Prices carry a rate and the date they were seen.
  - To-dos are ordered by book-by date.
  - A rewrite keeps what was marked booked, and Claude can't mark anything booked itself.
- **For two or more people it doesn't yet.** The moment someone else edits a shared link, the trip forks into separate copies, and nothing brings them back together.
- **The idea stage is weak.** The app can't hold "sometime in March or April" or help pick the week, and it fixes dates too early.
- **Without the password, the library path works for one person** until dates are missing, where two pages crash (bug 2).

## Bugs to fix first (all confirmed against the code)

1. **An option's name can shift the trip dates.**
   - The app's own "Write the full plan for <option name>." goes through the describe box (`src/livechat.js:25`).
   - When the name contains a date ("Nice, Fri 9 – Sun 11 Apr"), "Apr" is read as a month. The trip dates become 1–7 April, and the plan request carries those dates.
   - Claude's plan came back for 9–11 April, and nothing flags the mismatch.
   - Fix: skip the describe box for the app's own messages.
2. **Itinerary and Plan & book crash with no dates.** After a route is chosen without dates, both pages show "Something went wrong: Invalid time value" (`stays()` in `src/compute.js`). This hits exactly the person who hasn't fixed dates yet.
3. **Conditions shows the wrong place for a live choice.** With Gudauri chosen, Conditions shows "Conditions: Dolomites…", because it falls back to a library destination (`src/views/conditions.js:9`).
4. **The avalanche danger limit means two different things (safety).**
   - Setup says a day is a no-go *above* the level set.
   - Conditions marks the day a no-go *at* that level.
   - With Léa's limit of 2, a level-2 day is fine in one place and a no-go in the other.
5. **Permits and admin items can't be ticked.** "Apply: camping permit" never shows done, and a traveller's visa check has no tick box, yet these are the most time-critical items.
6. **A plan update can silently drop people's work.**
   - If Claude leaves an item out of an update, it disappears: a ticked to-do, a gear row someone added (with its cells), or a "decided" booking. Only "booked" bookings are kept.
   - A booked item the new plan no longer uses stays, still counted in the total, with no "cancel this?". Example: a permit for a night that was swapped out.
7. **Live trips have dead ends.** Destinations shows only the library, with no "chosen" bar and no Next button. A family member walking with Next lands on cards whose only button, "Choose this destination", would replace the live choice.
8. **Wrong numbers after a change of people.** Adding a third traveller after a plan exists keeps the plan total, which was priced for two, and silently divides it by three per person.
9. **The describe box over-applies.**
   - "Situ can only travel within Schengen" became a limit for both travellers.
   - "By train if possible" became the hard rule "trains only".
   - "Let's fly instead" wasn't understood.
   - A message naming only a month resets a 3-day length to 7 days.
   - The solo trip is still asked "How many of you are going?".
10. **Library presets don't fit the dates.** A preset plus the default rest day can leave no day to get there or back, and the itinerary runs past the end date. The "Fit to my dates" button only appears when the trip is too long.

## Smaller things the testers hit

- Winter destinations ("Highlands in winter") are offered for July.
- The ski trip is set to drive, yet day 1 shows a train route.
- Rome2Rio and map links use the stage description instead of a place name.
- A solo trip still says "for the group" and shows split-the-cost blocks.
- With no password, Setup doesn't say live search exists or why it's off.
- No warning when the plan's days fall outside the trip dates.
- What Claude found out about an option (for example "wild camping is illegal") stays in the chat, not on the option's card.
- Negative balances read "€-800".

## What's missing, stage by stage

**Idea and dates**
- A date window ("March or April"), a length ("a long weekend") and "weekends only", held as flexible until one is picked.
- Help choosing the week: hut opening and closing dates, crowd peaks and events as flags on the dates, prices by weekend.
- Two candidate date ranges compared side by side (the ski friends' 13–19 vs 20–26 March scored the same).
- Soft preferences ("if possible") kept apart from hard limits.

**Options and choosing**
- Options that carry their own dates and price, in one table sortable by price, with library and live options together.
- Choosing an option with dates sets the trip dates.
- Flags that name whose limit it is ("above Mom's 33°C"), for both library and live options.
- More checks on live options: crowds, hiking share, ski grade, daily ascent, "needs a flight" on a drive trip, and a "places to avoid" limit.
- A per-person vote on decisions, with a tally and who hasn't voted. Deciding "Where do we go?" should also choose it.

**Plan and booking**
- Done states for permits and admin, and who marked a booking booked, and when.
- Consistency checks:
  - from the spec's stage 4: a camping night with no tent, a book-by date already past;
  - added by this review: booked with no confirmation, and a booked item the plan no longer uses.
- Stale warnings: when dates, people, travel mode or budget change after a plan exists, the plan should say it's out of date and offer to refresh it.
- Dated deadlines ("book the huts by April 2027") instead of "5 months ahead", plus a calendar file.
- Train and flight legs as rows to book with a reference; nights at the start and end of a route.
- One "booked so far" list.

**Money**
- A booking marked booked becomes an expense, with payer and split.
- Expenses in other currencies, using the trip's rates.
- Households settling as one, fuel split per car, and transfers marked as paid back.

**Sharing and the trip itself**
- **Merge on import** (spec stage 4): opening a newer link of the same trip updates it field by field and shows what changed, instead of making an "(imported)" copy. This is the single biggest gap for every group persona.
- Shorter links. A live trip's link runs to 13,000–17,000 characters because the whole chat thread goes in. The share page already warns that long links can be refused, but every round trip makes a new one.
- Conditions for live choices, and a per-person go/no-go on a day ("Léa rests").

## What worked well

- Limits stay flags, never exclusion. Dropping a flagged stage clears its flag at once. The Schengen check even catches Cyprus (EU but not Schengen).
- One sentence fills most of Setup, and the app says which parts are guesses.
- Cost splits and settle-up are correct in every persona that tested them (family, Situ, friends).
- The share link carries everything, and people can view it without the password.
- The live plan: computed totals in the trip currency, missing rates named, booked items kept through rewrites, and to-dos ordered by date.

## Suggested order

1. **A fix PR now** for bugs 1–8. Each has a scenario that already shows it, so each fix starts with a failing test. Bug 4 is a safety question: which reading is right, "a no-go above the level" or "at the level", is your call.
2. **Stage 4**, as the spec planned, plus additions from this review:
   - Already in the spec: merge-on-import, consistency checks, side-by-side comparison, per-traveller admin.
   - Added:
     - per-person votes, and flags that name the person;
     - stale warnings;
     - booked items flowing into Money, and expenses in other currencies;
     - the describe-box fixes (bug 9) and preset fitting (bug 10);
     - more checks on live options;
     - shorter links.
3. **A new "idea and dates" stage**: flexible dates, comparing weeks, and options that carry dates. The spec doesn't cover it, so it needs a short design conversation first.
4. **Stage 5** (map, priority list, calendar file) gains the dated book-by deadlines and the "booked so far" list.
5. **Later:** households and paid-back transfers in Money, and the smaller items above.
