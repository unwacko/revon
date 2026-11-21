import { html, useState, useEffect, useRef, store, post, toast, go, region, position, contractor, person, isFollowing, toggleFollow, ago, inr, rs, pct, fmtDate, TAGS, STATUS, chain, children, levelLabel, regionName } from './lib.js';
import { postPhoto, storyPhoto, credit } from './photos.js';
import * as L from '/vendor/leaflet/leaflet-src.esm.js';

// ---------------- Icons ----------------
const P = {
  home: 'M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
  search: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14zm9 16-4.3-4.3',
  plus: 'M4 4h16v16H4zM12 8v8M8 12h8',
  bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  user: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  users: 'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM2 21a7 7 0 0 1 14 0M16 3.5a4 4 0 0 1 0 7.5M18 14a6 6 0 0 1 4 7',
  up: 'M12 4 4 13h5v7h6v-7h5z',
  comment: 'M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z',
  share: 'M22 3 11 14M22 3l-7 18-4-7-7-4z',
  bookmark: 'M6 3h12v18l-6-5-6 5z',
  back: 'M15 5l-7 7 7 7',
  chev: 'M9 5l7 7-7 7',
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
  road: 'M8 3 4 21M16 3l4 18M12 4v3M12 10v4M12 17v3',
  alert: 'M12 3 2 20h20zM12 10v4M12 17h.01',
  wrench: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.5 2.5-2.4-.6-.6-2.4z',
  compass: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z',
  moon: 'M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z',
  menu: 'M4 6h16M4 12h16M4 18h16',
  globe: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM3 12h18M12 3c2.5 2.5 3.5 6 3.5 9s-1 6.5-3.5 9c-2.5-2.5-3.5-6-3.5-9s1-6.5 3.5-9z',
  down: 'M6 9l6 6 6-6',
};
export const Icon = ({ n, s = 24, w = 1.9, fill }) => html`<svg class="ic" width=${s} height=${s} viewBox="0 0 24 24" fill=${fill || 'none'} stroke="currentColor" stroke-width=${w} stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d=${P[n]} /></svg>`;

// ---------------- Avatars ----------------
const hue = (s) => [...(s || 'x')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 360, 7);
// Portrait pool (public/img/people). Add new files to the lists below as more grids are cropped.
const FEMALE = new Set(['Aarti', 'Sunita', 'Meenal', 'Farah', 'Kavita', 'Shraddha', 'Pallavi', 'Deepa', 'Swati', 'Neelam', 'Rekha', 'Ayesha', 'Varsha', 'Jyoti', 'Anjali', 'Leena', 'Madhuri', 'Bhavna']);
const MALE = new Set(['Rajesh', 'Vikram', 'Sachin', 'Nitin', 'Anil', 'Manoj', 'Imran', 'Rohit', 'Ganesh', 'Prakash', 'Tushar', 'Hemant', 'Sameer', 'Kiran', 'Mohan', 'Yogesh', 'Suresh', 'Rahul']);
const PORTRAITS = { official: { f: [2, 4, 6, 9, 11, 14, 16], m: [1, 3, 5, 7, 8, 10, 12, 13, 15] }, citizen: { f: [2, 4, 6, 8], m: [1, 3, 5, 7] } }; // <set>_NN.jpg
const AESTHETIC = [9, 10, 11, 12, 13, 14, 15, 16]; // citizen_NN.jpg: non-face avatars for citizens who stay anonymous
const img = (set, n) => `/img/people/${set}_${String(n).padStart(2, '0')}.jpg`;
const portrait = (name, kind) => {
  if (kind === 'anon') { const h = hue(name); return h % 3 === 0 ? null : img('citizen', AESTHETIC[(h * 7) % AESTHETIC.length]); } // some keep the plain icon
  const first = (name || '').trim().split(' ')[0];
  const g = FEMALE.has(first) ? 'f' : MALE.has(first) ? 'm' : null;
  if (!g) return null;
  const set = kind === 'citizen' ? 'citizen' : 'official', list = PORTRAITS[set][g];
  return img(set, list[hue(name) % list.length]);
};
// kind: 'public' (official / contractor), 'citizen' (citizen who chose to show their name), 'anon' (handle only)
export function Avatar({ name, size = 36, kind, ring }) {
  const photo = portrait(name, kind);
  const initials = kind === 'anon' ? '' : (name || '?').replace(/\(.*\)/, '').split(' ').filter(Boolean).slice(0, 2).map((x) => x[0]).join('').toUpperCase();
  const style = `width:${size}px;height:${size}px;font-size:${size * 0.38}px;background:${kind === 'anon' ? 'var(--anon)' : `hsl(${hue(name)} 45% 42%)`}`;
  return html`<span class=${'avatar' + (ring ? ' ring ring-' + ring : '')} style=${style}>${photo ? html`<img src=${photo} alt="" loading="lazy" />` : kind === 'anon' ? html`<${Icon} n="user" s=${size * 0.55} />` : initials}</span>`;
}

export const TagPill = ({ tag }) => html`<span class=${'tag tag-' + tag}>${TAGS[tag]?.label || tag}</span>`;
export const StatusPill = ({ status }) => status ? html`<span class=${'status st-' + status}>${STATUS[status] || status}</span>` : null;
export const Party = ({ party }) => party ? html`<span class="party">${party}</span>` : null;

export function FollowButton({ type, id, small }) {
  const on = isFollowing(type, id);
  return html`<button class=${'btn ' + (on ? 'btn-ghost' : 'btn-primary') + (small ? ' btn-sm' : '')} onClick=${(e) => { e.preventDefault(); e.stopPropagation(); toggleFollow(type, id); }}>${on ? 'Following' : 'Follow'}</button>`;
}

