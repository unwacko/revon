import { html, useState, useEffect, store, useStore, setStore, api, post, useData, go, toast, region, position, contractor, person, chain, children, positionsIn, levelLabel, loadMeta, safeSet, setMode, refreshUnread, ago, M, defaultMode, regionName } from '../lib.js';
import { Header, Icon, Avatar, LanguageButton, Tabs, PostCard, PositionRow, FollowButton, Loading, Empty, ComingSoon, AreaMap, DemoBanner } from '../components.js';
import { ModeSwitch } from './dashboard.js';

async function signIn(token, me) {
  const mode = defaultMode(me);
  safeSet('token', token); safeSet('mode', mode);
  setStore({ token, mode });
  await loadMeta();
}
export async function logout() {
  await post('/auth/logout').catch(() => {});
  safeSet('token', null); safeSet('mode', null);
  setStore({ token: null, mode: 'citizen' });
  await loadMeta();
  go('#/login');
}
export function switchView() {
  const me = store.meta.me;
  const next = store.mode === 'citizen' ? defaultMode(me) : 'citizen';
  if (next === store.mode) return toast('You only have the citizen view');
  setMode(next);
  toast(next === 'citizen' ? 'Switched to citizen view' : 'Switched to your official view');
  go(next === 'citizen' ? '#/' : '#/dashboard');
}

// ---------------- Login ----------------
export function Login() {
  const [step, setStep] = useState('welcome');
  const demo = useData(() => api('/demo-accounts'), []);
  if (step === 'digilocker') return html`<${DigiLockerMock} onBack=${() => setStep('welcome')} />`;
  return html`<div class="login">
    <div class="login-lang"><${LanguageButton} /></div>
    <div class="login-hero">
      <div class="logo big">Revon</div>
      <p>Report road problems. See who is responsible — from your ward engineer to the Prime Minister — where the money went, and whether the fix lasted.</p>
    </div>
    <button class="btn btn-digi btn-block" onClick=${() => setStep('digilocker')}><span class="digi-mark">DL</span> Continue with DigiLocker</button>
    <p class="dim small center">One verified account per real person. Your area is set from your Aadhaar address. Citizens stay anonymous to the public.</p>
    <div class="divider"><span>or try a demo account</span></div>
    <div class="demo-list">${demo.loading ? html`<${Loading} />` : demo.data.map((d) => html`<button class="row as-btn" onClick=${async () => { const r = await post('/auth/demo', { userId: d.id }); await signIn(r.token, r.me); go(defaultMode(r.me) === 'citizen' ? '#/' : '#/dashboard'); }}>
      <${Avatar} name=${d.label} kind=${d.label.startsWith('Citizen') ? 'anon' : 'public'} size=${38} />
      <div class="row-main"><div class="row-t">${d.label}</div><div class="row-s">${d.role}</div></div><${Icon} n="back" s=${16} />
    </button>`)}</div>
    <${DemoBanner} />
  </div>`;
}

function DigiLockerMock({ onBack }) {
  const leaves = M().regions.filter((r) => r.type === 'ward');
  const [f, setF] = useState({ name: '', addressLine: '', regionId: leaves[0].id, consent: false });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.consent) return toast('Please allow sharing of name & address');
    setBusy(true);
    try { const r = await post('/auth/digilocker', f); await signIn(r.token, r.me); go('#/onboarding'); } catch (err) { toast(err.message); }
    setBusy(false);
  };
  return html`<div class="login">
    <${Header} title="DigiLocker" sub="Simulated for the prototype" back=${false} right=${html`<button class="btn btn-ghost btn-sm" onClick=${onBack}>Cancel</button>`} />
    <div class="digi-card">
      <div class="digi-head"><span class="digi-mark">DL</span><div><b>Revon is requesting</b><div class="small">Name · Address (from Aadhaar)</div></div></div>
      <form class="form" onSubmit=${submit}>
        <p class="dim small">In production this is the official DigiLocker sign-in. Here you type sample details — do not enter real Aadhaar numbers.</p>
        <label class="field"><span>Name (as on Aadhaar)</span><input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></label>
        <label class="field"><span>Address</span><input value=${f.addressLine} onInput=${(e) => setF({ ...f, addressLine: e.target.value })} placeholder="Flat, street, locality" /></label>
        <label class="field"><span>Locality (maps to your area)</span><select value=${f.regionId} onChange=${(e) => setF({ ...f, regionId: e.target.value })}>${leaves.map((r) => html`<option value=${r.id}>${r.name}</option>`)}</select></label>
        <label class="check-row"><input type="checkbox" checked=${f.consent} onChange=${(e) => setF({ ...f, consent: e.target.checked })} /> <span>Allow sharing name & address (simulated consent)</span></label>
        <button class="btn btn-primary btn-block" disabled=${busy}>Allow & continue</button>
      </form>
      <${ComingSoon} label="Real DigiLocker + privacy guarantee" icon="shield" block />
    </div>
  </div>`;
}

