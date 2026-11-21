import { html, useState, useEffect, store, useStore, setStore, api, post, useData, go, toast, region, position, contractor, person, chain, children, positionsIn, levelLabel, loadMeta, safeSet, setMode, refreshUnread, ago, M } from '../lib.js';
import { Header, Icon, Avatar, Tabs, PostCard, PositionRow, FollowButton, Loading, Empty, ComingSoon, AreaMap, DemoBanner } from '../components.js';
import { ModeSwitch } from './dashboard.js';

async function signIn(token) {
  safeSet('token', token); safeSet('mode', 'citizen');
  setStore({ token, mode: 'citizen' });
  await loadMeta();
}

// ---------------- Login ----------------
export function Login() {
  const [step, setStep] = useState('welcome');
  const demo = useData(() => api('/demo-accounts'), []);
  if (step === 'digilocker') return html`<${DigiLockerMock} onBack=${() => setStep('welcome')} />`;
  return html`<div class="login">
    <div class="login-hero">
      <div class="logo big">Neta<span>Connect</span></div>
      <p>Report problems. See exactly who is responsible — from your ward corporator to the Prime Minister — and track what they do about it.</p>
    </div>
    <button class="btn btn-digi btn-block" onClick=${() => setStep('digilocker')}><span class="digi-mark">DL</span> Continue with DigiLocker</button>
    <p class="muted small center">One verified account per real person. Your area is set from your Aadhaar address. Citizens stay anonymous to the public.</p>
    <div class="divider"><span>or try a demo account</span></div>
    <div class="demo-list">${demo.loading ? html`<${Loading} />` : demo.data.map((d) => html`<button class="row as-btn" onClick=${async () => { const r = await post('/auth/demo', { userId: d.id }); await signIn(r.token); go('#/'); }}>
      <${Avatar} name=${d.label} kind=${d.label.startsWith('Citizen') ? 'anon' : 'public'} size=${38} />
      <div class="row-main"><div class="row-t">${d.label}</div><div class="row-s">${d.role}</div></div><${Icon} n="back" s=${16} />
    </button>`)}</div>
    <${DemoBanner} />
  </div>`;
}

