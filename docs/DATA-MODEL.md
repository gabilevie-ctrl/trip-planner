# Data model

## Destination (`data/destinations/<id>.json`)

Shipped shape (v1). Fields marked **→** were planned and are now in place; `climate` and `access[]` are per destination, `season.fitByMonth` and `events` replaced the July-only fields. Hiking and ski-touring destinations use `kind: "hike" | "skitour"` and `stage` blocks with `hut`, `ascentM`, `descentM`, `hours`, `difficulty`; they also carry `bulletins[]` (avalanche, weather, conditions, huts links).

```jsonc
{
  "id": "caucasus",
  "name": "Georgia + Armenia",
  "region": "The Caucasus",
  "zone": "asia",                  // europe | asia | americas | africa | oceania
  "tagline": "…",
  "noFlights": false,              // reachable by train from the default origin
  "tags": ["mountains","history","food","roadtrip"],   // → phase 1

  "access": {                      // → becomes an array, one entry per origin region
    "fromOrigin": "BRU",
    "baseCostPerPerson": 550,
    "route": "…",
    "mode": "flight"               // flight | train | ferry | drive
  },

  "rates": { "city": 80, "hike": 90, "transit": 80 },   // € per person per day, B&B/Airbnb basis
  "lodgingAssumption": "2 rooms for 5, local B&B or Airbnb, one meal out a day",  // → phase 1

  "blocks": [
    {
      "id": "svaneti",
      "type": "city" | "hike",     // → add "beach", "wildlife", "rest"
      "name": "Svaneti: Mestia to Ushguli",
      "place": "…",
      "defaultDays": 4, "minDays": 2, "maxDays": 5,
      "maxAltitudeM": 2700,
      "dayHighC": 22,              // → climate: { "7": {"high":22,"low":9,"rainDays":8}, … }
      "crowd": "low" | "med" | "high",   // → crowdByMonth
      "transitHours": 5,           // typical time to reach from the previous hub
      "history": "Medieval defensive towers (UNESCO)",
      "guidebookPick": true,
      "see": ["…"],
      "note": "…",
      "ratePerDay": null,          // overrides rates[type]
      "extraTransportCost": 0,     // internal flight, boat charter…
      "bookAhead": { "what": "Inca Trail permits", "leadMonths": 5 }   // → phase 3
    }
  ],

  "presets": [ { "name": "Balanced", "picks": { "tbilisi": 2, "svaneti": 4 } } ],

  "season": {
    "fitByWindow": { "jul-15_jul-29": 70 },   // → fitByMonth: [60,55,65,75,85,80,70,70,85,90,70,55]
    "events": [                               // → phase 1
      { "name": "Mariamoba", "from": "08-15", "to": "08-16", "effect": "crowds", "note": "…" }
    ]
  },

  "guides": [ { "name": "Lonely Planet Georgia", "url": "…" } ],
  "sources": [ { "name": "…", "url": "https://…" } ],   // required; may be empty only for the 38 v1 destinations
  "lastReviewed": "2026-11-08"     // YYYY-MM-DD; validate fails when older than 18 months
}
```

## Checks (`npm run validate`)

`scripts/lib/check-destination.cjs` checks each file: the fields above are present, block types, day ranges, crowd levels and preset picks are valid, `season.fitByMonth` has 12 numbers 0–100, `lastReviewed` is a real date that is neither in the future nor older than 18 months, every `sources` entry has a `name` and an `https://` `url`, and the `data/index.json` entry has the same `kind`, `name` and `zone`. An empty `sources` list is reported as a count; `npm run validate:strict` fails on it. Pass file paths to check only those files (`npm run validate:strict -- data/destinations/<id>.json`); new destinations must pass that strict check.

The 38 v1 destinations carry `"lastReviewed": "2026-11-08"` and `"sources": []`: that date marks the v1 enrichment pass, not a sourced review. They all reach the 18-month limit on 2028-05-09. Start a new destination from `docs/destination-template.jsonc`.

## Trip (stored in the browser, shareable by link)

```jsonc
{
  "id": "t_…", "name": "Parents' 30th",
  "origin": { "city": "Brussels", "region": "europe-west" },
  "travellers": [
    { "name": "Mom", "limits": { "maxAltitudeM": 4200, "maxDayHighC": 33, "minDayHighC": 15, "crowds": "avoid", "noFlights": false } },
    // minDayHighC: warmth floor; the highest floor across travellers applies. countryZone: "any" | "europe" | "eu" | "schengen";
    // every traveller's country limit applies (lists in src/criteria.js COUNTRY_GROUPS). Both are flags, never exclusions.
    { "name": "Antoine", "limits": { "countryZone": "schengen" } },
    { "name": "Antoine", "limits": { "maxHikeShare": 60 } }   // percent of planned days, 0–100
  ],
  "dates": { "start": "2027-07-12", "end": "2027-07-26" },      // or { "window": {...}, "lengthDays": 15 }
  "budget": { "total": 15000, "currency": "EUR", "perPerson": 3000 },   // perPerson only when the chat was given a per-person amount; the total follows the traveller count
  "lodging": "bnb" | "hotel",
  "type": { "city": 2, "mountains": 2, "beach": 1, "wildlife": 0, "history": 2 },   // weights
  "visited": ["slovenia","scotland","tatras"],
  "weights": { "cost": 2, "alt": 1, "heat": 1, "crowd": 1, "hrs": 1, "hist": 1, "season": 1 },
  "destinations": {               // per destination: chosen preset or custom picks, rest days
    "caucasus": { "preset": "Balanced", "picks": { "tbilisi": 2 }, "rest": 2 }
  },
  "ideas": [ { "name": "Timor-Leste", "zone": "asia", "pp": null, "note": "…" } ],
  "chosen": null,                 // destination id once decided → unlocks Book step
  "brief": [                      // the "Describe the trip" chat (src/describe.js); [] when unused, filled by migrate()
    { "who": "you", "text": "Five of us from Brussels, two weeks in July…" },
    { "who": "app", "text": "Filled in: 5 travellers · …" }
  ]
}
```
Each message sent in the chat is also appended to `notes`, so nothing typed is lost if a field is later changed.

A trip made with "Ask a chatbot to fill it in" (`src/chatbot.js`) starts with the same `brief`: the person's description, then the app's summary of what the chatbot's JSON reply filled, what was not used and why, and the chatbot's own guesses. The reply's fields (`kind`, `name`, `origin`, `travelMode`, `lodging`, `dates`, `budget`, `type`, `travellers[].limits`, `notes`, `assumptions`) are checked against `src/criteria.js` and the trip passes `state.migrate` before it is stored.

## Scoring (phase 1)

`score(destination, trip)` returns 0–100 and a list of reasons. Criteria, each normalised to 0–100:
cost (vs budget per head; capped low when over), altitude (vs the strictest traveller ceiling), heat, crowds, transit hours, history, season fit (from `fitByMonth` for the trip's months, adjusted by `events` inside the dates), type match (destination `tags` vs trip `type` weights). Hard limits produce flags, not silent exclusion.