// ---------------- Onboarding ----------------
export function Onboarding() {
  const s = useStore();
  const me = s.meta.me;
  const [step, setStep] = useState(1);
  const [regionId, setRegionId] = useState(me.regionId);
  const leaves = M().regions.filter((r) => r.type === 'ward');
  const levels = chain(me.regionId);
  const followAllHeads = async () => {
    for (const r of levels) for (const p of positionsIn(r.id).filter((x) => x.isHead)) if (!me.following.positions.includes(p.id)) await post('/follow', { type: 'position', id: p.id, on: true });
    await loadMeta(); toast('Following all area heads');
  };
  const finish = async () => { await post('/me/onboarded'); await loadMeta(); go('#/'); };
  return html`<div class="onboard">
    <div class="steps">${[1, 2, 3].map((n) => html`<i class=${n <= step ? 'on' : ''}></i>`)}</div>
    ${step === 1 ? html`
      <h2 class="h2">Verify your details</h2>
      <section class="card pad">
        <div class="kv"><span>Name</span><b>${me.realName}</b></div>
        <div class="kv"><span>Verified via</span><b class="verified-by">DigiLocker <span class="verified" title="Verified"><${Icon} n="check" s=${12} w=${3} /></span></b></div>
        <div class="kv"><span>Public identity</span><b>${me.handle}</b></div>
        <p class="dim small">By default other citizens only see your anonymous handle, your area and your posts. You can choose to show your name and photo later in Settings → Privacy.</p>
      </section>
      <h3 class="h3">Your assigned area</h3>
      <section class="card pad">
        <select value=${regionId} onChange=${(e) => setRegionId(e.target.value)}>${leaves.map((r) => html`<option value=${r.id}>${r.name}</option>`)}</select>
        <div class="dim small">${chain(regionId).map((r) => r.shortName || r.name).join(' › ')}</div>
        <${AreaMap} regions=${[region(regionId)]} height=${150} />
      </section>
      <button class="btn btn-primary btn-block" onClick=${async () => { if (regionId !== me.regionId) await post('/me/area', { regionId }); await loadMeta(); setStep(2); }}>Confirm area</button>` : null}
    ${step === 2 ? html`
      <h2 class="h2">Who is accountable for you</h2>
      <p class="dim">Follow them to see their updates first. Nearest positions are shown first, then higher areas.</p>
      <button class="btn btn-ghost btn-block" onClick=${followAllHeads}>Follow all area heads</button>
      ${levels.map((r) => html`<section class="card pad"><div class="sec-h"><b>${r.name}</b><span class="dim small">${levelLabel(r.type)}</span></div>${positionsIn(r.id).map((p) => html`<${PositionRow} p=${p} />`)}</section>`)}
      <button class="btn btn-primary btn-block sticky-cta" onClick=${() => setStep(3)}>Continue</button>` : null}
    ${step === 3 ? html`
      <h2 class="h2">You're all set</h2>
      <section class="card pad">
        <p><b>Your home feed</b> shows problems ranked by your area first, then who you follow, then upvotes and recency.</p>
        <p><span class="tag tag-problem">Problem</span> Report what's broken — the platform shows who is responsible.</p>
        <p><span class="tag tag-progress">Progress update</span> Officials respond; you get notified on your post.</p>
        <p><span class="tag tag-position_change">Position change</span> <span class="tag tag-election">Election</span> Platform announcements.</p>
      </section>
      <button class="btn btn-primary btn-block" onClick=${finish}>Go to dashboard</button>` : null}
  </div>`;
}

