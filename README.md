# Revon

### Live demo: **[revon.journeytix.com](https://revon.journeytix.com)**

Pick any demo account on the login screen. Citizen accounts open the feed; official accounts open their dashboard.

---

**Know who is responsible. Hold them accountable.**

Revon is a civic network for Mumbai's roads. Citizens report a problem, Revon shows which official owns it, and every owner gets a public track record: what was spent, who did the work, and whether the fix lasted.

## What you can do

| | |
|---|---|
| **Report a problem** | Headline, details, photo and location. Revon suggests the responsible position and explains why; you can change it before posting. |
| **Follow the thread** | Every post opens a discussion thread with nested replies. Officials answer as their position. |
| **See who is responsible** | Area pages show the positions at each level, the chain above, the areas below and the budget. |
| **Track the money** | Money trail by ward, zone and city, audit flags, contractor scorecards and a planner for where the next rupee should go. |
| **Official dashboard** | Ranked problems, unviewed and unanswered counts, progress updates, projects and contractor bids. |
| **Joint solved story** | Two or three authorities publish one story when they solve a problem together. |

Post types are colour-tagged: yellow problem, white normal post, purple official progress, blue position change, green election.

## Run locally

```bash
npm install
npm run dev     # http://localhost:3000
npm run reset   # rebuild the database from /dataset
```

## Stack

- **Server:** Node + Express (`server/`), JSON-file database (`data/db.json`), live updates over Server-Sent Events.
- **Client:** Preact + htm with no build step (`public/`), Leaflet maps.
- **Design:** light theme, one sans-serif font (IBM Plex Sans), flat surfaces, shared spacing and type scales (`public/styles.css`).
- **Hosting:** Oracle Cloud VM behind Caddy and Cloudflare.

## Data

The app uses the synthetic **"Follow the Rupee: Mumbai Monsoon Roads"** dataset ([source](https://github.com/SumeetGDoshi/Claude-Impact-Labs-data-2), CC BY 4.0): 24 BMC wards, 6,501 complaints, 2,499 work orders, 291 road segments, 8 contractors, plus rainfall, flood, traffic and accident data.

- It is **not BMC data**. All complaints, work orders, budgets and contractors are synthetic.
- **All office holders, parties and contractor staff are fictional.**
- Ward boundaries on the map are approximate, not official.
- Notifications, comments and joint stories in the demo are generated from the seed data.
- Responsible-position suggestions are rules-based in this demo, not an AI model.

## Coming soon

Shown in the app as "Soon" buttons and listed at `#/roadmap`: AI routing and summaries, tag-verification and moderation bots, real DigiLocker sign-in, push and SMS alerts, official GIS boundaries.
