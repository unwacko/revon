import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { buildSeed, LEVELS, CATEGORIES } from './seed.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const PORT = Number(process.env.PORT || 3000);

fs.mkdirSync(UPLOAD_DIR, { recursive: true });

// ---------------- Persistence (JSON file; swap for Postgres when moving to cloud) ----------------
let db;
if (process.argv.includes('--reset') || !fs.existsSync(DB_FILE)) {
  db = buildSeed();
  fs.writeFileSync(DB_FILE, JSON.stringify(db));
  console.log('Seeded database at', DB_FILE);
} else {
  db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}
let saveTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    const tmp = DB_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(db));
    fs.renameSync(tmp, DB_FILE);
  }, 150);
}

// ---------------- Live sync (Server-Sent Events) ----------------
const clients = new Set();
function broadcast(entity, id) {
  const msg = `data: ${JSON.stringify({ entity, id, at: Date.now() })}\n\n`;
  for (const res of clients) res.write(msg);
}
function changed(entity, id) { save(); broadcast(entity, id); }

// ---------------- Helpers ----------------
const byId = (arr, id) => arr.find((x) => x.id === id);
const R = (id) => byId(db.regions, id);
const POS = (id) => byId(db.positions, id);
const USER = (id) => byId(db.users, id);
const CON = (id) => byId(db.contractors, id);
const PROJ = (id) => byId(db.projects, id);
const POST = (id) => byId(db.posts, id);
const nextId = (kind, prefix) => `${prefix}_${++db.counters[kind]}`;
const depth = (regionId) => LEVELS[R(regionId)?.type]?.depth ?? 9;

function chain(regionId) {
  const out = [];
  let r = R(regionId);
  while (r) { out.push(r.id); r = R(r.parentId); }
  return out; // [self, parent, ..., nation]
}
function subtree(regionId) {
  const out = [regionId];
  for (let i = 0; i < out.length; i++) for (const r of db.regions) if (r.parentId === out[i]) out.push(r.id);
  return out;
}
const inSubtree = (regionId, ancestorId) => chain(regionId).includes(ancestorId);
const positionsHeldBy = (userId) => db.positions.filter((p) => p.holderUserId === userId);
const contractorsOf = (userId) => db.contractors.filter((c) => c.memberUserIds.includes(userId));
const anonHandle = (u) => 'Citizen ' + crypto.createHash('sha1').update(u.id).digest('hex').slice(0, 5).toUpperCase();

// Public view of a person. Plain citizens stay anonymous.
function publicUser(u) {
  if (!u) return null;
  const held = positionsHeldBy(u.id);
  const cons = contractorsOf(u.id);
  if (u.role === 'admin') return { id: u.id, kind: 'admin', name: 'Platform Admin', regionId: u.regionId };
  if (held.length || cons.length) {
    return { id: u.id, kind: 'public', name: u.realName, party: u.party || null, regionId: u.regionId, positionIds: held.map((p) => p.id), contractorIds: cons.map((c) => c.id) };
  }
  return { id: u.id, kind: 'anon', name: anonHandle(u), regionId: u.regionId };
}

function suggestResponsible(regionId, category) {
  // Rule-based stand-in for the future AI layer: walk up from the post's area and
  // pick the lowest-level positions whose remit covers the category.
  // Prefers: the area's head, then specialists (narrow remit) nearest first.
  const out = [];
  const covers = (p) => p.categories.includes(category);
  chain(regionId).forEach((rid, level) => {
    const here = db.positions.filter((p) => p.regionId === rid && covers(p));
    const head = here.find((p) => p.isHead);
    if (level === 0 && head) out.push(head.id);
    here.filter((p) => !p.isHead && p.categories.length <= 2).sort((a, b) => a.categories.length - b.categories.length || a.rank - b.rank).forEach((p) => out.push(p.id));
  });
  for (const rid of chain(regionId).slice(0, 3)) {
    if (out.length >= 2) break;
    db.positions.filter((p) => p.regionId === rid && covers(p) && !out.includes(p.id)).sort((a, b) => a.rank - b.rank).slice(0, 2 - out.length).forEach((p) => out.push(p.id));
  }
  out.splice(3);
  if (!out.length) { const head = db.positions.find((p) => p.regionId === regionId && p.isHead); if (head) out.push(head.id); }
  return out;
}