// ---------------- Notifications ----------------
export function Notifications() {
  const { data, loading } = useData(() => api('/notifications'), []);
  // Remember what was unread when it arrived, then mark it read on the server; rows keep their unread look for this visit.
  const [wasUnread, setWasUnread] = useState(() => new Set());
  useEffect(() => {
    const fresh = (data || []).filter((n) => !n.read && !wasUnread.has(n.id));
    if (!fresh.length) return;
    setWasUnread(new Set([...wasUnread, ...fresh.map((n) => n.id)]));
    post('/notifications/read').then(refreshUnread).catch(() => {});
  }, [data]);
  const unread = (n) => !n.read || wasUnread.has(n.id);
  // type -> [icon, tint]; tints map to the post-type colour tokens in nf-* classes (notifications.css)
  const KIND = {
    comment: ['comment', 'plain'], mention: ['at', 'plain'], follow: ['user', 'plain'], info: ['bell', 'plain'],
    problem: ['alert', 'problem'], grouped: ['grid', 'problem'], reopened: ['alert', 'problem'],
    progress: ['flag', 'progress'], project: ['briefcase', 'position'], contractor: ['rupee', 'position'],
    joint_solved: ['users', 'solved'], resolved: ['check', 'solved'], status: ['check', 'plain'],
  };
  // Bold the actor: seeded items carry `actor`; live ones start with "<office> posted/commented/…".
  const split = (n) => {
    if (n.actor && n.text.startsWith(n.actor)) return [n.actor, n.text.slice(n.actor.length)];
    const m = n.text.match(/^(.+?)( (?:posted|commented|replied|marked|mentioned|placed|published|started|chose|opened|created) .*)$/);
    return m && m[1].length < 90 ? [m[1], m[2]] : [null, n.text];
  };
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  const bucket = (t) => (t >= startOfDay ? 'Today' : t >= startOfDay - 6 * 864e5 ? 'This week' : 'Earlier');
  const groups = ['Today', 'This week', 'Earlier'].map((g) => [g, (data || []).filter((n) => bucket(n.createdAt) === g)]).filter(([, l]) => l.length);
  const row = (n) => {
    const [ic, tint] = KIND[n.type] || KIND.info;
    const [actor, rest] = split(n);
    return html`<a key=${n.id} class=${'nf-row' + (unread(n) ? ' unread' : '')} href=${n.link || '#/'}>
      <span class=${'nf-ic nf-' + (n.type === 'status' && /resolved/.test(n.text) ? 'solved' : tint)}><${Icon} n=${ic} s=${18} /></span>
      <span class="nf-text" title=${n.text}>${actor ? html`<b>${actor}</b>` : null}${rest}</span>
      <span class="nf-time">${ago(n.createdAt)}</span>
      ${!unread(n) ? null : html`<span class="nf-dot" aria-label="Unread"></span>`}
    </a>`;
  };
  return html`<${Header} title="Notifications" />
    ${loading ? html`<${Loading} />` : !data?.length ? html`<${Empty}>No notifications yet. Updates on your problem posts will appear here.</${Empty}>` : html`<div class="nf">
      ${data.some((n) => n.demo) ? html`<div class="nf-note">Demo notifications generated from seed data</div>` : null}
      ${groups.map(([g, list]) => html`<section class="nf-group" aria-label=${g}><h2 class="nf-h">${g}</h2>${list.map((n) => row(n))}</section>`)}
    </div>`}`;
}

