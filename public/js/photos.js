// Illustrative road photos from Wikimedia Commons (files + licences in /img/stories/credits.json).
// The dataset has no real complaint photos, so posts without an uploaded photo show one of these,
// matched to the post's category and always labelled "Illustrative photo" with its credit.
const P = (file, artist, license) => ({ src: '/img/stories/' + file, artist, license });

const DAMAGE = [
  P('broken-roads-in-india.jpg', 'Rrthakur22', 'CC BY-SA 4.0'),
  P('driving-through-potholes.jpg', 'KEmel49', 'CC BY-SA 4.0'),
  P('potholes-on-road.jpg', 'KEmel49', 'CC BY-SA 4.0'),
  P('potholed-road-outside-kolkata.jpg', 'Slyronit', 'CC BY-SA 4.0'),
  P('roads-in-bihar.jpg', 'Savant dev', 'CC BY-SA 4.0'),
];
const WATER = [
  P('india-chennai-monsoon-06.jpg', 'McKay Savage', 'CC BY 2.0'),
  P('driving-through-potholes.jpg', 'KEmel49', 'CC BY-SA 4.0'),
];
const WORKS = [
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

// Photo for a post, or null if no illustrative photo fits (normal/admin posts, garbage, traffic...).
export function postPhoto(p) {
  if (!p) return null;
  if (p.tag === 'progress') return pick(WORKS, p.id);
  if (p.tag === 'problem') {
    if (WATER_CATS.has(p.category)) return pick(WATER, p.id);
    if (DAMAGE_CATS.has(p.category) || !p.category) return pick(DAMAGE, p.id);
  }
  return null;
}
// Photo for a story: roadwork for officials and contractors, finished work for joint solved stories.
export const storyPhoto = (id, joint) => (joint ? pick(WORKS.slice(0, 3), id) : pick(WORKS, id));
export const credit = (ph) => `Illustrative photo · ${ph.artist}, ${ph.license}, Wikimedia Commons`;
