// "Follow the rupee" analytics: audit flags, money trail, fair scorecards, next-rupee planner.
// Everything is deterministic and evidence-based: every flag/score links back to work orders.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCsv, km } from './geo.js';
import { ROAD_CATS, DRAIN_CATS, wardRegionId } from './seed.js';

const DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dataset');
const csv = (f) => readCsv(path.join(DIR, f));

export const ref = {
  rateCard: Object.fromEntries(csv('rate_card.csv').map((r) => [r.repair_method, { unit: r.unit, rate: +r.standard_rate_inr }])),
  hotspots: csv('flood_hotspots.csv').map((h) => ({ id: h.hotspot_id, name: h.name, wardCode: h.ward_code, at: [+h.lat, +h.lon], threshold: +h.flood_threshold_mm_per_day, tide: h.tide_sensitive === 'Y', depthCm: +h.avg_water_depth_cm, years: +h.years_flagged_last_5, pump: h.pumping_station_nearby === 'Y' })),
  accidents: csv('accidents.csv').map((a) => ({ id: a.accident_id, at: a.occurred_at, roadId: a.road_id, wardCode: a.ward_code, severity: a.severity, cause: a.probable_cause, vehicle: a.vehicle_type })),
  facilities: csv('facilities.csv').map((f) => ({ id: f.facility_id, type: f.type, name: f.name, wardCode: f.ward_code, size: +f.beds_or_students, emergency: f.emergency_services === 'Y', roadId: f.ambulance_entry_road })),
  rain: {},
};
for (const r of csv('rainfall_daily.csv')) (ref.rain[r.date] ||= {})[r.station] = { mm: +r.rainfall_mm, cat: r.imd_category, alert: r.imd_alert };
const ISLAND = new Set(['A', 'B', 'C', 'D', 'E', 'F/S', 'F/N', 'G/S', 'G/N']);
const dateKey = (ms) => new Date(ms + 5.5 * 3600e3).toISOString().slice(0, 10);
export function rainOn(ms, wardCode) {
  const d = ref.rain[dateKey(ms)];
  return d?.[ISLAND.has(wardCode) ? 'Colaba' : 'Santacruz'] || null;
}
const heavy = (r) => r && /Heavy|Extremely/.test(r.cat);
const ROAD_CAUSES = /pothole|waterlog|uneven|chamber/i;

// ---------------- Audit (static dataset; computed once) ----------------
export function expectedCost(wo) {
  const rc = ref.rateCard[wo.method];
  if (!rc) return null;
  return rc.unit === 'per sqm' ? rc.rate * wo.areaSqm : rc.rate;
}

export function audit(db) {
  const roads = Object.fromEntries(db.roads.map((r) => [r.id, r]));
  const byKey = {};
  for (const w of db.workOrders) (byKey[w.roadId + '|' + w.workType] ||= []).push(w);
  for (const w of db.workOrders) {
    const flags = [];
    const exp = expectedCost(w);
    w.expected = exp;
    w.costRatio = exp ? w.cost / exp : null;
    if (w.costRatio > 1.5) flags.push({ type: 'overbilled', severity: 'high', text: `Billed ₹${Math.round(w.cost).toLocaleString('en-IN')}, ${w.costRatio.toFixed(1)}× the rate card (expected about ₹${Math.round(exp).toLocaleString('en-IN')}). Normal jobs vary 20–30%.` });
    if (!w.complaintIds.length) {
      const twin = byKey[w.roadId + '|' + w.workType].find((o) => o !== w && Math.abs(o.completedAt - w.completedAt) <= 10 * 864e5);
      if (twin) { w.twinId = twin.id; flags.push({ type: 'duplicate', severity: 'high', text: `Same road and same work as ${twin.id}, finished ${Math.abs(Math.round((w.completedAt - twin.completedAt) / 864e5))} day(s) apart, with no complaint linked. Possible double billing.` }); }
    }
    const road = roads[w.roadId];
    if (road?.underDlp && w.cost > 0) flags.push({ type: 'dlp', severity: 'high', text: `Road was resurfaced on ${road.lastResurfaced} and is still under its Defect Liability Period, so the original contractor should have repaired it free. BMC paid ₹${Math.round(w.cost).toLocaleString('en-IN')}.` });
    const rain = rainOn(w.assignedAt, w.wardCode);
    w.heavyRain = heavy(rain);
    if (!w.slaMet) flags.push({ type: 'sla', severity: 'note', text: `Missed the ${w.slaHours}-hour target${w.heavyRain ? ` (assigned on a ${rain.cat.toLowerCase()} rain day — context, not blame)` : ''}.` });
    if (w.reopened) flags.push({ type: 'reopened', severity: 'note', text: 'The fix failed and the issue re-opened within 30 days.' });
    w.flags = flags;
  }
}
export const FLAG_LABELS = { overbilled: 'Over rate card', duplicate: 'Possible double billing', dlp: 'Paid during DLP', sla: 'Missed time target', reopened: 'Fix did not last' };