export function ComingSoon({ label, icon = 'bot', block }) {
  return html`<button class=${'btn btn-soon' + (block ? ' btn-block' : '')} onClick=${(e) => { e.preventDefault(); toast(label + ' — planned for a future release'); }}><${Icon} n=${icon} s=${18} /> ${label} <span class="soon">Soon</span></button>`;
}

export const Loading = () => html`<div class="loading"><span></span><span></span><span></span></div>`;
export const Empty = ({ children }) => html`<div class="empty">${children}</div>`;
export const ErrorBox = ({ error }) => html`<div class="empty error">${error}</div>`;

const LANGUAGES = [
  'English', 'Marathi', 'Hindi',
  'Assamese', 'Bengali', 'Bodo', 'Dogri', 'Gujarati', 'Kannada',
  'Kashmiri', 'Konkani', 'Maithili', 'Malayalam', 'Manipuri', 'Nepali',
  'Odia', 'Punjabi', 'Sanskrit', 'Santali', 'Sindhi', 'Tamil', 'Telugu', 'Urdu',
];
// Language picker: UI only for now (all 22 scheduled languages; Marathi and Hindi first).
export function LanguageButton() {
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const close = () => setOpen(false); setTimeout(() => addEventListener('click', close), 0); return () => removeEventListener('click', close); }, [open]);
  return html`<div class="lang">
    <button class="lang-btn" aria-label="Change language" aria-expanded=${open} onClick=${(e) => { e.stopPropagation(); setOpen(!open); }}><${Icon} n="globe" s=${22} /><span>EN</span><${Icon} n="down" s=${16} /></button>
    ${open ? html`<div class="lang-menu" role="menu" onClick=${(e) => e.stopPropagation()}>
      <div class="lang-h">Language</div>
      ${LANGUAGES.map((en, i) => html`${i === 3 ? html`<div class="lang-sep">All scheduled languages</div>` : null}<button role="menuitem" class=${'lang-item' + (i === 0 ? ' on' : '')} onClick=${() => { setOpen(false); if (i) toast(en + ' — coming soon'); }}><span>${en}</span>${i === 0 ? html`<${Icon} n="check" s=${18} />` : null}</button>`)}
    </div>` : null}
  </div>`;
}

