import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSeed, LEVELS, CATEGORIES, ROAD_CATS, DRAIN_CATS } from './seed.js';
import { audit, money, contractorScorecard, wardScorecard, planner, roadInfo, ref, FLAG_LABELS } from './analytics.js';
import { inPolygon, km } from './geo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = Number(process.env.PORT || 3000);
const SEED_VERSION = 8;

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------- Persistence (JSON file; swap for Postgres when moving to the cloud) ----------------
let db = null;
if (!process.argv.includes('--reset') && fs.existsSync(DB_FILE)) {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  if (db.version !== SEED_VERSION) db = null;
}
if (!db) {
  console.time('seed');
  db = buildSeed(); db.version = SEED_VERSION;
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
  console.timeEnd('seed');
  console.log('Seeded database at', DB_FILE);
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 400);
}

// ---------------- Indexes ----------------
const ix = {};
function reindex() {
  for (const k of ['regions', 'positions', 'users', 'contractors', 'posts', 'projects', 'roads', 'workOrders']) ix[k] = new Map(db[k].map((x) => [x.id, x]));
  ix.children = new Map();
  for (const r of db.regions) { if (!ix.children.has(r.parentId)) ix.children.set(r.parentId, []); ix.children.get(r.parentId).push(r.id); }
  ix.chain = new Map();
  ix.progressByProblem = new Map();
  for (const p of db.posts) if (p.tag === 'progress') for (const id of p.linkedProblemIds) { if (!ix.progressByProblem.has(id)) ix.progressByProblem.set(id, []); ix.progressByProblem.get(id).push(p.id); }
  ix.commentCount = new Map();
  for (const c of db.comments) ix.commentCount.set(c.postId, (ix.commentCount.get(c.postId) || 0) + 1);
  ix.held = new Map();
  for (const p of db.positions) if (p.holderUserId) { if (!ix.held.has(p.holderUserId)) ix.held.set(p.holderUserId, []); ix.held.get(p.holderUserId).push(p); }
  ix.memberOf = new Map();
  for (const c of db.contractors) for (const u of c.memberUserIds) { if (!ix.memberOf.has(u)) ix.memberOf.set(u, []); ix.memberOf.get(u).push(c); }
  ix.money = new Map();
}
audit(db);
reindex();

// ---------------- Live sync (Server-Sent Events) ----------------
const clients = new Set();
function changed(entity, id) {
  save();
  if (['positions', 'contractors', 'regions'].includes(entity)) reindex();
  const msg = `data: ${JSON.stringify({ entity, id, at: Date.now() })}\n\n`;
  for (const res of clients) res.write(msg);
}

// ---------------- Helpers ----------------
const R = (id) => ix.regions.get(id);
const POS = (id) => ix.positions.get(id);
const USER = (id) => ix.users.get(id);
const CON = (id) => ix.contractors.get(id);
const PROJ = (id) => ix.projects.get(id);
const POST = (id) => ix.posts.get(id);
const ROAD = (id) => ix.roads.get(id);
const WO = (id) => ix.workOrders.get(id);
const nextId = (kind, prefix) => `${prefix}_${++db.counters[kind]}`;
const depth = (regionId) => LEVELS[R(regionId)?.type]?.depth ?? 9;
const add = (kind, item) => { db[kind].push(item); ix[kind]?.set(item.id, item); };

function chain(regionId) {
  if (ix.chain.has(regionId)) return ix.chain.get(regionId);
  const out = [];
  let r = R(regionId);
  while (r) { out.push(r.id); r = R(r.parentId); }
  ix.chain.set(regionId, out);
  return out;
}
function subtree(regionId) {
  const out = [regionId];
  for (let i = 0; i < out.length; i++) out.push(...(ix.children.get(out[i]) || []));
  return out;
}
const wardsUnder = (regionId) => subtree(regionId).filter((id) => R(id)?.type === 'ward');
const inSubtree = (regionId, ancestorId) => chain(regionId).includes(ancestorId);
const positionsHeldBy = (userId) => ix.held.get(userId) || [];
const contractorsOf = (userId) => ix.memberOf.get(userId) || [];
const anonHandle = (u) => u.anonHandle || 'Citizen ' + crypto.createHash('sha1').update(u.id).digest('hex').slice(0, 5).toUpperCase();
const upCount = (p) => (p.upvoteBase || 0) + p.upvotes.length;
const conName = (id) => CON(id)?.name || 'Unknown';
const moneyFor = (regionId) => { if (!ix.money.has(regionId)) ix.money.set(regionId, money(db, wardsUnder(regionId), conName)); return ix.money.get(regionId); };

function publicUser(u) {
  if (!u) return null;
  const held = positionsHeldBy(u.id);
  const cons = contractorsOf(u.id);
  if (u.role === 'admin') return { id: u.id, kind: 'admin', name: 'Platform Admin', regionId: u.regionId };
  if (held.length || cons.length) return { id: u.id, kind: 'public', name: u.realName, party: u.party || null, regionId: u.regionId, positionIds: held.map((p) => p.id), contractorIds: cons.map((c) => c.id) };
  if (u.showName && u.realName) return { id: u.id, kind: 'citizen', name: u.realName, regionId: u.regionId };
  return { id: u.id, kind: 'anon', name: anonHandle(u), regionId: u.regionId };
}

function suggestResponsible(regionId, category) {
  // Rule-based stand-in for the future AI layer: the area's head, then the
  // department positions whose remit covers the category, nearest first.
  const out = [];
  const covers = (p) => p.categories.includes(category);
  chain(regionId).forEach((rid, level) => {
    const here = db.positions.filter((p) => p.regionId === rid && covers(p));
    const head = here.find((p) => p.isHead);
    if (level === 0 && head) out.push(head.id);
    here.filter((p) => p.kind === 'department').sort((a, b) => a.rank - b.rank).forEach((p) => out.push(p.id));
  });
  for (const rid of chain(regionId).slice(0, 3)) {
    if (out.length >= 2) break;
    db.positions.filter((p) => p.regionId === rid && covers(p) && !out.includes(p.id)).sort((a, b) => a.rank - b.rank).slice(0, 2 - out.length).forEach((p) => out.push(p.id));
  }
  return out.slice(0, 3);
}

function locate(lat, lng) {
  const ward = db.regions.find((r) => r.type === 'ward' && inPolygon([lat, lng], r.geometry));
  if (ward) return ward;
  let best = null;
  for (const r of db.regions) { const d = km([lat, lng], r.center); if (d <= r.radiusKm && (!best || depth(r.id) > depth(best.id))) best = r; }
  return best;
}

// ---------------- Auth ----------------
function getUser(req) {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  const uid = db.sessions[tok];
  return uid ? USER(uid) : null;
}
function auth(req, res, next) {
  const u = getUser(req);
  if (!u) return res.status(401).json({ error: 'Please sign in' });
  req.user = u;
  next();
}
function newSession(userId) {
  const tok = crypto.randomBytes(24).toString('hex');
  db.sessions[tok] = userId;
  save();
  return tok;
}
function me(u) {
  return {
    id: u.id, role: u.role, realName: u.realName || null, regionId: u.regionId, verified: u.verified, onboarded: u.onboarded,
    following: u.following, contractorsFollowed: u.contractorsFollowed || [], handle: publicUser(u).name, showName: !!u.showName, party: u.party || null,
    positionIds: positionsHeldBy(u.id).map((p) => p.id), contractorIds: contractorsOf(u.id).map((c) => c.id),
  };
}

function canRespond(user, actingAs, post) {
  if (actingAs.type === 'citizen') return true;
  if (actingAs.type === 'admin') return user.role === 'admin';
  if (actingAs.type === 'position') {
    const p = POS(actingAs.id);
    if (!p || p.holderUserId !== user.id) return false;
    return post.responsible.some((r) => r.positionId === p.id) || inSubtree(post.regionId, p.regionId) || post.mentions.some((m) => m.type === 'position' && m.id === p.id);
  }
  if (actingAs.type === 'contractor') {
    const c = CON(actingAs.id);
    if (!c || !c.memberUserIds.includes(user.id)) return false;
    const projIds = db.projects.filter((pj) => pj.contractorId === c.id).map((pj) => pj.id);
    return db.projects.some((pj) => projIds.includes(pj.id) && pj.linkedProblemIds.includes(post.id)) || (post.projectId && projIds.includes(post.projectId))
      || post.mentions.some((m) => m.type === 'contractor' && m.id === c.id) || (post.workOrderIds || []).some((id) => WO(id)?.contractorId === c.id);
  }
  return false;
}

function notify(userIds, text, link, type = 'info') {
  for (const userId of new Set(userIds)) if (userId) db.notifications.push({ id: nextId('notif', 'n'), userId, type, text, link, read: false, createdAt: Date.now() });
}