// ---------------- Money trail ----------------
const sum = (a, f) => a.reduce((s, x) => s + f(x), 0);
const groupSum = (list, key) => { const o = {}; for (const w of list) o[key(w)] = (o[key(w)] || 0) + w.cost; return Object.entries(o).sort((a, b) => b[1] - a[1]); };

export function money(db, wardIds, contractorName) {
  const set = new Set(wardIds);
  const wos = db.workOrders.filter((w) => set.has(w.regionId));
  const wards = db.regions.filter((r) => set.has(r.id));
  const budget = sum(wards, (r) => (r.budget['Monsoon road repairs 2025'] || 0) * 1e7);
  const spend = sum(wos, (w) => w.cost);
  const flagged = (t) => wos.filter((w) => w.flags.some((f) => f.type === t));
  const failed = wos.filter((w) => w.reopened);
  return {
    budget, spend, jobs: wos.length,
    byContractor: groupSum(wos, (w) => contractorName(w.contractorId)),
    byWorkType: groupSum(wos, (w) => w.workType),
    byMethod: groupSum(wos, (w) => w.method),
    byMonth: groupSum(wos, (w) => new Date(w.completedAt + 5.5 * 3600e3).toISOString().slice(0, 7)).sort((a, b) => a[0].localeCompare(b[0])),
    failedSpend: sum(failed, (w) => w.cost), failedJobs: failed.length,
    slaMet: wos.length ? wos.filter((w) => w.slaMet).length / wos.length : 0,
    reopenRate: wos.length ? failed.length / wos.length : 0,
    flags: Object.fromEntries(['overbilled', 'duplicate', 'dlp'].map((t) => { const l = flagged(t); return [t, { jobs: l.length, amount: sum(l, (w) => w.cost), excess: t === 'overbilled' ? sum(l, (w) => w.cost - w.expected) : sum(l, (w) => w.cost) }]; })),
    wards: wards.length > 1 ? wards.map((r) => { const l = wos.filter((w) => w.regionId === r.id); const b = (r.budget['Monsoon road repairs 2025'] || 0) * 1e7; const s = sum(l, (w) => w.cost); return { id: r.id, name: r.shortName || r.name, budget: b, spend: s, jobs: l.length, reopenRate: l.length ? l.filter((w) => w.reopened).length / l.length : 0, flagged: l.filter((w) => w.flags.some((f) => f.severity === 'high')).length }; }).sort((a, b) => b.spend / (b.budget || 1) - a.spend / (a.budget || 1)) : null,
  };
}

// ---------------- Fair scorecards ----------------
// Peer baseline: compare each job with other contractors' jobs of the same type in the same ward
// (falls back to citywide same type), so low-lying wards and hard work types aren't punished.
function peerRates(db, list, excludeContractor) {
  let reopen = 0, sla = 0;
  for (const w of list) {
    let peers = db.workOrders.filter((o) => o.workType === w.workType && o.wardCode === w.wardCode && o.contractorId !== excludeContractor);
    if (peers.length < 8) peers = db.workOrders.filter((o) => o.workType === w.workType && o.contractorId !== excludeContractor);
    reopen += peers.filter((o) => o.reopened).length / peers.length;
    sla += peers.filter((o) => o.slaMet).length / peers.length;
  }
  return { reopen: reopen / list.length, sla: sla / list.length };
}
const pct = (x) => Math.round(x * 100) + '%';
const median = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0; };

