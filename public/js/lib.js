import { html, render, useState, useEffect, useRef, useMemo, useCallback } from '/vendor/htm/standalone.module.js';
export { html, render, useState, useEffect, useRef, useMemo, useCallback };

export const APP_NAME = 'Revon';

// ---------------- Store ----------------
const listeners = new Set();
export const store = {
  token: safeGet('token'),
  meta: null, // regions, positions, contractors, projects, people, me
  version: 0, // bumps on every server change (live sync)
  mode: safeGet('mode') || '', // 'citizen' | 'position:<id>' | 'contractor:<id>' | 'admin'
  unread: 0,
  toast: null,
};
export function setStore(patch) { Object.assign(store, patch); listeners.forEach((l) => l()); }
export function useStore() {
  const [, force] = useState(0);
  useEffect(() => { const l = () => force((x) => x + 1); listeners.add(l); return () => listeners.delete(l); }, []);
  return store;
}
function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
export function safeSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} }

export function toast(msg) { setStore({ toast: msg }); clearTimeout(toast.t); toast.t = setTimeout(() => setStore({ toast: null }), 2600); }

// ---------------- API ----------------
export async function api(path, opts = {}) {
  const res = await fetch('/api' + path, {
    method: opts.body ? 'POST' : 'GET',
    ...opts,
    headers: { 'Content-Type': 'application/json', ...(store.token ? { Authorization: 'Bearer ' + store.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}
export const post = (path, body = {}) => api(path, { body });

export async function loadMeta() {
  const meta = await api('/meta');
  if (store.token && !meta.me) { safeSet('token', null); setStore({ token: null }); }
  // keep mode valid
  const me = meta.me;
  let mode = store.mode || defaultMode(me);
  const valid = mode === 'citizen' || (me && ((mode.startsWith('position:') && me.positionIds.includes(mode.slice(9))) || (mode.startsWith('contractor:') && me.contractorIds.includes(mode.slice(11))) || (mode === 'admin' && me.role === 'admin')));
  if (!valid) mode = defaultMode(me);
  setStore({ meta, mode });
  refreshUnread();
}
export async function refreshUnread() {
  if (!store.token) return;
  try { const n = await api('/notifications'); setStore({ unread: n.filter((x) => !x.read).length }); } catch {}
}

// Live sync: server pushes change events; views re-fetch.
let es;
export function startLiveSync() {
  if (es) return;
  es = new EventSource('/api/events');
  let t;
  es.onmessage = () => {
    clearTimeout(t);
    t = setTimeout(async () => { await loadMeta().catch(() => {}); setStore({ version: store.version + 1 }); }, 250);
  };
}

// Fetch helper that re-runs on live-sync changes
export function useData(fn, deps = []) {
  const s = useStore();
  const [state, setState] = useState({ data: null, error: null, loading: true });
  useEffect(() => {
    let alive = true;
    fn().then((data) => alive && setState({ data, error: null, loading: false })).catch((e) => alive && setState({ data: null, error: e.message, loading: false }));
    return () => { alive = false; };
  }, [...deps, s.version, s.token]);
  return state;
}

// ---------------- Router ----------------
export function parseHash() {
  const h = location.hash.replace(/^#/, '') || '/';
  const [p, q] = h.split('?');
  return { parts: p.split('/').filter(Boolean), query: Object.fromEntries(new URLSearchParams(q || '')) };
}
export function useRoute() {
  const [r, setR] = useState(parseHash());
  useEffect(() => { const f = () => { setR(parseHash()); window.scrollTo(0, 0); }; addEventListener('hashchange', f); return () => removeEventListener('hashchange', f); }, []);
  return r;
}
export const go = (h) => { location.hash = h; };

// ---------------- Lookups ----------------
export const M = () => store.meta;
export const region = (id) => store.meta?.regions.find((r) => r.id === id);
export const position = (id) => store.meta?.positions.find((p) => p.id === id);
export const contractor = (id) => store.meta?.contractors.find((c) => c.id === id);
export const project = (id) => store.meta?.projects.find((p) => p.id === id);
export const person = (id) => store.meta?.people[id];
export const children = (id) => store.meta.regions.filter((r) => r.parentId === id);
export function chain(id) { const out = []; let r = region(id); while (r) { out.push(r); r = region(r.parentId); } return out; }
export const levelLabel = (type) => store.meta?.levels[type]?.label || type;
export const depthOf = (type) => store.meta?.levels[type]?.depth ?? 9;
export const positionsIn = (regionId) => store.meta.positions.filter((p) => p.regionId === regionId).sort((a, b) => (b.isHead - a.isHead) || a.rank - b.rank);
export function isFollowing(type, id) { const me = store.meta?.me; if (!me) return false; if (type === 'contractor') return (me.contractorsFollowed || []).includes(id); return me.following[{ position: 'positions', user: 'users', region: 'regions' }[type]].includes(id); }
export async function toggleFollow(type, id) {
  if (!store.token) return go('#/login');
  const on = !isFollowing(type, id);
  const me = type === 'contractor' ? await post('/follow-contractor', { id, on }) : await post('/follow', { type, id, on });
  setStore({ meta: { ...store.meta, me } });
  toast(on ? 'Following' : 'Unfollowed');
}
export function actingAs() {
  const m = store.mode;
  if (m.startsWith('position:')) return { type: 'position', id: m.slice(9) };
  if (m.startsWith('contractor:')) return { type: 'contractor', id: m.slice(11) };
  if (m === 'admin') return { type: 'admin' };
  return { type: 'citizen' };
}
export function setMode(mode) { safeSet('mode', mode); setStore({ mode }); }

// ---------------- Formatting ----------------
export function ago(ts) {
  const s = (Date.now() - ts) / 1000;
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 86400 * 7) return Math.floor(s / 86400) + 'd';
  return new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: new Date(ts).getFullYear() === new Date().getFullYear() ? undefined : 'numeric' });
}
// ₹ in rupees → Indian format (₹88,502 · ₹4.3 lakh · ₹13.4 crore)
export function rs(r) {
  if (r == null || isNaN(r)) return '—';
  const a = Math.abs(r);
  if (a >= 1e12) return '₹' + (+(r / 1e12).toFixed(2)) + ' lakh crore';
  if (a >= 1e7) return '₹' + (+(r / 1e7).toFixed(2)).toLocaleString('en-IN') + ' crore';
  if (a >= 1e5) return '₹' + (+(r / 1e5).toFixed(1)) + ' lakh';
  return '₹' + Math.round(r).toLocaleString('en-IN');
}
// budgets/projects are stored in ₹ crore
export const inr = (cr) => (cr == null || isNaN(cr) ? '—' : rs(cr * 1e7));
export const pct = (x) => Math.round((x || 0) * 100) + '%';
export const fmtDate = (ts) => (ts ? new Date(ts).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const fmtNum = (n) => (n || 0).toLocaleString('en-IN');

export const TAGS = {
  problem: { label: 'Problem', cls: 'problem' },
  normal: { label: 'Post', cls: 'normal' },
  progress: { label: 'Progress update', cls: 'progress' },
  position_change: { label: 'Position change', cls: 'position_change' },
  election: { label: 'Election', cls: 'election' },
};
export const STATUS = { open: 'Open', acknowledged: 'Acknowledged', in_progress: 'In progress', resolved: 'Resolved', duplicate: 'Duplicate', rejected: 'Rejected', forwarded: 'Forwarded', bidding: 'Open for bids', completed: 'Completed' };
// Default "acting as": a position if the user holds one, then contractor, then admin.
export function defaultMode(me) {
  if (!me) return 'citizen';
  if (me.positionIds?.length) return 'position:' + me.positionIds[0];
  if (me.contractorIds?.length) return 'contractor:' + me.contractorIds[0];
  if (me.role === 'admin') return 'admin';
  return 'citizen';
}
export const regionName = (id) => { const r = region(id); return r?.shortName || r?.name || ''; };

// Compress an image file to a JPEG data URL (max 1280px)
export function compressImage(file, max = 1280) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL('image/jpeg', 0.8));
      URL.revokeObjectURL(img.src);
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}