export function Header({ title, back, right, sub }) {
  return html`<header class="topbar">
    ${back ? html`<button class="icon-btn" aria-label="Back" onClick=${() => (history.length > 1 ? history.back() : go('#/'))}><${Icon} n="back" s=${28} /></button>` : null}
    <div class="topbar-title"><div class="t1">${title}</div>${sub ? html`<div class="t2">${sub}</div>` : null}</div>
    <div class="topbar-right">${right}<${LanguageButton} /></div>
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

// ---------------- Post (layout per design mock) ----------------
export function authorInfo(a) {
  a = a || {};
  if (a.type === 'citizen') return { name: a.person?.name, kind: a.person?.kind, href: '#/person/' + a.person?.id, sub: null };
  if (a.type === 'position') return { name: a.title, kind: 'public', avatar: a.person?.name, href: '#/position/' + a.id, sub: a.person?.name, verified: true, ring: 'official' };
  if (a.type === 'contractor') return { name: a.title, kind: 'public', href: '#/contractor/' + a.id, sub: 'Contractor', ring: 'contractor' };
  return { name: 'Platform Admin', kind: 'public', href: '#/', sub: 'Verified platform account', verified: true, ring: 'admin' };
}

export function AuthorLine({ author, regionId, regionName: rn, createdAt, reasons, source }) {
  const a = authorInfo(author);
  return html`<div class="author">
    <a href=${a.href} class="author-av" onClick=${(e) => e.stopPropagation()}><${Avatar} name=${a.avatar || a.name} kind=${a.kind} size=${32} ring=${a.ring} /></a>
    <div class="author-meta">
      <div class="author-name"><a href=${a.href} onClick=${(e) => e.stopPropagation()}>${a.name}</a>${a.verified ? html` <span class="verified" title="Verified"><${Icon} n="check" s=${12} w=${3} /></span>` : null}<span class="dim"> • ${ago(createdAt)}</span></div>
      <div class="author-sub">${a.sub ? html`${a.sub} · ` : null}<a href=${'#/region/' + regionId} onClick=${(e) => e.stopPropagation()}>${rn}</a>${source?.channel ? html` · via ${source.channel}` : null}${reasons?.length ? html` · <span class="reason">${reasons[0]}</span>` : null}</div>
    </div>
  </div>`;
}

export function RepairStrip({ wo }) {
  if (!wo) return null;
  const late = !wo.slaMet, failed = wo.reopened;
  return html`<a class="repair" href=${'#/wo/' + wo.id} onClick=${(e) => e.stopPropagation()}>
    <div class="repair-top"><${Icon} n="wrench" s=${18} /><b>${wo.method}</b><span class="dim">· ${wo.contractorName}</span></div>
    <div class="repair-facts">
      <span><b>${rs(wo.cost)}</b>${wo.costRatio ? html` <i class=${wo.costRatio > 1.5 ? 'bad' : ''}>${wo.costRatio.toFixed(1)}× rate card</i>` : null}</span>
      <span class=${late ? 'warn' : 'ok'}>${late ? 'Late' : 'On time'}</span>
      <span class=${failed ? 'bad' : 'ok'}>${failed ? 'Fix failed in 30 days' : 'Fix held 30+ days'}</span>
    </div>
    ${wo.flags.filter((f) => ['overbilled', 'duplicate', 'dlp'].includes(f)).length ? html`<div class="flag-row">${wo.flags.filter((f) => ['overbilled', 'duplicate', 'dlp'].includes(f)).map((f) => html`<span class="flag">${store.meta.flagLabels[f]}</span>`)}</div>` : null}
  </a>`;
}

// Image slot under every title. Real photos (uploaded in the app) fill it; otherwise an empty,
// labelled 16:9 holder is shown. The dataset only has text descriptions of photos (its photo_url
// values are placehold.co placeholders), so that description becomes the holder's caption.
// To fill a holder later, add an image URL to the post's `images` array.
export function PostMedia({ p, note = true }) {
  const imgs = (p.images || []).filter(Boolean);
  const ill = !imgs.length && postPhoto(p);
  if (ill) return html`<figure class="post-figure post-figure-ill">
    <div class="post-images n1"><img src=${ill.src} alt=${p.photoNote || 'Illustrative photo of a road problem'} loading="lazy" /></div>
    <figcaption>${credit(ill)}</figcaption>
  </figure>`;
  if (imgs.length) return html`<figure class="post-figure">
    <div class=${'post-images n' + Math.min(imgs.length, 3)}>${imgs.slice(0, 3).map((src) => html`<img src=${src} alt=${p.photoNote || 'Photo attached to this post'} loading="lazy" />`)}</div>
  </figure>`;
  return html`<figure class="post-figure" data-image-slot=${p.id}>
    <div class="media-holder" role="img" aria-label=${'Image placeholder' + (note && p.photoNote ? ': ' + p.photoNote : '')}>
      <span class="ratio">16:9</span>
      <${Icon} n="image" s=${28} w=${1.5} />
      <b>${note && p.photoNote ? 'Photo not uploaded yet' : 'Image placeholder'}</b>
      <span>${note && p.photoNote ? 'Citizen described it as: ' + p.photoNote : 'Space reserved for a photo'}</span>
    </div>
  </figure>`;
}

// Card order: author, headline, body, tag row, image, actions. Everything else (road, responsible
// positions, repair record, linked problems, location) lives in the thread page's Details block.
export function PostCard({ p, compact, full }) {
  const [up, setUp] = useState({ on: p.upvoted, n: p.upvoteCount });
  const [saved, setSaved] = useState(false);
  useEffect(() => setUp({ on: p.upvoted, n: p.upvoteCount }), [p.upvoted, p.upvoteCount]);
  const vote = async (e) => {
    e.stopPropagation();
    if (!store.token) return go('#/login');
    setUp((u) => ({ on: !u.on, n: u.n + (u.on ? -1 : 1) }));
    try { const r = await post(`/posts/${p.id}/upvote`); setUp({ on: r.upvoted, n: r.upvoteCount }); } catch (err) { toast(err.message); }
  };
  const open = () => go('#/post/' + p.id);
  const fmt = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : n);
  return html`<article class=${'post post-' + p.tag + (full ? ' full' : '')} onClick=${full ? undefined : (e) => { if (e.target.closest('a,button,input,label')) return; if (getSelection()?.toString()) return; open(); }}>
    <div class="post-head"><${AuthorLine} ...${p} /></div>
    ${full ? html`<h1 class="post-title">${p.title}</h1>` : html`<h3 class="post-title">${p.title}</h3>`}
    <p class=${'post-body' + (compact ? ' clamp' : '')}>${p.body}</p>
    <div class="post-tags"><${TagPill} tag=${p.tag} />${p.category ? html`<span class="chip">${p.category}</span>` : null}<${StatusPill} status=${p.status} /></div>
    <${PostMedia} p=${p} note=${false} />
    <div class="actions">
      <button class=${'act' + (up.on ? ' on' : '')} onClick=${vote} aria-label="Upvote"><${Icon} n="up" s=${24} fill=${up.on ? 'currentColor' : 'none'} /><span>${fmt(up.n)}</span></button>
      <button class="act" onClick=${open} aria-label="Comments"><${Icon} n="comment" s=${24} /><span>${fmt(p.commentCount + (p.progressUpdates?.length || 0))}</span></button>
      <button class="act" aria-label="Share" onClick=${(e) => { e.stopPropagation(); navigator.clipboard?.writeText(location.origin + '/#/post/' + p.id); toast('Link copied'); }}><${Icon} n="share" s=${24} /></button>
      <button class=${'act save' + (saved ? ' on' : '')} aria-label="Save" onClick=${(e) => { e.stopPropagation(); setSaved(!saved); toast(saved ? 'Removed from saved' : 'Saved'); }}><${Icon} n="bookmark" s=${24} fill=${saved ? 'currentColor' : 'none'} /></button>
    </div>
  </article>`;
}

// ---------------- Rows ----------------
export function PositionRow({ p, showRegion, right }) {
  if (!p) return null;
  const holder = person(p.holderUserId);
  return html`<a class="row" href=${'#/position/' + p.id}>
    <${Avatar} name=${holder?.name || p.title} size=${44} ring="official" />
    <div class="row-main">
      <div class="row-t">${p.title}${p.isHead ? html` <span class="head-badge">Head</span>` : null}</div>
      <div class="row-s">${holder ? html`${holder.name} <${Party} party=${holder.party} />` : html`<i>Vacant</i>`}${showRegion ? html` · ${regionName(p.regionId)}` : null}</div>
    </div>
    ${right !== undefined ? right : html`<${FollowButton} type="position" id=${p.id} small />`}
  </a>`;
}
export function ContractorRow({ c, right }) {
  if (!c) return null;
  return html`<a class="row" href=${'#/contractor/' + c.id}>
    <${Avatar} name=${c.name} size=${44} ring="contractor" />
    <div class="row-main"><div class="row-t">${c.name}</div><div class="row-s">${c.type === 'group' ? 'Group of citizens' : c.type === 'individual' ? 'Individual' : 'Company'}${c.empanelledSince ? ` · empanelled ${c.empanelledSince}` : ''} · ${c.regionIds.length} wards</div></div>
    ${right || null}
  </a>`;
}
export function ProjectRow({ pj }) {
  const pctv = pj.budget ? Math.min(100, Math.round((pj.spent / pj.budget) * 100)) : 0;
  return html`<a class="row project-row" href=${'#/project/' + pj.id}>
    <div class="proj-ic"><${Icon} n="briefcase" s=${22} /></div>
    <div class="row-main">
      <div class="row-t">${pj.title}</div>
      <div class="row-s">${inr(pj.budget)} · <${StatusPill} status=${pj.status} /> · ${regionName(pj.regionId)}</div>
      <div class="bar thin"><i style=${`width:${pctv}%`}></i></div>
    </div>
  </a>`;
}
export function RegionRow({ r, right }) {
  return html`<a class="row" href=${'#/region/' + r.id}>
    <div class="region-ic"><${Icon} n="map" s=${22} /></div>
    <div class="row-main"><div class="row-t">${r.name}</div><div class="row-s">${levelLabel(r.type)}</div></div>
    ${right || null}
  </a>`;
}
export function WorkOrderRow({ w }) {
  const high = (w.flagDetails || []).filter((f) => f.severity === 'high');
  return html`<a class="row wo-row" href=${'#/wo/' + w.id}>
    <div class=${'proj-ic' + (high.length ? ' bad' : '')}><${Icon} n=${high.length ? 'alert' : 'wrench'} s=${22} /></div>
    <div class="row-main">
      <div class="row-t">${w.workType || ''} — ${w.roadName || ''} <span class="dim small">${w.id}</span></div>
      <div class="row-s">${rs(w.cost)} · ${w.method} · ${w.contractorName} · ${fmtDate(w.completedAt)}</div>
      <div class="row-s">${w.slaMet ? html`<span class="ok">On time</span>` : html`<span class="warn">Late</span>`} · ${w.reopened ? html`<span class="bad">Re-opened</span>` : html`<span class="ok">Held</span>`}${high.map((f) => html` · <span class="flag">${store.meta.flagLabels[f.type]}</span>`)}</div>
    </div>
  </a>`;
}

export function Breadcrumb({ regionId }) {
  const c = chain(regionId).reverse();
  return html`<nav class="crumbs">${c.map((r, i) => html`${i ? html`<span>›</span>` : null}<a href=${'#/region/' + r.id}>${r.shortName || r.name}</a>`)}</nav>`;
}

// ---------------- Budget bars ----------------
export function Bars({ title, entries, total, note, money = rs }) {
  if (!entries?.length) return null;
  const max = Math.max(...entries.map((e) => e[1]));
  return html`<section class="card pad">
    <div class="sec-h"><b>${title}</b>${total != null ? html`<span class="dim">${money(total)}</span>` : null}</div>
    ${entries.map(([k, v]) => html`<div class="budget-row"><div class="budget-l"><span>${k}</span><b>${money(v)}</b></div><div class="bar"><i style=${`width:${Math.max(2, (v / max) * 100)}%`}></i></div></div>`)}
    ${note ? html`<div class="dim small">${note}</div>` : null}
  </section>`;
}
export const BudgetBars = ({ budget, title = 'Budget by category' }) => html`<${Bars} title=${title} entries=${Object.entries(budget || {}).sort((a, b) => b[1] - a[1])} total=${Object.values(budget || {}).reduce((a, b) => a + b, 0)} money=${inr} />`;

// ---------------- Map: real ward polygons; click an area to zoom into it ----------------
function wardsBelow(r) {
  if (r.geometry) return [r];
  const out = [];
  const walk = (id) => { for (const k of children(id)) { if (k.geometry) out.push(k); else walk(k.id); } };
  walk(r.id);
  return out;
}
export function AreaMap({ regions, focus, marker, height = 220, onPick, roads }) {
  const ref = useRef();
  useEffect(() => {
    if (!ref.current) return;
    const map = L.map(ref.current, { zoomControl: true, attributionControl: true, scrollWheelZoom: false });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap contributors' }).addTo(map);
    const all = L.featureGroup().addTo(map);
    let focusLayer = null;
    const seen = new Set();
    const drawRegion = (r, isFocus) => {
      const polys = wardsBelow(r).filter((w) => !seen.has(w.id));
      if (polys.length) {
        polys.forEach((w) => {
          seen.add(w.id);
          const layer = L.geoJSON(w.geometry, { style: { color: isFocus ? '#facc15' : '#7c8cff', weight: isFocus ? 2.5 : 1.2, fillOpacity: isFocus ? 0.18 : 0.06 } })
            .bindTooltip(w.shortName || w.name, { sticky: true })
            .on('click', (e) => {
              map.fitBounds(layer.getBounds(), { padding: [16, 16] });
              L.popup().setLatLng(e.latlng).setContent(`<b>${w.name}</b><br><a href="#/region/${w.id}">Open ward page ›</a>`).openOn(map);
            });
          layer.addTo(all);
          if (isFocus) focusLayer = focusLayer ? focusLayer.addLayer(layer) && focusLayer : L.featureGroup([layer]);
        });
      } else if (!seen.has(r.id)) {
        seen.add(r.id);
        const c = L.circle(r.center, { radius: r.radiusKm * 1000, color: isFocus ? '#facc15' : '#7c8cff', weight: 1.5, fillOpacity: 0.06 }).bindTooltip(r.name)
          .on('click', () => map.fitBounds(c.getBounds()));
        c.addTo(all);
        if (isFocus) focusLayer = L.featureGroup([c]);
      }
    };
    const [first, ...rest] = regions;
    if (first) drawRegion(first, true);
    rest.forEach((r) => drawRegion(r, false));
    (roads || []).forEach((rd) => L.polyline(rd.path, { color: rd.color || '#f97316', weight: 6, opacity: 0.9 }).bindTooltip(rd.label || rd.name).on('click', () => rd.href && go(rd.href)).addTo(all));
    if (marker) L.circleMarker([marker.lat, marker.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#e11d48', fillOpacity: 1 }).addTo(all);
    const target = roads?.length && focus === 'roads' ? L.featureGroup((roads || []).map((rd) => L.polyline(rd.path))) : focusLayer || all;
    try { map.fitBounds(target.getBounds(), { padding: [12, 12], maxZoom: 16 }); } catch { map.setView([19.07, 72.88], 11); }
    if (onPick) map.on('click', (e) => onPick(e.latlng));
    setTimeout(() => map.invalidateSize(), 120);
    return () => map.remove();
  }, [regions.map((r) => r.id).join(), marker?.lat, marker?.lng, (roads || []).map((r) => r.id).join()]);
  return html`<div class="map" ref=${ref} style=${`height:${height}px`}></div>`;
}

// ---------------- Follow the rupee panels ----------------
export function Kpis({ items }) {
  return html`<div class="kpis">${items.map(([v, l, cls, onClick]) => html`<button class=${'kpi ' + (cls || '')} onClick=${onClick}><b>${v}</b><span>${l}</span></button>`)}</div>`;
}

export function MoneyPanel({ m, regionId }) {
  if (!m || m.none) return html`<${Empty}>No monsoon repair spending recorded for this area.</${Empty}>`;
  const used = m.budget ? m.spend / m.budget : 0;
  const review = m.flags.overbilled.excess + m.flags.duplicate.amount + m.flags.dlp.amount;
  return html`
    ${m.summary ? html`<section class="card pad summary"><div class="sec-h"><b>In plain words</b><span class="dim small">Auto-generated from work orders</span></div><p>${m.summary}</p><${ComingSoon} label="Ask Claude about this ward" icon="sparkle" /></section>` : null}
    <section class="card pad">
      <div class="sec-h"><b>Where did the money go?</b><span class="dim small">Monsoon 2025 · Jun–Oct</span></div>
      <div class="budget-l big"><span>Spent ${rs(m.spend)} of ${rs(m.budget)}</span><b class=${used > 1 ? 'bad' : ''}>${pct(used)}</b></div>
      <div class=${'bar' + (used > 1 ? ' over' : '')}><i style=${`width:${Math.min(100, used * 100)}%`}></i></div>
      <div class="money-grid">
        <div><b>${m.jobs}</b><span>repair jobs</span></div>
        <div><b class=${m.slaMet < 0.5 ? 'warn' : ''}>${pct(m.slaMet)}</b><span>on time</span></div>
        <div><b class=${m.reopenRate > 0.25 ? 'bad' : ''}>${pct(m.reopenRate)}</b><span>fixes failed</span></div>
        <div><b class="bad">${rs(m.failedSpend)}</b><span>spent on failed fixes</span></div>
      </div>
    </section>
    <section class="card pad">
      <div class="sec-h"><b>Needs a second look</b><b class="bad">${rs(review)}</b></div>
      ${[['dlp', 'Paid while road was under Defect Liability Period', m.flags.dlp.amount], ['duplicate', 'Possible double billing (same road & work, days apart, no complaint)', m.flags.duplicate.amount], ['overbilled', 'Billed above 1.5× the rate card (excess over standard rate)', m.flags.overbilled.excess]].map(([k, label, amt]) => html`<a class="audit-row" href=${`#/audit/${regionId}?flag=${k}`}><div class="grow"><b>${store.meta.flagLabels[k]}</b><div class="dim small">${label}</div></div><div class="right"><b>${rs(amt)}</b><div class="dim small">${m.flags[k].jobs} jobs ›</div></div></a>`)}
      <p class="dim small">Flags are prompts to check the records, not proof of wrongdoing.</p>
    </section>
    <${Bars} title="Spend by contractor" entries=${m.byContractor} />
    <${Bars} title="Spend by issue" entries=${m.byWorkType} />
    <${Bars} title="Spend by repair method" entries=${m.byMethod} />
    <${Bars} title="Spend by month" entries=${m.byMonth.map(([k, v]) => [new Date(k + '-01').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' }), v])} />
    ${m.wards ? html`<section class="card pad"><div class="sec-h"><b>Wards: budget used</b><span class="dim small">highest first</span></div>
      ${m.wards.map((w) => html`<a class="ward-row" href=${'#/region/' + w.id + '?tab=money'}><div class="budget-l"><span>${w.name}</span><b class=${w.spend > w.budget ? 'bad' : ''}>${pct(w.spend / (w.budget || 1))}</b></div><div class=${'bar' + (w.spend > w.budget ? ' over' : '')}><i style=${`width:${Math.min(100, (w.spend / (w.budget || 1)) * 100)}%`}></i></div><div class="dim small">${rs(w.spend)} of ${rs(w.budget)} · ${w.jobs} jobs · ${pct(w.reopenRate)} failed · ${w.flagged} flagged</div></a>`)}
    </section>` : null}`;
}

export function PlannerPanel({ data }) {
  if (!data || data.none) return html`<${Empty}>No ward data for this area.</${Empty}>`;
  const F = { demand: 'Complaints', failures: 'Repeat failures', flood: 'Flood risk', traffic: 'Traffic', accidents: 'Accidents', facilities: 'Hospitals/schools' };
  return html`
    <section class="card pad summary">
      <div class="sec-h"><b>Where should the next rupee go?</b></div>
      <p>${data.totalIssues} open road and drain issues, ranked by risk: complaints, repeat failures, flooding, traffic, accidents and nearby hospitals or schools. ${data.remainingStart > 0 ? html`Remaining budget ${rs(data.remainingStart)} covers the items marked <b>Funded</b>.` : html`<b>This budget is used up</b> — this is the priority list for the next allocation.`}</p>
      <p class="dim small">Roads under Defect Liability Period go back to the original contractor at no cost to BMC.</p>
    </section>
    ${data.issues.map((it, i) => html`<section class="card pad plan">
      <div class="plan-top"><span class="rank-big">${i + 1}</span><div class="grow"><a href=${it.roadId ? '#/road/' + it.roadId : '#/region/' + it.regionId} class="row-t">${it.roadName}</a><div class="dim small">${it.wardName} · ${it.family === 'road' ? 'Road surface' : 'Drainage / waterlogging'}</div></div><div class=${'risk r' + Math.min(4, Math.floor(it.score / 20))}>${it.score}<small>risk</small></div></div>
      <div class="factors">${Object.entries(it.factors).map(([k, v]) => html`<div class="factor"><span>${F[k]}</span><div class="bar thin"><i style=${`width:${Math.round(v * 100)}%`}></i></div></div>`)}</div>
      ${it.why.length ? html`<div class="why">${it.why.join(' · ')}</div>` : null}
      <div class="rec"><${Icon} n="wrench" s=${18} /><div class="grow"><b>${it.method}</b>${it.underDlp ? html`<div class="dim small">Road under DLP — contractor must repair free</div>` : html`<div class="dim small">Fails ${pct(it.methodReopen)} of the time vs ${pct(it.cheapestReopen)} for ${it.cheapest} (cheapest)</div>`}</div><div class="right"><b>${it.estCost ? rs(it.estCost) : '₹0'}</b>${it.funded ? html`<div class="ok small">Funded</div>` : html`<div class="warn small">Next allocation</div>`}</div></div>
      <div class="dim small">${it.complaintIds.length} open complaint${it.complaintIds.length > 1 ? 's' : ''}: ${it.complaintIds.slice(0, 4).map((id, j) => html`${j ? ', ' : ''}<a href=${'#/post/' + id}>${id}</a>`)}${it.complaintIds.length > 4 ? '…' : ''}</div>
    </section>`)}`;
}

export function ScorecardPanel({ sc, name }) {
  if (!sc) return null;
  return html`<section class="card pad scorecard">
    <div class="sec-h"><b>Scorecard${name ? ' — ' + name : ''}</b><span class=${'score s' + Math.min(4, Math.floor(sc.score / 20))}>${sc.score}<small>/100</small></span></div>
    <p>${sc.summary}</p>
    <div class="money-grid">
      <div><b>${pct(sc.slaMet)}</b><span>on time (peers ${pct(sc.peer.sla)})</span></div>
      <div><b class=${sc.reopen > sc.peer.reopen + 0.03 ? 'bad' : sc.reopen < sc.peer.reopen - 0.03 ? 'ok' : ''}>${pct(sc.reopen)}</b><span>fixes failed (peers ${pct(sc.peer.reopen)})</span></div>
      <div><b>${pct(sc.inBand)}</b><span>bills within normal range</span></div>
      <div><b>${rs(sc.spend)}</b><span>${sc.jobs} jobs · ${sc.wards.length} wards</span></div>
    </div>
    <div class="flag-row">${Object.entries(sc.flags).map(([k, n]) => n ? html`<a class="flag" href=${`#/audit/r_bmc?flag=${k}&contractor=${sc.contractorId}`}>${store.meta.flagLabels[k]}: ${n}</a>` : null)}</div>
    <div class="dim small">Fair comparison: each job is compared with other contractors' jobs of the same type in the same ward.</div>
  </section>`;
}

export function DemoBanner() {
  return html`<div class="demo-banner">Prototype · synthetic Mumbai dataset · all people, parties and contractors are fictional</div>`;
}

// ---------------- Stories: pill of followed positions/contractors with unseen count ----------------
import { api as _api, actingAs as _actingAs, positionsIn as _positionsIn } from './lib.js';
// Overlapping round avatars of the authorities behind a joint "solved" story.
const JointFaces = ({ authors, size }) => html`<span class="joint-faces">${authors.map((a) => html`<${Avatar} name=${a.person || a.title} size=${size} />`)}</span>`;
export function StoriesPill() {
  const [d, setD] = useState(null);
  const [open, setOpen] = useState(null);
  const load = () => _api('/stories').then(setD).catch(() => {});
  useEffect(() => { if (store.token) load(); }, [store.version, store.token]);
  if (!d?.groups.length) return null;
  const solo = d.groups.filter((g) => !g.joint), joint = d.groups.filter((g) => g.joint);
  const faces = solo.slice(0, 2);
  return html`<div class="story-slots">
      ${solo.length ? html`<div class="story-slot-i">
        <button class=${'story-pill' + (d.unseen ? '' : ' seen')} onClick=${() => setOpen(0)} aria-label=${`${d.unseen} new stories`}>
          ${faces.map((g) => html`<${Avatar} name=${g.person || g.title} size=${54} />`)}
          ${d.unseen ? html`<i class="story-count">${d.unseen}</i>` : null}
        </button>
        <div class="story-label">Stories</div>
      </div>` : null}
      ${joint.map((g) => html`<div class="story-slot-i" key=${g.key}>
        <button class=${'story-pill joint-pill' + (g.items[0].seen ? ' seen' : '')} onClick=${() => setOpen(d.groups.indexOf(g))} aria-label=${`Solved: ${g.problem?.title || 'joint story'}, by ${g.authors.map((a) => a.title).join(', ')}`}>
          <${JointFaces} authors=${g.authors} size=${g.authors.length > 2 ? 46 : 54} />
        </button>
        <div class="story-label joint-label"><${Icon} n="check" s=${14} w=${2.5} />Solved</div>
      </div>`)}
    </div>
    ${open != null ? html`<${StoryViewer} groups=${d.groups} start=${open} onClose=${() => { setOpen(null); load(); }} />` : null}`;
}
function StoryViewer({ groups, start, onClose }) {
  const [gi, setGi] = useState(start);
  const [ii, setIi] = useState(0);
  const g = groups[gi], it = g?.items[ii];
  useEffect(() => { if (it) post(`/stories/${it.id}/seen`).catch(() => {}); }, [it?.id]);
  useEffect(() => { const t = setTimeout(next, g?.joint ? 10000 : 6000); return () => clearTimeout(t); }, [gi, ii]);
  function next() { if (ii + 1 < g.items.length) setIi(ii + 1); else if (gi + 1 < groups.length) { setGi(gi + 1); setIi(0); } else onClose(); }
  const prev = () => { if (ii > 0) setIi(ii - 1); else if (gi > 0) { setGi(gi - 1); setIi(0); } };
  if (!g) return null;
  const leave = (e) => { e.stopPropagation(); onClose(); };
  if (g.joint) return html`<div class="story-view joint-view" onClick=${(e) => (e.clientX < innerWidth / 3 ? prev() : next())}>
    <div class="story-bars">${g.items.map((_, i) => html`<i class=${i < ii ? 'done' : i === ii ? 'run joint-run' : ''} key=${gi + '-' + i + '-' + ii}></i>`)}</div>
    <div class="story-head joint-head">
      <span class="joint-ring"><${JointFaces} authors=${g.authors} size=${40} /></span>
      <div class="grow"><div class="joint-solved"><${Icon} n="check" s=${16} w=${2.5} />Solved</div><div class="joint-meta">Joint story · ${g.authors.length} authorities · ${ago(it.createdAt)}</div></div>
      <button class="icon-btn" aria-label="Close" onClick=${leave}><${Icon} n="x" s=${30} /></button>
    </div>
    <div class="joint-body">
      ${g.problem ? html`<div class="joint-problem">${g.problem.title}</div>` : null}
      <figure class="story-photo"><img src=${storyPhoto(it.id, true).src} alt="Road work" /><figcaption>${credit(storyPhoto(it.id, true))}</figcaption></figure>
      <p class="joint-text">${it.text}</p>
      <ul class="joint-authors">${g.authors.map((a) => html`<li><a href=${'#/position/' + a.id} onClick=${leave}><${Avatar} name=${a.person || a.title} size=${32} /><span class="grow"><b>${a.title}</b><span>${a.person || 'Vacant'}</span></span></a></li>`)}</ul>
      ${g.problem ? html`<a class="joint-link" href=${'#/post/' + g.problem.id} onClick=${leave}>View the problem <${Icon} n="chev" s=${16} /></a>` : null}
    </div>
  </div>`;
  const href = g.actor.type === 'position' ? '#/position/' + g.actor.id : '#/contractor/' + g.actor.id;
  return html`<div class="story-view" onClick=${(e) => (e.clientX < innerWidth / 3 ? prev() : next())}>
    <div class="story-bars">${g.items.map((_, i) => html`<i class=${i < ii ? 'done' : i === ii ? 'run' : ''} key=${gi + '-' + i + '-' + ii}></i>`)}</div>
    <div class="story-head"><${Avatar} name=${g.person || g.title} size=${40} ring="official" /><a href=${href} onClick=${(e) => { e.stopPropagation(); onClose(); }}><b>${g.title}</b><div class="dim small">${g.person || ''} · ${ago(it.createdAt)}</div></a><button class="icon-btn" aria-label="Close" onClick=${(e) => { e.stopPropagation(); onClose(); }}><${Icon} n="x" s=${30} /></button></div>
    <figure class="story-photo"><img src=${storyPhoto(it.id).src} alt="Road work" /><figcaption>${credit(storyPhoto(it.id))}</figcaption></figure>
    <div class="story-text">${it.text}</div>
  </div>`;
}
export function NewStory() {
  const a = _actingAs();
  const [text, setText] = useState('');
  if (a.type !== 'position' && a.type !== 'contractor') return null;
  const send = async (e) => { e.preventDefault(); try { await post('/stories', { actingAs: a, text }); setText(''); toast('Story posted for 24 hours'); } catch (err) { toast(err.message); } };
  return html`<form class="new-story" onSubmit=${send}><input value=${text} onInput=${(e) => setText(e.target.value)} placeholder="Post a story to your followers (24 h)…" maxlength="280" /><button class="btn btn-primary btn-sm" disabled=${text.trim().length < 5}>Share</button></form>`;
}

// ---------------- Joint solved story: 2–3 authorities announce one problem as solved ----------------
export function JointStoryAction({ post: p }) {
  const [open, setOpen] = useState(false);
  return html`<button class="btn btn-sm joint-btn" onClick=${() => setOpen(true)}><${Icon} n="users" s=${16} />Publish joint solved story</button>
    ${open ? html`<${JointStorySheet} post=${p} onClose=${() => setOpen(false)} />` : null}`;
}
export function JointStorySheet({ post: p, onClose }) {
  const act = _actingAs();
  const me = act.type === 'position' ? position(act.id) : null;
  const [sel, setSel] = useState([]);
  const [text, setText] = useState(`${p.title} is solved. `);
  const [markResolved, setMarkResolved] = useState(p.status !== 'resolved');
  const [busy, setBusy] = useState(false);
  const resp = new Set((p.responsible || []).map((r) => r.positionId));
  // Co-authority candidates: offices responsible for this problem first, then the nearest offices up the area chain.
  const cands = chain(p.regionId).flatMap((r, d) => _positionsIn(r.id).map((x) => ({ x, d })))
    .filter(({ x }) => x.id !== me?.id && x.holderUserId)
    .sort((a, b) => (resp.has(b.x.id) - resp.has(a.x.id)) || a.d - b.d || a.x.rank - b.x.rank)
    .slice(0, 10).map((o) => o.x);
  const toggle = (id) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length < 2 ? [...s, id] : s));
  const publish = async () => {
    setBusy(true);
    try {
      await post('/stories/joint', { actingPositionId: me.id, positionIds: [me.id, ...sel], problemPostId: p.id, text, markResolved });
      toast('Joint solved story published');
      onClose();
    } catch (err) { toast(err.message); setBusy(false); }
  };
  const holder = (x) => person(x.holderUserId)?.name;
  return html`<${Sheet} open title="Joint solved story" onClose=${onClose}>
    <div class="joint-sheet">
      ${!me ? html`<p class="joint-intro">Switch to your position to publish a joint story.</p>` : html`
      <p class="joint-intro">One story from you and up to two other authorities who worked on this problem. The citizen who reported it, everyone who upvoted it and the followers of each authority will see it for a week.</p>
      <div class="joint-sec">Problem</div>
      <div class="joint-prob">${p.title}</div>
      <div class="joint-sec">Authorities <span>${sel.length + 1} of 3</span></div>
      <div class="joint-cand me"><${Avatar} name=${holder(me) || me.title} size=${32} /><div class="row-main"><div class="row-t">${me.title}</div><div class="row-s">${holder(me) || ''} · You</div></div></div>
      ${cands.map((x) => { const on = sel.includes(x.id); return html`<button type="button" class=${'joint-cand' + (on ? ' on' : '')} aria-pressed=${on} disabled=${!on && sel.length >= 2} onClick=${() => toggle(x.id)}>
        <${Avatar} name=${holder(x) || x.title} size=${32} />
        <div class="row-main"><div class="row-t">${x.title}</div><div class="row-s">${holder(x)} · ${regionName(x.regionId)}${resp.has(x.id) ? ' · Responsible' : ''}</div></div>
        <span class="joint-tick">${on ? html`<${Icon} n="check" s=${18} w=${2.5} />` : null}</span>
      </button>`; })}
      <label class="joint-sec" for="joint-text">What was done</label>
      <textarea id="joint-text" rows="4" maxlength="400" value=${text} onInput=${(e) => setText(e.target.value)}></textarea>
      <div class="joint-count">${text.length}/400</div>
      ${p.status !== 'resolved' ? html`<label class="joint-check"><input type="checkbox" checked=${markResolved} onChange=${(e) => setMarkResolved(e.target.checked)} />Also mark this problem as resolved</label>` : null}
      <button class="btn btn-primary btn-block" disabled=${busy || !sel.length || text.trim().length < 10} onClick=${publish}>${busy ? 'Publishing…' : sel.length ? `Publish with ${sel.length + 1} authorities` : 'Pick at least one co-authority'}</button>`}
    </div>
  </${Sheet}>`;
}

// ---------------- Budget: total, % allocation, click for charts ----------------
const PALETTE = ['#7c8cff', '#facc15', '#22c55e', '#f97316', '#ec4899', '#06b6d4', '#a78bfa', '#84cc16'];
export function Donut({ parts, size = 180 }) {
  const total = parts.reduce((a, p) => a + p[1], 0) || 1;
  let acc = 0;
  const r = 70, c = 2 * Math.PI * r;
  return html`<svg viewBox="0 0 180 180" width=${size} height=${size} class="donut">${parts.map(([k, v], i) => { const len = (v / total) * c; const el = html`<circle cx="90" cy="90" r=${r} fill="none" stroke=${PALETTE[i % PALETTE.length]} stroke-width="26" stroke-dasharray=${`${len} ${c - len}`} stroke-dashoffset=${-acc} transform="rotate(-90 90 90)"><title>${k}</title></circle>`; acc += len; return el; })}</svg>`;
}
export function BudgetPanel({ title = 'Budget', entries, money = inr, context, detail }) {
  const [open, setOpen] = useState(null);
  const list = (entries || []).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
  if (!list.length) return null;
  const total = list.reduce((a, e) => a + e[1], 0);
  const share = (v) => ((v / total) * 100).toFixed(v / total < 0.1 ? 1 : 0) + '%';
  return html`<section class="card pad budget">
    <div class="sec-h"><b>${title}</b><button class="link-btn" onClick=${() => setOpen('all')}>Charts ›</button></div>
    <div class="budget-total">${money(total)}<span>total allocated</span></div>
    ${context ? html`<div class="dim small">${context}</div>` : null}
    <div class="stack">${list.map(([k, v], i) => html`<i style=${`width:${(v / total) * 100}%;background:${PALETTE[i % PALETTE.length]}`} title=${k}></i>`)}</div>
    ${list.map(([k, v], i) => html`<button class="budget-line" onClick=${() => setOpen(k)}><span class="sw" style=${`background:${PALETTE[i % PALETTE.length]}`}></span><span class="grow">${k}</span><b>${money(v)}</b><span class="pctv">${share(v)}</span><${Icon} n="chev" s=${18} /></button>`)}
    <${Sheet} open=${!!open} title=${open === 'all' ? title : open} onClose=${() => setOpen(null)}>
      <div class="chart-wrap"><${Donut} parts=${list} /><div class="donut-center"><b>${open && open !== 'all' ? share(list.find((e) => e[0] === open)?.[1] || 0) : money(total)}</b><span>${open && open !== 'all' ? 'of total' : 'total'}</span></div></div>
      ${list.map(([k, v], i) => html`<div class=${'budget-line static' + (open === k ? ' on' : '')}><span class="sw" style=${`background:${PALETTE[i % PALETTE.length]}`}></span><span class="grow">${k}</span><b>${money(v)}</b><span class="pctv">${share(v)}</span></div>`)}
      ${detail ? detail(open) : null}
    </${Sheet}>
  </section>`;
}