export function contractorScorecard(db, c) {
  const wos = db.workOrders.filter((w) => w.contractorId === c.id);
  if (!wos.length) return null;
  const spend = sum(wos, (w) => w.cost);
  const slaMet = wos.filter((w) => w.slaMet).length / wos.length;
  const reopen = wos.filter((w) => w.reopened).length / wos.length;
  const peer = peerRates(db, wos, c.id);
  const ratios = wos.map((w) => w.costRatio).filter(Boolean);
  const inBand = ratios.filter((r) => r <= 1.3).length / ratios.length;
  const missed = wos.filter((w) => !w.slaMet);
  const missedRain = missed.filter((w) => w.heavyRain).length;
  const counts = (t) => wos.filter((w) => w.flags.some((f) => f.type === t)).length;
  const flags = { overbilled: counts('overbilled'), duplicate: counts('duplicate'), dlp: counts('dlp') };
  const wards = [...new Set(wos.map((w) => w.wardCode))];
  // Method durability for "one thing to improve"
  const methodStats = Object.entries(groupBy(wos, (w) => w.method)).map(([m, l]) => ({ m, n: l.length, reopen: l.filter((w) => w.reopened).length / l.length })).filter((x) => x.n >= 15).sort((a, b) => b.reopen - a.reopen);
  const score = Math.round(100 * (0.35 * clamp(0.5 + (peer.reopen - reopen) * 2.5) + 0.3 * clamp(0.5 + (slaMet - peer.sla) * 2.5) + 0.2 * inBand + 0.15 * (1 - Math.min(1, (flags.overbilled + flags.duplicate) / Math.max(10, wos.length * 0.05)))));
  let improve;
  if (flags.duplicate) improve = `Explain ${flags.duplicate} job(s) billed twice for the same road and work within days.`;
  else if (flags.overbilled > 2) improve = `Bring ${flags.overbilled} jobs billed above 1.5× the rate card back in line, or attach measurements that justify them.`;
  else if (methodStats[0] && methodStats[0].reopen > peer.reopen + 0.05) improve = `${methodStats[0].m} jobs re-opened ${pct(methodStats[0].reopen)} of the time — use a longer-lasting method on busy roads.`;
  else improve = 'Keep it up — share site photos before and after each job so citizens can see the work.';
  const summary = `During the 2025 monsoon, ${c.name} did ${wos.length} repair jobs across ${wards.length} wards, billed ₹${(spend / 1e7).toFixed(2)} crore. ` +
    `It met the time target on ${pct(slaMet)} of jobs (similar jobs by others: ${pct(peer.sla)})${missedRain ? `; ${missedRain} of its ${missed.length} late jobs were assigned on heavy-rain days` : ''}. ` +
    `${pct(reopen)} of its fixes failed within 30 days, compared with ${pct(peer.reopen)} for comparable jobs in the same wards. ` +
    `${pct(inBand)} of its bills were within the normal range of the rate card. One thing to improve: ${improve}`;
  return { contractorId: c.id, jobs: wos.length, wards, spend, slaMet, reopen, peer, inBand, medianRatio: median(ratios), flags, missedRain, missed: missed.length, score, summary, methodStats };
}
const clamp = (x) => Math.max(0, Math.min(1, x));
function groupBy(a, f) { const o = {}; for (const x of a) (o[f(x)] ||= []).push(x); return o; }

export function wardScorecard(db, region, m) {
  const k = region.wardCode;
  const spentPct = m.budget ? m.spend / m.budget : 0;
  const open = db.posts.filter((p) => p.tag === 'problem' && p.regionId === region.id && ['open', 'in_progress'].includes(p.status)).length;
  const flaggedAmt = m.flags.overbilled.excess + m.flags.duplicate.amount + m.flags.dlp.amount;
  return `${region.shortName || region.name} had a monsoon road repair budget of ₹${(m.budget / 1e5).toFixed(1)} lakh and spent ₹${(m.spend / 1e5).toFixed(1)} lakh (${pct(spentPct)}) on ${m.jobs} jobs. ` +
    `${pct(m.slaMet)} of jobs were finished on time and ${pct(m.reopenRate)} of fixes failed within 30 days, costing ₹${(m.failedSpend / 1e5).toFixed(1)} lakh. ` +
    (flaggedAmt > 0 ? `About ₹${(flaggedAmt / 1e5).toFixed(1)} lakh needs a second look: work paid on roads under DLP, possible double bills, or bills well above the rate card. ` : '') +
    `${open} complaints are still open.${region.lowLying >= 0.6 ? ` This ward is low-lying (flood index ${region.lowLying}), so some repeat repairs are expected.` : ''}`;
}

// ---------------- Road risk & next-rupee planner ----------------
export function roadInfo(db, road) {
  const wos = db.workOrders.filter((w) => w.roadId === road.id);
  const hotspots = ref.hotspots.filter((h) => km(h.at, road.mid) < 0.8).map((h) => ({ ...h, distKm: km(h.at, road.mid) }));
  const accidents = ref.accidents.filter((a) => a.roadId === road.id);
  const facilities = ref.facilities.filter((f) => f.roadId === road.id);
  return { road, workOrders: wos, hotspots, accidents, roadAccidents: accidents.filter((a) => ROAD_CAUSES.test(a.cause)), facilities, spend: sum(wos, (w) => w.cost), reopened: wos.filter((w) => w.reopened).length };
}

let methodDurability = null;
function bestMethod(db, family) {
  if (!methodDurability) {
    methodDurability = Object.entries(groupBy(db.workOrders, (w) => w.method)).map(([m, l]) => ({ method: m, n: l.length, reopen: l.filter((w) => w.reopened).length / l.length, medianArea: median(l.map((w) => w.areaSqm)), workTypes: [...new Set(l.map((w) => w.workType))] }));
  }
  const cands = methodDurability.filter((x) => x.n >= 20 && x.workTypes.some((t) => (family === 'road' ? ROAD_CATS : DRAIN_CATS).includes(t)) && (family === 'road' ? /patch|asphalt|Paver|PQC/.test(x.method) : !/patch|asphalt|Paver/.test(x.method)));
  cands.sort((a, b) => a.reopen - b.reopen);
  const best = cands[0];
  const rc = ref.rateCard[best.method];
  const cheapest = [...cands].sort((a, b) => (ref.rateCard[a.method].rate - ref.rateCard[b.method].rate))[0];
  return { method: best.method, reopen: best.reopen, cost: rc.unit === 'per sqm' ? rc.rate * Math.max(best.medianArea, 8) : rc.rate, cheapest: cheapest.method, cheapestReopen: cheapest.reopen };
}

