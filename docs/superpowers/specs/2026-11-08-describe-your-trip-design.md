# Describe your trip: a small chat that fills the form, and ideas in step 1

## Why
Family members starting a trip think in sentences ("five of us, two weeks in July, Mom can't do heat or altitude, we love old towns and food, about €15k"), not in form fields. Gabriel asked for a little chatbot where people type their thoughts when they create a trip, it prefills most characteristics, and they then review the form. Step 1 (Setup) should also help brainstorm destinations from those wishes and limits.

## Decisions
- **No server, no AI account (builder's call, stated to Gabriel).** The app is a static page on GitHub Pages shared with family; an API key cannot go there and cross-site fetch is blocked on the artifact host. The "chat" is a rule-based reader of plain English in `src/describe.js`. It is honest about what it understood and asks for what is missing.
- **Where it lives.** Home gets a "Describe your trip" box above the three kinds; sending it creates the trip (kind read from the text, explore by default) and opens Setup. Setup (step 1) opens with the chat thread and a box to add more, then "Ideas that fit so far", then the existing form.
- **Every value it sets is said back** in the reply, so nothing is filled silently. Guessed values (placeholder dates from a month, a vague "not too hot" → 28 °C) are labelled as guesses in the reply.
- **Limits are flags, never exclusion**: the reader sets traveller limits; scoring and flags work as before.
- **Nothing is lost**: each message is appended to the trip's notes.

## What it reads
Kind (ski touring / hut-to-hut / explore), number of travellers, dates (exact range, or month + length as a flagged guess), length, budget (currency, total or per person), origin city, travel mode (trains only / drive), lodging style, interests (explore type weights 0–3 with "love"/"a bit of"/"no" intensity), altitude and heat ceilings, crowds, max share of hiking days, daily ascent and hours, hiking and ski grades, huts only.

## Ideas in step 1
The top three destinations of the trip's kind by the existing `score()`, skipping visited ones, each with score, cost per person, the score's reason and how many limits it breaks, plus a link to Destinations. It updates as the form or the chat changes.

## Data
Trip gains `brief: [{ who: "you" | "app", text }]`. `newTrip` adds it; `migrate` fills it for old trips; documented in `docs/DATA-MODEL.md`.

## Non-goals
No free-form AI, no names extracted from text, no change of kind after creation (the reply says so and suggests a new trip).