function DigiLockerMock({ onBack }) {
  const leaves = M().regions.filter((r) => !children(r.id).length);
  const [f, setF] = useState({ name: '', addressLine: '', regionId: leaves[0].id, consent: false });
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!f.consent) return toast('Please allow sharing of name & address');
    setBusy(true);
    try { const r = await post('/auth/digilocker', f); await signIn(r.token); go('#/onboarding'); } catch (err) { toast(err.message); }
    setBusy(false);
  };
  return html`<div class="login">
    <${Header} title="DigiLocker" sub="Simulated for the prototype" back=${false} right=${html`<button class="btn btn-ghost btn-sm" onClick=${onBack}>Cancel</button>`} />
    <div class="digi-card">
      <div class="digi-head"><span class="digi-mark">DL</span><div><b>Neta Connect is requesting</b><div class="small">Name · Address (from Aadhaar)</div></div></div>
      <form class="form" onSubmit=${submit}>
        <p class="muted small">In production this is the official DigiLocker sign-in. Here you type sample details — do not enter real Aadhaar numbers.</p>
        <label class="field"><span>Name (as on Aadhaar)</span><input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} /></label>
        <label class="field"><span>Address</span><input value=${f.addressLine} onInput=${(e) => setF({ ...f, addressLine: e.target.value })} placeholder="Flat, street, locality" /></label>
        <label class="field"><span>Locality (maps to your area)</span><select value=${f.regionId} onChange=${(e) => setF({ ...f, regionId: e.target.value })}>${leaves.map((r) => html`<option value=${r.id}>${r.name}, ${region(r.parentId).name}</option>`)}</select></label>
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
  const leaves = M().regions.filter((r) => !children(r.id).length);
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
        <div class="kv"><span>Verified via</span><b>DigiLocker ✓</b></div>
        <div class="kv"><span>Public identity</span><b>${me.handle}</b></div>
        <p class="muted small">Other citizens only see your anonymous handle, your area and your posts. Your name is never shown unless you are assigned a public position.</p>
      </section>
      <h3 class="h3">Your assigned area</h3>
      <section class="card pad">
        <select value=${regionId} onChange=${(e) => setRegionId(e.target.value)}>${leaves.map((r) => html`<option value=${r.id}>${r.name}, ${region(r.parentId).name}</option>`)}</select>
        <div class="muted small">${chain(regionId).map((r) => r.name).join(' › ')}</div>
        <${AreaMap} regions=${[region(regionId)]} height=${150} />
      </section>
      <button class="btn btn-primary btn-block" onClick=${async () => { if (regionId !== me.regionId) await post('/me/area', { regionId }); await loadMeta(); setStep(2); }}>Confirm area</button>` : null}
    ${step === 2 ? html`
      <h2 class="h2">Who is accountable for you</h2>
      <p class="muted">Follow them to see their updates first. Nearest positions are shown first, then higher areas.</p>
      <button class="btn btn-ghost btn-block" onClick=${followAllHeads}>Follow all area heads</button>
      ${levels.map((r) => html`<section class="card pad"><div class="sec-h"><b>${r.name}</b><span class="muted small">${levelLabel(r.type)}</span></div>${positionsIn(r.id).map((p) => html`<${PositionRow} p=${p} />`)}</section>`)}
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
  useEffect(() => { post('/notifications/read').then(refreshUnread).catch(() => {}); }, [data?.length]);
  return html`<${Header} title="Notifications" />
    ${loading ? html`<${Loading} />` : !data.length ? html`<${Empty}>No notifications yet. Updates on your problem posts will appear here.</${Empty}>` : html`<div class="list">${data.map((n) => html`<a class=${'notif' + (n.read ? '' : ' unread')} href=${n.link}><span class=${'dot dot-' + ({ progress: 'progress', problem: 'problem', position: 'position_change', project: 'progress' }[n.type] || 'normal')}></span><div class="grow"><div>${n.text}</div><div class="muted small">${ago(n.createdAt)}</div></div></a>`)}</div>`}`;
}

// ---------------- My profile ----------------
export function Me() {
  const s = useStore();
  const me = s.meta.me;
  const posts = useData(() => api('/posts?author=' + me.id), [me.id]);
  return html`
    <${Header} title=${me.handle} right=${html`<a class="icon-btn" href="#/settings" aria-label="Settings"><${Icon} n="settings" /></a>`} />
    <section class="profile">
      <div class="profile-top"><${Avatar} kind="anon" size=${84} />
        <div class="profile-stats"><div><b>${posts.data?.length ?? '—'}</b><span>posts</span></div><div><b>${me.following.positions.length}</b><span>positions</span></div><div><b>${me.following.users.length}</b><span>citizens</span></div></div>
      </div>
      <div class="profile-name">${me.handle} <span class="verified" title="DigiLocker verified">✓</span></div>
      <div class="profile-sub"><a href=${'#/region/' + me.regionId}>${region(me.regionId).name}</a> · visible to others as anonymous</div>
      <div class="muted small">Private: ${me.realName}</div>
    </section>
    <${ModeSwitch} />
    ${me.following.positions.length ? html`<section class="card pad"><div class="sec-h"><b>Following</b></div>${me.following.positions.map((id) => position(id) && html`<${PositionRow} p=${position(id)} showRegion />`)}</section>` : null}
    <div class="sec-h pad-x"><b>Your posts</b></div>
    ${posts.loading ? html`<${Loading} />` : posts.data.length ? posts.data.map((p) => html`<${PostCard} p=${p} compact />`) : html`<${Empty}>You haven't posted yet. <a href="#/new?tag=problem">Report a problem</a></${Empty}>`}`;
}

// ---------------- Settings ----------------
export function Settings() {
  const s = useStore();
  const [theme, setTheme] = useState(document.documentElement.dataset.theme || 'system');
  const applyTheme = (t) => { setTheme(t); if (t === 'system') delete document.documentElement.dataset.theme; else document.documentElement.dataset.theme = t; safeSet('theme', t === 'system' ? null : t); };
  const logout = async () => { await post('/auth/logout').catch(() => {}); safeSet('token', null); safeSet('mode', null); setStore({ token: null, mode: 'citizen' }); await loadMeta(); go('#/login'); };
  return html`<${Header} title="Settings" back />
    <section class="card pad"><div class="sec-h"><b>Account</b></div>
      <div class="kv"><span>Verified via</span><b>DigiLocker ✓</b></div>
      <div class="kv"><span>Home area</span><a href=${'#/region/' + s.meta.me.regionId}>${region(s.meta.me.regionId).name}</a></div>
      <${ComingSoon} label="Update address via DigiLocker" icon="pin" block />
    </section>
    <${ModeSwitch} />
    <section class="card pad"><div class="sec-h"><b>Appearance</b></div><div class="chips">${['system', 'light', 'dark'].map((t) => html`<button class=${'chip-btn' + (theme === t ? ' on' : '')} onClick=${() => applyTheme(t)}>${t[0].toUpperCase() + t.slice(1)}</button>`)}</div></section>
    <section class="card pad"><div class="sec-h"><b>Notifications</b></div>
      ${['Progress on my problem posts', 'Posts from people I follow', 'Position changes in my area', 'Election announcements'].map((l) => html`<label class="check-row"><input type="checkbox" checked /> <span>${l}</span></label>`)}
      <${ComingSoon} label="Push & SMS notifications" icon="bell" block />
    </section>
    <section class="card pad"><div class="sec-h"><b>Privacy</b></div><p class="muted small">Citizens are anonymous. Only area and posts are public.</p><${ComingSoon} label="DigiLocker privacy & no-leak guarantee" icon="shield" block /></section>
    <section class="card pad"><a class="row" href="#/roadmap"><${Icon} n="sparkle" /><div class="row-main">What's coming next</div></a><a class="row" href="#/structure"><${Icon} n="tree" /><div class="row-main">How India is divided</div></a><button class="row as-btn danger" onClick=${logout}><${Icon} n="logout" /><div class="row-main">Log out</div></button></section>`;
}