export function planner(db, wardIds, moneyFor) {
  const set = new Set(wardIds);
  const regions = Object.fromEntries(db.regions.map((r) => [r.id, r]));
  const roads = Object.fromEntries(db.roads.map((r) => [r.id, r]));
  const open = db.posts.filter((p) => p.tag === 'problem' && set.has(p.regionId) && ['open', 'in_progress'].includes(p.status));
  // Cluster complaints into issues: same road (or same ward when unmapped) and same family.
  const issues = {};
  for (const p of open) {
    const fam = DRAIN_CATS.includes(p.category) ? 'drain' : ROAD_CATS.includes(p.category) ? 'road' : null;
    if (!fam) continue;
    const key = (p.roadId || 'ward:' + p.regionId) + '|' + fam;
    (issues[key] ||= { key, roadId: p.roadId, regionId: p.regionId, family: fam, posts: [] }).posts.push(p);
  }
  const list = Object.values(issues).map((it) => {
    const road = it.roadId ? roads[it.roadId] : null;
    const info = road ? roadInfo(db, road) : null;
    const ward = regions[it.regionId];
    const up = sum(it.posts, (p) => (p.upvoteBase || 0) + p.upvotes.length);
    const f = {
      demand: clamp((it.posts.length + up / 25) / 10),
      failures: info ? clamp(info.reopened / 3 + info.workOrders.length / 15) : 0,
      flood: clamp(Math.max(0, ...(info?.hotspots || []).map((h) => (h.years / 5) * (h.tide ? 1 : 0.85))) * 0.8 + (ward?.lowLying || 0) * 0.3),
      traffic: road ? clamp(road.traffic.congestion / 10 + (road.busRoute ? 0.1 : 0)) : 0.3,
      accidents: info ? clamp(sum(info.roadAccidents, (a) => (a.severity === 'Fatal' ? 3 : a.severity === 'Grievous' ? 2 : 1)) / 5) : 0,
      facilities: info ? clamp(sum(info.facilities, (x) => (x.type === 'Hospital' ? (x.emergency ? 1 : 0.6) : 0.4))) : 0,
    };
    const score = Math.round(100 * (0.22 * f.demand + 0.18 * f.failures + 0.18 * f.flood + 0.14 * f.traffic + 0.14 * f.accidents + 0.14 * f.facilities));
    const rec = bestMethod(db, it.family);
    const why = [];
    if (it.posts.length > 1) why.push(`${it.posts.length} open complaints`);
    if (info?.reopened) why.push(`${info.reopened} repair(s) here failed this season`);
    if (info?.hotspots.length) why.push(`near flood hotspot ${info.hotspots[0].name}`);
    if (info?.roadAccidents.length) why.push(`${info.roadAccidents.length} accident(s) linked to road condition`);
    if (info?.facilities.length) why.push(`access road for ${info.facilities.map((x) => x.name).slice(0, 2).join(', ')}`);
    if (road?.busRoute) why.push('BEST bus route');
    return {
      key: it.key, roadId: it.roadId, roadName: road ? `${road.name} (seg ${road.segment})` : 'Unmapped location', regionId: it.regionId, wardName: ward?.shortName || ward?.name, family: it.family, complaintIds: it.posts.map((p) => p.id), factors: f, score, why,
      underDlp: !!road?.underDlp, method: road?.underDlp ? 'Raise with DLP contractor' : rec.method, methodReopen: rec.reopen, cheapest: rec.cheapest, cheapestReopen: rec.cheapestReopen, estCost: road?.underDlp ? 0 : rec.cost,
    };
  }).sort((a, b) => b.score - a.score);
  // Allocate remaining budget per ward, highest risk first
  const remaining = {};
  for (const id of wardIds) { const m = moneyFor(id); remaining[id] = Math.max(0, m.budget - m.spend); }
  const start = { ...remaining };
  for (const it of list) { if (it.estCost <= remaining[it.regionId]) { it.funded = true; remaining[it.regionId] -= it.estCost; } else it.funded = it.estCost === 0; }
  return { issues: list.slice(0, 60), totalIssues: list.length, remainingStart: sum(Object.values(start), (x) => x), remainingAfter: sum(Object.values(remaining), (x) => x) };
}