function actorLabel(actingAs, authorId) {
  if (actingAs.type === 'position') { const p = POS(actingAs.id); return { type: 'position', id: p?.id, title: p ? p.title : 'Position', person: publicUser(USER(authorId)) }; }
  if (actingAs.type === 'contractor') { const c = CON(actingAs.id); return { type: 'contractor', id: c?.id, title: c?.name || 'Contractor', person: publicUser(USER(authorId)) }; }
  if (actingAs.type === 'admin') return { type: 'admin', title: 'Platform Admin' };
  const pu = publicUser(USER(authorId));
  return { type: 'citizen', person: pu, title: pu?.name };
}

const woBrief = (w) => w && ({ id: w.id, contractorId: w.contractorId, contractorName: conName(w.contractorId), method: w.method, cost: w.cost, expected: w.expected, costRatio: w.costRatio, slaMet: w.slaMet, slaHours: w.slaHours, reopened: w.reopened, completedAt: w.completedAt, assignedAt: w.assignedAt, flags: w.flags.map((f) => f.type), remark: w.remark });

function decorate(p, viewer) {
  const road = p.roadId ? ROAD(p.roadId) : null;
  return {
    ...p,
    author: actorLabel(p.actingAs, p.authorId),
    regionName: R(p.regionId)?.shortName || R(p.regionId)?.name,
    road: road ? { id: road.id, name: road.name, segment: road.segment, underDlp: road.underDlp } : null,
    upvoteCount: upCount(p),
    upvoted: viewer ? p.upvotes.includes(viewer.id) : false,
    upvotes: undefined,
    commentCount: ix.commentCount.get(p.id) || 0,
    workOrders: (p.workOrderIds || []).map((id) => woBrief(WO(id))).filter(Boolean),
    linkedProblems: p.linkedProblemIds.slice(0, 6).map((id) => { const x = POST(id); return x && { id: x.id, title: x.title, status: x.status }; }).filter(Boolean),
    linkedProblemCount: p.linkedProblemIds.length,
    progressUpdates: p.tag === 'problem' ? (ix.progressByProblem.get(p.id) || []).map((id) => { const x = POST(id); return { id: x.id, title: x.title, createdAt: x.createdAt }; }) : [],
  };
}

// ---------------- Ranking ----------------
// Score = engagement (decayed by age) × proximity × follow boost × type weight.
// Lower (closer) areas beat higher areas; followed beats non-followed; road problems lead.
function hot(p) {
  const engagement = upCount(p) + 0.5 * (ix.commentCount.get(p.id) || 0) + (ix.progressByProblem.get(p.id)?.length || 0);
  const ageH = Math.max(0, (Date.now() - p.createdAt) / 3600000);
  return (1 + Math.log2(1 + engagement)) / Math.pow(ageH / 24 + 2, 0.6);
}
const HIDDEN = new Set(['duplicate', 'rejected']);
function typeWeight(p) {
  if (p.tag === 'problem') return ROAD_CATS.includes(p.category) ? 1.25 : DRAIN_CATS.includes(p.category) ? 1.05 : 0.75;
  // Non-problem posts are rare (a couple of each), so they get a boost to surface among problems.
  if (p.tag === 'normal') return 1.2;
  return { progress: 1.6, position_change: 1.4, election: 1.4 }[p.tag] || 1;
}
function rankFor(viewer, p) {
  const reasons = [];
  let prox = 0.12;
  let followBoost = 1;
  if (viewer) {
    const myChain = chain(viewer.regionId);
    const postChain = chain(p.regionId);
    if (p.regionId === viewer.regionId) { prox = 1; reasons.push('Your ward'); }
    else if (myChain.includes(p.regionId)) { prox = 0.4 + 0.4 * (depth(p.regionId) / Math.max(1, depth(viewer.regionId))); reasons.push('Covers your ward'); }
    else {
      const lca = postChain.find((id) => myChain.includes(id));
      if (lca) { prox = 0.15 + 0.35 * (depth(lca) / Math.max(1, depth(viewer.regionId))); if (depth(lca) >= 5) reasons.push('Nearby'); }
    }
    const f = viewer.following;
    let followed = f.users.includes(p.authorId)
      || (p.actingAs.type === 'position' && f.positions.includes(p.actingAs.id))
      || p.mentions.some((m) => m.type === 'position' && f.positions.includes(m.id))
      || p.responsible.some((r) => f.positions.includes(r.positionId))
      || f.regions.includes(p.regionId);
    if (followed) { reasons.push('Following'); followBoost = 1.7; }
  }
  return { score: hot(p) * prox * followBoost * typeWeight(p), reasons };
}

// ---------------- Comments: payload + demo threads ----------------
const commentUps = (c) => (c.upvoteBase || 0) + (c.upvotes?.length || 0);
const commentOut = (c, viewer) => ({
  ...c, parentId: c.parentId || null, author: actorLabel(c.actingAs, c.authorId),
  upvoteCount: commentUps(c), upvoted: viewer ? (c.upvotes || []).includes(viewer.id) : false, upvotes: undefined, upvoteBase: undefined,
});

// Demo comment threads, added once at startup so thread pages are not empty (marked demo: true).
// o = official (the post's responsible position at index o), otherwise a citizen from the post's ward.
const DEMO_THREADS = [
  [
    { t: 'This has been getting worse since the first heavy spell. A two-wheeler went in last night near {road}; the rider was lucky.', u: 142, r: [
      { o: 1, t: 'Site inspected this morning. There is a damaged storm-water line under it, so a surface patch will not hold. Barricades are up; the line gets repaired first, then the road.', u: 88, r: [
        { t: 'Thanks. Can you share a date? The barricades already fell over once in the rain.', u: 41, r: [
          { o: 1, t: 'Target is within 7 working days, weather permitting. The ward team will re-fix the barricades with sandbags today.', u: 37 },
        ] },
      ] },
      { t: 'The same stretch was resurfaced in May. Who did that work, and is it still under defect liability?', u: 64 },
    ] },
    { t: 'Buses are diverting through the side lane now, and that lane floods too. Please look at both.', u: 23 },
  ],
  [
    { t: 'Water fills it completely after 20 minutes of rain, so you cannot see how deep it is. Lost a tyre here on Tuesday.', u: 96, r: [
      { t: 'Same. It is right at the lane merge, so cars swerve at the last second.', u: 31, r: [
        { t: 'Reported it on the old complaint line twice. Closed both times as resolved without any work.', u: 27 },
      ] },
    ] },
    { t: 'Is this stretch with the ward or with MMRDA? Every complaint gets passed between them.', u: 52, r: [
      { o: 0, t: 'This segment is maintained by the ward. The complaint is assigned to our roads engineer and will be logged against a work order once it is filled.', u: 45 },
    ] },
  ],
  [
    { t: 'Cold mix was dumped here two weeks ago and it washed out after one night of rain.', u: 77, r: [
      { t: 'Cold mix in the middle of the monsoon never lasts. This spot needs mastic asphalt.', u: 40, r: [
        { t: 'Mastic costs more per square metre, but paying for cold mix three times costs more.', u: 22 },
      ] },
    ] },
    { t: 'School buses use {road} every morning. Please prioritise this one.', u: 34 },
  ],
  [
    { t: 'There are four of these between the signal and the bus stop. Upvoting so it moves up the list.', u: 58, r: [
      { o: 1, t: 'Noted. These are listed for the next patching round in the ward. A progress update with photos will follow once the work is done.', u: 49, r: [
        { t: 'Please post the before photos too, so we can check the same spots were fixed.', u: 26 },
      ] },
    ] },
  ],
  [
    { t: 'It gets wider every day. Shopkeepers put a crate in it as a warning.', u: 61, r: [
      { t: 'Passed by this morning. The crate is gone and it is just open now.', u: 19 },
    ] },
    { t: 'For whoever reads this at the ward office: there is a gas pipeline marker right next to it.', u: 44 },
  ],
  [
    { t: 'This junction floods first every year and the road breaks right after. Fix the drainage, not just the surface.', u: 83, r: [
      { o: 0, t: 'Agreed that drainage is the root cause here. Desilting of the drain at this junction is being checked with the Storm Water Drains team.', u: 51, r: [
        { t: 'Please put the desilting dates on the project page so people can follow it.', u: 29 },
      ] },
    ] },
  ],
  [
    { t: 'Auto drivers refuse to take {road} after dark because of this.', u: 38 },
    { t: 'The street lights are also off on this stretch, which makes it worse.', u: 21 },
  ],
  [
    { t: 'Second complaint about this road this week. The grouped count shows how bad it is.', u: 17 },
  ],
];
const DEMO_COMMENTS_V = 2;
function seedDemoComments() {
  // Idempotent: runs once per DB (and again only if the templates' version changes). Only demo
  // comments are ever replaced; seed.js comments and real user comments are left alone.
  if (db.demoCommentsV === DEMO_COMMENTS_V && db.comments.some((c) => c.demo)) return;
  db.comments = db.comments.filter((c) => !c.demo);
  db.demoCommentsV = DEMO_COMMENTS_V;
  const demo = USER('u_demo');
  if (!demo) return;
  const top = db.posts.filter((p) => p.tag === 'problem' && !HIDDEN.has(p.status))
    .map((p) => ({ p, s: rankFor(demo, p).score })).sort((a, b) => b.s - a.s).slice(0, DEMO_THREADS.length).map((x) => x.p);
  const busy = new Set([...ix.held.keys(), ...ix.memberOf.keys(), 'u_demo']);
  const citizens = db.users.filter((u) => u.role === 'citizen' && !busy.has(u.id));
  top.forEach((p, i) => {
    const local = citizens.filter((u) => u.regionId === p.regionId);
    const pool = local.length >= 6 ? local : citizens;
    let ci = i * 7;
    const road = (p.title.split(' — ')[1] || 'this road').trim();
    let at = p.createdAt;
    const walk = (nodes, parentId) => nodes.forEach((n) => {
      at = Math.min(at + (1 + (n.t.length % 5)) * 3600e3, Date.now() - 60e3);
      const pos = n.o != null ? POS(p.responsible[n.o]?.positionId || p.responsible[0]?.positionId) : null;
      const official = pos?.holderUserId ? pos : null;
      const authorId = official ? official.holderUserId : pool[ci++ % pool.length].id;
      const c = { id: nextId('comment', 'cm'), postId: p.id, parentId, authorId, actingAs: official ? { type: 'position', id: official.id } : { type: 'citizen' },
        body: n.t.replace('{road}', road), upvoteBase: n.u || 0, upvotes: [], createdAt: at, demo: true };
      db.comments.push(c);
      if (official) { if (!p.respondedByPositions.includes(official.id)) p.respondedByPositions.push(official.id); if (!p.viewedByPositions.includes(official.id)) p.viewedByPositions.push(official.id); }
      if (n.r) walk(n.r, c.id);
    });
    walk(DEMO_THREADS[i], null);
  });
  ix.commentCount = new Map();
  for (const c of db.comments) ix.commentCount.set(c.postId, (ix.commentCount.get(c.postId) || 0) + 1);
  save();
  console.log(`Added ${db.comments.filter((c) => c.demo).length} demo comments`);
}
seedDemoComments();

