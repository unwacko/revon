# Revon

### Follow every problem from a pothole to national taxation, and see who is accountable for whom.

**Revon is a social platform where people come together to raise the problems that matter to them, and ministers and officials can see those problems from their areas and react to them.** Officials get a clear picture of what matters most, and everyone can see who is responsible for a broken road, where the repair money went, and whether the fix actually lasted.
Built on a Mumbai monsoon-roads dataset (24 wards, 6,501 complaints, 2,499 work orders).

### Live demo: **[revon.journeytix.com](https://revon.journeytix.com)**

Pick any demo account on the login screen. Citizen accounts open the feed; official accounts open their dashboards.

![License: MIT](https://img.shields.io/badge/license-MIT-green)
&nbsp;![Node 22+](https://img.shields.io/badge/node-%E2%89%A522-blue)
&nbsp;![No build step](https://img.shields.io/badge/client-no%20build%20step-lightgrey)

---

## Table of contents

1. [The problem](#1-the-problem)
2. [Our solution](#2-our-solution)
3. [Why a social network, not a complaint form](#3-why-a-social-network-not-a-complaint-form)
4. [How it works for people](#4-how-it-works-for-people)
5. [Features](#5-features)
6. [Trust and safety](#6-trust-and-safety)
7. [Why Revon is different](#7-why-revon-is-different)
8. [Try it in 60 seconds](#8-try-it-in-60-seconds)
9. [How it works (architecture)](#9-how-it-works)
10. [Data and honesty notes](#10-data-and-honesty-notes)
11. [Roadmap](#11-roadmap)
12. [The accountability hierarchy we model](#12-the-accountability-hierarchy-we-model)
13. [License](#13-license)

---

## 1. The problem

**Nobody knows who is responsible.** Citizens cannot tell which official owns which job, or whom to report to. So people tag the wrong official for the wrong job, and the problem goes nowhere.

**Our complaints live on foreign platforms.** Civic complaints are raised on platforms run by foreign companies, whose interests and misinformation can shape what people see. Revon is built in India, so its content is created and monitored locally.

Take Mumbai's roads. Every monsoon, the city spends crores repairing the same stretches. Citizens complain, a patch is laid, the rain returns, and the pothole reopens. Nobody can easily answer three basic questions:

| Question citizens can't answer today | Why it's hard |
|---|---|
| **Who is actually responsible for this road?** | Responsibility is split across a ward engineer, a zone, the municipal corporation, the state PWD and others. Citizens don't know whom to tag, so complaints go nowhere. |
| **Where did the money go?** | Repair budgets and work orders sit in records that are not joined to the complaints that triggered them. |
| **Did the fix last?** | No public link between a complaint, the contractor who "fixed" it, the cost against the rate card, and whether it re-opened. Repeat failures and possible overbilling stay invisible. |

The result is a loop with no memory: the same stretch is repaired again next year, often by the same contractor, and the next rupee is spent by habit rather than by risk.

## 2. Our solution

**One Indian network where every problem has an owner.** Revon is built on three things:

| | What it is |
|---|---|
| **Area** | Ward, city, state, country. Every area has its own public page. |
| **Position** | A tag held by one citizen at a time, with a public history. Each area defines its own positions. |
| **Person** | The verified citizen who holds the position and answers for it. |

For every ward, road and contractor, Revon answers three questions:

1. **Where did the money go?** A money trail by ward, zone and city: budget vs spend, by contractor, issue, method and month, plus audit flags.
2. **Did the fix last?** Every complaint links to the work order that fixed it: cost vs the rate card, time target, and whether it re-opened within 30 days. Contractor scorecards compare each job with peers doing the same work in the same ward.
3. **Where should the next rupee go?** A risk-ranked planner combining open complaints, repeat failures, flood hotspots, traffic, accidents and nearby hospitals or schools. It recommends the longest-lasting repair method and fits the list to the remaining budget. Roads still under their Defect Liability Period (DLP) go back to the original contractor, not the public purse.

## 3. Why a social network, not a complaint form

On a normal complaint system, one person files a complaint and one authority is meant to answer, so it is easy to skip. On Revon, anyone can post, others see it and upvote it, and many voices together make a problem hard to ignore.

- **Enjoyable.** People come back to it, unlike a form you fill once and forget.
- **Relatable.** Neighbours see your problem and say "same here", so nobody feels alone.
- **Pressure.** Upvotes show officials what matters most, so a supported problem is hard to ignore.

**A form hides problems. A network shows them.**

## 4. How it works for people

### The citizen journey
1. **Sign in.** One verified account per real person. The prototype uses a simulated DigiLocker screen; real DigiLocker sign-in is on the roadmap.
2. **Follow.** Onboarding shows the positions in your area, main ones first, with follow buttons.
3. **Report.** Post a problem with a photo and location. Revon suggests who is responsible, and you can adjust the suggestion before posting.
4. **Watch it move.** The responsible position sees it on its dashboard. Progress updates (purple) from officials appear on your original problem, and you are notified.

### The official journey
1. **See what matters.** A position holder opens their dashboard, which shows the problems routed to them, with upvotes and status.
2. **Act.** Update a problem's status, assign it, and post progress updates linked to the problems they cover.
3. **Create a project.** Add a budget, link it to the problems it will fix, and open it for bids.
4. **Choose in public.** Contractors bid; the official awards one and publishes the reason ("why this contractor") on the public project page.
5. **Celebrate together.** Two or three authorities that worked on one problem can publish a single joint "solved" story.

## 5. Features

### For citizens
- **Problem posts (yellow)** with photo and location; the app suggests who is responsible and the citizen can choose or adjust.
- **Smart responsibility routing**: `/api/suggest` and `/api/route-suggest` map a location and issue to the right ward engineer, zone officer and body.
- **Progress updates (purple)** from the responsible authority appear on the original problem, with a full repair record.
- **Normal posts (white)** for community discussion, plus **stories** and **joint solved stories** where several authorities announce a fix together.
- **Follow** officials, wards and contractors; upvote and comment; notifications for progress on your problems.
- **Anonymous by default**: others see only your ward and posts.
- **Reddit-style threads**: open any post to read and reply to the full conversation.
- **Live updates** across devices via Server-Sent Events.
- **English-first, with a language picker** (22 scheduled languages; Marathi and Hindi first). Dataset text in Hindi, Marathi and Hinglish is auto-translated by rules.

### Transparency (open to everyone)
- **Money trail** per ward, zone and city: spend by contractor, issue, repair method and month.
- **Audit flags** that point to records worth checking:
  - **Paid during DLP**: the road was still under its Defect Liability Period.
  - **Possible double billing**: same road and same work within 10 days with no linked complaint.
  - **Over rate card**: billed more than 1.5x the rate card (normal variation is 20-30%).
  - **Late**, with heavy-rain context.
  - **Fix did not last**: re-opened within 30 days.
- **Fair contractor scorecards**: each job is compared with peers doing the same work in the same ward, so contractors aren't punished for hard wards.
- **Interactive ward map** with the dataset's ward polygons (Leaflet); click a ward to zoom in.
- **Next-rupee planner**: risk-ranked, budget-aware repair list.
- **Road and work-order pages** showing the full history of any segment.
- **Structure page** explaining how India's governance levels connect.

### For officials
- **Role-based dashboard** per position: incoming problems, status, assignments, workload.
- **Update status and assign** problems to the right person; every assignment is shown publicly with its source (rules, poster or an official).
- **Projects and bids**: create a project, collect contractor bids, award one, and publish the reason on the public project page.
- **Joint solved stories** with up to two other authorities.
- **Contractor management** per position and a public record of work.
- **Admin view** for assigning positions, adding contractors and reviewing users.

### For contractors
- Public **scorecard** of their own monsoon work, with fair peer comparison, and a way to bid on and respond to projects.

## 6. Trust and safety

| Protection | Status |
|---|---|
| **Verified accounts**: one account per real person, so there are no bots | Simulated DigiLocker sign-in in the prototype; real DigiLocker is on the roadmap |
| **Anonymous to the public**: citizens are shown by ward and posts only | Built |
| **Role rules**: citizens post problems and normal posts; officials and contractors post only progress updates linked to problems or projects; contractors only for projects assigned to them | Built, enforced by the server |
| **Only the responsible can respond**: an official answers on a problem only where their position is responsible | Built |
| **Upvotes only**: there is no downvote, so nobody can pile on | Built |
| **Posting and upvoting limited to your own area**, so outsiders cannot mob a topic | Designed, not built yet |
| **Bots** that verify post tags and block promotional, vulgar or policy-breaking content | Planned (shown as "Soon") |

## 7. Why Revon is different

Complaint apps and grievance portals exist. Revon is built around what they typically don't do.

| | Typical complaint / grievance portal | Social media tagging | **Revon** |
|---|---|---|---|
| Routes to the *right* official | Generic department queue | Citizen must know whom to tag | Suggests responsible officials by location and issue; officials can reassign publicly |
| Shows the money | Usually no | No | Money trail by ward, contractor, issue and month |
| Links complaint, work order and cost | Rarely public | No | Every complaint joined to its work order and rate card |
| Checks if the fix lasted | Complaint closed = done | No | 30-day re-open detection, repeat-failure tracking |
| Flags suspicious billing | No | No | Audit flags (DLP, double billing, over rate card), with a "check, not proof" framing |
| Fair to contractors | n/a | Pile-ons | Peer-normalised scorecards |
| Decides where to spend next | No | No | Risk-ranked planner with budget fit and DLP recovery |
| Citizen identity | Often personal details required | Public | Anonymous by default, ward-level only |
| Engagement | Form-filling | High, but unstructured | Familiar social UI with structured accountability behind it |

**In one line:** others collect complaints; Revon closes the loop between the complaint, the rupee and the result.

## 8. Try it in 60 seconds

**Live demo:** [revon.journeytix.com](https://revon.journeytix.com). Pick any demo account on the login screen.

**Run locally** (Node 22+):

```bash
npm install
npm run dev        # http://localhost:3000
npm run reset      # rebuild the database from /dataset
```

Open `http://<your-computer-ip>:3000` on a phone on the same Wi-Fi. Demo accounts are on the login screen; official accounts open in their official view, and you can switch views from the bottom-left of the sidebar or from Profile.

**Suggested judge walkthrough**

1. Log in as a demo citizen and open the feed. Tap a yellow problem post to open its thread and see its linked repair record.
2. Open **Responsibles** and a ward, then the **Money trail** tab: budget vs spend, by contractor.
3. Open **Audit flags** and **Contractor scorecards** (`#/scorecards`).
4. Open the **Planner** for a ward and see the risk-ranked next repairs.
5. Switch to an official account and open **Dashboard**; update a problem's status and watch it appear live on the citizen side.
6. As an official, open a problem post and try **Publish joint solved story**.
7. Visit `#/roadmap` for what is coming next.

## 9. How it works

```
 /dataset (CSV/GeoJSON)  ->  server/seed.js  ->  data/db.json
                                                    |
 Express API  <-------------- server/analytics.js --+   audit flags, money trail,
 (server/index.js)                                       fair scorecards, planner
        |  REST + Server-Sent Events (live sync)
        v
 Preact + htm client (public/js, no build step) + Leaflet ward map
```

- **Backend:** Node + Express 5, JSON-file persistence, live sync over SSE.
- **Analytics (`server/analytics.js`):** audit flags, money trail, fair scorecards, next-rupee planner.
- **Geo (`server/geo.js`):** point-in-polygon ward location.
- **Translation (`server/translate.js`):** rule-based translation of Hindi, Marathi and Hinglish text.
- **Frontend:** Preact + htm with no build step; light theme, sans-serif only. Zero build tooling means a judge can read and run it quickly.

## 10. Data and honesty notes

`/dataset` holds the synthetic **"Follow the Rupee: Mumbai Monsoon Roads"** dataset (CC BY 4.0, [source](https://github.com/SumeetGDoshi/Claude-Impact-Labs-data-2)): 24 BMC wards with polygons, 6,501 complaints, 2,499 work orders, 291 road segments, a rate card, 8 contractors, plus rainfall, tides, flood hotspots, traffic, accidents and facilities.

- It is **not BMC data**. Office holders, parties and contractor staff in the app are fictional.
- **Audit flags are prompts to check records, not proof of wrongdoing.**
- Complaints become problem posts, with the category corrected from the linked work order (the citizen's own tag stays visible). Work orders become progress updates from the ward engineer. Social posts become normal posts.
- Sign-in uses a simulated DigiLocker screen. Do not enter real Aadhaar numbers.
- Some notifications are demo content generated from seed data, and are labelled as such.
- This is a prototype. Posts created on the live demo may reset when the server restarts.
- The language picker is UI only for now; "Soon" buttons mark features that are planned but not built.

## 11. Roadmap

Planned features are shown in the app as a non-functional **"Soon"** button and listed at `#/roadmap`.

**Designed, not built yet**
- [ ] **Grouped problems**: merge about ten similar reports into one problem, with the report count as a severity signal for officials
- [ ] **Own-area posting and upvoting**: citizens can read everywhere but post and upvote only in their own area
- [ ] **AI responsibility routing**, replacing today's rule-based suggestion, with the reasoning shown to the poster

**AI with Claude**
- [ ] Plain-language summaries and a multilingual **"What happened to my complaint?"** assistant ("Ask Claude about this ward")
- [ ] **AI accountability detection from photos**: point a camera at a problem and find who is responsible
- [ ] **Tag-verification bot** and **content-policy bot** before posts publish
- [ ] **Official-post check**: AI verifies that officials post only official project updates (today the server limits them to progress updates linked to problems or projects)

**Trust and identity**
- [ ] Real **DigiLocker** sign-in with a verifiable privacy and no-leak guarantee
- [ ] Optional "hide my name" for public-role holders

**Reach**
- [ ] Push and SMS notifications
- [ ] Full multi-language UI (Marathi and Hindi first, then all 22 scheduled languages)
- [ ] Official GIS boundaries, the full India region map, and live municipal data feeds
- [ ] Expansion beyond roads (drains, water, garbage, lighting) and beyond Mumbai, including the rural Panchayati Raj track

**Platform**
- [ ] Postgres for permanent storage
- [ ] Contractor-facing tools: respond to flags, upload completion proof
- [ ] Open API and data exports for journalists, RTI activists and researchers

## 12. The accountability hierarchy we model

India (PM) -> Maharashtra (CM, PWD, MMRDA) -> Konkan Division -> Greater Mumbai / BMC (Mayor, Commissioner, Chief Engineers; Collectors of Mumbai City and Mumbai Suburban) -> 7 zones (Deputy Municipal Commissioners) -> 24 wards (Assistant Commissioner, Executive Engineer Roads, Assistant Engineer Storm Water Drains, Corporator). The rural Panchayati Raj track is explained at `#/structure`.

## 13. License

[MIT](LICENSE) © 2026 unwacko. Dataset: CC BY 4.0 (see section 10).