// ---------------- Roadmap (future features — for PPT / video) ----------------
export function Roadmap() {
  const items = [
    ['bot', 'Bot: tag verification', 'Checks that a post tagged Problem is actually a civic problem and that normal posts aren\'t mis-tagged.'],
    ['shield', 'Bot: content policy', 'Blocks promotional messages, vulgar content, and posts against platform rules or the Constitution.'],
    ['sparkle', 'AI accountability check', 'While posting a problem (especially by camera), AI reads the text + photo + location and identifies the responsible position. Poster can edit; admins see whether a bot or person assigned it.'],
    ['shield', 'Real DigiLocker integration', 'Official OAuth with DigiLocker; Aadhaar address → area. Privacy promise: no data leaks, minimal data stored.'],
    ['flag', 'Rules for what officials can post', 'Enforced automatically: only official project updates, no greetings / personal publicity.'],
    ['bell', 'Push & SMS notifications', 'Instant alerts for progress on your problem posts.'],
    ['map', 'Real ward boundaries', 'Replace approximate circles with official GIS ward / constituency polygons.'],
  ];
  return html`<${Header} title="Coming next" back />
    <section class="card pad"><p class="muted small">These are shown as buttons in the app but not functional yet.</p>
    ${items.map(([i, t, d]) => html`<div class="road-row"><div class="road-ic"><${Icon} n=${i} s=${20} /></div><div><b>${t}</b><div class="muted small">${d}</div></div></div>`)}</section>`;
}
