import { html, useState, useEffect, useRef, store, post, toast, go, region, position, contractor, person, isFollowing, toggleFollow, ago, inr, TAGS, STATUS, chain, levelLabel } from './lib.js';
import * as L from '/vendor/leaflet/leaflet-src.esm.js';

// ---------------- Icons (stroke, Instagram-like) ----------------
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  plus: 'M4 4h16v16H4zM12 8v8M8 12h8',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  up: 'M12 4 4 13h5v7h6v-7h5z',
  comment: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  share: 'M22 3 11 14M22 3l-7 18-4-7-7-4z',
  back: 'M15 5l-7 7 7 7',
  camera: 'M4 8h3l2-3h6l2 3h3v11H4zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  pin: 'M12 21s-7-6.2-7-11a7 7 0 1 1 14 0c0 4.8-7 11-7 11zm0-8.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  tree: 'M12 3v6M12 9H6v4M12 9h6v4M6 13v2M18 13v2M4 15h4v5H4zM16 15h4v5h-4zM10 3h4',
  grid: 'M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM13 13h7v7h-7z',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z',
  briefcase: 'M3 7h18v13H3zM8 7V4h8v3M3 12h18',
  chart: 'M4 20V10M10 20V4M16 20v-7M22 20H2',
  shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z',
  bot: 'M8 8h8a3 3 0 0 1 3 3v5a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3zM12 4v4M9 13h.01M15 13h.01',
  check: 'M5 12l5 5L20 7',
  x: 'M6 6l12 12M18 6 6 18',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 3-3 4 4M15 9h.01',
  at: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0zm0 0v1.5a2.5 2.5 0 0 0 5 0V12a9 9 0 1 0-3.5 7.1',
  swap: 'M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7',
  logout: 'M15 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4M10 17l-5-5 5-5M5 12h11',
  map: 'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2zM9 4v14M15 6v14',
  sparkle: 'M12 3l2 6 6 2-6 2-2 6-2-6-6-2 6-2z',
  rupee: 'M6 4h12M6 9h12M14 4c3 0 4 2.5 4 5s-2 5-6 5H7l8 7',
  flag: 'M5 21V4h11l-2 4 2 4H5',
};
export const Icon = ({ n, s = 24, w = 1.8, fill }) => html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" fill=${fill || 'none'} stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[n]} /></svg>`;