// ---------------- App ----------------
const app = express();
app.use(express.json({ limit: '12mb' }));
app.use('/uploads', express.static(UPLOAD_DIR));
app.use('/vendor/htm', express.static(path.join(ROOT, 'node_modules/htm/preact')));
app.use('/vendor/leaflet', express.static(path.join(ROOT, 'node_modules/leaflet/dist')));
app.use(express.static(path.join(ROOT, 'public')));

app.get('/api/events', (req, res) => {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
  res.flushHeaders();
  res.write('retry: 3000\n\n');
  clients.add(res);
  const ping = setInterval(() => res.write(': ping\n\n'), 25000);
  req.on('close', () => { clearInterval(ping); clients.delete(res); });
});

app.get('/api/meta', (req, res) => {
  const viewer = getUser(req);
  const people = {};
  for (const id of new Set([...ix.held.keys(), ...ix.memberOf.keys(), 'u_admin'])) { const u = USER(id); if (u) people[id] = publicUser(u); }
  res.json({
    levels: LEVELS, categories: CATEGORIES, roadCategories: ROAD_CATS, drainCategories: DRAIN_CATS, flagLabels: FLAG_LABELS,
    regions: db.regions, positions: db.positions, contractors: db.contractors, people, projects: db.projects,
    roads: db.roads.map((r) => ({ id: r.id, name: r.name, segment: r.segment, regionId: r.regionId, underDlp: r.underDlp, path: r.path })),
    me: viewer ? me(viewer) : null,
  });
});

// ---- Auth ----
app.post('/api/auth/digilocker', (req, res) => {
  const { name, regionId, addressLine } = req.body || {};
  if (!name || !R(regionId)) return res.status(400).json({ error: 'Name and address area required' });
  const u = { id: nextId('user', 'u'), role: 'citizen', realName: String(name).slice(0, 60), regionId, addressLine: String(addressLine || '').slice(0, 140), verified: true, onboarded: false, following: { positions: [], users: [], regions: [] }, createdAt: Date.now() };
  add('users', u);
  const token = newSession(u.id);
  changed('users', u.id);
  res.json({ token, me: me(u) });
});
app.post('/api/auth/demo', (req, res) => {
  const u = USER(req.body?.userId);
  if (!u) return res.status(404).json({ error: 'No such demo user' });
  res.json({ token: newSession(u.id), me: me(u) });
});
app.post('/api/auth/logout', (req, res) => {
  const tok = (req.headers.authorization || '').replace('Bearer ', '');
  delete db.sessions[tok]; save();
  res.json({ ok: true });
});
app.get('/api/demo-accounts', (req, res) => {
  const pick = ['u_demo', 'u_eer_kw', 'u_amc_kw', 'u_swd_fs', 'u_corp_kw', 'u_dmc_zone4', 'u_bmc_comm', 'u_ce_roads', 'u_c_ct01', 'u_c_ct04', 'u_admin'];
  res.json(pick.map(USER).filter(Boolean).map((u) => {
    const held = positionsHeldBy(u.id); const cons = contractorsOf(u.id);
    const role = u.role === 'admin' ? 'Admin' : held.length ? held.map((p) => p.title).join(', ') : cons.length ? `Contractor · ${cons[0].name}` : `Citizen · ${R(u.regionId).shortName || R(u.regionId).name}`;
    return { id: u.id, label: u.role === 'admin' || held.length || cons.length ? u.realName : anonHandle(u), role };
  }));
});

app.get('/api/me', auth, (req, res) => res.json(me(req.user)));
app.post('/api/me/area', auth, (req, res) => {
  if (!R(req.body?.regionId)) return res.status(400).json({ error: 'Unknown area' });
  req.user.regionId = req.body.regionId; changed('users', req.user.id);
  res.json(me(req.user));
});
// Anonymity is a choice: a citizen can show their verified name and photo, or stay behind their handle.
app.post('/api/me/identity', auth, (req, res) => { req.user.showName = !!req.body?.showName && !!req.user.realName; changed('users', req.user.id); res.json(me(req.user)); });
app.post('/api/me/onboarded', auth, (req, res) => { req.user.onboarded = true; changed('users', req.user.id); res.json(me(req.user)); });

app.post('/api/follow', auth, (req, res) => {
  const { type, id, on } = req.body || {};
  const key = { position: 'positions', user: 'users', region: 'regions' }[type];
  if (!key) return res.status(400).json({ error: 'bad type' });
  const list = req.user.following[key];
  const i = list.indexOf(id);
  if (on && i < 0) list.push(id);
  if (!on && i >= 0) list.splice(i, 1);
  if (on && type === 'position') { const p = POS(id); const h = p?.holderUserId; if (h && h !== req.user.id) notify([h], `A citizen started following ${p.title}`, `#/position/${id}`); }
  changed('users', req.user.id);
  res.json(me(req.user));
});

// ---- Feed & posts ----
app.get('/api/feed', (req, res) => {
  const viewer = getUser(req);
  const tab = req.query.tab || 'problems';
  const limit = Math.min(60, Number(req.query.limit) || 40);
  const offset = Number(req.query.offset) || 0;
  let list = db.posts.filter((p) => !HIDDEN.has(p.status));
  if (tab === 'problems') list = list.filter((p) => p.tag === 'problem');
  const ranked = [];
  for (const p of list) {
    const r = rankFor(viewer, p);
    if (tab === 'following' && !r.reasons.includes('Following')) continue;
    ranked.push({ p, ...r });
  }
  ranked.sort((a, b) => b.score - a.score);
  let ordered = ranked;
  if (tab === 'foryou') {
    // Problems stay the majority; the few other post types are mixed in, one every 5th slot.
    const others = ranked.filter((x) => x.p.tag !== 'problem');
    const problems = ranked.filter((x) => x.p.tag === 'problem');
    ordered = [];
    while (problems.length || others.length) {
      if (others.length && (ordered.length % 5 === 2 || !problems.length)) ordered.push(others.shift());
      else ordered.push(problems.shift());
    }
  }
  res.json(ordered.slice(offset, offset + limit).map(({ p, reasons }) => ({ ...decorate(p, viewer), reasons })));
});

