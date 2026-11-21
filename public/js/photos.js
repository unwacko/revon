// Illustrative road photos from Wikimedia Commons (files + licences in /img/stories/credits.json and /img/photos/credits.json).
// The dataset has no real complaint photos, so posts without an uploaded photo show one of these,
// matched to the post's category and always labelled "Illustrative photo" with its credit.
const P = (file, artist, license) => ({ src: file.startsWith('/') ? file : '/img/stories/' + file, artist, license });

const DAMAGE = [
  P("/img/photos/potholes-1-november-2026.jpg", "Sbb1413", "CC BY-SA 3.0"),
  P("/img/photos/roads-deformed-t-munnekollala-bengaluru.jpg", "Gangaasoonu", "CC BY-SA 4.0"),
  P("/img/photos/big-fatal-hole-in-a-delhi-road.jpg", "Rrthakur22", "CC BY-SA 4.0"),
  P('broken-roads-in-india.jpg', 'Rrthakur22', 'CC BY-SA 4.0'),
  P('driving-through-potholes.jpg', 'KEmel49', 'CC BY-SA 4.0'),
  P('potholes-on-road.jpg', 'KEmel49', 'CC BY-SA 4.0'),
  P('potholed-road-outside-kolkata.jpg', 'Slyronit', 'CC BY-SA 4.0'),
  P('roads-in-bihar.jpg', 'Savant dev', 'CC BY-SA 4.0'),
];
const WATER = [
  P("/img/photos/kerala-police-4x4-driving-through-a-monsoon.jpg", "Liji Jinaraj from Kochi, India", "CC BY-SA 2.0"),
  P("/img/photos/monsoon-floods-in-ambala-2010.jpg", "Harsh Mangal from Sydney, Australia", "CC BY-SA 2.0"),
  P("/img/photos/old-manhole-cover-in-india.jpg", "Sindugab", "CC0"),
  P("/img/photos/kanaldeckel-in-chandigarh.jpg", "Recher009", "CC BY-SA 4.0"),
  P("/img/photos/anushaktinagar-monsoon-awesome.jpg", "S.J.Saravanan", "CC BY-SA 3.0"),
  P("/img/photos/whiteguard-volunteers-help-kerala-flood-2018.jpg", "Msp7com", "CC BY-SA 4.0"),
  P('india-chennai-monsoon-06.jpg', 'McKay Savage', 'CC BY 2.0'),
  P('driving-through-potholes.jpg', 'KEmel49', 'CC BY-SA 4.0'),
];
const WORKS = [
  P("/img/photos/cement-road-construction-jcb-nagpur-02.jpg", "Ganesh Dhamodkar", "CC BY-SA 4.0"),
  P("/img/photos/cement-road-construction-men-at-work.jpg", "Ganesh Dhamodkar", "CC BY-SA 4.0"),
  P("/img/photos/cement-road-construction-nagpur-01.jpg", "Ganesh Dhamodkar", "CC BY-SA 4.0"),
  P("/img/photos/flyover-construction-in-progress-on-sinhgad-road.jpg", "DesiBoy101", "CC BY 4.0"),
  P("/img/photos/road-construction-in-tea-plantation-jeg9543.jpg", "PJeganathan", "CC BY-SA 4.0"),
  P("/img/photos/road-construction-in-tea-plantation-jeg9547.jpg", "PJeganathan", "CC BY-SA 4.0"),
  P("/img/photos/road-construction-under-process.jpg", "Armpam", "CC BY-SA 4.0"),
  P("/img/photos/road-construction-vehicle-bangalore-2025.jpg", "Gpkp", "CC BY-SA 4.0"),
  P("/img/photos/road-construction-work.jpg", "Siyaulhaque", "CC BY-SA 4.0"),
  P("/img/photos/road-construction-work-2.jpg", "Siyaulhaque", "CC BY-SA 4.0"),
  P("/img/photos/namma-metro-construction-in-brigade-road-mg-road-junction.jpg", "Varun Shiv Kapur from New Delhi, India", "CC BY 2.0"),
  P('potholeraja.jpg', 'Bprathap79', 'CC BY-SA 4.0'),
  P('filling-a-pothole-52892187926.jpg', 'Oregon Department of Transportation', 'CC BY 2.0'),
  P('road-resurfacing-vehicles.jpg', 'Tim Sheerman-Chase', 'CC BY 4.0'),
  P('road-resurfacing-02.jpg', 'Bidgee', 'CC BY-SA 3.0'),
  P('coastal-road-construction-work-mumbai.jpg', 'Wander-earth', 'CC BY-SA 4.0'),
  P('coastal-road-under-construction-mumbai.jpg', 'Qiw007', 'CC BY-SA 4.0'),
  P('road-bridge-under-construction-in-bkc.jpg', 'DesiBoy101', 'CC BY 4.0'),
];
const WATER_CATS = new Set(['Waterlogging', 'Choked drain / nullah overflow', 'Open or broken manhole']);
const DAMAGE_CATS = new Set(['Pothole', 'Road cave-in', 'Broken paver blocks', 'Road related']);

const hash = (s) => [...String(s || '')].reduce((a, c) => (a * 33 + c.charCodeAt(0)) >>> 0, 5381);
const pick = (list, key) => list[hash(key) % list.length];
// No repeats on screen: each post gets the next unused photo of its kind, in the order posts appear,
// and keeps it for the session. A photo is reused only after every photo of that kind has been shown.
const given = new Map(), next = { damage: 0, water: 0, works: 0 };
const POOLS = { damage: DAMAGE, water: WATER, works: WORKS };
function deal(kind, id) {
  if (!given.has(id)) { const pool = POOLS[kind], n = next[kind]++; given.set(id, n < pool.length ? pool[(hash(kind) + n) % pool.length] : null); }
  return given.get(id); // null once every photo of this kind is on screen: never show the same photo twice
}

// Photo for a post, or null if no illustrative photo fits (normal/admin posts, garbage, traffic...).
export function postPhoto(p) {
  if (!p) return null;
  if (p.tag === 'progress') return deal('works', p.id);
  if (p.tag === 'problem') {
    if (WATER_CATS.has(p.category)) return deal('water', p.id);
    if (DAMAGE_CATS.has(p.category) || !p.category) return deal('damage', p.id);
  }
  return null;
}
// Photo for a story: roadwork for officials and contractors, finished work for joint solved stories.
export const storyPhoto = (id, joint) => (joint ? pick(WORKS.slice(0, 3), id) : pick(WORKS, id));
export const credit = (ph) => `Illustrative photo · ${ph.artist}, ${ph.license}, Wikimedia Commons`;
