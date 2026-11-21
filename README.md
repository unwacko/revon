# Revon (prototype)

**Every monsoon, Mumbai spends crores repairing the same roads.** Revon connects citizens with everyone accountable for a road, from the ward engineer up to the Prime Minister. For every ward, road and contractor it answers three questions:

1. **Where did the money go?** Money trail by ward, zone and city: budget vs spend, by contractor, issue, method and month, plus audit flags.
2. **Did the fix last?** Every complaint links to the work order that fixed it: cost vs the rate card, time target, and whether it re-opened within 30 days. Contractor scorecards compare each job with peers doing the same work in the same ward.
3. **Where should the next rupee go?** A risk-ranked planner covering open complaints, repeat failures, flood hotspots, traffic, accidents and nearby hospitals or schools. It recommends the longest-lasting repair method and fits the list to the remaining budget. Roads still under DLP go back to the original contractor.

## Deploy

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/unwacko/revvon)

Uses `render.yaml` (free plan). The database is rebuilt from `/dataset` on each start, so posts made in the app reset when the free instance restarts or redeploys. Moving data to Postgres is the next step for a permanent deployment.

## Run

```bash
npm install
npm run dev        # http://localhost:3000
npm run reset      # rebuild the database from /dataset
```

To use it on your phone (same Wi-Fi), open `http://<your-computer-ip>:3000`. Demo accounts are on the login screen. Official accounts open in their official view; switch views from the bottom-left of the sidebar or from Profile.

## Data

`/dataset` holds the synthetic **“Follow the Rupee: Mumbai Monsoon Roads”** dataset (CC BY 4.0, [source](https://github.com/SumeetGDoshi/Claude-Impact-Labs-data-2)). It contains 24 BMC wards with polygons, 6,501 complaints, 2,499 work orders, 291 road segments, a rate card, 8 contractors, plus rainfall, tides, flood hotspots, traffic, accidents and facilities. It is **not BMC data**. Office holders, parties and contractor staff in the app are fictional.

How the data maps into the app:
- Complaints → Yellow problem posts. The category is corrected from the linked work order; the citizen's own tag is still shown.
- Work orders → Purple progress updates from the ward engineer, with a repair record on each problem.
- Social posts → White normal posts.
- Everything is shown in English: the dataset's Hindi, Marathi and Hinglish texts are translated by rules in `server/translate.js` (all 2,291 covered). Only the English text is stored and shown, with a small "Translated from …" note.
- A language picker (22 scheduled languages, Marathi and Hindi first) is UI only for now.

Audit flags:
- **Paid during DLP**: road still under its Defect Liability Period.
- **Possible double billing**: same road and same work within 10 days, with no complaint linked.
- **Over rate card**: billed more than 1.5× the rate card (normal variation is 20–30%).
- **Late**, with heavy-rain context.
- **Fix did not last**: re-opened within 30 days.

Flags are prompts to check the records, not proof of wrongdoing.

## Stack
- Node + Express (`server/`), JSON-file persistence (`data/db.json`), live sync over Server-Sent Events.
- `server/analytics.js`: audit flags, money trail, fair scorecards, next-rupee planner.
- Preact + htm client with no build step (`public/js`), Leaflet with the dataset's ward polygons. Click a ward to zoom into it.
- Layout follows Instagram: icon rail, two-pane settings, stories. Font is Reddit Sans; light theme only (no dark mode).

## Hierarchy
India (PM) → Maharashtra (CM, PWD, MMRDA) → Konkan Division → Greater Mumbai / BMC (Mayor, Commissioner, Chief Engineers; Collectors of Mumbai City and Mumbai Suburban) → 7 zones (Deputy Municipal Commissioners) → 24 wards (Assistant Commissioner, Executive Engineer Roads, Assistant Engineer Storm Water Drains, Corporator). The rural Panchayati Raj track is explained at `#/structure`.

## Future (shown as “Soon” buttons, listed at `#/roadmap` for the PPT and video)
Claude-written summaries and a multilingual “What happened to my complaint?” assistant · tag-verification and content-policy bots · AI accountability detection from photos · real DigiLocker sign-in and privacy guarantee · push/SMS · official GIS boundaries.