function locate(lat, lng) {
  const dist = (a, b) => {
    const toRad = (x) => (x * Math.PI) / 180;
    const dLat = toRad(b[0] - a[0]), dLng = toRad(b[1] - a[1]);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
    return 6371 * 2 * Math.asin(Math.sqrt(h));
  };
  // deepest region whose circle contains the point; fall back to nearest leaf
  let best = null;
  for (const r of db.regions) {
    const d = dist([lat, lng], r.center);
    if (d <= r.radiusKm && (!best || depth(r.id) > depth(best.r.id) || (depth(r.id) === depth(best.r.id) && d < best.d))) best = { r, d };
  }
  if (!best || depth(best.r.id) < 4) {
    const leaves = db.regions.filter((r) => !db.regions.some((c) => c.parentId === r.id));
    let near = null;
    for (const r of leaves) { const d = dist([lat, lng], r.center); if (!near || d < near.d) near = { r, d }; }
    if (near && near.d < 25) best = near;
  }
  return best?.r || null;
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
    id: u.id, role: u.role, realName: u.realName, regionId: u.regionId, verified: u.verified, onboarded: u.onboarded,
    following: u.following, handle: publicUser(u).name, party: u.party || null,
    positionIds: positionsHeldBy(u.id).map((p) => p.id), contractorIds: contractorsOf(u.id).map((c) => c.id),
  };
}

// Can this acting identity respond (comment / progress) on a given post?
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
    return db.projects.some((pj) => projIds.includes(pj.id) && pj.linkedProblemIds.includes(post.id)) || (post.projectId && projIds.includes(post.projectId)) || post.mentions.some((m) => m.type === 'contractor' && m.id === c.id);
  }
  return false;
}

function notify(userIds, text, link, type = 'info') {
  for (const userId of new Set(userIds)) {
    db.notifications.push({ id: nextId('notif', 'n'), userId, type, text, link, read: false, createdAt: Date.now() });
  }
}

function actorLabel(actingAs, authorId) {
  if (actingAs.type === 'position') { const p = POS(actingAs.id); return { type: 'position', id: p?.id, title: p ? `${p.title}, ${R(p.regionId)?.name}` : 'Position', person: publicUser(USER(authorId)) }; }
  if (actingAs.type === 'contractor') { const c = CON(actingAs.id); return { type: 'contractor', id: c?.id, title: c?.name || 'Contractor', person: publicUser(USER(authorId)) }; }
  if (actingAs.type === 'admin') return { type: 'admin', title: 'Platform Admin' };
  return { type: 'citizen', person: publicUser(USER(authorId)), title: publicUser(USER(authorId))?.name };
}

function decorate(p, viewer) {
  const commentCount = db.comments.filter((c) => c.postId === p.id).length;
  return {
    ...p,
    author: actorLabel(p.actingAs, p.authorId),
    regionName: R(p.regionId)?.name,
    upvoteCount: p.upvotes.length,
    upvoted: viewer ? p.upvotes.includes(viewer.id) : false,
    upvotes: undefined,
    commentCount,
    linkedProblems: p.linkedProblemIds.map((id) => { const x = POST(id); return x && { id: x.id, title: x.title, status: x.status }; }).filter(Boolean),
    progressUpdates: p.tag === 'problem' ? db.posts.filter((x) => x.tag === 'progress' && x.linkedProblemIds.includes(p.id)).map((x) => ({ id: x.id, title: x.title, createdAt: x.createdAt })) : [],
  };
}

