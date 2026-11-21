import { html, render, useEffect, useStore, useRoute, loadMeta, startLiveSync, refreshUnread, store, go } from './lib.js';
import { Icon, Loading } from './components.js';
import { Feed, PostPage } from './pages/feed.js';
import { Compose } from './pages/compose.js';
import { Responsibles, Structure, RegionPage, PositionPage, ContractorPage, ProjectPage, PersonPage, RoadPage, WorkOrderPage, AuditPage, Scorecards } from './pages/explore.js';
import { Dashboard } from './pages/dashboard.js';
import { Login, Onboarding, Notifications, Me, Settings, Roadmap, logout, switchView } from './pages/account.js';

// Light theme only.
document.documentElement.dataset.theme = 'light';
try { localStorage.removeItem('theme'); } catch {}

const NEEDS_AUTH = new Set(['new', 'notifications', 'me', 'settings', 'dashboard', 'onboarding']);

function Page({ parts, query }) {
  const [a, b] = parts;
  switch (a) {
    case undefined: return html`<${Feed} query=${query} />`;
    case 'post': return html`<${PostPage} id=${b} key=${b} />`;
    case 'new': return html`<${Compose} query=${query} key=${JSON.stringify(query)} />`;
    case 'responsibles': case 'explore': return html`<${Responsibles} />`;
    case 'structure': return html`<${Structure} />`;
    case 'region': return html`<${RegionPage} id=${b} query=${query} key=${b + (query.tab || '')} />`;
    case 'position': return html`<${PositionPage} id=${b} key=${b} />`;
    case 'contractor': return html`<${ContractorPage} id=${b} key=${b} />`;
    case 'project': return html`<${ProjectPage} id=${b} key=${b} />`;
    case 'person': return html`<${PersonPage} id=${b} key=${b} />`;
    case 'road': return html`<${RoadPage} id=${b} key=${b} />`;
    case 'wo': return html`<${WorkOrderPage} id=${b} key=${b} />`;
    case 'audit': return html`<${AuditPage} id=${b} query=${query} key=${b + JSON.stringify(query)} />`;
    case 'scorecards': return html`<${Scorecards} />`;
    case 'dashboard': return html`<${Dashboard} query=${query} />`;
    case 'notifications': return html`<${Notifications} />`;
    case 'me': return html`<${Me} />`;
    case 'settings': return html`<${Settings} query=${query} key=${query.s || ''} />`;
    case 'roadmap': return html`<${Roadmap} />`;
    case 'login': return html`<${Login} />`;
    case 'onboarding': return html`<${Onboarding} />`;
    default: return html`<div class="empty">Page not found. <a href="#/">Go home</a></div>`;
  }
}

function Nav({ route }) {
  const s = useStore();
  const official = s.mode !== 'citizen';
  const cur = route.parts[0] === 'explore' ? 'responsibles' : route.parts[0] || '';
  const items = [
    official ? ['dashboard', '#/dashboard', 'grid', s.mode === 'admin' ? 'Admin' : 'Dashboard'] : ['', '#/', 'home', 'Home'],
    official ? ['', '#/', 'home', 'Feed'] : ['responsibles', '#/responsibles', 'users', 'Responsibles'],
    ['new', '#/new', 'plus', 'Post'],
    ['notifications', '#/notifications', 'bell', 'Notifications'],
    ['me', '#/me', 'user', 'Profile'],
  ];
  const canSwitch = s.meta?.me && (s.meta.me.positionIds.length || s.meta.me.contractorIds.length || s.meta.me.role === 'admin');
  return html`<nav class="nav" aria-label="Main">
    <a class="nav-logo" href="#/"><span class="logo-full">Revon</span><span class="logo-mark">R</span></a>
    ${items.map(([k, href, icon, label]) => html`<a href=${href} class=${'nav-item' + (cur === k ? ' on' : '')} aria-label=${label}>
      <span class="nav-ic"><${Icon} n=${icon} s=${30} w=${cur === k ? 2.5 : 1.9} />${k === 'notifications' && s.unread ? html`<i class="dot-badge">${s.unread}</i>` : null}</span><span class="nav-l">${label}</span></a>`)}
    ${official ? html`<a href="#/responsibles" class=${'nav-item desktop-only' + (cur === 'responsibles' ? ' on' : '')} aria-label="Responsibles"><span class="nav-ic"><${Icon} n="users" s=${30} /></span><span class="nav-l">Responsibles</span></a>` : null}
    <div class="nav-bottom desktop-only">
      <a href="#/settings" class=${'nav-item' + (cur === 'settings' ? ' on' : '')} aria-label="Settings"><span class="nav-ic"><${Icon} n="settings" s=${30} /></span><span class="nav-l">Settings</span></a>
      ${canSwitch ? html`<button class="nav-item" onClick=${switchView} aria-label="Switch view"><span class="nav-ic"><${Icon} n="swap" s=${30} /></span><span class="nav-l">${s.mode === 'citizen' ? 'Switch to official view' : 'Switch to citizen view'}</span></button>` : null}
      <button class="nav-item" onClick=${logout} aria-label="Log out"><span class="nav-ic"><${Icon} n="logout" s=${30} /></span><span class="nav-l">Log out</span></button>
    </div>
  </nav>`;
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
  return html`<div class=${'shell' + (bare ? ' bare' : '') + (page === 'settings' ? ' wide' : '')}>
    ${bare ? null : html`<${Nav} route=${route} />`}
    <main class="main"><${Page} ...${route} /></main>
    ${s.toast ? html`<div class="toast" role="status">${s.toast}</div>` : null}
  </div>`;
}

render(html`<${App} />`, document.getElementById('app'));
