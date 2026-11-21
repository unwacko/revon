// Builds the database from the "Follow the Rupee: Mumbai Monsoon Roads" dataset
// (synthetic, CC BY 4.0, github.com/SumeetGDoshi/Claude-Impact-Labs-data-2).
// Office holders, parties and contractor staff are FICTIONAL. Complaints, work
// orders, roads, wards and risk data come from /dataset.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv, km, inPolygon, ist } from './geo.js';
import fs from 'node:fs';
import { translate, setLocalityAliases, guessLang } from './translate.js';

// Nothing in Devanagari script is written into the database: the CSVs are read and translated here.
const DEVANAGARI = /[\u0900-\u097F]/;
const english = (s, fallback) => (s && !DEVANAGARI.test(s) ? s : fallback);

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dataset');
const csv = (f) => readCsv(path.join(DIR, f));

export const LEVELS = {
  nation: { depth: 0, label: 'Nation' },
  state: { depth: 1, label: 'State / UT' },
  division: { depth: 2, label: 'Revenue Division' },
  district: { depth: 3, label: 'District' },
  municipal_corporation: { depth: 4, label: 'Municipal Corporation' },
  zilla_parishad: { depth: 4, label: 'Zilla Parishad (District Panchayat)' },
  zone: { depth: 5, label: 'Municipal Zone' },
  block: { depth: 5, label: 'Panchayat Samiti / Block' },
  ward: { depth: 6, label: 'Ward' },
  gram_panchayat: { depth: 6, label: 'Gram Panchayat (Village)' },
};

export const ROAD_CATS = ['Pothole', 'Road cave-in', 'Broken paver blocks', 'Road related'];
export const DRAIN_CATS = ['Waterlogging', 'Choked drain / nullah overflow', 'Open or broken manhole'];
export const CATEGORIES = [...ROAD_CATS, ...DRAIN_CATS, 'Streetlights', 'Garbage', 'Traffic', 'Other'];

export const wardRegionId = (code) => 'w_' + code.replace('/', '-');