// ---------------- Ranking ----------------
// Score = recency-decayed engagement × proximity × follow boost × type weight.
// Lower (closer) areas beat higher areas; followed beats non-followed.
function hot(p) {
  const engagement = p.upvotes.length + 0.5 * db.comments.filter((c) => c.postId === p.id).length;
  const ageH = (Date.now() - p.createdAt) / 3600000;
  return (1 + Math.log2(1 + engagement)) / Math.pow(ageH + 2, 0.6);
}
function rankFor(viewer, p) {
  const reasons = [];
  let prox = 0.12;
  if (viewer) {
    const myChain = chain(viewer.regionId);
    const postChain = chain(p.regionId);
    if (p.regionId === viewer.regionId) { prox = 1; reasons.push('Your area'); }
    else if (myChain.includes(p.regionId)) { prox = 0.4 + 0.4 * (depth(p.regionId) / Math.max(1, depth(viewer.regionId))); reasons.push('Covers your area'); }
    else {
      const lca = postChain.find((id) => myChain.includes(id));
      if (lca) { prox = 0.15 + 0.35 * (depth(lca) / Math.max(1, depth(viewer.regionId))); if (depth(lca) >= 4) reasons.push('Nearby'); }
    }
    const f = viewer.following;
    let followed = false;
    if (f.users.includes(p.authorId)) followed = true;
    if (p.actingAs.type === 'position' && f.positions.includes(p.actingAs.id)) followed = true;
    if (p.mentions.some((m) => m.type === 'position' && f.positions.includes(m.id))) followed = true;
    if (p.responsible.some((r) => f.positions.includes(r.positionId))) followed = true;
    if (f.regions.includes(p.regionId)) followed = true;
    if (followed) reasons.push('Following');
    var followBoost = followed ? 1.7 : 1;
  }
  const typeW = { problem: 1.15, progress: 1.2, position_change: 1.0, election: 1.1, normal: 0.85 }[p.tag] || 1;
  return { score: hot(p) * prox * (followBoost || 1) * typeW, reasons };
}

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

// Everything public & small: hierarchy, positions, contractors, projects, public people
app.get('/api/meta', (req, res) => {
  const viewer = getUser(req);
  const people = {};
  for (const u of db.users) { const pu = publicUser(u); if (pu.kind !== 'anon') people[u.id] = pu; }
  res.json({
    levels: LEVELS, categories: CATEGORIES,
    regions: db.regions, positions: db.positions, contractors: db.contractors, people,
    projects: db.projects.map((pj) => ({ ...pj })),
    me: viewer ? me(viewer) : null,
  });
});

// ---- Auth ----
// DigiLocker is mocked: in production this is the OAuth flow returning a verified Aadhaar address.
app.post('/api/auth/digilocker', (req, res) => {
  const { name, regionId, addressLine } = req.body || {};
  if (!name || !R(regionId)) return res.status(400).json({ error: 'Name and address area required' });
  const u = { id: nextId('user', 'u'), role: 'citizen', realName: String(name).slice(0, 60), regionId, addressLine: String(addressLine || '').slice(0, 140), verified: true, onboarded: false, following: { positions: [], users: [], regions: [] }, createdAt: Date.now() };
  db.users.push(u);
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
  const pick = ['u_cit1', 'u_cit4', 'u_cit7', 'u_corp_kothrud', 'u_je_hadapsar', 'u_commissioner', 'u_cityeng', 'u_sarpanch_wagholi', 'u_c_sahyadri', 'u_c_patil', 'u_admin'];
  res.json(pick.map(USER).filter(Boolean).map((u) => {
    const held = positionsHeldBy(u.id); const cons = contractorsOf(u.id);
    const role = u.role === 'admin' ? 'Admin' : held.length ? held.map((p) => `${p.title} · ${R(p.regionId).name}`).join(', ') : cons.length ? `Contractor · ${cons[0].name}` : `Citizen · ${R(u.regionId).name}`;
    return { id: u.id, label: u.role === 'admin' || held.length || cons.length ? u.realName : anonHandle(u), role };
  }));
});

app.get('/api/me', auth, (req, res) => res.json(me(req.user)));
app.post('/api/me/area', auth, (req, res) => {
  if (!R(req.body?.regionId)) return res.status(400).json({ error: 'Unknown area' });
  req.user.regionId = req.body.regionId; changed('users', req.user.id);
  res.json(me(req.user));
});
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
  const tab = req.query.tab || 'foryou';
  let list = db.posts;
  if (tab === 'problems') list = list.filter((p) => p.tag === 'problem');
  if (tab === 'following' && viewer) list = list.filter((p) => rankFor(viewer, p).reasons.includes('Following'));
  const ranked = list.map((p) => ({ p, ...rankFor(viewer, p) })).sort((a, b) => b.score - a.score).slice(0, 80);
  res.json(ranked.map(({ p, reasons }) => ({ ...decorate(p, viewer), reasons })));
});