// ---------------- My profile ----------------
export function Me() {
  const s = useStore();
  const me = s.meta.me;
  const posts = useData(() => api('/posts?author=' + me.id), [me.id]);
  return html`
    <${Header} title=${me.handle} right=${html`<a class="icon-btn" href="#/settings" aria-label="Settings"><${Icon} n="settings" /></a>`} />
    <section class="profile">
      <div class="profile-top"><${Avatar} kind=${me.showName ? 'citizen' : 'anon'} name=${me.handle} size=${72} />
        <div class="profile-stats"><div><b>${posts.data?.length ?? '—'}</b><span>posts</span></div><div><b>${me.following.positions.length}</b><span>positions</span></div><div><b>${me.following.users.length}</b><span>citizens</span></div></div>
      </div>
      <div class="profile-name">${me.handle} <span class="verified" title="DigiLocker verified"><${Icon} n="check" s=${12} w=${3} /></span></div>
      <div class="profile-sub"><a href=${'#/region/' + me.regionId}>${regionName(me.regionId)}</a> · ${me.showName ? 'showing your name' : 'others see you as anonymous'}</div>
      ${me.realName && !me.showName ? html`<div class="dim small">Only you see: ${me.realName}</div>` : null}
    </section>
    <section class="card pad profile-actions"><a class="row" href="#/settings"><${Icon} n="settings" s=${24} /><div class="row-main">Settings</div><${Icon} n="chev" /></a><button class="row as-btn" onClick=${switchView}><${Icon} n="swap" s=${24} /><div class="row-main">${s.mode === 'citizen' ? 'Switch to official view' : 'Switch to citizen view'}</div></button><button class="row as-btn danger" onClick=${logout}><${Icon} n="logout" s=${24} /><div class="row-main">Log out</div></button></section>
    ${me.following.positions.length ? html`<section class="card pad"><div class="sec-h"><b>Following</b></div>${me.following.positions.map((id) => position(id) && html`<${PositionRow} p=${position(id)} showRegion />`)}</section>` : null}
    <div class="sec-h section-h"><b>Your posts</b></div>
    ${posts.loading ? html`<${Loading} />` : posts.data.length ? html`<div class="feed">${posts.data.map((p) => html`<${PostCard} p=${p} compact />`)}</div>` : html`<${Empty}>You haven't posted yet. <a href="#/new?tag=problem">Report a problem</a></${Empty}>`}`;
}

// ---------------- Settings (two-pane, like the reference design) ----------------
const SECTIONS = [
  ['Your account', [['account', 'user', 'Account', 'DigiLocker verification, home ward'], ['acting', 'swap', 'Acting as', 'Official, contractor or citizen view']]],
  ['How you use Revon', [['notifications', 'bell', 'Notifications']]],
  ['Who can see your content', [['privacy', 'shield', 'Privacy']]],
  ['More info and support', [['roadmap', 'sparkle', "What's coming next"], ['structure', 'tree', 'How India is divided'], ['data', 'chart', 'About the data']]],
];
export function IdentityToggle({ me }) {
  const [busy, setBusy] = useState(false);
  const flip = async (e) => { setBusy(true); try { await post('/me/identity', { showName: e.target.checked }); await loadMeta(); } catch { toast('Could not save'); } setBusy(false); };
  const locked = !!(me.positionIds.length || me.contractorIds.length);
  return html`<section class="set-card">
    <label class="set-toggle"><span><b>Show my name and photo</b><br /><small class="dim">${me.showName ? `People see you as “${me.realName}”.` : `Off: people see only “${me.handle}”, your ward and your posts.`}</small></span><input type="checkbox" class="switch" checked=${!!me.showName} disabled=${busy || !me.realName || locked} onChange=${flip} /></label>
    <p class="dim small">Staying anonymous is the default, and it is your choice. Switch it any time; it applies to your past and future posts. Public roles always show the holder's name.</p>
  </section>`;
}