// ---------------- Avatars ----------------
const hue = (s) => [...(s || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
export function Avatar({ name, size = 36, kind, ring }) {
  const initials = kind === 'anon' ? '' : (name || '?').replace(/\(.*\)/, '').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.38}px;background:${kind === 'anon' ? 'var(--anon)' : `hsl(${hue(name)} 55% 45%)`}`;
  return html`<span class=${'avatar' + (ring ? ' ring ring-' + ring : '')} style=${style}>${kind === 'anon' ? html`<${Icon} n="user" s=${size * 0.55} />` : initials}</span>`;
}

export const TagPill = ({ tag }) => html`<span class=${'tag tag-' + tag}>${TAGS[tag]?.label || tag}</span>`;
export const StatusPill = ({ status }) => status ? html`<span class=${'status st-' + status}>${STATUS[status] || status}</span>` : null;
export const Party = ({ party }) => party ? html`<span class="party">${party}</span>` : null;

export function FollowButton({ type, id, small }) {
  const on = isFollowing(type, id);
  return html`<button class=${'btn ' + (on ? 'btn-ghost' : 'btn-primary') + (small ? ' btn-sm' : '')} onClick=${(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(type, id); }}>${on ? 'Following' : 'Follow'}</button>`;
}

export function ComingSoon({ label, icon = 'bot', block }) {
  return html`<button class=${'btn btn-soon' + (block ? ' btn-block' : '')} onClick=${(e) => { e.preventDefault(); toast(label + ' — planned for a future release'); }}><${Icon} n=${icon} s=${16} /> ${label} <span class="soon">Soon</span></button>`;
}

export const Loading = () => html`<div class="loading"><span></span><span></span><span></span></div>`;
export const Empty = ({ children }) => html`<div class="empty">${children}</div>`;
export const ErrorBox = ({ error }) => html`<div class="empty error">${error}</div>`;

export function Header({ title, back, right, sub }) {
  return html`<header class="topbar">
    ${back ? html`<button class="icon-btn" aria-label="Back" onClick=${() => (history.length > 1 ? history.back() : go('#/'))}><${Icon} n="back" /></button>` : null}
    <div class="topbar-title"><div class="t1">${title}</div>${sub ? html`<div class="t2">${sub}</div>` : null}</div>
    <div class="topbar-right">${right}</div>
  </header>`;
}

export function Tabs({ tabs, value, onChange }) {
  return html`<div class="tabs" role="tablist">${tabs.map(([k, label, badge]) => html`<button role="tab" aria-selected=${value === k} class=${value === k ? 'on' : ''} onClick=${() => onChange(k)}>${label}${badge ? html`<span class="badge">${badge}</span>` : null}</button>`)}</div>`;
}

export function Sheet({ open, onClose, title, children }) {
  if (!open) return null;
  return html`<div class="sheet-wrap" onClick=${onClose}><div class="sheet" role="dialog" aria-label=${title} onClick=${(e) => e.stopPropagation()}>
    <div class="sheet-handle"></div>
    <div class="sheet-head"><b>${title}</b><button class="icon-btn" aria-label="Close" onClick=${onClose}><${Icon} n="x" /></button></div>
    <div class="sheet-body">${children}</div>
  </div></div>`;
}

// ---------------- Post card (text-first) ----------------
export function AuthorLine({ author, regionId, regionName, createdAt, reasons }) {
  const a = author || {};
  let name = a.title, sub = null, href = null, kind = 'public', avatarName = a.title;
  if (a.type === 'citizen') { kind = a.person?.kind; name = a.person?.name; href = '#/person/' + a.person?.id; }
  if (a.type === 'position') { href = '#/position/' + a.id; avatarName = a.person?.name; sub = a.person?.name; }
  if (a.type === 'contractor') { href = '#/contractor/' + a.id; sub = 'Contractor'; }
  if (a.type === 'admin') { kind = 'public'; sub = 'Verified platform account'; }
  return html`<div class="author">
    <a href=${href || '#/'} class="author-av"><${Avatar} name=${avatarName} kind=${kind} size=${36} ring=${a.type === 'position' ? 'official' : a.type === 'contractor' ? 'contractor' : a.type === 'admin' ? 'admin' : null} /></a>
    <div class="author-meta">
      <a href=${href || '#/'} class="author-name">${name}${a.type === 'position' || a.type === 'admin' ? html` <span class="verified" title="Verified">✓</span>` : null}</a>
      <div class="author-sub">${sub ? html`${sub} · ` : null}<a href=${'#/region/' + regionId}>${regionName}</a> · ${ago(createdAt)}${reasons?.length ? html` · <span class="reason">${reasons[0]}</span>` : null}</div>
    </div>
  </div>`;
}

export function PostCard({ p, compact, onChange }) {
  const [up, setUp] = useState({ on: p.upvoted, n: p.upvoteCount });
  useEffect(() => setUp({ on: p.upvoted, n: p.upvoteCount }), [p.upvoted, p.upvoteCount]);
  const vote = async (e) => {
    e.stopPropagation();
    if (!store.token) return go('#/login');
    setUp((u) => ({ on: !u.on, n: u.n + (u.on ? -1 : 1) }));
    try { const r = await post(`/posts/${p.id}/upvote`); setUp({ on: r.upvoted, n: r.upvoteCount }); } catch (err) { toast(err.message); }
  };
  const open = () => go('#/post/' + p.id);
  return html`<article class=${'card post shadow-' + p.tag} onClick=${compact ? open : undefined}>
    <${AuthorLine} ...${p} />
    <h3 class="post-title" onClick=${open}>${p.title}</h3>
    <div class="post-tags"><${TagPill} tag=${p.tag} />${p.category ? html`<span class="chip">${p.category}</span>` : null}<${StatusPill} status=${p.status} /></div>
    <p class=${'post-body' + (compact ? ' clamp' : '')} onClick=${open}>${p.body}</p>
    ${p.images?.length ? html`<div class=${'post-images n' + Math.min(p.images.length, 3)}>${p.images.map((src) => html`<img src=${src} alt="Attached photo" loading="lazy" />`)}</div>` : null}
    ${p.mentions?.length ? html`<div class="mentions">${p.mentions.map((m) => m.type === 'position' ? html`<a class="mention" href=${'#/position/' + m.id} onClick=${(e) => e.stopPropagation()}>@${position(m.id)?.title}</a>` : html`<a class="mention" href=${'#/contractor/' + m.id} onClick=${(e) => e.stopPropagation()}>@${contractor(m.id)?.name}</a>`)}</div>` : null}
    ${p.linkedProblems?.length ? html`<div class="linked"><div class="linked-h">Update for problem${p.linkedProblems.length > 1 ? 's' : ''}</div>${p.linkedProblems.map((x) => html`<a href=${'#/post/' + x.id} onClick=${(e) => e.stopPropagation()} class="linked-row"><span class="dot dot-problem"></span><span class="grow">${x.title}</span><${StatusPill} status=${x.status} /></a>`)}</div>` : null}
    ${p.tag === 'problem' && p.responsible?.length ? html`<div class="responsible"><span class="muted">Responsible:</span> ${p.responsible.slice(0, 3).map((r) => html`<a href=${'#/position/' + r.positionId} onClick=${(e) => e.stopPropagation()} class="resp">${position(r.positionId)?.title}</a>`)}</div>` : null}
    ${p.progressUpdates?.length ? html`<a class="progress-note" href=${'#/post/' + p.progressUpdates[p.progressUpdates.length - 1].id} onClick=${(e) => e.stopPropagation()}><span class="dot dot-progress"></span>${p.progressUpdates.length} progress update${p.progressUpdates.length > 1 ? 's' : ''} · latest ${ago(p.progressUpdates[p.progressUpdates.length - 1].createdAt)}</a>` : null}
    <div class="actions">
      <button class=${'act' + (up.on ? ' on' : '')} onClick=${vote} aria-label="Upvote"><${Icon} n="up" fill=${up.on ? 'currentColor' : 'none'} /> <span>${up.n}</span></button>
      <button class="act" onClick=${open} aria-label="Comments"><${Icon} n="comment" /> <span>${p.commentCount}</span></button>
      <button class="act" aria-label="Share" onClick=${(e) => { e.stopPropagation(); navigator.clipboard?.writeText(location.origin + '/#/post/' + p.id); toast('Link copied'); }}><${Icon} n="share" /></button>
    </div>
  </article>`;
}

// ---------------- Rows ----------------
export function PositionRow({ p, showRegion, right }) {
  const holder = person(p.holderUserId);
  return html`<a class="row" href=${'#/position/' + p.id}>
    <${Avatar} name=${holder?.name || p.title} size=${44} ring="official" />
    <div class="row-main">
      <div class="row-t">${p.title}${p.isHead ? html` <span class="head-badge">Head</span>` : null}</div>
      <div class="row-s">${holder ? html`${holder.name} <${Party} party=${holder.party} />` : html`<i>Vacant</i>`}${showRegion ? html` · ${region(p.regionId)?.name}` : null}</div>
    </div>
    ${right !== undefined ? right : html`<${FollowButton} type="position" id=${p.id} small />`}
  </a>`;
}
export function ContractorRow({ c, right }) {
  return html`<a class="row" href=${'#/contractor/' + c.id}>
    <${Avatar} name=${c.name} size=${44} ring="contractor" />
    <div class="row-main"><div class="row-t">${c.name}</div><div class="row-s">${c.type === 'group' ? 'Group of citizens' : c.type === 'individual' ? 'Individual' : 'Company'} · ${c.specialties.join(', ')}</div></div>
    ${right || null}
  </a>`;
}
export function ProjectRow({ pj }) {
  const pct = pj.budget ? Math.min(100, Math.round((pj.spent / pj.budget) * 100)) : 0;
  return html`<a class="row project-row" href=${'#/project/' + pj.id}>
    <div class="proj-ic"><${Icon} n="briefcase" s=${20} /></div>
    <div class="row-main">
      <div class="row-t">${pj.title}</div>
      <div class="row-s">${inr(pj.budget)} · <${StatusPill} status=${pj.status} /> · ${region(pj.regionId)?.name}</div>
      <div class="bar thin"><i style=${`width:${pct}%`}></i></div>
    </div>
  </a>`;
}
export function RegionRow({ r, right }) {
  return html`<a class="row" href=${'#/region/' + r.id}>
    <div class="region-ic"><${Icon} n="map" s=${20} /></div>
    <div class="row-main"><div class="row-t">${r.name}</div><div class="row-s">${levelLabel(r.type)}</div></div>
    ${right || null}
  </a>`;
}

export function Breadcrumb({ regionId }) {
  const c = chain(regionId).reverse();
  return html`<nav class="crumbs">${c.map((r, i) => html`${i ? html`<span>›</span>` : null}<a href=${'#/region/' + r.id}>${r.name}</a>`)}</nav>`;
}

// ---------------- Budget (LinkedIn-like bars) ----------------
export function BudgetBars({ budget, title = 'Budget by category' }) {
  const entries = Object.entries(budget || {}).sort((a, b) => b[1] - a[1]);
  if (!entries.length) return null;
  const total = entries.reduce((s, [, v]) => s + v, 0);
  const max = entries[0][1];
  return html`<section class="card pad">
    <div class="sec-h"><b>${title}</b><span class="muted">${inr(total)} total</span></div>
    ${entries.map(([k, v]) => html`<div class="budget-row"><div class="budget-l"><span>${k}</span><b>${inr(v)}</b></div><div class="bar"><i style=${`width:${Math.max(3, (v / max) * 100)}%`}></i></div></div>`)}
    <div class="muted small">Sample figures in ₹ crore, annual allocation.</div>
  </section>`;
}

// ---------------- Map ----------------
export function AreaMap({ regions, marker, height = 200, onPick }) {
  const ref = useRef();
  const mapRef = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: false, attributionControl: true, scrollWheelZoom: false });
    mapRef.current = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(map);
    const group = L.featureGroup().addTo(map);
    regions.forEach((r, i) => {
      L.circle(r.center, { radius: r.radiusKm * 1000, color: i === 0 ? '#7c3aed' : '#2563eb', weight: i === 0 ? 2 : 1, fillOpacity: i === 0 ? 0.12 : 0.05 }).bindTooltip(r.name).addTo(group);
    });
    if (marker) L.circleMarker([marker.lat, marker.lng], { radius: 7, color: '#fff', weight: 2, fillColor: '#e11d48', fillOpacity: 1 }).addTo(group);
    try { map.fitBounds(group.getBounds(), { padding: [10, 10] }); } catch { map.setView([20, 78], 4); }
    if (onPick) map.on('click', (e) => onPick(e.latlng));
    setTimeout(() => map.invalidateSize(), 100);
    return () => map.remove();
  }, [regions.map((r) => r.id).join(), marker?.lat, marker?.lng]);
  return html`<div class="map" ref=${ref} style=${`height:${height}px`}></div>`;
}

export function DemoBanner() {
  return html`<div class="demo-banner">Prototype · all people, parties & businesses shown are fictional sample data</div>`;
}