app.get('/api/posts', (req, res) => {
  const viewer = getUser(req);
  const { region, subtree: sub, author, position, contractor, tag, project } = req.query;
  let list = db.posts;
  if (region) { const ids = sub ? subtree(region) : [region]; list = list.filter((p) => ids.includes(p.regionId)); }
  if (author) list = list.filter((p) => p.authorId === author && p.actingAs.type === 'citizen');
  if (position) list = list.filter((p) => (p.actingAs.type === 'position' && p.actingAs.id === position) || p.mentions.some((m) => m.type === 'position' && m.id === position) || p.responsible.some((r) => r.positionId === position));
  if (contractor) list = list.filter((p) => (p.actingAs.type === 'contractor' && p.actingAs.id === contractor) || p.mentions.some((m) => m.type === 'contractor' && m.id === contractor));
  if (project) { const pj = PROJ(project); list = list.filter((p) => p.projectId === project || pj?.linkedProblemIds.includes(p.id)); }
  if (tag) list = list.filter((p) => p.tag === tag);
  res.json([...list].sort((a, b) => b.createdAt - a.createdAt).slice(0, 100).map((p) => decorate(p, viewer)));
});

app.get('/api/posts/:id', (req, res) => {
  const viewer = getUser(req);
  const p = POST(req.params.id);
  if (!p) return res.status(404).json({ error: 'Post not found' });
  const comments = db.comments.filter((c) => c.postId === p.id).sort((a, b) => a.createdAt - b.createdAt).map((c) => ({ ...c, author: actorLabel(c.actingAs, c.authorId) }));
  const project = db.projects.find((pj) => pj.id === p.projectId || pj.linkedProblemIds.includes(p.id)) || null;
  res.json({ post: decorate(p, viewer), comments, project });
});

app.post('/api/posts', auth, (req, res) => {
  const u = req.user;
  const b = req.body || {};
  const actingAs = b.actingAs || { type: 'citizen' };
  const allowed = {
    citizen: ['problem', 'normal'],
    position: ['progress'],
    contractor: ['progress'],
    admin: ['position_change', 'election', 'normal'],
  }[actingAs.type];
  if (!allowed || !allowed.includes(b.tag)) return res.status(403).json({ error: `As ${actingAs.type} you can post: ${(allowed || []).join(', ')}` });
  if (actingAs.type === 'position' && POS(actingAs.id)?.holderUserId !== u.id) return res.status(403).json({ error: 'You do not hold this position' });
  if (actingAs.type === 'contractor' && !CON(actingAs.id)?.memberUserIds.includes(u.id)) return res.status(403).json({ error: 'You are not part of this contractor' });
  if (actingAs.type === 'admin' && u.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const title = String(b.title || '').trim();
  const body = String(b.body || '').trim();
  if (title.length < 5) return res.status(400).json({ error: 'Title is too short' });
  if (body.length < 10) return res.status(400).json({ error: 'Write a little more detail in the body' });

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
    responsible = (chosen.length ? chosen : suggested).map((positionId) => ({ positionId, assignedBy: suggested.includes(positionId) ? 'rules' : 'user' }));
  }
  const p = {
    id: nextId('post', 'post'), authorId: u.id, actingAs, tag: b.tag, title: title.slice(0, 140), body: body.slice(0, 5000),
    images: (b.images || []).slice(0, 4), mentions: (b.mentions || []).filter((m) => (m.type === 'position' && POS(m.id)) || (m.type === 'contractor' && CON(m.id))),
    linkedProblemIds: linked, upvotes: [], status: b.tag === 'problem' ? 'open' : null, viewedByPositions: [], respondedByPositions: [],
    responsible, category: b.tag === 'problem' ? (b.category || 'Other') : null, location: b.location || null, regionId,
    projectId: PROJ(b.projectId) ? b.projectId : null, capturedWithCamera: !!b.capturedWithCamera,
    moderation: { botVerified: null, note: 'Bot verification — coming soon' }, createdAt: Date.now(),
  };
  db.posts.push(p);

  // Notifications
  const actor = actorLabel(actingAs, u.id).title;
  if (b.tag === 'progress') {
    for (const id of linked) {
      const prob = POST(id);
      const who = actingAs.type === 'position' ? actingAs.id : null;
      if (who && !prob.respondedByPositions.includes(who)) prob.respondedByPositions.push(who);
      if (b.markResolved) prob.status = 'resolved'; else if (prob.status === 'open' || prob.status === 'acknowledged') prob.status = 'in_progress';
      notify([prob.authorId, ...prob.upvotes].filter((x) => x !== u.id), `${actor} posted a progress update on "${prob.title}"`, `#/post/${p.id}`, 'progress');
    }
    if (p.projectId) { const pj = PROJ(p.projectId); for (const id of pj.linkedProblemIds) if (!linked.includes(id)) { const prob = POST(id); notify([prob.authorId], `Project update on "${pj.title}" (linked to your problem)`, `#/post/${p.id}`, 'progress'); } }
  }
  if (b.tag === 'problem') {
    const holders = responsible.map((r) => POS(r.positionId)?.holderUserId).filter(Boolean);
    notify(holders, `New problem in your area: "${p.title}"`, `#/post/${p.id}`, 'problem');
  }
  for (const m of p.mentions) {
    const ids = m.type === 'position' ? [POS(m.id).holderUserId] : CON(m.id).memberUserIds;
    notify(ids.filter((x) => x && x !== u.id), `${actor} mentioned you in "${p.title}"`, `#/post/${p.id}`, 'mention');
  }
  if (actingAs.type === 'citizen') {
    const followers = db.users.filter((x) => x.following.users.includes(u.id)).map((x) => x.id);
    notify(followers, `A citizen you follow posted: "${p.title}"`, `#/post/${p.id}`, 'follow');
  }
  changed('posts', p.id);
  res.json(decorate(p, u));
});