export function Settings({ query = {} }) {
  const s = useStore();
  const sec = query.s || (window.innerWidth >= 900 ? 'account' : null);
  const me = s.meta.me;
  const title = SECTIONS.flatMap((x) => x[1]).find((x) => x[0] === sec)?.[2];
  const pane = {
    account: html`<section class="set-card"><div class="kv"><span>Verified via</span><b class="verified-by">DigiLocker <span class="verified" title="Verified"><${Icon} n="check" s=${12} w=${3} /></span></b></div><div class="kv"><span>Public name</span><b>${me.handle}</b></div><div class="kv"><span>Home ward</span><a href=${'#/region/' + me.regionId}>${regionName(me.regionId)}</a></div></section><${ComingSoon} label="Update address via DigiLocker" icon="pin" block />`,
    acting: me.positionIds.length || me.contractorIds.length || me.role === 'admin' ? html`<${ModeSwitch} />` : html`<section class="set-card"><p>You use Revon as a citizen. If you are elected or hired into a position, or join a contractor, you'll be able to switch views here.</p></section>`,
    notifications: html`${['Progress on my problem posts', 'Posts from people I follow', 'Position changes in my ward', 'Election announcements'].map((l) => html`<label class="set-toggle"><span>${l}</span><input type="checkbox" class="switch" checked /></label>`)}<${ComingSoon} label="Push & SMS notifications" icon="bell" block />`,
    privacy: html`<${IdentityToggle} me=${me} /><${ComingSoon} label="DigiLocker privacy & no-leak guarantee" icon="shield" block />`,
    roadmap: html`<${RoadmapList} />`,
    structure: html`<a class="btn btn-ghost" href="#/structure">Open the explainer ›</a>`,
    data: html`<section class="set-card"><p>Problems, repairs, roads, wards and risk data come from the synthetic “Follow the Rupee: Mumbai Monsoon Roads” dataset (CC BY 4.0). It is not BMC data. Office holders, parties and contractor staff are fictional.</p></section>`,
  }[sec];
  return html`<div class=${'settings' + (sec ? ' has-pane' : '')}>
    <aside class="set-nav">
      <div class="set-h">Settings <${LanguageButton} /></div>
      ${SECTIONS.map(([h, items]) => html`<div class="set-group">${h}</div>${items.map(([k, ic, label, sub]) => html`<a class=${'set-item' + (sec === k ? ' on' : '')} href=${'#/settings?s=' + k}><${Icon} n=${ic} s=${24} /><div class="grow"><div>${label}</div>${sub ? html`<div class="dim small">${sub}</div>` : null}</div></a>`)}`)}
      <div class="set-group">Session</div>
      <button class="set-item" onClick=${switchView}><${Icon} n="swap" s=${24} /><div class="grow">${s.mode === 'citizen' ? 'Switch to official view' : 'Switch to citizen view'}</div></button>
      <button class="set-item danger" onClick=${logout}><${Icon} n="logout" s=${24} /><div class="grow">Log out</div></button>
    </aside>
    ${sec ? html`<section class="set-pane">
      <div class="set-pane-h"><a class="icon-btn set-back" href="#/settings" aria-label="Back"><${Icon} n="back" s=${24} /></a><h2>${title}</h2></div>
      ${pane}
    </section>` : null}
  </div>`;
}

function RoadmapList() {
  return html`${ROADMAP.map(([i, t, d]) => html`<div class="road-row"><div class="road-ic"><${Icon} n=${i} s=${22} /></div><div><b>${t}</b><div class="dim small">${d}</div></div></div>`)}`;
}
const ROADMAP = [
  ['sparkle', 'Claude: plain-language ward and contractor summaries', 'Claude writes the one-page money-trail summary and answers “What happened to my complaint?” in English, Hindi or Marathi.'],
  ['bot', 'Bot: tag verification', 'About 18% of complaints are filed under the wrong category. The bot suggests the right one before posting.'],
  ['shield', 'Bot: content policy', 'Blocks promotional messages, vulgar content, and posts against platform rules or the Constitution.'],
  ['sparkle', 'AI accountability check', 'Reads the photo, text and location of a problem to identify the responsible position. The poster can edit; admins see whether a bot or a person assigned it.'],
  ['shield', 'Real DigiLocker integration', 'Official sign-in; Aadhaar address → ward. Privacy promise: no data leaks, minimal data stored.'],
  ['flag', 'Rules for what officials can post', 'Enforced automatically: only official updates, no greetings or personal publicity.'],
  ['bell', 'Push & SMS notifications', 'Instant alerts for progress on your problem posts.'],
  ['map', 'Official ward boundaries', 'Replace the dataset\'s approximate ward polygons with official GIS boundaries.'],
];

// ---------------- Roadmap (future features — for the PPT / video) ----------------
export function Roadmap() {
  return html`<${Header} title="What's coming next" back />
    <section class="card pad"><p class="dim small">These appear as buttons in the app but don't work yet.</p><${RoadmapList} /></section>`;
}
