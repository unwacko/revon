# Neta Connect (prototype)

A platform connecting citizens with politicians and officials (and, to a lesser degree, contractors) across India's governance hierarchy. Citizens report problems, the platform shows who is responsible, and officials respond publicly.

## Run

```bash
npm install
npm run dev        # http://localhost:3000  (auto-restarts on server changes)
npm run reset      # wipe data/ and re-seed sample data
```

Open on your phone (same Wi-Fi): `http://<your-computer-ip>:3000`.

## Stack
- **Server**: Node + Express (`server/index.js`), JSON-file persistence in `data/db.json`, image uploads in `data/uploads/`.
- **Live sync**: Server-Sent Events (`/api/events`). Every write is broadcast and open clients re-fetch, so every device stays in sync.
- **Client**: Preact + htm with no build step (`public/js`), a hash router, Leaflet maps (OpenStreetMap tiles).
- Moving to the cloud later means swapping the JSON store for Postgres and deploying the same server. We'll cover that after testing.

## Roles & what's built
| Role | Can do |
|---|---|
| Citizen (DigiLocker-verified, anonymous) | Ranked feed, post 🟡 Problem / ⚪ normal posts, camera + geolocation reporting, upvote, comment, follow positions/citizens/areas, notifications |
| Position holder | Official dashboard: ranked problems, unviewed/unresponded counts, bulk 🟣 progress updates (auto-notify problem posters), status changes, re-assign responsibility, create projects, award bids, assign/register contractors, switch to citizen view |
| Contractor (company / group of citizens) | Dashboard, bid on open projects, post updates only on assigned projects |
| Admin | Assign people to positions (auto-publishes a 🔵 position-change post), 🟢 election posts, register contractors, problem-routing log (auto vs. person-assigned) |
| Area head (fixed position) | Add positions to their area |

## Region hierarchy (fact-checked)
Nation (PM) → State (CM) → Revenue Division (Divisional Commissioner) → District (Collector, SP; MP attached) → then two parallel tracks:
- **Urban (74th Amendment)**: Municipal Corporation (Mayor, Commissioner, City Engineer, Traffic DCP) → Ward (Corporators, Ward Officer, Junior Engineer; MLA attached)
- **Rural (73rd Amendment)**: Zilla Parishad (President, CEO) → Panchayat Samiti/Block (Sabhapati, BDO) → Gram Panchayat (Sarpanch, Gram Sevak)

Lok Sabha and Vidhan Sabha constituencies overlap these areas, so MPs and MLAs are attached to the area that best contains them. Tehsil/Taluka is a revenue unit and is described in-app (`#/structure`) but not modelled as a tree level.

## Future (buttons shown, not functional; also listed at `#/roadmap` for the PPT/video)
AI tag-verification bot · content-policy bot · AI accountability detection from photo and text · real DigiLocker OAuth and privacy guarantee · automated official-post rules · push/SMS · real GIS ward boundaries.

## Sample data
`server/seed.js` contains Pune-based **fictional** people, parties and businesses, plus placeholder road problems. Replace it with the road-problems dataset (then run `npm run reset`).