app.get('/api/posts', (req, res) => {
  const viewer = getUser(req);
  const { region, subtree: sub, author, position, contractor, tag, project, road, status } = req.query;
  const limit = Math.min(100, Number(req.query.limit) || 50);
  let list = db.posts;
  if (region) { const ids = new Set(sub ? subtree(region) : [region]); list = list.filter((p) => ids.has(p.regionId)); }
  if (author) list = list.filter((p) => p.authorId === author && p.actingAs.type === 'citizen');
  if (position) list = list.filter((p) => (p.actingAs.type === 'position' && p.actingAs.id === position) || p.mentions.some((m) => m.type === 'position' && m.id === position) || p.responsible.some((r) => r.positionId === position));
  if (contractor) list = list.filter((p) => (p.actingAs.type === 'contractor' && p.actingAs.id === contractor) || p.mentions.some((m) => m.type === 'contractor' && m.id === contractor));
  if (project) { const pj = PROJ(project); list = list.filter((p) => p.projectId === project || pj?.linkedProblemIds.includes(p.id)); }
  if (road) list = list.filter((p) => p.roadId === road);
  if (tag) list = list.filter((p) => p.tag === tag);
  if (status === 'open') list = list.filter((p) => ['open', 'in_progress', 'acknowledged'].includes(p.status));
  else if (!req.query.all) list = list.filter((p) => !HIDDEN.has(p.status));
  res.json([...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, limit).map((p) => decorate(p, viewer)));
});

app.get('/api/posts/:id', (req, res) => {
  const viewer = getUser(req);
  const p = POST(req.params.id);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  const comments = db.comments.filter((c) => c.postId === p.id).sort((a, b) => a.createdAt - b.createdAt).map((c) => commentOut(c, viewer));
  const project = db.projects.find((pj) => pj.id === p.projectId || pj.linkedProblemIds.includes(p.id)) || null;
  const workOrders = (p.workOrderIds || []).map(WO).filter(Boolean).map((w) => ({ ...woBrief(w), flagDetails: w.flags, twinId: w.twinId }));
  res.json({ post: decorate(p, viewer), comments, project, workOrders });
});