const FIRST = ['Aarti', 'Rajesh', 'Sunita', 'Vikram', 'Meenal', 'Sachin', 'Farah', 'Nitin', 'Kavita', 'Anil', 'Shraddha', 'Manoj', 'Pallavi', 'Imran', 'Deepa', 'Rohit', 'Swati', 'Ganesh', 'Neelam', 'Prakash', 'Rekha', 'Tushar', 'Ayesha', 'Hemant', 'Varsha', 'Sameer', 'Jyoti', 'Kiran', 'Mohan', 'Anjali', 'Yogesh', 'Leena', 'Suresh', 'Madhuri', 'Rahul', 'Bhavna'];
const LAST = ['Naik', 'Sawant', 'Kulkarni', 'Shaikh', 'Pednekar', 'Iyer', 'Gaikwad', 'Mhatre', 'Fernandes', 'Desai', 'Patil', 'Khan', 'Rane', 'Joshi', 'Menon', 'Parab', 'Bhosale', 'Chavan', 'Pillai', 'Shetty', 'Mehta', 'Kamat', 'Thakur', 'Ansari', 'Jadhav', 'Salvi', 'Nair', 'Dalvi', 'Bhatia', 'Gupte'];
const PARTIES = ['Bharat Pragati Party', 'Lok Vikas Aghadi', 'Jan Shakti Dal', 'Mumbai Nagrik Manch', 'Independent'];
const choosesName = (id) => [...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % 100 < 50;
let nameI = 0;
const nextName = (suffix = '') => { const i = nameI++; return `${FIRST[(i * 7) % FIRST.length]} ${LAST[(i * 11 + 3) % LAST.length]}${suffix}`; };

const titleCat = { 'Open or broken manhole': 'Open manhole', 'Choked drain / nullah overflow': 'Choked drain', 'Road related': 'Road damage', Other: 'Civic issue' };

export function buildSeed() {
  const wardsCsv = csv('wards.csv');
  const geo = JSON.parse(fs.readFileSync(path.join(DIR, 'wards.geojson'), 'utf8'));
  const geomByCode = Object.fromEntries(geo.features.map((f) => [f.properties.ward_code, f.geometry]));
  const localities = csv('localities.csv');
  const roadsCsv = csv('roads.csv');
  const traffic = Object.fromEntries(csv('traffic.csv').map((t) => [t.road_id, t]));
  const contractorsCsv = csv('contractors.csv');
  const wos = csv('work_orders.csv');
  const complaints = csv('complaints.csv');
  const social = csv('social_posts.csv');

  // ---------------- Regions ----------------
  const regions = [];
  const region = (id, name, type, parentId, center, radiusKm, population, extra = {}) => regions.push({ id, name, type, parentId, center, radiusKm, population, budget: {}, ...extra });
  region('r_in', 'India', 'nation', null, [22.5, 79.0], 1500, 1428000000);
  region('r_mh', 'Maharashtra', 'state', 'r_in', [19.4, 75.7], 330, 126000000);
  region('r_konkan', 'Konkan Division', 'division', 'r_mh', [18.9, 73.2], 120, 29000000);
  region('r_bmc', 'Greater Mumbai (BMC)', 'municipal_corporation', 'r_konkan', [19.07, 72.88], 22, 12400000, { note: 'BMC covers two revenue districts — Mumbai City and Mumbai Suburban. Their Collectors are listed here.' });
  const zones = [...new Set(wardsCsv.map((w) => w.zone))].sort();
  for (const z of zones) {
    const ws = wardsCsv.filter((w) => w.zone === z);
    const c = [ws.reduce((a, w) => a + +w.centroid_lat, 0) / ws.length, ws.reduce((a, w) => a + +w.centroid_lon, 0) / ws.length];
    region('r_' + z.toLowerCase().replace(' ', ''), z + ' (BMC)', 'zone', 'r_bmc', c, 6, ws.reduce((a, w) => a + +w.population_est, 0), { wardCodes: ws.map((w) => w.ward_code) });
  }
  for (const w of wardsCsv) {
    region(wardRegionId(w.ward_code), `${w.ward_code} Ward — ${w.ward_name}`, 'ward', 'r_' + w.zone.toLowerCase().replace(' ', ''), [+w.centroid_lat, +w.centroid_lon], Math.sqrt(+w.approx_area_km2 / Math.PI), +w.population_est, {
      wardCode: w.ward_code, shortName: `${w.ward_code} Ward`, geometry: geomByCode[w.ward_code], lowLying: +w.low_lying_index, crews: +w.engineering_crews,
      office: w.assistant_commissioner_office.replace(' (synthetic)', ''), localities: w.localities.split(';').map((s) => s.trim()),
      budget: { 'Monsoon road repairs 2025': +w.monsoon_repair_budget_inr_2025 / 1e7 },
    });
  }
  const R = Object.fromEntries(regions.map((r) => [r.id, r]));
  R.r_in.budget = { 'Roads (national highways)': 278000, Health: 90000, Education: 125000 };
  R.r_mh.budget = { 'Roads (PWD)': 19900, Health: 18000, Education: 80000 };
  R.r_bmc.budget = { 'Monsoon road repairs 2025': wardsCsv.reduce((a, w) => a + +w.monsoon_repair_budget_inr_2025, 0) / 1e7 };

  // ---------------- Users & positions ----------------
  const now = Date.parse('2025-10-10T10:00:00+05:30');
  const users = [];
  const user = (id, o) => { const u = { id, role: 'citizen', verified: true, onboarded: true, following: { positions: [], users: [], regions: [] }, createdAt: now - 400 * 864e5, ...o }; users.push(u); return u; };
  user('u_admin', { role: 'admin', realName: 'Platform Admin', regionId: wardRegionId('A') });

  const positions = [];
  const pos = (id, regionId, title, kind, categories, responsibilities, budget = 0, extra = {}) => {
    const holder = extra.vacant ? null : user('u_' + id.slice(2), { realName: nextName(extra.suffix || ''), party: kind === 'elected' ? PARTIES[positions.length % PARTIES.length] : null, regionId: extra.homeRegion || regionId });
    positions.push({ id, regionId, title, kind, holderUserId: holder?.id || null, categories, responsibilities, budget, contractorIds: [], isHead: !!extra.isHead, rank: extra.rank ?? 5, createdAt: now - 500 * 864e5 });
  };
  const ALL = CATEGORIES;
  const anyWard = wardRegionId('A');
  pos('p_pm', 'r_in', 'Prime Minister', 'elected', ALL, ['Heads the Union Government', 'Union budget & national policy'], 0, { isHead: true, rank: 0, homeRegion: anyWard });
  pos('p_morth', 'r_in', 'Union Minister, Road Transport & Highways', 'elected', [...ROAD_CATS, 'Traffic'], ['National Highways (via NHAI)', 'Road safety policy'], 278000, { rank: 1, homeRegion: anyWard });
  pos('p_cm', 'r_mh', 'Chief Minister', 'elected', ALL, ['Heads the State Government', 'State budget & policy'], 0, { isHead: true, rank: 0, homeRegion: anyWard });
  pos('p_pwdmin', 'r_mh', 'Minister, Public Works Department (PWD)', 'elected', ROAD_CATS, ['State highways', 'Roads handed to PWD inside cities'], 19900, { rank: 1, homeRegion: anyWard });
  pos('p_mmrda', 'r_mh', 'Metropolitan Commissioner, MMRDA', 'appointed', ROAD_CATS, ['Flyovers, metro corridors and roads under MMRDA', 'Complaints on MMRDA roads are forwarded here'], 0, { rank: 2, suffix: ' (IAS)', homeRegion: anyWard });
  pos('p_divcom', 'r_konkan', 'Divisional Commissioner, Konkan', 'appointed', ['Other'], ['Supervises Collectors of the division', 'Revenue administration & disaster coordination'], 0, { isHead: true, rank: 0, suffix: ' (IAS)', homeRegion: anyWard });
  pos('p_mayor', 'r_bmc', 'Mayor of Mumbai', 'elected', ALL, ['Presides over the BMC General Body', 'City development agenda'], 0, { isHead: true, rank: 0, homeRegion: wardRegionId('G/N') });
  pos('p_bmc_comm', 'r_bmc', 'Municipal Commissioner, BMC', 'appointed', ALL, ['Executive head of BMC', 'Approves budgets, tenders and contractor empanelment'], R.r_bmc.budget['Monsoon road repairs 2025'], { rank: 1, suffix: ' (IAS)', homeRegion: anyWard });
  pos('p_ce_roads', 'r_bmc', 'Chief Engineer, Roads & Traffic', 'department', ROAD_CATS, ['City road network & monsoon pothole programme', 'Rate card, quality audits, Defect Liability Period enforcement'], 0, { rank: 2, homeRegion: wardRegionId('F/N') });
  pos('p_ce_swd', 'r_bmc', 'Chief Engineer, Storm Water Drains', 'department', DRAIN_CATS, ['Drains, nullahs and pumping stations', 'Flood hotspot mitigation'], 0, { rank: 3, homeRegion: wardRegionId('G/S') });
  pos('p_traffic', 'r_bmc', 'Joint Commissioner of Police (Traffic)', 'appointed', ['Traffic'], ['Traffic management & diversions', 'NOCs for night road work'], 0, { rank: 4, suffix: ' (IPS)', homeRegion: anyWard });
  pos('p_coll_city', 'r_bmc', 'Collector, Mumbai City District', 'appointed', ['Other'], ['Revenue administration (A–G wards)', 'Disaster management, elections'], 0, { rank: 5, suffix: ' (IAS)', homeRegion: anyWard });
  pos('p_coll_sub', 'r_bmc', 'Collector, Mumbai Suburban District', 'appointed', ['Other'], ['Revenue administration (H–T wards)', 'Disaster management, elections'], 0, { rank: 6, suffix: ' (IAS)', homeRegion: wardRegionId('H/E') });
  for (const z of zones) {
    const rid = 'r_' + z.toLowerCase().replace(' ', '');
    pos('p_dmc_' + rid.slice(2), rid, `Deputy Municipal Commissioner, ${z}`, 'appointed', ALL, ['Supervises Assistant Commissioners of the zone', 'Reviews ward spending & escalations'], 0, { isHead: true, rank: 0, homeRegion: wardRegionId(R[rid].wardCodes[0]) });
  }
  for (const w of wardsCsv) {
    const rid = wardRegionId(w.ward_code), k = w.ward_code.replace('/', '').toLowerCase();
    const b = +w.monsoon_repair_budget_inr_2025 / 1e7;
    pos('p_amc_' + k, rid, `Assistant Municipal Commissioner (${w.ward_code} Ward)`, 'appointed', ALL, [`Heads ${R[rid].office}`, 'Oversees the ward repair budget (spent via the engineers below)', 'Complaint redressal, crews, first escalation point'], 0, { isHead: true, rank: 0 });
    pos('p_eer_' + k, rid, `Executive Engineer, Roads (${w.ward_code} Ward)`, 'department', ROAD_CATS, ['Potholes, cave-ins, paver blocks', 'Issues & certifies work orders', 'Supervises contractors on site'], b * 0.7, { rank: 1 });
    pos('p_swd_' + k, rid, `Assistant Engineer, Storm Water Drains (${w.ward_code} Ward)`, 'department', DRAIN_CATS, ['Waterlogging, drains & nullahs', 'Manhole safety', 'Pumps during heavy rain'], b * 0.3, { rank: 2 });
    pos('p_corp_' + k, rid, `Corporator (Nagarsevak), ${w.ward_code} Ward`, 'elected', ALL, ['Represents residents in the BMC General Body', 'Raises ward issues, approves ward works', 'Sample representative — each ward has several corporators'], 0, { rank: 3 });
  }
  const P = Object.fromEntries(positions.map((p) => [p.id, p]));
  const wardKey = (code) => code.replace('/', '').toLowerCase();

  // ---------------- Contractors ----------------
  const contractors = contractorsCsv.map((c) => {
    const id = 'c_' + c.contractor_id.toLowerCase();
    const member = user('u_' + id, { realName: nextName(), regionId: wardRegionId(c.active_wards.split(';')[0].trim()) });
    const wards = c.active_wards.split(';').map((s) => s.trim());
    for (const code of wards) { P['p_eer_' + wardKey(code)].contractorIds.push(id); P['p_swd_' + wardKey(code)].contractorIds.push(id); }
    return {
      id, code: c.contractor_id, name: c.contractor_name.replace(' (synthetic)', ''), type: 'company', memberUserIds: [member.id], regionIds: wards.map(wardRegionId),
      specialties: ['Pothole', 'Waterlogging'], gstin: '', empanelledSince: +c.empanelled_since,
      assignedBy: wards.map((code) => ({ positionId: 'p_eer_' + wardKey(code), regionId: wardRegionId(code), at: Date.parse(`${c.empanelled_since}-04-01`) })), createdAt: Date.parse(`${c.empanelled_since}-04-01`),
    };
  });
  const conByCode = Object.fromEntries(contractors.map((c) => [c.code, c]));

  // ---------------- Roads ----------------
  const roads = roadsCsv.map((r) => {
    const t = traffic[r.road_id] || {};
    return {
      id: r.road_id, name: r.road_name, segment: +r.segment_no, regionId: wardRegionId(r.ward_code), wardCode: r.ward_code, type: r.road_type, surface: r.surface, lanes: +r.lanes, lengthM: +r.length_m,
      path: [[+r.start_lat, +r.start_lon], [+r.end_lat, +r.end_lon]], mid: [(+r.start_lat + +r.end_lat) / 2, (+r.start_lon + +r.end_lon) / 2],
      lastResurfaced: r.last_resurfaced, underDlp: r.under_dlp === 'Y', busRoute: r.bus_route === 'Y',
      traffic: { peak: +t.peak_hour_vehicles || 0, speed: +t.avg_peak_speed_kmph || 0, congestion: +t.congestion_index_0_10 || 0, buses: +t.bus_routes_count || 0, twoWheelerPct: +t.two_wheeler_share_pct || 0 },
    };
  });
  const roadById = Object.fromEntries(roads.map((r) => [r.id, r]));
  const roadsByWard = {};
  for (const r of roads) (roadsByWard[r.wardCode] ||= []).push(r);

  const aliasMap = {};
  for (const l of localities) for (const a of l.aliases.split(/[;|,]/).map((x) => x.trim()).filter(Boolean)) aliasMap[a] = l.locality;
  setLocalityAliases(aliasMap);
  const englishPlace = (t) => { if (!t) return t; if (aliasMap[t]) return aliasMap[t]; return /[\u0900-\u097F]/.test(t) ? (Object.entries(aliasMap).find(([k]) => t.includes(k))?.[1] || '') : t; };

  // ---------------- Geocoding helpers ----------------
  const locIndex = [];
  for (const l of localities) for (const n of [l.locality, ...l.aliases.split(/[;|,]/)].map((s) => s.trim().toLowerCase()).filter(Boolean)) locIndex.push([n, l]);
  locIndex.sort((a, b) => b[0].length - a[0].length);
  const findLocality = (text) => { const t = (text || '').toLowerCase(); const hit = locIndex.find(([n]) => n.length > 2 && t.includes(n)); return hit?.[1] || null; };
  const wardOfPoint = (lat, lng) => wardsCsv.find((w) => inPolygon([lat, lng], geomByCode[w.ward_code]))?.ward_code || null;
  const nearestRoad = (code, lat, lng, maxKm = 1.5) => {
    let best = null;
    for (const r of roadsByWard[code] || []) { const d = km([lat, lng], r.mid); if (d < maxKm && (!best || d < best.d)) best = { r, d }; }
    return best?.r || null;
  };
  const roadByText = (code, text) => { const t = (text || '').toLowerCase(); return (roadsByWard[code] || []).find((r) => t.includes(r.name.toLowerCase())) || null; };

  // ---------------- Work orders ----------------
  const workOrders = wos.map((w) => ({
    id: w.work_order_id, complaintIds: w.linked_complaint_ids ? w.linked_complaint_ids.split('|') : [], wardCode: w.ward_code, regionId: wardRegionId(w.ward_code), roadId: w.road_id,
    workType: w.work_type, method: w.repair_method, contractorId: conByCode[w.contractor_id]?.id, assignedAt: ist(w.assigned_at), startedAt: ist(w.work_started_at), completedAt: ist(w.completed_at),
    areaSqm: +w.area_sqm, cost: +w.cost_inr, slaHours: +w.sla_hours, slaMet: w.sla_met === 'Y', reopened: w.reopened_within_30d === 'Y', remark: w.engineer_remark,
  }));
  const woByComplaint = {};
  for (const w of workOrders) for (const c of w.complaintIds) (woByComplaint[c] ||= []).push(w);

  // ---------------- Posts from complaints ----------------
  const posts = [];
  const statusMap = { Resolved: 'resolved', Open: 'open', 'In Progress': 'in_progress', 'Closed - Duplicate': 'duplicate', 'Forwarded to MMRDA/PWD': 'forwarded', 'Forwarded to SWM dept': 'forwarded', 'Rejected - Not BMC road': 'rejected', 'Rejected - Not road issue': 'rejected' };
  const suggest = (rid, cat) => {
    const w = R[rid];
    if (w?.type !== 'ward') return [{ positionId: ROAD_CATS.includes(cat) ? 'p_ce_roads' : DRAIN_CATS.includes(cat) ? 'p_ce_swd' : 'p_bmc_comm', assignedBy: 'rules' }];
    const k = wardKey(w.wardCode);
    const spec = ROAD_CATS.includes(cat) ? 'p_eer_' + k : DRAIN_CATS.includes(cat) ? 'p_swd_' + k : null;
    return ['p_amc_' + k, spec].filter(Boolean).map((positionId) => ({ positionId, assignedBy: 'rules' }));
  };
  for (const c of complaints) {
    const linked = woByComplaint[c.complaint_id] || [];
    const lat = c.lat ? +c.lat : null, lng = c.lon ? +c.lon : null;
    let code = c.ward_code || null;
    if (!code && lat) code = wardOfPoint(lat, lng);
    const loc = findLocality(c.locality_text) || findLocality(c.description);
    if (!code && loc) code = loc.ward_code;
    let road = linked[0] ? roadById[linked[0].roadId] : null;
    if (!road && code) road = (lat && nearestRoad(code, lat, lng)) || roadByText(code, c.description) || (loc && nearestRoad(code, +loc.lat, +loc.lon, 2));
    const category = linked[0]?.workType || c.category_reported;
    const locName = englishPlace(c.locality_text) || loc?.locality || '';
    const where = road ? `${road.name}${locName ? ', ' + locName : ''}` : locName || 'Mumbai';
    const translated = translate(c.description);
    const regionId = code ? wardRegionId(code) : 'r_bmc';
    const uid = 'u_' + c.complainant_id;
    users.push({ id: uid, role: 'citizen', verified: true, onboarded: true, anonHandle: 'Citizen ' + c.complainant_id.slice(-5), ...(choosesName(uid) ? { realName: nextName(), showName: true } : {}), regionId, following: { positions: [], users: [], regions: [] }, createdAt: ist(c.received_at) - 30 * 864e5 });
    posts.push({
      id: c.complaint_id, authorId: uid, actingAs: { type: 'citizen' }, tag: 'problem',
      title: `${titleCat[category] || category} — ${where}`, body: english(translated || c.description, `${titleCat[category] || category} reported at ${where}.`), originalLanguage: translated ? ({ 'hi-en': 'Hinglish', hi: 'Hindi', mr: 'Marathi' }[c.language] || 'Hindi') : null, photoNote: c.photo_description || null, images: [],
      category, categoryReported: c.category_reported, regionId, roadId: road?.id || null, location: lat ? { lat, lng } : null,
      source: { type: 'complaint', channel: c.channel, language: c.language }, upvoteBase: +c.upvotes || 0, upvotes: [],
      status: statusMap[c.status] || 'open', statusDetail: c.status, resolvedAt: ist(c.resolved_at),
      mentions: [], linkedProblemIds: [], workOrderIds: linked.map((w) => w.id), projectId: null,
      viewedByPositions: [], respondedByPositions: linked.length ? suggest(regionId, category).map((r) => r.positionId) : [],
      responsible: suggest(regionId, category), moderation: { botVerified: null }, createdAt: ist(c.received_at),
    });
  }
  const postById = Object.fromEntries(posts.map((p) => [p.id, p]));

  // ---------------- Normal (white) posts: just two citizen posts from the social data ----------------
  for (const s of social.filter((x) => ['SOC00565', 'SOC00223'].includes(x.post_id))) {
    const loc = findLocality(s.text);
    const uid = 'u_s_' + s.author_handle.replace(/[^a-z0-9]/gi, '');
    users.push({ id: uid, role: 'citizen', verified: true, onboarded: true, anonHandle: 'Citizen ' + uid.slice(-5).toUpperCase(), regionId: loc ? wardRegionId(loc.ward_code) : 'r_bmc', following: { positions: [], users: [], regions: [] }, createdAt: ist(s.posted_at) - 30 * 864e5 });
    const text = translate(s.text) || s.text;
    const firstLine = text.split(/[.!?\n]/)[0].trim();
    posts.push({
      id: s.post_id, authorId: uid, actingAs: { type: 'citizen' }, tag: 'normal', title: firstLine.length > 90 ? firstLine.slice(0, 87) + '…' : firstLine, body: text,
      source: { type: 'social', channel: s.source }, images: [], mentions: [], linkedProblemIds: [], workOrderIds: [], regionId: loc ? wardRegionId(loc.ward_code) : 'r_bmc', roadId: null,
      upvoteBase: Math.round((+s.likes_or_forwards || 0) / 10), upvotes: [], status: null, viewedByPositions: [], respondedByPositions: [], responsible: [], category: null, location: null, projectId: null,
      moderation: { botVerified: null }, createdAt: ist(s.posted_at),
    });
  }

  // ---------------- Admin posts ----------------
  const admin = (id, tag, title, body, regionId, createdAt, mentions = []) => posts.push({ id, authorId: 'u_admin', actingAs: { type: 'admin' }, tag, title, body, images: [], mentions, linkedProblemIds: [], workOrderIds: [], regionId, roadId: null, upvoteBase: 40, upvotes: [], status: null, viewedByPositions: [], respondedByPositions: [], responsible: [], category: null, location: null, projectId: null, moderation: { botVerified: null }, createdAt });
  admin('ADM-1', 'position_change', 'New Executive Engineer (Roads) for K/W Ward', `${users.find((u) => u.id === P.p_eer_kw.holderUserId).realName} has taken charge as Executive Engineer, Roads for K/W Ward (Andheri West, Juhu, Versova). Pothole and cave-in complaints in K/W now route to this office.`, wardRegionId('K/W'), Date.parse('2025-06-02T10:00:00+05:30'), [{ type: 'position', id: 'p_eer_kw' }]);
  admin('ADM-2', 'election', 'BMC elections: who is responsible for your road?', 'Corporators raise and approve ward works. The Assistant Municipal Commissioner runs the ward office and its budget. The Executive Engineer (Roads) issues and certifies repair work orders. Contractors must repair roads still under their Defect Liability Period at no cost to BMC. Check your ward page to see each office and how the monsoon money was spent.', 'r_bmc', Date.parse('2025-09-20T10:00:00+05:30'));

  admin('ADM-3', 'position_change', 'New Assistant Municipal Commissioner for F/S Ward', `${users.find((u) => u.id === P.p_amc_fs.holderUserId).realName} has taken charge of the F/S Ward office (Parel, Lalbaug, Hindmata). Waterlogging complaints at Hindmata and King Edward Memorial Hospital approach roads are the first priority.`, wardRegionId('F/S'), Date.parse('2025-07-01T10:00:00+05:30'), [{ type: 'position', id: 'p_amc_fs' }]);
  admin('ADM-4', 'election', 'Ward elections: what your corporator will be responsible for', 'Each administrative ward elects several corporators. After the election they sit on the ward committee, which approves road and drain works, reviews monsoon repair spending and can question contractors whose fixes fail. Check your ward page to see last season\'s money trail before you vote.', 'r_bmc', Date.parse('2025-10-02T10:00:00+05:30'));

  // ---------------- Demo citizen + follows ----------------
  const demo = posts.find((p) => p.tag === 'problem' && p.regionId === wardRegionId('K/W') && p.status === 'resolved' && p.workOrderIds.length && workOrders.find((w) => w.id === p.workOrderIds[0])?.reopened);
  const demoUser = users.find((u) => u.id === demo.authorId);
  demoUser.id = 'u_demo'; demo.authorId = 'u_demo'; demoUser.realName = 'Demo Citizen';
  demoUser.following.positions = ['p_amc_kw', 'p_swd_kw', 'p_corp_kw', 'p_mayor'];

  // ---------------- Progress (purple) posts: just two, from real work orders ----------------
  const drainWo = workOrders.find((w) => w.wardCode === 'F/S' && w.workType === 'Waterlogging' && w.complaintIds.length >= 2 && !w.reopened);
  for (const w of [workOrders.find((x) => x.id === demo.workOrderIds[0]), drainWo].filter(Boolean)) {
    const k = wardKey(w.wardCode);
    const posId = ROAD_CATS.includes(w.workType) ? 'p_eer_' + k : 'p_swd_' + k;
    const road = roadById[w.roadId];
    const con = contractors.find((c) => c.id === w.contractorId);
    const days = Math.max(0, (w.completedAt - w.assignedAt) / 864e5);
    posts.push({
      id: w.id, authorId: P[posId].holderUserId, actingAs: { type: 'position', id: posId }, tag: 'progress',
      title: `Repaired: ${titleCat[w.workType] || w.workType} on ${road?.name || 'ward road'}`,
      body: `${w.method}${/patch|asphalt|Paver/.test(w.method) ? ` over ${w.areaSqm} sq m` : ''} by ${con?.name}. Completed ${days.toFixed(1)} days after assignment${w.slaMet ? ', within the time target' : `, past the ${w.slaHours}-hour target`}.${w.remark ? ` Engineer's note: “${w.remark}”.` : ''}`,
      images: [], mentions: con ? [{ type: 'contractor', id: con.id }] : [], linkedProblemIds: w.complaintIds.filter((id) => postById[id]), workOrderIds: [w.id], regionId: w.regionId, roadId: w.roadId,
      upvoteBase: 0, upvotes: [], status: null, viewedByPositions: [], respondedByPositions: [], responsible: [], category: null, location: null, projectId: null,
      moderation: { botVerified: null }, createdAt: w.completedAt,
    });
  }


  // ---------------- Projects (planned works, open for bids) ----------------
  const topRoad = (code) => {
    const counts = {};
    for (const p of posts) if (p.tag === 'problem' && p.roadId && roadById[p.roadId].wardCode === code && ['open', 'in_progress'].includes(p.status)) counts[p.roadId] = (counts[p.roadId] || 0) + 1;
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
  };
  const projects = [];
  const kwRoad = roadById[topRoad('K/W')], fsRoad = roadById[topRoad('F/S')];
  const kwCons = contractors.filter((c) => c.regionIds.includes(wardRegionId('K/W')));
  const kwBidders = [...kwCons, ...contractors.filter((c) => !kwCons.includes(c))].slice(0, 4);
  for (const c of kwBidders) if (!c.regionIds.includes(wardRegionId('K/W'))) c.regionIds.push(wardRegionId('K/W'));
  const openOn = (rid) => posts.filter((p) => p.tag === 'problem' && p.roadId === rid && ['open', 'in_progress'].includes(p.status)).map((p) => p.id).slice(0, 12);
  if (kwRoad) projects.push({ id: 'pj_1', title: `Post-monsoon mastic resurfacing — ${kwRoad.name} (segment ${kwRoad.segment})`, description: `Full-width mastic asphalt resurfacing of ${kwRoad.lengthM} m to stop repeat pothole patching on this stretch.`, category: 'Pothole', regionId: kwRoad.regionId, roadId: kwRoad.id, positionId: 'p_eer_kw', approvedByPositionId: 'p_amc_kw', approvedByUserId: P.p_amc_kw.holderUserId, contractorId: null, budget: 0.42, spent: 0, status: 'bidding', linkedProblemIds: openOn(kwRoad.id), bids: kwBidders.map((c, i) => ({ contractorId: c.id, amount: [0.39, 0.36, 0.44, 0.41][i], timelineDays: [21, 30, 18, 25][i], note: ['Night work only, no daytime lane closures', 'Includes 3-year defect liability', 'Fastest timeline, two crews', 'Mastic asphalt with full milling'][i], at: now - (4 - i) * 864e5 })), startDate: null, endDate: null, createdAt: now - 5 * 864e5 });
  if (fsRoad) projects.push({ id: 'pj_2', title: `Hindmata area drain widening near ${fsRoad.name}`, description: 'Widen the storm-water drain and add a holding pump to cut waterlogging time at a chronic flood hotspot.', category: 'Waterlogging', regionId: fsRoad.regionId, roadId: fsRoad.id, positionId: 'p_swd_fs', approvedByPositionId: 'p_ce_swd', approvedByUserId: P.p_ce_swd.holderUserId, contractorId: contractors[3].id, budget: 1.8, spent: 0.55, status: 'in_progress', linkedProblemIds: openOn(fsRoad.id), bids: [{ contractorId: contractors[3].id, amount: 1.8, timelineDays: 120, note: 'Includes holding pump and desilting', at: now - 40 * 864e5 }, { contractorId: contractors[6].id, amount: 1.62, timelineDays: 150, note: 'Pump supplied separately', at: now - 41 * 864e5 }, { contractorId: contractors[7].id, amount: 1.95, timelineDays: 110, note: 'Fastest timeline', at: now - 42 * 864e5 }], awardReason: 'Not the lowest bid. The lowest bid needs 150 days, which runs past the June monsoon onset, and leaves the pump out of scope. Western Coast Asphalt Co finishes in 120 days, includes the holding pump and desilting, and stays within the allocated budget.', awardedAt: now - 21 * 864e5, startDate: now - 20 * 864e5, endDate: null, createdAt: now - 45 * 864e5 });

  // pj_3: an awarded K/W drain project. Three bids, the winner and the public reason for the choice.
  const kwDrainRoad = (() => {
    const counts = {};
    for (const p of posts) if (p.tag === 'problem' && p.regionId === wardRegionId('K/W') && p.roadId && DRAIN_CATS.includes(p.category) && ['open', 'in_progress'].includes(p.status)) counts[p.roadId] = (counts[p.roadId] || 0) + 1;
    return roadById[Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0]];
  })();
  if (kwDrainRoad) {
    const linked = posts.filter((p) => p.tag === 'problem' && p.roadId === kwDrainRoad.id && DRAIN_CATS.includes(p.category) && ['open', 'in_progress'].includes(p.status)).map((p) => p.id);
    for (const id of linked) postById[id].status = 'in_progress';
    projects.push({
      id: 'pj_3', title: `Drain desilting and manhole covers — ${kwDrainRoad.name} (segment ${kwDrainRoad.segment})`, description: `Desilt the roadside storm-water drain along ${kwDrainRoad.lengthM} m and replace broken manhole covers, so this stretch stops flooding after every heavy spell.`,
      category: 'Waterlogging', regionId: kwDrainRoad.regionId, roadId: kwDrainRoad.id, positionId: 'p_swd_kw', approvedByPositionId: 'p_amc_kw', approvedByUserId: P.p_amc_kw.holderUserId,
      contractorId: 'c_ct05', budget: 0.28, spent: 0.06, status: 'in_progress', linkedProblemIds: linked,
      bids: [
        { contractorId: 'c_ct06', amount: 0.26, timelineDays: 35, note: 'Silt disposal billed separately', at: now - 7 * 864e5 },
        { contractorId: 'c_ct05', amount: 0.28, timelineDays: 24, note: 'Includes silt disposal and a 3-year defect liability', at: now - 6.5 * 864e5 },
        { contractorId: 'c_ct08', amount: 0.31, timelineDays: 20, note: 'Two crews, night work', at: now - 6 * 864e5 },
      ],
      awardNote: 'Deccan Paving Solutions was chosen over the lowest bid because its price includes silt disposal and a 3-year defect liability; with disposal added, the lowest bid costs more. It is also already empanelled in K/W Ward.',
      startDate: now - 3 * 864e5, endDate: null, createdAt: now - 8 * 864e5,
    });
  }

  // Stories: short-lived updates from positions/contractors (shown to followers)
  const t0 = Date.now();
  const stories = [
    ['p_eer_kw', 'Night patching on S.V. Road tonight 11 pm–5 am. Expect one lane closed near the station.', 1],
    ['p_eer_kw', 'Mastic asphalt trial on 3 stretches — we will report in 30 days whether it held.', 3],
    ['p_amc_kw', 'Ward office open Saturday 10–1 for road complaints in person.', 5],
    ['p_swd_kw', 'Pumps on standby at Andheri subway — orange alert tomorrow.', 2],
    ['p_corp_kw', 'Raised the repeat-pothole roads in today\'s ward committee meeting.', 7],
    ['p_mayor', 'All wards to publish monsoon repair spend by road. Starting next week.', 9],
  ].map(([pid, text, h], i) => ({ id: 'st_' + (i + 1), actor: { type: 'position', id: pid }, authorId: P[pid].holderUserId, text, createdAt: t0 - h * 3600e3, seenBy: [] }));
  stories.push({ id: 'st_7', actor: { type: 'contractor', id: 'c_ct01' }, authorId: 'u_c_ct01', text: 'Crew deployed for cold-mix patching in K/E today. Photos tomorrow.', createdAt: t0 - 4 * 3600e3, seenBy: [] });
  demoUser.following.positions.push('p_eer_kw');
  demoUser.contractorsFollowed = ['c_ct01'];

  // ---------------- Joint "solved" stories ----------------
  // Two or three authorities who worked on one problem publish a single story saying it is solved.
  const kwResolved = (cat) => posts.filter((p) => p.tag === 'problem' && p.regionId === wardRegionId('K/W') && p.status === 'resolved' && p.category === cat && p.authorId !== 'u_demo').sort((a, b) => b.upvoteBase - a.upvoteBase)[0];
  const caveIn = kwResolved('Road cave-in'), manhole = kwResolved('Open or broken manhole');
  const roadOf = (p) => roadById[p.roadId]?.name || 'the ward road';
  const placeOf = (p) => p.title.split(' — ')[1] || roadOf(p);
  const joint = (id, problem, authorIds, text, h) => {
    if (!problem) return;
    for (const pid of authorIds) if (!problem.respondedByPositions.includes(pid)) problem.respondedByPositions.push(pid);
    stories.push({ id, type: 'joint_solved', authors: authorIds.map((pid) => ({ type: 'position', id: pid })), problemPostId: problem.id, text, authorId: P[authorIds[0]].holderUserId, createdAt: t0 - h * 3600e3, seenBy: [] });
  };
  joint('js_1', caveIn, ['p_eer_kw', 'p_swd_kw', 'p_corp_kw'], `The cave-in on ${caveIn && placeOf(caveIn)} is fixed. Storm Water Drains replaced the leaking drain line that washed out the road base, Roads rebuilt the base and resurfaced the stretch, and the ward committee signed off the work on site.`, 3);
  joint('js_2', manhole, ['p_swd_kw', 'p_eer_kw'], `The open manhole on ${manhole && placeOf(manhole)} now has a new cover and frame. Storm Water Drains fitted it, and Roads re-levelled the surface around it so two-wheelers do not hit an edge.`, 20);
  if (caveIn && !caveIn.upvotes.includes('u_demo')) caveIn.upvotes.push('u_demo');

  // A seeded official reply on the demo citizen's problem (the notification below points at it).
  const comments = [{ id: 'cm_s1', postId: demo.id, authorId: P.p_eer_kw.holderUserId, actingAs: { type: 'position', id: 'p_eer_kw' }, body: `We have logged that the patch on ${roadOf(demo)} failed within 30 days. The repeat repair goes back to the same contractor, and we will post the result on this thread.`, createdAt: t0 - 1.2 * 864e5 }];

  // ---------------- Demo notifications ----------------
  // Every item is built from seed records (real post ids, positions, contractors, projects) and marked demo: true.
  const ROAD = (p) => ROAD_CATS.includes(p.category), DRAIN = (p) => DRAIN_CATS.includes(p.category);
  const sameFamily = (p) => posts.filter((x) => x.tag === 'problem' && x.roadId && x.roadId === p.roadId && (ROAD(p) ? ROAD(x) : DRAIN(x)));
  const demoGroup = sameFamily(demo);
  const demoWo = workOrders.find((w) => w.id === demo.workOrderIds[0]);
  const lakh = (cr) => `₹${Math.round(cr * 100)} lakh`;
  const pj1 = projects.find((x) => x.id === 'pj_1'), pj3 = projects.find((x) => x.id === 'pj_3');
  const winBid = pj3?.bids.find((b) => b.contractorId === pj3.contractorId);
  const conNameOf = (id) => contractors.find((c) => c.id === id)?.name;
  const swdUpdate = posts.filter((p) => p.tag === 'progress' && p.actingAs.id === 'p_swd_kw').sort((a, b) => b.createdAt - a.createdAt)[0];
  const newKwPothole = posts.filter((p) => p.tag === 'problem' && p.regionId === wardRegionId('K/W') && p.status === 'open' && ROAD(p)).sort((a, b) => b.createdAt - a.createdAt)[0];
  const T = (P_) => P[P_].title;
  const notifications = [];
  const note = (userId, type, actor, text, link, daysAgo, read) => notifications.push({ id: 'n_' + (notifications.length + 1), userId, type, actor, text: actor ? `${actor} ${text}` : text, link, read, demo: true, createdAt: t0 - daysAgo * 864e5 });

  note('u_demo', 'comment', T('p_eer_kw'), `replied to your problem "${demo.title}"`, '#/post/' + demo.id, 0.05, false);
  if (caveIn) note('u_demo', 'joint_solved', T('p_eer_kw'), `and 2 other authorities published a joint story: "${caveIn.title}" is solved`, '#/post/' + caveIn.id, 0.12, false);
  if (pj3) note('u_demo', 'contractor', T('p_swd_kw'), `chose ${conNameOf(pj3.contractorId)} for "${pj3.title}" at ${lakh(winBid.amount)}, out of ${pj3.bids.length} bids`, '#/project/pj_3', 0.4, false);
  if (caveIn) note('u_demo', 'resolved', T('p_eer_kw'), `marked "${caveIn.title}", which you upvoted, as resolved`, '#/post/' + caveIn.id, 0.9, true);
  if (swdUpdate) note('u_demo', 'progress', T('p_swd_kw'), `posted a progress update: "${swdUpdate.title}"`, '#/post/' + swdUpdate.id, 1.6, false);
  note('u_demo', 'grouped', null, `Your problem "${demo.title}" was grouped with ${demoGroup.length - 1} other reports on ${roadOf(demo)} (segment ${roadById[demo.roadId]?.segment}). The group size shows officials how serious it is.`, '#/post/' + demo.id, 2.5, true);
  if (pj1) note('u_demo', 'project', T('p_eer_kw'), `opened "${pj1.title}" for bids. It covers ${pj1.linkedProblemIds.length} open problems in K/W Ward`, '#/project/pj_1', 4.2, true);
  if (pj3) note('u_demo', 'project', T('p_swd_kw'), `created a project for ${pj3.linkedProblemIds.length} waterlogging problems in your ward: "${pj3.title}"`, '#/project/pj_3', 7.5, true);
  if (demoWo?.reopened) note('u_demo', 'reopened', null, `The repair on your problem "${demo.title}" by ${conNameOf(demoWo.contractorId)} failed within 30 days, so the complaint was re-opened`, '#/wo/' + demoWo.id, 8.3, true);
  note('u_demo', 'progress', T('p_eer_kw'), `posted a progress update on "${demo.title}"`, '#/post/' + demo.workOrderIds[0], 9.6, true);

  if (manhole) note('u_eer_kw', 'joint_solved', T('p_swd_kw'), `published a joint solved story with you on "${manhole.title}"`, '#/post/' + manhole.id, 0.8, false);
  if (pj1?.bids[0]) note('u_eer_kw', 'contractor', conNameOf(pj1.bids[0].contractorId), `placed a bid of ${lakh(pj1.bids[0].amount)} on "${pj1.title}"`, '#/project/pj_1', 2.1, false);
  if (newKwPothole) note('u_eer_kw', 'problem', null, `New problem in your area: "${newKwPothole.title}"`, '#/post/' + newKwPothole.id, 3.4, true);
  note('u_eer_kw', 'follow', 'A citizen', `started following ${T('p_eer_kw')}`, '#/position/p_eer_kw', 6, true);

  return { version: 2, stories, regions, positions, users, contractors, roads, workOrders, posts, comments, projects, notifications, sessions: {}, counters: { post: 0, comment: 0, user: 0, notif: 100, project: 10, position: 0, contractor: 10 } };
}