app.post('/api/posts/:id/upvote', auth, (req, res) => {
  const p = POST(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const i = p.upvotes.indexOf(req.user.id);
  if (i >= 0) p.upvotes.splice(i, 1); else p.upvotes.push(req.user.id);
  changed('posts', p.id);
  res.json({ upvoted: i < 0, upvoteCount: p.upvotes.length });
});

app.post('/api/posts/:id/comments', auth, (req, res) => {
  const p = POST(req.params.id);
  if (!p) return res.status(404).json({ error: 'Not found' });
  const actingAs = req.body?.actingAs || { type: 'citizen' };
  const body = String(req.body?.body || '').trim();
  if (!body) return res.status(400).json({ error: 'Empty comment' });
  if (!canRespond(req.user, actingAs, p)) return res.status(403).json({ error: 'You can only respond on behalf of a position/contractor to posts you are responsible for' });
  const c = { id: nextId('comment', 'cm'), postId: p.id, authorId: req.user.id, actingAs, body: body.slice(0, 2000), createdAt: Date.now() };
  db.comments.push(c);
  if (actingAs.type === 'position') {
    if (!p.respondedByPositions.includes(actingAs.id)) p.respondedByPositions.push(actingAs.id);
    if (!p.viewedByPositions.includes(actingAs.id)) p.viewedByPositions.push(actingAs.id);
    if (p.status === 'open') p.status = 'acknowledged';
  }
  if (p.authorId !== req.user.id) notify([p.authorId], `${actorLabel(actingAs, req.user.id).title} commented on "${p.title}"`, `#/post/${p.id}`, 'comment');
  changed('posts', p.id);
  res.json({ ...c, author: actorLabel(actingAs, req.user.id) });
});

app.post('/api/posts/:id/view', auth, (req, res) => {
  const p = POST(req.params.id); const pos = POS(req.body?.positionId);
  if (!p || !pos || pos.holderUserId !== req.user.id) return res.json({ ok: false });
  if (!p.viewedByPositions.includes(pos.id)) { p.viewedByPositions.push(pos.id); changed('posts', p.id); }
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

// Official re-assigns responsibility (records who assigned: person)
app.post('/api/posts/:id/assign', auth, (req, res) => {
  const p = POST(req.params.id);
  const { positionId, actingPositionId } = req.body || {};
  const actor = POS(actingPositionId);
  const isAdmin = req.user.role === 'admin';
  if (!p || !POS(positionId) || (!isAdmin && (!actor || !canRespond(req.user, { type: 'position', id: actor.id }, p)))) return res.status(403).json({ error: 'Not allowed' });
  if (!p.responsible.some((r) => r.positionId === positionId)) p.responsible.push({ positionId, assignedBy: 'person', assignedByUserId: req.user.id });
  const h = POS(positionId).holderUserId; if (h) notify([h], `A problem was assigned to ${POS(positionId).title}: "${p.title}"`, `#/post/${p.id}`, 'problem');
  changed('posts', p.id);
  res.json({ ok: true });
});

app.get('/api/locate', (req, res) => {
  const lat = Number(req.query.lat), lng = Number(req.query.lng);
  const r = Number.isFinite(lat) && Number.isFinite(lng) ? locate(lat, lng) : null;
  if (!r) return res.json({ region: null });
  const positions = chain(r.id).flatMap((rid) => db.positions.filter((p) => p.regionId === rid)).slice(0, 12);
  const contractorIds = [...new Set(positions.flatMap((p) => p.contractorIds))];
  res.json({ region: r, chain: chain(r.id), positionIds: positions.map((p) => p.id), contractorIds });
});

app.get('/api/suggest', (req, res) => {
  const regionId = R(req.query.regionId) ? req.query.regionId : null;
  res.json({ positionIds: regionId ? suggestResponsible(regionId, req.query.category || 'Other') : [], by: 'rules' });
});

// ---- Dashboards ----
app.get('/api/dashboard/position/:id', auth, (req, res) => {
  const pos = POS(req.params.id);
  if (!pos || (pos.holderUserId !== req.user.id && req.user.role !== 'admin')) return res.status(403).json({ error: 'Not your position' });
  const area = subtree(pos.regionId);
  const problems = db.posts.filter((p) => p.tag === 'problem' && (p.responsible.some((r) => r.positionId === pos.id) || area.includes(p.regionId)));
  const ranked = problems.map((p) => ({ p, s: hot(p) * (p.responsible.some((r) => r.positionId === pos.id) ? 1.5 : 1) * (p.status === 'resolved' ? 0.2 : 1) })).sort((a, b) => b.s - a.s).map(({ p }) => ({ ...decorate(p, req.user), assignedToMe: p.responsible.some((r) => r.positionId === pos.id), viewed: p.viewedByPositions.includes(pos.id), responded: p.respondedByPositions.includes(pos.id) }));
  res.json({
    position: pos,
    problems: ranked,
    counts: { total: ranked.length, unviewed: ranked.filter((x) => !x.viewed).length, unresponded: ranked.filter((x) => !x.responded && x.status !== 'resolved').length, resolved: ranked.filter((x) => x.status === 'resolved').length },
    projects: db.projects.filter((pj) => pj.positionId === pos.id || area.includes(pj.regionId)),
  });
});

// ---- Projects ----
app.post('/api/projects', auth, (req, res) => {
  const b = req.body || {};
  const pos = POS(b.positionId);
  if (!pos || pos.holderUserId !== req.user.id) return res.status(403).json({ error: 'Create projects from a position you hold' });
  if (!b.title || !(Number(b.budget) > 0)) return res.status(400).json({ error: 'Title and budget required' });
  const pj = {
    id: nextId('project', 'pj'), title: String(b.title).slice(0, 140), description: String(b.description || '').slice(0, 3000), category: b.category || 'Roads',
    regionId: R(b.regionId) && inSubtree(b.regionId, pos.regionId) ? b.regionId : pos.regionId, positionId: pos.id,
    approvedByPositionId: pos.id, approvedByUserId: req.user.id, contractorId: CON(b.contractorId) ? b.contractorId : null,
    budget: Number(b.budget), spent: 0, status: CON(b.contractorId) ? 'in_progress' : 'bidding',
    linkedProblemIds: (b.linkedProblemIds || []).filter((id) => POST(id)?.tag === 'problem'), bids: [], startDate: CON(b.contractorId) ? Date.now() : null, endDate: null, createdAt: Date.now(),
  };
  db.projects.push(pj);
  for (const id of pj.linkedProblemIds) { const prob = POST(id); notify([prob.authorId, ...prob.upvotes], `Your problem "${prob.title}" was added to project "${pj.title}"`, `#/project/${pj.id}`, 'project'); if (prob.status === 'open' || prob.status === 'acknowledged') prob.status = 'in_progress'; if (!prob.respondedByPositions.includes(pos.id)) prob.respondedByPositions.push(pos.id); }
  if (pj.contractorId) notify(CON(pj.contractorId).memberUserIds, `You were assigned project "${pj.title}"`, `#/project/${pj.id}`, 'project');
  else { const eligible = db.contractors.filter((c) => c.regionIds.some((r) => inSubtree(pj.regionId, r))); notify(eligible.flatMap((c) => c.memberUserIds), `New project open for bids: "${pj.title}"`, `#/project/${pj.id}`, 'project'); }
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
  const h = POS(pj.positionId)?.holderUserId; if (h) notify([h], `${c.name} placed a bid on "${pj.title}"`, `#/project/${pj.id}`, 'project');
  changed('projects', pj.id);
  res.json(pj);
});

app.post('/api/projects/:id/award', auth, (req, res) => {
  const pj = PROJ(req.params.id); const pos = POS(pj?.positionId); const c = CON(req.body?.contractorId);
  if (!pj || !c || pos?.holderUserId !== req.user.id) return res.status(403).json({ error: 'Only the responsible position can award' });
  pj.contractorId = c.id; pj.status = 'in_progress'; pj.startDate = Date.now(); pj.approvedByUserId = req.user.id; pj.approvedByPositionId = pos.id;
  notify(c.memberUserIds, `You won the bid for "${pj.title}"`, `#/project/${pj.id}`, 'project');
  notify(pj.linkedProblemIds.map((id) => POST(id)?.authorId).filter(Boolean), `Contractor ${c.name} assigned to fix "${pj.title}"`, `#/project/${pj.id}`, 'project');
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

// Assign a contractor to a position (position holder) — "assign contractors to people"
app.post('/api/positions/:id/contractors', auth, (req, res) => {
  const pos = POS(req.params.id); const c = CON(req.body?.contractorId);
  if (!pos || !c || (pos.holderUserId !== req.user.id && req.user.role !== 'admin')) return res.status(403).json({ error: 'Not allowed' });
  if (req.body.remove) pos.contractorIds = pos.contractorIds.filter((x) => x !== c.id);
  else if (!pos.contractorIds.includes(c.id)) {
    pos.contractorIds.push(c.id);
    c.assignedBy.push({ positionId: pos.id, regionId: pos.regionId, at: Date.now() });
    if (!c.regionIds.some((r) => inSubtree(pos.regionId, r))) c.regionIds.push(pos.regionId);
    notify(c.memberUserIds, `${pos.title}, ${R(pos.regionId).name} added you as an assigned contractor`, `#/contractor/${c.id}`, 'project');
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
  if (u) notify([u.id], `You have been assigned the position ${pos.title}, ${R(pos.regionId).name}`, `#/position/${pos.id}`, 'position');
  if (u) {
    const p = { id: nextId('post', 'post'), authorId: req.user.id, actingAs: { type: 'admin' }, tag: 'position_change', title: `${u.realName} is now ${pos.title}, ${R(pos.regionId).name}`, body: `${u.realName}${u.party ? ` (${u.party})` : ''} has taken charge as ${pos.title}${prev ? `, succeeding ${prev.realName}` : ''}. Responsibilities: ${pos.responsibilities.join('; ')}.`, images: [], mentions: [{ type: 'position', id: pos.id }], linkedProblemIds: [], upvotes: [], status: null, viewedByPositions: [], respondedByPositions: [], responsible: [], category: null, location: null, regionId: pos.regionId, projectId: null, moderation: { botVerified: null }, createdAt: Date.now() };
    db.posts.push(p);
    const followers = db.users.filter((x) => x.following.positions.includes(pos.id)).map((x) => x.id);
    notify(followers, `Position change: ${p.title}`, `#/post/${p.id}`, 'position');
  }
  changed('positions', pos.id);
  res.json(pos);
});

app.post('/api/admin/positions', auth, (req, res) => {
  const b = req.body || {};
  if (!R(b.regionId)) return res.status(400).json({ error: 'Unknown area' });
  if (req.user.role !== 'admin' && !isHeadOf(req.user, b.regionId)) return res.status(403).json({ error: 'Only admins or the area\'s fixed head position can edit area positions' });
  if (!b.title) return res.status(400).json({ error: 'Title required' });
  const p = { id: nextId('position', 'p'), regionId: b.regionId, title: String(b.title).slice(0, 100), kind: ['elected', 'appointed', 'department'].includes(b.kind) ? b.kind : 'appointed', holderUserId: null, categories: (b.categories || []).filter((c) => CATEGORIES.includes(c)), responsibilities: (b.responsibilities || []).map(String).filter(Boolean).slice(0, 8), budget: Number(b.budget) || 0, contractorIds: [], isHead: false, rank: 4, createdAt: Date.now() };
  db.positions.push(p);
  changed('positions', p.id);
  res.json(p);
});

app.post('/api/admin/contractors', auth, (req, res) => {
  const b = req.body || {};
  const pos = POS(b.positionId);
  const allowed = req.user.role === 'admin' || (pos && pos.holderUserId === req.user.id);
  if (!allowed) return res.status(403).json({ error: 'Not allowed' });
  const members = (b.memberUserIds || []).filter((id) => USER(id));
  if (!b.name || !members.length) return res.status(400).json({ error: 'Name and at least one member required' });
  const c = { id: nextId('contractor', 'c'), name: String(b.name).slice(0, 100), type: ['company', 'individual', 'group'].includes(b.type) ? b.type : 'company', memberUserIds: members, regionIds: [pos ? pos.regionId : (R(b.regionId) ? b.regionId : 'r_in')], specialties: (b.specialties || []).filter((x) => CATEGORIES.includes(x)), gstin: '', assignedBy: pos ? [{ positionId: pos.id, regionId: pos.regionId, at: Date.now() }] : [], createdAt: Date.now() };
  db.contractors.push(c);
  if (pos) pos.contractorIds.push(c.id);
  notify(members, `You were registered as part of contractor "${c.name}"`, `#/contractor/${c.id}`, 'project');
  changed('contractors', c.id);
  res.json(c);
});

app.get('/api/admin/users', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  const q = String(req.query.q || '').toLowerCase();
  res.json(db.users.filter((u) => !q || (u.realName || '').toLowerCase().includes(q) || anonHandle(u).toLowerCase().includes(q)).slice(0, 30).map((u) => ({ id: u.id, realName: u.realName, handle: anonHandle(u), regionId: u.regionId, role: u.role })));
});

app.get('/api/admin/assignments', auth, (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admins only' });
  res.json(db.posts.filter((p) => p.tag === 'problem').sort((a, b) => b.createdAt - a.createdAt).map((p) => ({ id: p.id, title: p.title, regionName: R(p.regionId)?.name, responsible: p.responsible.map((r) => ({ ...r, title: POS(r.positionId)?.title, assignedByName: r.assignedByUserId ? USER(r.assignedByUserId)?.realName : null })) })));
});

// ---- Notifications ----
app.get('/api/notifications', auth, (req, res) => {
  res.json(db.notifications.filter((n) => n.userId === req.user.id).sort((a, b) => b.createdAt - a.createdAt).slice(0, 100));
});
app.post('/api/notifications/read', auth, (req, res) => {
  for (const n of db.notifications) if (n.userId === req.user.id) n.read = true;
  save();
  res.json({ ok: true });
});

// ---- People ----
app.get('/api/people/:id', (req, res) => {
  const u = USER(req.params.id);
  if (!u) return res.status(404).json({ error: 'Not found' });
  const viewer = getUser(req);
  const followers = db.users.filter((x) => x.following.users.includes(u.id)).length;
  res.json({ person: publicUser(u), followers, isMe: viewer?.id === u.id });
});

// ---- Uploads (images as data URLs, compressed client-side) ----
app.post('/api/upload', auth, (req, res) => {
  const m = /^data:image\/(png|jpe?g|webp);base64,(.+)$/.exec(req.body?.dataUrl || '');
  if (!m) return res.status(400).json({ error: 'Unsupported image' });
  const name = crypto.randomBytes(10).toString('hex') + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1]);
  fs.writeFileSync(path.join(UPLOAD_DIR, name), Buffer.from(m[2], 'base64'));
  res.json({ url: '/uploads/' + name });
});

app.get(/^\/(?!api|uploads|vendor).*/, (req, res) => res.sendFile(path.join(ROOT, 'public/index.html')));

app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));
