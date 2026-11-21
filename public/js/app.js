import { html, render, useEffect, useStore, useRoute, loadMeta, startLiveSync, refreshUnread, store, go, safeSet } from './lib.js';
import { Icon, Loading, Avatar } from './components.js';
import { Feed, PostPage } from './pages/feed.js';
import { Compose } from './pages/compose.js';
import { Explore, Structure, RegionPage, PositionPage, ContractorPage, ProjectPage, PersonPage } from './pages/explore.js';
import { Dashboard } from './pages/dashboard.js';
import { Login, Onboarding, Notifications, Me, Settings, Roadmap } from './pages/account.js';

try { const t = localStorage.getItem('theme'); if (t) document.documentElement.dataset.theme = t; } catch {}

const NEEDS_AUTH = new Set(['new', 'notifications', 'me', 'settings', 'dashboard', 'onboarding']);

function Page({ parts, query }) {
  const [a, b] = parts;
  switch (a) {
    case undefined: return html`<${Feed} query=${query} />`;
    case 'post': return html`<${PostPage} id=${b} key=${b} />`;
    case 'new': return html`<${Compose} query=${query} key=${JSON.stringify(query)} />`;
    case 'explore': return html`<${Explore} />`;
    case 'structure': return html`<${Structure} />`;
    case 'region': return html`<${RegionPage} id=${b} key=${b} />`;
    case 'position': return html`<${PositionPage} id=${b} key=${b} />`;
    case 'contractor': return html`<${ContractorPage} id=${b} key=${b} />`;
    case 'project': return html`<${ProjectPage} id=${b} key=${b} />`;
    case 'person': return html`<${PersonPage} id=${b} key=${b} />`;
    case 'dashboard': return html`<${Dashboard} query=${query} />`;
    case 'notifications': return html`<${Notifications} />`;
    case 'me': return html`<${Me} />`;
    case 'settings': return html`<${Settings} />`;
    case 'roadmap': return html`<${Roadmap} />`;
    case 'login': return html`<${Login} />`;
    case 'onboarding': return html`<${Onboarding} />`;
    default: return html`<div class="empty">Page not found. <a href="#/">Go home</a></div>`;
  }
}

function Nav({ route }) {
  const s = useStore();
  const official = s.mode !== 'citizen';
  const cur = route.parts[0] || '';
  const items = [
    official ? ['dashboard', '#/dashboard', 'grid', s.mode === 'admin' ? 'Admin' : 'Dashboard'] : ['', '#/', 'home', 'Home'],
    official ? ['', '#/', 'home', 'Feed'] : ['explore', '#/explore', 'search', 'Explore'],
    ['new', s.mode === 'citizen' ? '#/new?tag=problem' : s.mode === 'admin' ? '#/new?tag=position_change' : '#/new?tag=progress', 'plus', s.mode === 'citizen' ? 'Post' : 'Update'],
    ['notifications', '#/notifications', 'bell', 'Alerts'],
    ['me', '#/me', 'user', 'Profile'],
  ];
  return html`<nav class="nav" aria-label="Main">
    <div class="nav-logo">Neta<span>Connect</span></div>
    ${items.map(([k, href, icon, label]) => html`<a href=${href} class=${'nav-item' + (cur === k ? ' on' : '')} aria-label=${label}>
      <span class="nav-ic"><${Icon} n=${icon} w=${cur === k ? 2.4 : 1.8} />${k === 'notifications' && s.unread ? html`<i class="dot-badge">${s.unread}</i>` : null}</span><span class="nav-l">${label}</span></a>`)}
    ${official ? html`<a href="#/explore" class=${'nav-item desktop-only' + (cur === 'explore' ? ' on' : '')} aria-label="Explore"><span class="nav-ic"><${Icon} n="search" /></span><span class="nav-l">Explore</span></a>` : null}
    <div class="nav-mode">${s.mode === 'citizen' ? 'Citizen view' : s.mode === 'admin' ? 'Admin' : 'Official view'}</div>
  </nav>`;
}

function Rail() {
  const s = useStore();
  const me = s.meta?.me;
  return html`<aside class="rail">
    ${me ? html`<div class="card pad"><div class="row"><${Avatar} kind="anon" size=${44} /><div class="row-main"><div class="row-t">${me.handle}</div><div class="row-s">${s.meta.regions.find((r) => r.id === me.regionId)?.name}</div></div></div>
      <a class="link small" href="#/explore">Who's accountable for my area ›</a></div>` : null}
    <div class="card pad small">
      <b>Post colours</b>
      <div class="legend"><span class="tag tag-problem">Problem</span> by citizens</div>
      <div class="legend"><span class="tag tag-normal">Post</span> by citizens</div>
      <div class="legend"><span class="tag tag-progress">Progress update</span> by positions</div>
      <div class="legend"><span class="tag tag-position_change">Position change</span> by admin</div>
      <div class="legend"><span class="tag tag-election">Election</span> by admin</div>
    </div>
    <div class="muted small pad-x"><a href="#/structure">How India is divided</a> · <a href="#/roadmap">Roadmap</a></div>
  </aside>`;
}

function App() {
  const s = useStore();
  const route = useRoute();
  useEffect(() => { loadMeta().catch(() => {}); startLiveSync(); const t = setInterval(refreshUnread, 30000); return () => clearInterval(t); }, []);
  useEffect(() => { refreshUnread(); }, [s.version]);
  if (!s.meta) return html`<${Loading} />`;
  const page = route.parts[0];
  if (!s.token && NEEDS_AUTH.has(page)) { go('#/login'); return null; }
  if (s.token && s.meta.me && !s.meta.me.onboarded && page !== 'onboarding') { go('#/onboarding'); return null; }
  const bare = page === 'login' || page === 'onboarding';
  return html`<div class=${'shell' + (bare ? ' bare' : '')}>
    ${bare ? null : html`<${Nav} route=${route} />`}
    <main class="main"><${Page} ...${route} /></main>
    ${bare ? null : html`<${Rail} />`}
    ${s.toast ? html`<div class="toast" role="status">${s.toast}</div>` : null}
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