app.post('/api/posts', auth, (req, res) => {
  const u = req.user;
  const b = req.body || {};
  const actingAs = b.actingAs || { type: 'citizen' };
  const allowed = { citizen: ['problem', 'normal'], position: ['progress'], contractor: ['progress'], admin: ['position_change', 'election', 'normal'] }[actingAs.type];
  if (!allowed || !allowed.includes(b.tag)) return res.status(403).json({ error: `As ${actingAs.type} you can post: ${(allowed || []).join(', ')}` });
  if (actingAs.type === 'position' && POS(actingAs.id)?.holderUserId !== u.id) return res.status(403).json({ error: 'You do not hold this position' });
  if (actingAs.type === 'contractor' && !CON(actingAs.id)?.memberUserIds.includes(u.id)) return res.status(403).json({ error: 'You are not part of this contractor' });
  if (actingAs.type === 'admin' && u.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const title = String(b.title || '').trim();
  const body = String(b.body || '').trim();
  if (title.length < 5) return res.status(400).json({ error: 'Title is too short' });
  if (body.length < 10) return res.status(400).json({ error: 'Please write a little more detail' });

  let regionId = R(b.regionId) ? b.regionId : u.regionId;
  if (actingAs.type === 'position') regionId = POS(actingAs.id).regionId;
  const linked = (b.linkedProblemIds || []).filter((id) => POST(id)?.tag === 'problem');
  if (b.tag === 'progress') {
    if (!linked.length && !b.projectId) return res.status(400).json({ error: 'Progress updates must be linked to problem posts or a project' });
    for (const id of linked) if (!canRespond(u, actingAs, POST(id))) return res.status(403).json({ error: `You are not responsible for "${POST(id).title}"` });
    if (actingAs.type === 'contractor' && b.projectId && PROJ(b.projectId)?.contractorId !== actingAs.id) return res.status(403).json({ error: 'Contractors can only post updates for projects assigned to them' });
  }
  let responsible = [];
  if (b.tag === 'problem') {
    const chosen = (b.responsiblePositionIds || []).filter((id) => POS(id));
    const suggested = suggestResponsible(regionId, b.category || 'Other');
    responsible = (chosen.length ? chosen : suggested).map((positionId) => ({ positionId, assignedBy: ['user', 'rules'].includes(b.responsibleAssignedBy) ? b.responsibleAssignedBy : suggested.includes(positionId) ? 'rules' : 'user' }));
  }
  const road = ROAD(b.roadId);
  const p = {
    id: nextId('post', 'post'), authorId: u.id, actingAs, tag: b.tag, title: title.slice(0, 140), body: body.slice(0, 5000),
    images: (b.images || []).slice(0, 4), mentions: (b.mentions || []).filter((m) => (m.type === 'position' && POS(m.id)) || (m.type === 'contractor' && CON(m.id))),
    linkedProblemIds: linked, workOrderIds: [], upvoteBase: 0, upvotes: [], status: b.tag === 'problem' ? 'open' : null, viewedByPositions: [], respondedByPositions: [],
    responsible, category: b.tag === 'problem' ? (b.category || 'Other') : null, location: b.location || null, regionId, roadId: road ? road.id : null,
    projectId: PROJ(b.projectId) ? b.projectId : null, capturedWithCamera: !!b.capturedWithCamera, source: { type: 'app', channel: 'Revon' },
    moderation: { botVerified: null }, createdAt: Date.now(),
  };
  add('posts', p);
  const actor = actorLabel(actingAs, u.id).title;
  if (b.tag === 'progress') {
    for (const id of linked) {
      const prob = POST(id);
      if (!ix.progressByProblem.has(id)) ix.progressByProblem.set(id, []);
      ix.progressByProblem.get(id).push(p.id);
      const who = actingAs.type === 'position' ? actingAs.id : null;
      if (who && !prob.respondedByPositions.includes(who)) prob.respondedByPositions.push(who);
      if (b.markResolved) prob.status = 'resolved'; else if (prob.status === 'open' || prob.status === 'acknowledged') prob.status = 'in_progress';
      notify([prob.authorId, ...prob.upvotes].filter((x) => x !== u.id), `${actor} posted a progress update on "${prob.title}"`, `#/post/${p.id}`, 'progress');
    }
    if (p.projectId) { const pj = PROJ(p.projectId); for (const id of pj.linkedProblemIds) if (!linked.includes(id)) notify([POST(id)?.authorId], `Project update on "${pj.title}" (linked to your problem)`, `#/post/${p.id}`, 'progress'); }
  }
  if (b.tag === 'problem') notify(responsible.map((r) => POS(r.positionId)?.holderUserId), `New problem in your area: "${p.title}"`, `#/post/${p.id}`, 'problem');
  for (const m of p.mentions) {
    const ids = m.type === 'position' ? [POS(m.id).holderUserId] : CON(m.id).memberUserIds;
    notify(ids.filter((x) => x !== u.id), `${actor} mentioned you in "${p.title}"`, `#/post/${p.id}`, 'mention');
  }
  if (actingAs.type === 'citizen') notify(db.users.filter((x) => x.following.users.includes(u.id)).map((x) => x.id), `A citizen you follow posted: "${p.title}"`, `#/post/${p.id}`, 'follow');
  changed('posts', p.id);
  res.json(decorate(p, u));
});

app.post('/api/posts/:id/upvote', auth, (req, res) => {
  const p = POST(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const i = p.upvotes.indexOf(req.user.id);
  if (i >= 0) p.upvotes.splice(i, 1); else p.upvotes.push(req.user.id);
  changed('posts', p.id);
  res.json({ upvoted: i < 0, upvoteCount: upCount(p) });
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const p = POST(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const actingAs = req.body?.actingAs || { type: 'citizen' };
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Empty comment' });
  if (!canRespond(req.user, actingAs, p)) return res.status(403).json({ error: 'You can only respond on behalf of a position or contractor to posts you are responsible for' });
  const parentId = req.body?.parentId || null;
  const parent = parentId ? db.comments.find((x) => x.id === parentId) : null;
  if (parentId && (!parent || parent.postId !== p.id)) return res.status(400).json({ error: 'The comment you are replying to is not on this post' });
  const c = { id: nextId('comment', 'cm'), postId: p.id, parentId, authorId: req.user.id, actingAs, body: body.slice(0, 2000), upvotes: [], createdAt: Date.now() };
  db.comments.push(c);
  ix.commentCount.set(p.id, (ix.commentCount.get(p.id) || 0) + 1);
  if (actingAs.type === 'position') {
    if (!p.respondedByPositions.includes(actingAs.id)) p.respondedByPositions.push(actingAs.id);
    if (!p.viewedByPositions.includes(actingAs.id)) p.viewedByPositions.push(actingAs.id);
    if (p.status === 'open') p.status = 'acknowledged';
  }
  if (p.authorId !== req.user.id) notify([p.authorId], `${actorLabel(actingAs, req.user.id).title} commented on "${p.title}"`, `#/post/${p.id}`, 'comment');
  if (parent && parent.authorId !== req.user.id && parent.authorId !== p.authorId) notify([parent.authorId], `${actorLabel(actingAs, req.user.id).title} replied to your comment on "${p.title}"`, `#/post/${p.id}`, 'comment');
  changed('posts', p.id);
  res.json(commentOut(c, req.user));
});

app.post('/api/comments/:id/upvote', auth, (req, res) => {
  const c = db.comments.find((x) => x.id === req.params.id);
  if (!c) return res.status(404).json({ error: 'Not found' });
  const ups = (c.upvotes ||= []);
  const i = ups.indexOf(req.user.id);
  if (i >= 0) ups.splice(i, 1); else ups.push(req.user.id);
  changed('posts', c.postId);
  res.json({ upvoted: i < 0, upvoteCount: commentUps(c) });
});

app.post('/api/posts/:id/view', auth, (req, res) => {
  const p = POST(req.params.id); const pos = POS(req.body?.positionId);
  if (!p || !pos || pos.holderUserId !== req.user.id) return res.json({ ok: false });
  if (!p.viewedByPositions.includes(pos.id)) { p.viewedByPositions.push(pos.id); save(); }
  res.json({ ok: true });
});

app.post('/api/posts/:id/status', auth, (req, res) => {
  const p = POST(req.params.id); const pos = POS(req.body?.positionId);
  const ok = ['open', 'acknowledged', 'in_progress', 'resolved'].includes(req.body?.status);
  if (!p || !ok || !pos || !canRespond(req.user, { type: 'position', id: pos.id }, p)) return res.status(403).json({ error: 'Not allowed' });
  p.status = req.body.status;
  notify([p.authorId], `${pos.title} marked your problem "${p.title}" as ${p.status.replace('_', ' ')}`, `#/post/${p.id}`, 'status');
  changed('posts', p.id);
  res.json({ ok: true });
});

app.post('/api/posts/:id/assign', auth, (req, res) => {
  const p = POST(req.params.id);
  const { positionId, actingPositionId } = req.body || {};
  const actor = POS(actingPositionId);
  const isAdmin = req.user.role === 'admin';
  if (!p || !POS(positionId) || (!isAdmin && (!actor || !canRespond(req.user, { type: 'position', id: actor.id }, p)))) return res.status(403).json({ error: 'Not allowed' });
  if (!p.responsible.some((r) => r.positionId === positionId)) p.responsible.push({ positionId, assignedBy: 'person', assignedByUserId: req.user.id });
  notify([POS(positionId).holderUserId], `A problem was assigned to ${POS(positionId).title}: "${p.title}"`, `#/post/${p.id}`, 'problem');
  changed('posts', p.id);
  res.json({ ok: true });
});

app.get('/api/locate', (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const r = Number.isFinite(lat) && Number.isFinite(lng) ? locate(lat, lng) : null;
  if (!r) return res.json({ region: null });
  const positions = chain(r.id).flatMap((rid) => db.positions.filter((p) => p.regionId === rid).sort((a, b) => a.rank - b.rank)).slice(0, 12);
  const contractorIds = [...new Set(positions.flatMap((p) => p.contractorIds))];
  let road = null;
  for (const x of db.roads) { const d = km([lat, lng], x.mid); if (x.regionId === r.id && d < 0.6 && (!road || d < road.d)) road = { id: x.id, name: x.name, segment: x.segment, underDlp: x.underDlp, d }; }
  res.json({ region: r, chain: chain(r.id), positionIds: positions.map((p) => p.id), contractorIds, road });
});

app.get('/api/suggest', (req, res) => {
  const regionId = R(req.query.regionId) ? req.query.regionId : null;
  res.json({ positionIds: regionId ? suggestResponsible(regionId, req.query.category || 'Other') : [], by: 'rules' });
});

// Composer routing: deterministic, rules-based stand-in for AI routing. Reads the post text for a
// category, works out the ward (road > GPS > picked ward > user's ward), maps category to the
// department that owns it, and flags roads under DLP. Returns reasons the composer shows verbatim.
const ROUTE_WORDS = {
  'Pothole': ['pothole', 'potholes', 'crater', 'pit in the road', 'pits'],
  'Road cave-in': ['cave-in', 'cave in', 'caved', 'sinkhole', 'collapsed', 'subsided'],
  'Broken paver blocks': ['paver', 'pavers', 'paving block', 'paver block'],
  'Open or broken manhole': ['manhole', 'manhole cover', 'open chamber'],
  'Waterlogging': ['waterlogging', 'waterlogged', 'water logging', 'flooded', 'flooding', 'flood', 'knee-deep', 'knee deep', 'standing water', 'inundated'],
  'Choked drain / nullah overflow': ['drain', 'drains', 'nullah', 'gutter', 'sewer', 'overflow', 'overflowing', 'choked', 'clogged', 'dirty water'],
  'Streetlights': ['streetlight', 'streetlights', 'street light', 'street lights', 'lamp post', 'no lights'],
  'Garbage': ['garbage', 'trash', 'waste', 'dumping', 'litter', 'rubbish', 'debris', 'stink'],
  'Traffic': ['traffic', 'signal', 'jam', 'congestion', 'parking', 'wrong side'],
  'Road related': ['road', 'footpath', 'divider', 'speed breaker', 'asphalt', 'tar', 'resurfacing', 'uneven'],
};
const ROUTE_DEPT = { 'Pothole': 'Roads', 'Road cave-in': 'Roads', 'Broken paver blocks': 'Roads', 'Road related': 'Roads', 'Waterlogging': 'Storm Water Drains', 'Choked drain / nullah overflow': 'Storm Water Drains', 'Open or broken manhole': 'Storm Water Drains', 'Streetlights': 'the ward office', 'Garbage': 'Solid Waste Management at the ward office', 'Traffic': 'Traffic Police', 'Other': 'the ward office' };
app.post('/api/route-suggest', (req, res) => {
  const b = req.body || {};
  const text = `${b.title || ''} ${b.body || ''}`.toLowerCase();
  let category = CATEGORIES.includes(b.category) ? b.category : 'Other', hits = [];
  let best = 0;
  for (const [cat, words] of b.categoryLocked ? [] : Object.entries(ROUTE_WORDS)) {
    const found = words.filter((w) => new RegExp(`(^|[^a-z])${w.replace(/[-/]/g, '\\$&')}([^a-z]|$)`).test(text));
    if (found.length > best) { best = found.length; category = cat; hits = found; }
  }
  const road = ROAD(b.roadId);
  const loc = b.location && Number.isFinite(+b.location.lat) && Number.isFinite(+b.location.lng) ? locate(+b.location.lat, +b.location.lng) : null;
  const u = getUser(req);
  const [regionId, source] = road ? [road.regionId, `the road (${road.name})`] : loc ? [loc.id, 'your photo/GPS location'] : R(b.regionId) ? [b.regionId, 'the ward you picked'] : [u?.regionId || 'w_K-W', 'your home ward'];
  const reg = R(regionId);
  const levels = chain(regionId);
  const covers = (p) => p.categories.includes(category);
  let primary = null;
  for (const rid of levels) {
    const here = db.positions.filter((p) => p.regionId === rid && covers(p)).sort((a, b2) => a.rank - b2.rank);
    primary = ROUTE_DEPT[category] === 'Traffic Police' ? here.find((p) => /Traffic/.test(p.title)) : ['Roads', 'Storm Water Drains'].includes(ROUTE_DEPT[category]) ? here.find((p) => p.kind === 'department') : here.find((p) => p.isHead);
    if (primary) break;
  }
  primary = primary || POS(suggestResponsible(regionId, category)[0]);
  const reasons = [];
  reasons.push(hits.length ? `Your text mentions ${hits.slice(0, 3).map((h) => `"${h}"`).join(', ')}, so this reads as: ${category}.` : b.categoryLocked ? `You set the category yourself: ${category}.` : `No problem keywords recognised yet, so the selected category is used: ${category}.`);
  if (primary) reasons.push(`${category} is handled by ${({ 'Roads': 'the Roads department', 'Storm Water Drains': 'the Storm Water Drains department' })[ROUTE_DEPT[category]] || ROUTE_DEPT[category] || 'the ward office'}. In ${R(primary.regionId)?.shortName || R(primary.regionId)?.name || 'this area'} that is the ${primary.title}.`);
  reasons.push(`Area: ${reg?.shortName || reg?.name || regionId}, taken from ${source}.`);
  let contractorId = null;
  if (road?.underDlp) {
    const wo = db.workOrders.filter((w) => w.roadId === road.id && w.contractorId).sort((a, b2) => (b2.completedAt || b2.assignedAt || 0) - (a.completedAt || a.assignedAt || 0))[0];
    contractorId = wo?.contractorId || null;
    reasons.push(`${road.name} (segment ${road.segment}) is under its Defect Liability Period: the contractor must repair it at no cost to BMC${contractorId ? `. Latest contractor on record: ${conName(contractorId)}` : ''}.`);
  }
  const alternatives = [...new Set([...suggestResponsible(regionId, category), ...levels.slice(0, 3).flatMap((rid) => db.positions.filter((p) => p.regionId === rid && covers(p)).sort((a, b2) => a.rank - b2.rank).map((p) => p.id))])].filter((id) => id !== primary?.id).slice(0, 6);
  res.json({ positionId: primary?.id || null, reasons, alternatives, category, keywords: hits, regionId, contractorId, confidence: hits.length && (road || loc) ? 'high' : hits.length ? 'medium' : 'low', by: 'rules' });
});

// ---- Follow the rupee ----
app.get('/api/money/:regionId', (req, res) => {
  const r = R(req.params.regionId);
  if (!r) return res.status(404).json({ error: 'Unknown area' });
  if (!wardsUnder(r.id).length) return res.json({ none: true });
  const m = moneyFor(r.id);
  res.json({ ...m, summary: r.type === 'ward' ? wardScorecard(db, r, m) : null });
});
app.get('/api/planner/:regionId', (req, res) => {
  const r = R(req.params.regionId);
  if (!r) return res.status(404).json({ error: 'Unknown area' });
  const wards = wardsUnder(r.id);
  if (!wards.length) return res.json({ none: true });
  res.json(planner(db, wards, moneyFor));
});
app.get('/api/scorecards', (req, res) => res.json(db.contractors.map((c) => ({ ...contractorScorecard(db, c), name: c.name })).filter((x) => x.jobs).sort((a, b) => b.score - a.score)));
app.get('/api/contractors/:id/scorecard', (req, res) => { const c = CON(req.params.id); res.json(c ? contractorScorecard(db, c) : null); });

app.get('/api/workorders', (req, res) => {
  const { region, contractor, road, flag } = req.query;
  let list = db.workOrders;
  if (region) { const ids = new Set(subtree(region)); list = list.filter((w) => ids.has(w.regionId)); }
  if (contractor) list = list.filter((w) => w.contractorId === contractor);
  if (road) list = list.filter((w) => w.roadId === road);
  if (flag === 'any') list = list.filter((w) => w.flags.some((f) => f.severity === 'high'));
  else if (flag) list = list.filter((w) => w.flags.some((f) => f.type === flag));
  const total = list.length;
  const amount = list.reduce((a, w) => a + w.cost, 0);
  res.json({ total, amount, items: [...list].sort((a, b) => b.completedAt - a.completedAt).slice(0, Number(req.query.limit) || 60).map((w) => ({ ...woBrief(w), roadName: ROAD(w.roadId)?.name, wardCode: w.wardCode, workType: w.workType, flagDetails: w.flags })) });
});
app.get('/api/workorders/:id', (req, res) => {
  const w = WO(req.params.id);
  if (!w) return res.status(404).json({ error: 'Work order not found' });
  const road = ROAD(w.roadId);
  const sameRoad = db.workOrders.filter((o) => o.roadId === w.roadId && o.id !== w.id).sort((a, b) => a.completedAt - b.completedAt).map(woBrief);
  res.json({ workOrder: { ...w, contractorName: conName(w.contractorId) }, road, complaints: w.complaintIds.map(POST).filter(Boolean).map((p) => decorate(p)), sameRoad, rain: { assigned: ref.rain[new Date(w.assignedAt + 5.5 * 3600e3).toISOString().slice(0, 10)] || null } });
});
app.get('/api/roads/:id', (req, res) => {
  const road = ROAD(req.params.id);
  if (!road) return res.status(404).json({ error: 'Road not found' });
  const info = roadInfo(db, road);
  const complaints = db.posts.filter((p) => p.tag === 'problem' && p.roadId === road.id);
  res.json({ ...info, workOrders: info.workOrders.sort((a, b) => b.completedAt - a.completedAt).map((w) => ({ ...woBrief(w), workType: w.workType })), complaintCount: complaints.length, openCount: complaints.filter((p) => ['open', 'in_progress'].includes(p.status)).length });
});
app.get('/api/positions/:id/stats', (req, res) => {
  const pos = POS(req.params.id);
  if (!pos) return res.status(404).json({ error: 'Not found' });
  const area = new Set(subtree(pos.regionId));
  const problems = db.posts.filter((p) => p.tag === 'problem' && !HIDDEN.has(p.status) && (p.responsible.some((r) => r.positionId === pos.id)));
  const updates = db.posts.filter((p) => p.actingAs.type === 'position' && p.actingAs.id === pos.id).length;
  res.json({ problems: problems.length, open: problems.filter((p) => ['open', 'in_progress', 'acknowledged'].includes(p.status)).length, responded: problems.filter((p) => p.respondedByPositions.includes(pos.id)).length, updates, projects: db.projects.filter((pj) => pj.positionId === pos.id || area.has(pj.regionId)).length });
});

// ---- Stories (positions & contractors post short updates; followers see them, 24 h) ----
const STORY_TTL = 24 * 3600e3;
// Joint "solved" stories: 2–3 authorities announce together that one problem is solved. They stay up for a week.
const JOINT_TTL = 7 * 24 * 3600e3;
const isJoint = (st) => st.type === 'joint_solved';
function jointGroup(st, viewer) {
  const prob = POST(st.problemPostId);
  const authors = st.authors.map((a) => { const p = POS(a.id); return { type: 'position', id: a.id, title: p?.title || 'Position', person: publicUser(USER(p?.holderUserId))?.name || null }; });
  return {
    key: 'joint:' + st.id, joint: true, actor: { type: 'joint' }, title: 'Solved', person: authors.map((a) => a.person).filter(Boolean).join(', '), authors,
    problem: prob ? { id: prob.id, title: prob.title, status: prob.status } : null,
    items: [{ id: st.id, text: st.text, createdAt: st.createdAt, seen: !!viewer && st.seenBy.includes(viewer.id) }],
  };
}
app.get('/api/stories', (req, res) => {
  const viewer = getUser(req);
  const all = (db.stories || []).filter((st) => Date.now() - st.createdAt < (isJoint(st) ? JOINT_TTL : STORY_TTL));
  const live = all.filter((st) => !isJoint(st));
  const seesJoint = (st) => { if (!viewer) return false; const prob = POST(st.problemPostId); return st.authors.some((a) => viewer.following.positions.includes(a.id) || POS(a.id)?.holderUserId === viewer.id) || prob?.authorId === viewer.id || prob?.upvotes.includes(viewer.id); };
  const joint = all.filter((st) => isJoint(st) && seesJoint(st)).sort((a, b) => b.createdAt - a.createdAt).map((st) => jointGroup(st, viewer));
  const follows = (st) => viewer && ((st.actor.type === 'position' && viewer.following.positions.includes(st.actor.id)) || (st.actor.type === 'contractor' && (viewer.contractorsFollowed || []).includes(st.actor.id)) || st.authorId === viewer.id);
  const groups = {};
  for (const st of live.filter(follows).sort((a, b) => a.createdAt - b.createdAt)) {
    const k = st.actor.type + ':' + st.actor.id;
    const label = st.actor.type === 'position' ? POS(st.actor.id)?.title : CON(st.actor.id)?.name;
    (groups[k] ||= { key: k, actor: st.actor, title: label, person: publicUser(USER(st.authorId))?.name, items: [] }).items.push({ id: st.id, text: st.text, createdAt: st.createdAt, seen: st.seenBy.includes(viewer.id) });
  }
  const list = Object.values(groups).sort((a, b) => (a.items.every((i) => i.seen) - b.items.every((i) => i.seen)) || b.items.at(-1).createdAt - a.items.at(-1).createdAt);
  const unseenIn = (gs) => gs.reduce((n, g) => n + g.items.filter((i) => !i.seen).length, 0);
  res.json({ groups: [...list, ...joint], unseen: unseenIn(list), jointUnseen: unseenIn(joint) });
});
// Publish a joint solved story. The acting user must hold one of the 2–3 listed positions,
// and every listed position must be responsible for (or above) the problem's area.
app.post('/api/stories/joint', auth, (req, res) => {
  const b = req.body || {};
  const raw = Array.isArray(b.positionIds) ? b.positionIds.map(String) : [];
  const ids = [...new Set(raw)];
  if (ids.length !== raw.length || ids.length < 2 || ids.length > 3) return res.status(400).json({ error: 'Pick 2 or 3 different authorities' });
  const list = ids.map((id) => POS(id));
  if (list.some((p) => !p)) return res.status(400).json({ error: 'Unknown position' });
  const prob = POST(b.problemPostId);
  if (!prob || prob.tag !== 'problem') return res.status(404).json({ error: 'Problem post not found' });
  const mine = list.find((p) => p.holderUserId === req.user.id && (!b.actingPositionId || p.id === b.actingPositionId));
  if (!mine) return res.status(403).json({ error: 'You must hold one of the listed positions' });
  const far = list.find((p) => !(prob.responsible.some((r) => r.positionId === p.id) || inSubtree(prob.regionId, p.regionId) || prob.mentions.some((m) => m.type === 'position' && m.id === p.id)));
  if (far) return res.status(403).json({ error: `${far.title} is not responsible for this area` });
  const text = String(b.text || '').trim();
  if (text.length < 10) return res.status(400).json({ error: 'Say what was done (at least 10 characters)' });
  const st = { id: 'js_' + crypto.randomBytes(4).toString('hex'), type: 'joint_solved', authors: ids.map((id) => ({ type: 'position', id })), problemPostId: prob.id, text: text.slice(0, 400), authorId: req.user.id, createdAt: Date.now(), seenBy: [] };
  (db.stories ||= []).push(st);
  for (const p of list) if (!prob.respondedByPositions.includes(p.id)) prob.respondedByPositions.push(p.id);
  if (b.markResolved && prob.status !== 'resolved') { prob.status = 'resolved'; prob.resolvedAt = Date.now(); }
  const others = list.length - 1;
  notify([prob.authorId, ...prob.upvotes].filter((x) => x !== req.user.id), `${mine.title} and ${others} other ${others === 1 ? 'authority' : 'authorities'} published a joint story: "${prob.title}" is solved`, `#/post/${prob.id}`, 'joint_solved');
  notify(list.filter((p) => p !== mine).map((p) => p.holderUserId).filter((x) => x !== req.user.id), `${mine.title} published a joint solved story with you on "${prob.title}"`, `#/post/${prob.id}`, 'joint_solved');
  changed('posts', prob.id);
  changed('stories', st.id);
  res.json(jointGroup(st, req.user));
});
app.post('/api/stories', auth, (req, res) => {
  const a = req.body?.actingAs || {};
  const ok = (a.type === 'position' && POS(a.id)?.holderUserId === req.user.id) || (a.type === 'contractor' && CON(a.id)?.memberUserIds.includes(req.user.id));
  const text = String(req.body?.text || '').trim();
  if (!ok) return res.status(403).json({ error: 'Only positions and contractors can post stories' });
  if (text.length < 5) return res.status(400).json({ error: 'Story is too short' });
  const st = { id: 'st_' + crypto.randomBytes(4).toString('hex'), actor: { type: a.type, id: a.id }, authorId: req.user.id, text: text.slice(0, 280), createdAt: Date.now(), seenBy: [] };
  (db.stories ||= []).push(st);
  changed('stories', st.id);
  res.json(st);
});
app.post('/api/stories/:id/seen', auth, (req, res) => {
  const st = (db.stories || []).find((x) => x.id === req.params.id);
  if (st && !st.seenBy.includes(req.user.id)) { st.seenBy.push(req.user.id); save(); }
  res.json({ ok: true });
});
app.post('/api/follow-contractor', auth, (req, res) => {
  const list = (req.user.contractorsFollowed ||= []);
  const i = list.indexOf(req.body?.id);
  if (req.body?.on && i < 0 && CON(req.body.id)) list.push(req.body.id);
  if (!req.body?.on && i >= 0) list.splice(i, 1);
  changed('users', req.user.id);
  res.json(me(req.user));
});

// ---- Dashboards ----
app.get('/api/dashboard/position/:id', auth, (req, res) => {
  const pos = POS(req.params.id);
  if (!pos || (pos.holderUserId !== req.user.id && req.user.role !== 'admin')) return res.status(403).json({ error: 'Not your position' });
  const area = new Set(subtree(pos.regionId));
  const problems = db.posts.filter((p) => p.tag === 'problem' && !HIDDEN.has(p.status) && (p.responsible.some((r) => r.positionId === pos.id) || area.has(p.regionId)));
  const scored = problems.map((p) => ({ p, s: hot(p) * (p.responsible.some((r) => r.positionId === pos.id) ? 1.5 : 1) * (p.status === 'resolved' ? 0.1 : 1) * typeWeight(p) })).sort((a, b) => b.s - a.s);
  const mark = (p) => ({ viewed: p.viewedByPositions.includes(pos.id), responded: p.respondedByPositions.includes(pos.id) });
  const counts = { total: problems.length, unviewed: 0, unresponded: 0, resolved: 0, open: 0 };
  for (const p of problems) { const m = mark(p); if (!m.viewed) counts.unviewed++; if (p.status === 'resolved') counts.resolved++; else { counts.open++; if (!m.responded) counts.unresponded++; } }
  const f = req.query.filter;
  const filtered = scored.filter(({ p }) => { const m = mark(p); return !f || f === 'all' || (f === 'unviewed' && !m.viewed) || (f === 'unresponded' && !m.responded && p.status !== 'resolved') || (f === 'mine' && p.responsible.some((r) => r.positionId === pos.id)) || (f === 'open' && p.status !== 'resolved'); });
  res.json({
    position: pos, counts,
    problems: filtered.slice(0, 80).map(({ p }) => ({ ...decorate(p, req.user), assignedToMe: p.responsible.some((r) => r.positionId === pos.id), ...mark(p) })),
    projects: db.projects.filter((pj) => pj.positionId === pos.id || area.has(pj.regionId)),
  });
});

// ---- Projects ----
app.post('/api/projects', auth, (req, res) => {
  const b = req.body || {};
  const pos = POS(b.positionId);
  if (!pos || pos.holderUserId !== req.user.id) return res.status(403).json({ error: 'Create projects from a position you hold' });
  if (!b.title || !(Number(b.budget) > 0)) return res.status(400).json({ error: 'Title and budget required' });
  const pj = {
    id: nextId('project', 'pj'), title: String(b.title).slice(0, 140), description: String(b.description || '').slice(0, 3000), category: b.category || 'Pothole',
    regionId: R(b.regionId) && inSubtree(b.regionId, pos.regionId) ? b.regionId : pos.regionId, roadId: ROAD(b.roadId) ? b.roadId : null, positionId: pos.id,
    approvedByPositionId: pos.id, approvedByUserId: req.user.id, contractorId: CON(b.contractorId) ? b.contractorId : null,
    budget: Number(b.budget), spent: 0, status: CON(b.contractorId) ? 'in_progress' : 'bidding',
    linkedProblemIds: (b.linkedProblemIds || []).filter((id) => POST(id)?.tag === 'problem'), bids: [], startDate: CON(b.contractorId) ? Date.now() : null, endDate: null, createdAt: Date.now(),
  };
  add('projects', pj);
  for (const id of pj.linkedProblemIds) { const prob = POST(id); notify([prob.authorId, ...prob.upvotes], `Your problem "${prob.title}" was added to project "${pj.title}"`, `#/project/${pj.id}`, 'project'); if (prob.status === 'open' || prob.status === 'acknowledged') prob.status = 'in_progress'; if (!prob.respondedByPositions.includes(pos.id)) prob.respondedByPositions.push(pos.id); }
  if (pj.contractorId) notify(CON(pj.contractorId).memberUserIds, `You were assigned project "${pj.title}"`, `#/project/${pj.id}`, 'project');
  else notify(db.contractors.filter((c) => c.regionIds.some((r) => inSubtree(pj.regionId, r))).flatMap((c) => c.memberUserIds), `New project open for bids: "${pj.title}"`, `#/project/${pj.id}`, 'project');
  changed('projects', pj.id);
  res.json(pj);
});
app.post('/api/projects/:id/link', auth, (req, res) => {
  const pj = PROJ(req.params.id); const pos = POS(pj?.positionId);
  if (!pj || pos?.holderUserId !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  for (const id of req.body?.problemIds || []) if (POST(id)?.tag === 'problem' && !pj.linkedProblemIds.includes(id)) { pj.linkedProblemIds.push(id); const prob = POST(id); notify([prob.authorId], `Your problem "${prob.title}" was added to project "${pj.title}"`, `#/project/${pj.id}`, 'project'); if (prob.status === 'open' || prob.status === 'acknowledged') prob.status = 'in_progress'; }
  changed('projects', pj.id);
  res.json(pj);
});
app.post('/api/projects/:id/bids', auth, (req, res) => {
  const pj = PROJ(req.params.id); const c = CON(req.body?.contractorId);
  if (!pj || !c || !c.memberUserIds.includes(req.user.id)) return res.status(403).json({ error: 'Not allowed' });
  if (pj.status !== 'bidding') return res.status(400).json({ error: 'Bidding is closed' });
  pj.bids = pj.bids.filter((x) => x.contractorId !== c.id);
  pj.bids.push({ contractorId: c.id, amount: Number(req.body.amount), timelineDays: Number(req.body.timelineDays), note: String(req.body.note || '').slice(0, 300), at: Date.now() });
  notify([POS(pj.positionId)?.holderUserId], `${c.name} placed a bid on "${pj.title}"`, `#/project/${pj.id}`, 'project');
  changed('projects', pj.id);
  res.json(pj);
});
app.post('/api/projects/:id/award', auth, (req, res) => {
  const pj = PROJ(req.params.id); const pos = POS(pj?.positionId); const c = CON(req.body?.contractorId);
  if (!pj || !c || pos?.holderUserId !== req.user.id) return res.status(403).json({ error: 'Only the responsible position can award' });
  const reason = String(req.body?.reason || '').trim();
  if (reason.length < 20) return res.status(400).json({ error: 'Explain publicly why this contractor won (at least 20 characters)' });
  pj.awardReason = reason.slice(0, 1000); pj.awardedAt = Date.now();
  pj.contractorId = c.id; pj.status = 'in_progress'; pj.startDate = Date.now(); pj.approvedByUserId = req.user.id; pj.approvedByPositionId = pos.id;
  notify(c.memberUserIds, `You won the bid for "${pj.title}"`, `#/project/${pj.id}`, 'project');
  notify(pj.linkedProblemIds.map((id) => POST(id)?.authorId), `Contractor ${c.name} assigned to fix "${pj.title}"`, `#/project/${pj.id}`, 'project');
  changed('projects', pj.id);
  res.json(pj);
});
app.post('/api/projects/:id/update', auth, (req, res) => {
  const pj = PROJ(req.params.id); const pos = POS(pj?.positionId);
  if (!pj || pos?.holderUserId !== req.user.id) return res.status(403).json({ error: 'Not allowed' });
  if (req.body.spent != null) pj.spent = Number(req.body.spent);
  if (['bidding', 'in_progress', 'completed'].includes(req.body.status)) { pj.status = req.body.status; if (pj.status === 'completed') pj.endDate = Date.now(); }
  changed('projects', pj.id);
  res.json(pj);
});

app.post('/api/positions/:id/contractors', auth, (req, res) => {
  const pos = POS(req.params.id); const c = CON(req.body?.contractorId);
  if (!pos || !c || (pos.holderUserId !== req.user.id && req.user.role !== 'admin')) return res.status(403).json({ error: 'Not allowed' });
  if (req.body.remove) pos.contractorIds = pos.contractorIds.filter((x) => x !== c.id);
  else if (!pos.contractorIds.includes(c.id)) {
    pos.contractorIds.push(c.id);
    c.assignedBy.push({ positionId: pos.id, regionId: pos.regionId, at: Date.now() });
    if (!c.regionIds.some((r) => inSubtree(pos.regionId, r))) c.regionIds.push(pos.regionId);
    notify(c.memberUserIds, `${pos.title} added you as an assigned contractor`, `#/contractor/${c.id}`, 'project');
  }
  changed('positions', pos.id);
  res.json(pos);
});

// ---- Admin & area head ----
const isHeadOf = (user, regionId) => db.positions.some((p) => p.regionId === regionId && p.isHead && p.holderUserId === user.id);

app.post('/api/admin/assign', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const pos = POS(req.body?.positionId);
  const u = req.body?.userId ? USER(req.body.userId) : null;
  if (!pos || (req.body?.userId && !u)) return res.status(400).json({ error: 'Bad position or user' });
  const prev = pos.holderUserId ? USER(pos.holderUserId) : null;
  pos.holderUserId = u ? u.id : null;
  if (u && req.body.party !== undefined) u.party = req.body.party || null;
  if (u) {
    if (!u.realName) u.realName = anonHandle(u);
    notify([u.id], `You have been assigned the position ${pos.title}`, `#/position/${pos.id}`, 'position');
    const p = { id: nextId('post', 'post'), authorId: req.user.id, actingAs: { type: 'admin' }, tag: 'position_change', title: `${u.realName} is now ${pos.title}`, body: `${u.realName}${u.party ? ` (${u.party})` : ''} has taken charge as ${pos.title}${prev ? `, succeeding ${prev.realName}` : ''}. Responsibilities: ${pos.responsibilities.join('; ')}.`, images: [], mentions: [{ type: 'position', id: pos.id }], linkedProblemIds: [], workOrderIds: [], upvoteBase: 0, upvotes: [], status: null, viewedByPositions: [], respondedByPositions: [], responsible: [], category: null, location: null, regionId: pos.regionId, roadId: null, projectId: null, moderation: { botVerified: null }, createdAt: Date.now() };
    add('posts', p);
    notify(db.users.filter((x) => x.following.positions.includes(pos.id)).map((x) => x.id), `Position change: ${p.title}`, `#/post/${p.id}`, 'position');
  }
  changed('positions', pos.id);
  res.json(pos);
});

app.post('/api/admin/positions', auth, (req, res) => {
  const b = req.body || {};
  if (!R(b.regionId)) return res.status(400).json({ error: 'Unknown area' });
  if (req.user.role !== 'admin' && !isHeadOf(req.user, b.regionId)) return res.status(403).json({ error: "Only admins or the area's fixed head position can edit area positions" });
  if (!b.title) return res.status(400).json({ error: 'Title required' });
  const p = { id: nextId('position', 'p_new'), regionId: b.regionId, title: String(b.title).slice(0, 100), kind: ['elected', 'appointed', 'department'].includes(b.kind) ? b.kind : 'appointed', holderUserId: null, categories: (b.categories || []).filter((c) => CATEGORIES.includes(c)), responsibilities: (b.responsibilities || []).map(String).filter(Boolean).slice(0, 8), budget: Number(b.budget) || 0, contractorIds: [], isHead: false, rank: 4, createdAt: Date.now() };
  add('positions', p);
  changed('positions', p.id);
  res.json(p);
});

app.post('/api/admin/contractors', auth, (req, res) => {
  const b = req.body || {};
  const pos = POS(b.positionId);
  if (!(req.user.role === 'admin' || (pos && pos.holderUserId === req.user.id))) return res.status(403).json({ error: 'Not allowed' });
  const members = (b.memberUserIds || []).filter((id) => USER(id));
  if (!b.name || !members.length) return res.status(400).json({ error: 'Name and at least one member required' });
  const c = { id: nextId('contractor', 'c'), name: String(b.name).slice(0, 100), type: ['company', 'individual', 'group'].includes(b.type) ? b.type : 'company', memberUserIds: members, regionIds: [pos ? pos.regionId : (R(b.regionId) ? b.regionId : 'r_bmc')], specialties: (b.specialties || []).filter((x) => CATEGORIES.includes(x)), gstin: '', assignedBy: pos ? [{ positionId: pos.id, regionId: pos.regionId, at: Date.now() }] : [], createdAt: Date.now() };
  add('contractors', c);
  if (pos) pos.contractorIds.push(c.id);
  notify(members, `You were registered as part of contractor "${c.name}"`, `#/contractor/${c.id}`, 'project');
  changed('contractors', c.id);
  res.json(c);
});

app.get('/api/admin/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const q = String(req.query.q || '').toLowerCase();
  const out = [];
  for (const u of db.users) { if (out.length >= 30) break; const name = u.realName || anonHandle(u); if (!q || name.toLowerCase().includes(q) || anonHandle(u).toLowerCase().includes(q)) out.push({ id: u.id, realName: name, handle: anonHandle(u), regionId: u.regionId, role: u.role }); }
  res.json(out);
});
app.get('/api/admin/assignments', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(db.posts.filter((p) => p.tag === 'problem' && !HIDDEN.has(p.status)).sort((a, b) => b.createdAt - a.createdAt).slice(0, 60).map((p) => ({ id: p.id, title: p.title, regionName: R(p.regionId)?.shortName || R(p.regionId)?.name, categoryReported: p.categoryReported, category: p.category, responsible: p.responsible.map((r) => ({ ...r, title: POS(r.positionId)?.title, assignedByName: r.assignedByUserId ? USER(r.assignedByUserId)?.realName : null })) })));
});

// ---- Notifications ----
app.get('/api/notifications', auth, (req, res) => res.json(db.notifications.filter((n) => n.userId === req.user.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100)));
app.post('/api/notifications/read', auth, (req, res) => { for (const n of db.notifications) if (n.userId === req.user.id) n.read = true; save(); res.json({ ok: true }); });

app.get('/api/people/:id', (req, res) => {
  const u = USER(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const viewer = getUser(req);
  res.json({ person: publicUser(u), followers: db.users.filter((x) => x.following.users.includes(u.id)).length, isMe: viewer?.id === u.id });
});

app.post('/api/upload', auth, (req, res) => {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(req.body?.dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Unsupported image' });
  const name = crypto.randomBytes(10).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
  res.json({ url: '/uploads/' + name });
});

app.get(/^\/(?!api|uploads|vendor).*/, (req, res) => res.sendFile(path.join(ROOT, 'public/index.html')));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
