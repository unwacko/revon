import { html, useState, useEffect, setMode, store, useStore, api, post, useData, go, toast, region, position, contractor, project, person, children, chain, positionsIn, levelLabel, inr, rs, pct, ago, fmtNum, fmtDate, M, STATUS, regionName } from '../lib.js';
import { Header, Icon, Avatar, Tabs, PostCard, PositionRow, ContractorRow, ProjectRow, RegionRow, WorkOrderRow, Breadcrumb, BudgetBars, AreaMap, FollowButton, Loading, Empty, ErrorBox, StatusPill, Party, Sheet, ComingSoon, MoneyPanel, PlannerPanel, ScorecardPanel, Kpis, BudgetPanel, LanguageButton } from '../components.js';

// ---------------- Responsibles (was Explore) ----------------
export function Responsibles() {
  const s = useStore();
  const [q, setQ] = useState('');
  const city = useData(() => api('/money/r_bmc'), []);
  const ql = q.trim().toLowerCase();
  const me = s.meta.me;
  const res = ql ? {
    regions: M().regions.filter((r) => r.name.toLowerCase().includes(ql)).slice(0, 6),
    roads: M().roads.filter((r) => r.name.toLowerCase().includes(ql)).slice(0, 8),
    positions: M().positions.filter((p) => (p.title + ' ' + (person(p.holderUserId)?.name || '') + ' ' + regionName(p.regionId)).toLowerCase().includes(ql)).slice(0, 10),
    contractors: M().contractors.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 6),
    projects: M().projects.filter((p) => p.title.toLowerCase().includes(ql)).slice(0, 6),
  } : null;
  const m = city.data;
  return html`
    <header class="topbar"><div class="search"><${Icon} n="search" s=${20} /><input placeholder="Search wards, roads, officials, contractors" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Search" /></div><${LanguageButton} /></header>
    ${res ? html`<div class="list">
      ${res.regions.map((r) => html`<${RegionRow} r=${r} />`)}
      ${res.roads.map((r) => html`<a class="row" href=${'#/road/' + r.id}><div class="region-ic"><${Icon} n="road" s=${22} /></div><div class="row-main"><div class="row-t">${r.name} · segment ${r.segment}</div><div class="row-s">${regionName(r.regionId)}${r.underDlp ? ' · under DLP' : ''}</div></div></a>`)}
      ${res.positions.map((p) => html`<${PositionRow} p=${p} showRegion />`)}
      ${res.contractors.map((c) => html`<${ContractorRow} c=${c} />`)}
      ${res.projects.map((pj) => html`<${ProjectRow} pj=${pj} />`)}
      ${!Object.values(res).flat().length ? html`<${Empty}>No results for “${q}”.</${Empty}>` : null}
    </div>` : html`
      <section class="card pad hero">
        <div class="sec-h"><b>Mumbai monsoon roads 2025</b><a class="link" href="#/region/r_bmc?tab=money">Money trail ›</a></div>
        ${m ? html`<${Kpis} items=${[[rs(m.spend), 'spent of ' + rs(m.budget)], [pct(m.reopenRate), 'fixes failed in 30 days', 'bad'], [pct(m.slaMet), 'finished on time', 'warn'], [rs(m.flags.dlp.amount + m.flags.duplicate.amount + m.flags.overbilled.excess), 'needs a second look', 'bad', () => go('#/audit/r_bmc')]]} />` : html`<${Loading} />`}
        <div class="btn-row wrap"><a class="btn btn-primary" href="#/region/r_bmc?tab=plan">Where should the next rupee go?</a><a class="btn btn-ghost" href="#/scorecards">Contractor scorecards</a></div>
      </section>
      ${me ? html`<section class="card pad">
        <div class="sec-h"><b>Accountable for your ward</b><a href=${'#/region/' + me.regionId} class="link">${regionName(me.regionId)} ›</a></div>
        ${chain(me.regionId).slice(0, 2).flatMap((r) => positionsIn(r.id).slice(0, 4)).map((p) => html`<${PositionRow} p=${p} showRegion />`)}
      </section>` : null}
      <section class="card pad">
        <div class="sec-h"><b>Who is responsible — India to your ward</b><a class="link" href="#/structure">How it works ›</a></div>
        <p class="dim small">Area → positions → people. Tap the arrow to expand. "Higher" and "lower" are relative to where you are.</p>
        <${TreeNode} id="r_in" open depth=${0} />
      </section>
      <section class="card pad"><div class="sec-h"><b>Contractors</b><a class="link" href="#/scorecards">Scorecards ›</a></div>${M().contractors.map((c) => html`<${ContractorRow} c=${c} />`)}</section>
      <section class="card pad"><div class="sec-h"><b>Projects</b></div>${M().projects.map((pj) => html`<${ProjectRow} pj=${pj} />`)}</section>
    `}`;
}

function TreeNode({ id, open: initial, depth }) {
  const [open, setOpen] = useState(initial || chain(store.meta.me?.regionId || '').some((r) => r.id === id));
  const r = region(id);
  const kids = children(id);
  const head = positionsIn(id).find((p) => p.isHead);
  const holder = head && person(head.holderUserId);
  return html`<div class="tree-node" style=${`--d:${depth}`}>
    <div class="tree-row">
      <button class="tree-toggle" aria-label=${open ? 'Collapse' : 'Expand'} disabled=${!kids.length} onClick=${() => setOpen(!open)}>${kids.length ? html`<${Icon} n=${open ? 'down' : 'chev'} s=${16} />` : '•'}</button>
      <a href=${'#/region/' + id} class="tree-main">
        <div class="tree-t">${r.name} <span class="lvl">${levelLabel(r.type)}</span></div>
        ${head ? html`<div class="tree-s">${head.title}: ${holder?.name || 'Vacant'} ${holder?.party ? html`<${Party} party=${holder.party} />` : null} · ${positionsIn(id).length} positions</div>` : null}
      </a>
    </div>
    ${open ? kids.map((k) => html`<${TreeNode} id=${k.id} depth=${depth + 1} />`) : null}
  </div>`;
}

export function Structure() {
  const rows = [
    ['Nation', 'Prime Minister (Union Council of Ministers)', 'MPs — Lok Sabha constituencies (543). National highways via NHAI.'],
    ['State / UT', 'Chief Minister (the Governor is the constitutional head)', 'MLAs — Vidhan Sabha constituencies. State PWD and MMRDA roads.'],
    ['Revenue Division', 'Divisional Commissioner (IAS)', 'Groups districts — Mumbai falls in Konkan Division.'],
    ['District', 'Collector (IAS), Superintendent / Commissioner of Police', 'Mumbai has two: Mumbai City and Mumbai Suburban.'],
    ['Municipal Corporation', 'Mayor (elected), Municipal Commissioner (IAS, executive head)', 'BMC covers both Mumbai districts. Chief Engineers for Roads and Storm Water Drains.'],
    ['Municipal Zone', 'Deputy Municipal Commissioner', 'BMC groups its 24 wards into 7 zones.'],
    ['Ward', 'Assistant Municipal Commissioner (ward office), Executive Engineer (Roads), Corporators', 'Wards A to T. Each administrative ward contains several electoral wards with their own corporators.'],
    ['Rural: Zilla Parishad → Panchayat Samiti → Gram Panchayat', 'ZP President & CEO → Sabhapati & BDO → Sarpanch & Gram Sevak', '73rd Amendment — the three-tier Panchayati Raj outside cities.'],
  ];
  return html`<${Header} title="How India is divided" back />
    <section class="card pad">
      <p>Every problem here belongs to an <b>area</b>. Each area has a fixed head position plus other positions (engineers, police, departments). People and contractors are assigned to those positions.</p>
      <p class="dim small">Cities follow the 74th Constitutional Amendment (municipal bodies); villages follow the 73rd (Panchayati Raj). Lok Sabha and Vidhan Sabha constituencies overlap these areas, so MPs and MLAs are attached to the area that best contains them. Names vary by state (Taluka / Tehsil / Mandal; Sarpanch / Pradhan / Mukhiya).</p>
    </section>
    <section class="card pad structure">
      ${rows.map(([lvl, who, note], i) => html`<div class="st-row"><div class="st-n">${i + 1}</div><div><b>${lvl}</b><div>${who}</div><div class="dim small">${note}</div></div></div>`)}
    </section>`;
}

// ---------------- Area page ----------------
// Order: who this area is -> who is responsible -> where it sits -> money -> records -> map (last).
const CIVIC = new Set(['municipal_corporation', 'zone', 'ward']); // levels covered by the monsoon-roads dataset
const NO_MAP = new Set(['nation', 'state', 'division']); // no boundary data above the city
const RECORD_TABS = ['money', 'plan', 'problems', 'projects', 'roads'];
const SECTION_TABS = ['positions', 'areas', 'budget'];

const headOf = (rid) => positionsIn(rid).find((p) => p.isHead);
const wardIdsUnder = (rid) => { const r = region(rid); if (!r) return []; if (r.type === 'ward') return [rid]; return children(rid).flatMap((k) => wardIdsUnder(k.id)); };
function sumWards(rid) { return wardIdsUnder(rid).reduce((a, w) => a + Object.values(region(w).budget || {}).reduce((x, y) => x + y, 0), 0); }

// Open problems per ward, read from each ward head's stats (the ward head is routed every ward problem).
let openCache = null;
function openByWard() {
  if (openCache && Date.now() - openCache.at < 15000) return openCache.p;
  const heads = M().positions.filter((p) => p.isHead && region(p.regionId)?.type === 'ward');
  const p = Promise.all(heads.map((h) => api(`/positions/${h.id}/stats`).then((st) => [h.regionId, st.open], () => [h.regionId, 0]))).then(Object.fromEntries);
  openCache = { at: Date.now(), p };
  return p;
}
const openIn = (counts, rid) => { if (!counts) return null; const ws = wardIdsUnder(rid); return ws.length ? ws.reduce((a, w) => a + (counts[w] || 0), 0) : null; };

export function RegionPage({ id, query = {} }) {
  const s = useStore();
  const r = region(id);
  const civic = !!r && CIVIC.has(r.type);
  const [tab, setTab] = useState(RECORD_TABS.includes(query.tab) ? query.tab : civic ? 'money' : 'problems');
  const [addOpen, setAddOpen] = useState(false);
  const [mapOpen, setMapOpen] = useState(true);
  const money = useData(() => (civic && tab === 'money' ? api('/money/' + id) : Promise.resolve(null)), [id, tab]);
  const plan = useData(() => (civic && tab === 'plan' ? api('/planner/' + id) : Promise.resolve(null)), [id, tab]);
  const posts = useData(() => (tab === 'problems' ? api(`/posts?region=${id}&subtree=1&tag=problem&status=open&limit=12`) : Promise.resolve([])), [id, tab]);
  const open = useData(() => openByWard(), []);
  useEffect(() => {
    const target = SECTION_TABS.includes(query.tab) ? 'area-' + query.tab : RECORD_TABS.includes(query.tab) ? 'area-records' : null;
    if (!target) return;
    const t = setTimeout(() => document.getElementById(target)?.scrollIntoView({ block: 'start' }), 60);
    return () => clearTimeout(t);
  }, [id, query.tab]);
  if (!r) return html`<${Header} title="Area" back /><${ErrorBox} error="Area not found" />`;

  const ps = positionsIn(id);
  const head = ps.find((p) => p.isHead);
  const kids = children(id);
  const up = chain(id).reverse();
  const me = s.meta.me;
  const canEdit = me && (me.role === 'admin' || (head && head.holderUserId === me.id));
  const projects = M().projects.filter((pj) => chain(pj.regionId).some((c) => c.id === id));
  const roads = r.type === 'ward' ? M().roads.filter((x) => x.regionId === id) : [];
  const short = r.shortName || r.name;
  const openHere = openIn(open.data, id);
  const tabs = [...(civic ? [['money', 'Money trail'], ['plan', 'Next rupee']] : []), ['problems', 'Open problems'], ['projects', 'Projects'], ...(roads.length ? [['roads', 'Roads']] : [])];

  return html`<div class="area">
    <${Header} title=${levelLabel(r.type)} back right=${html`<${FollowButton} type="region" id=${id} small />`} />

    <section class="area-head">
      ${up.length > 1 ? html`<nav class="area-trail" aria-label="Area trail">${up.slice(0, -1).map((c, i) => html`${i ? html`<span aria-hidden="true">›</span>` : null}<a href=${'#/region/' + c.id}>${c.shortName || c.name}</a>`)}</nav>` : null}
      <h1 class="area-name">${r.name}</h1>
      <div class="area-meta">
        <span>${levelLabel(r.type)}</span>
        ${r.population ? html`<span>${fmtNum(r.population)} people</span>` : null}
        <span>${ps.length} ${ps.length === 1 ? 'position' : 'positions'}</span>
        ${openHere != null ? html`<span>${fmtNum(openHere)} open problems</span>` : null}
      </div>
      ${r.localities?.length ? html`<p class="area-note">Covers ${r.localities.join(', ')}.</p>` : null}
      ${r.note ? html`<p class="area-note">${r.note}</p>` : null}
    </section>

    <section class="area-sec" id="area-positions">
      <h2 class="area-h">Who is responsible here</h2>
      <p class="area-sub">${ps.length ? `Positions at ${short}, head position first.` : `No positions are listed at ${short} yet.`}</p>
      ${ps.length ? html`<div class="ledger">${ps.map((p) => html`<${PositionLine} p=${p} />`)}</div>` : null}
      ${canEdit ? html`<button class="area-add" onClick=${() => setAddOpen(true)}><${Icon} n="plus" s=${18} /> Add a position to this area</button>` : null}
    </section>

    <section class="area-sec" id="area-areas">
      <h2 class="area-h">Hierarchy</h2>
      <p class="area-sub">The chain of areas above ${short}, each with its head position.</p>
      <ol class="chain">
        ${up.map((c, i) => { const h = headOf(c.id); const hp = h && person(h.holderUserId); return html`<li class=${c.id === id ? 'on' : ''} style=${`--i:${i}`}>
          <a href=${'#/region/' + c.id} aria-current=${c.id === id ? 'page' : null}>
            <span class="chain-lvl">${levelLabel(c.type)}</span>
            <span class="chain-name">${c.shortName || c.name}</span>
            <span class="chain-head">${h ? html`${h.title} · <b>${hp?.name || 'Vacant'}</b>` : 'No head position listed'}</span>
          </a></li>`; })}
      </ol>
      ${kids.length ? html`
        <h3 class="area-h3">Areas under ${short}</h3>
        <table class="ledger-table">
          <thead><tr><th scope="col">Area</th><th scope="col">Head</th><th scope="col" class="num">Open problems</th><th scope="col"><span class="sr">Open</span></th></tr></thead>
          <tbody>${kids.map((k) => { const h = headOf(k.id); const hp = h && person(h.holderUserId); const n = openIn(open.data, k.id); return html`<tr class="link-row" onClick=${() => go('#/region/' + k.id)}>
            <td><a href=${'#/region/' + k.id} onClick=${(e) => e.stopPropagation()}>${k.shortName || k.name}</a><div class="cell-sub">${levelLabel(k.type)}</div></td>
            <td>${hp?.name || (h ? 'Vacant' : '—')}${h ? html`<div class="cell-sub">${h.title}</div>` : null}</td>
            <td class="num">${n == null ? '—' : fmtNum(n)}</td>
            <td class="chev"><${Icon} n="chev" s=${16} /></td>
          </tr>`; })}</tbody>
        </table>` : html`<p class="area-sub">${short} is the smallest area. Its problems go to the positions listed above.</p>`}
    </section>

    <${AreaBudget} r=${r} kids=${kids} civic=${civic} />

    <section class="area-sec" id="area-records">
      <h2 class="area-h">Records</h2>
      <div class="area-links">
        ${civic ? html`<a href=${'#/audit/' + id}>Audit flags ›</a><a href="#/scorecards">Contractor scorecards ›</a>` : html`<a href="#/region/r_bmc?tab=money">Mumbai monsoon money trail ›</a><a href="#/structure">How India is divided ›</a>`}
      </div>
      <${Tabs} value=${tab} onChange=${setTab} tabs=${tabs} />
      <div class="area-tab">
        ${tab === 'money' ? (money.loading ? html`<${Loading} />` : html`<${MoneyPanel} m=${money.data} regionId=${id} />`) : null}
        ${tab === 'plan' ? (plan.loading ? html`<${Loading} />` : html`<${PlannerPanel} data=${plan.data} />`) : null}
        ${tab === 'problems' ? (posts.loading ? html`<${Loading} />` : posts.data.length ? html`<div class="feed">${posts.data.map((p) => html`<${PostCard} p=${p} compact />`)}</div>` : html`<${Empty}>No open problems here.</${Empty}>`) : null}
        ${tab === 'projects' ? html`<section class="list">${projects.length ? projects.map((pj) => html`<${ProjectRow} pj=${pj} />`) : html`<${Empty}>No projects yet.</${Empty}>`}</section>` : null}
        ${tab === 'roads' ? html`<table class="ledger-table">
          <thead><tr><th scope="col">Road segment</th><th scope="col" class="num">Defect liability</th><th scope="col"><span class="sr">Open</span></th></tr></thead>
          <tbody>${roads.map((x) => html`<tr class="link-row" onClick=${() => go('#/road/' + x.id)}><td><a href=${'#/road/' + x.id} onClick=${(e) => e.stopPropagation()}>${x.name}</a><div class="cell-sub">Segment ${x.segment}</div></td><td class="num">${x.underDlp ? html`<span class="ok">Active</span>` : 'Expired'}</td><td class="chev"><${Icon} n="chev" s=${16} /></td></tr>`)}</tbody>
        </table>` : null}
      </div>
    </section>

    <section class="area-sec area-map">
      ${NO_MAP.has(r.type) ? html`<h2 class="area-h">Map</h2><p class="area-sub">Boundaries are mapped only for Mumbai's 24 wards so far. A map for ${short} is planned.</p>` : html`
        <button class="area-toggle" aria-expanded=${mapOpen} onClick=${() => setMapOpen(!mapOpen)}><h2 class="area-h">Map</h2><${Icon} n=${mapOpen ? 'down' : 'chev'} s=${18} /></button>
        ${mapOpen ? html`<${AreaMap} regions=${[r, ...kids]} height=${220} roads=${roads.map((x) => ({ ...x, label: `${x.name} · seg ${x.segment}`, href: '#/road/' + x.id, color: x.underDlp ? '#22c55e' : '#f97316' }))} />
          <p class="area-sub">Ward boundaries are approximate. Tap an area to zoom in.${roads.length ? ' Orange: ward roads. Green: still under defect liability.' : ''}</p>` : null}`}
    </section>
    <${AddPositionSheet} open=${addOpen} onClose=${() => setAddOpen(false)} regionId=${id} />
  </div>`;
}

function PositionLine({ p }) {
  const holder = person(p.holderUserId);
  return html`<div class="ledger-row pos-line">
    <${Avatar} name=${holder?.name || p.title} size=${32} />
    <a class="pos-main" href=${'#/position/' + p.id}>
      <span class="pos-title">${p.title}${p.isHead ? html` <span class="area-tag">Head</span>` : null}</span>
      <span class="pos-holder">${holder ? holder.name : html`<i>Vacant</i>`}${holder?.party ? html` <span class="area-party">${holder.party}</span>` : null}</span>
      ${p.responsibilities?.[0] ? html`<span class="pos-resp">${p.responsibilities[0]}</span>` : null}
    </a>
    <${FollowButton} type="position" id=${p.id} small />
  </div>`;
}

function AddPositionSheet({ open, onClose, regionId }) {
  const [f, setF] = useState({ title: '', kind: 'appointed', categories: ['Pothole'], responsibilities: '', budget: '' });
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    try { await post('/admin/positions', { ...f, regionId, responsibilities: f.responsibilities.split('\n') }); toast('Position added'); onClose(); } catch (err) { toast(err.message); }
  };
  return html`<${Sheet} open title="Add position" onClose=${onClose}><form class="form" onSubmit=${submit}>
    <label class="field"><span>Title</span><input required value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Sub-Engineer (Roads)" /></label>
    <label class="field"><span>Type</span><select value=${f.kind} onChange=${(e) => setF({ ...f, kind: e.target.value })}><option value="elected">Elected</option><option value="appointed">Appointed</option><option value="department">Department</option></select></label>
    <div class="field"><span>Responsible for</span><div class="chips">${M().categories.map((c) => html`<button type="button" class=${'chip-btn' + (f.categories.includes(c) ? ' on' : '')} onClick=${() => setF({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] })}>${c}</button>`)}</div></div>
    <label class="field"><span>Responsibilities (one per line)</span><textarea rows="3" value=${f.responsibilities} onInput=${(e) => setF({ ...f, responsibilities: e.target.value })}></textarea></label>
    <label class="field"><span>Budget (₹ crore)</span><input type="number" step="0.01" value=${f.budget} onInput=${(e) => setF({ ...f, budget: e.target.value })} /></label>
    <button class="btn btn-primary btn-block">Add position</button>
    <p class="dim small">People are assigned to positions by platform admins.</p>
  </form></${Sheet}>`;
}

function LedgerMoney({ rows, total, label = 'Category' }) {
  const max = Math.max(...rows.map((e) => e[1]));
  const share = (v) => { const x = (v / total) * 100; return (x < 10 ? x.toFixed(1) : x.toFixed(0)) + '%'; };
  return html`<table class="ledger-table money">
    <thead><tr><th scope="col">${label}</th><th scope="col" class="num">Amount</th><th scope="col" class="num">Share</th></tr></thead>
    <tbody>${rows.map(([k, v]) => html`<tr><td>${k}<span class="ledger-bar" aria-hidden="true"><i style=${`width:${Math.max(1, (v / max) * 100)}%`}></i></span></td><td class="num">${inr(v)}</td><td class="num">${share(v)}</td></tr>`)}</tbody>
    ${rows.length > 1 ? html`<tfoot><tr><td>Total</td><td class="num">${inr(total)}</td><td class="num">100%</td></tr></tfoot>` : null}
  </table>`;
}

function AreaBudget({ r, kids, civic }) {
  const own = Object.entries(r.budget || {}).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
  const total = own.reduce((a, e) => a + e[1], 0);
  const parent = r.parentId && region(r.parentId);
  const parentTotal = civic && parent && CIVIC.has(parent.type) ? sumWards(parent.id) : 0;
  const split = kids.map((k) => [k.shortName || k.name, sumWards(k.id)]).filter((e) => e[1] > 0).sort((a, b) => b[1] - a[1]);
  const short = r.shortName || r.name;
  return html`<section class="area-sec" id="area-budget">
    <h2 class="area-h">Budget by category</h2>
    ${own.length ? html`
      <p class="area-sub">${civic ? 'Monsoon road repair budget, June to September 2025.' : 'Indicative yearly figures, not an official budget statement.'}${parentTotal ? ` ${((total / parentTotal) * 100).toFixed(1)}% of ${parent.shortName || parent.name}'s ${inr(parentTotal)}.` : ''}</p>
      <${LedgerMoney} rows=${own} total=${total} />` : html`<p class="area-sub">No budget is recorded for ${short}.</p>`}
    ${split.length > 1 ? html`<h3 class="area-h3">Split across areas under ${short}</h3><${LedgerMoney} label="Area" rows=${split} total=${split.reduce((a, e) => a + e[1], 0)} />` : null}
  </section>`;
}

// ---------------- Road ----------------
const woFlags = (flags) => flags.map((t) => ({ type: t, severity: ['overbilled', 'duplicate', 'dlp'].includes(t) ? 'high' : 'note' }));
export function RoadPage({ id }) {
  const { data, error, loading } = useData(() => api('/roads/' + id), [id]);
  const posts = useData(() => api(`/posts?road=${id}&tag=problem&limit=30`), [id]);
  if (loading) return html`<${Header} title="Road" back /><${Loading} />`;
  if (error) return html`<${Header} title="Road" back /><${ErrorBox} error=${error} />`;
  const { road, workOrders, hotspots, accidents, roadAccidents, facilities, spend, reopened } = data;
  return html`
    <${Header} title=${road.name} sub=${`Segment ${road.segment} · ${regionName(road.regionId)}`} back />
    <${AreaMap} regions=${[region(road.regionId)]} roads=${[{ ...road, label: road.name, color: road.underDlp ? '#22c55e' : '#f97316' }]} focus="roads" height=${220} />
    <${Kpis} items=${[[rs(spend), 'spent this monsoon'], [workOrders.length, 'repairs'], [reopened, 'failed within 30 days', reopened ? 'bad' : ''], [data.openCount, 'open complaints', data.openCount ? 'warn' : '']]} />
    <section class="card pad">
      <div class="kv"><span>Type · surface</span><span>${road.type} · ${road.surface} · ${road.lanes} lanes · ${road.lengthM} m</span></div>
      <div class="kv"><span>Last resurfaced</span><span>${road.lastResurfaced}</span></div>
      <div class="kv"><span>Defect Liability Period</span>${road.underDlp ? html`<span class="ok">Active — the original contractor must repair it free</span>` : html`<span>Expired</span>`}</div>
      <div class="kv"><span>Peak traffic</span><span>${fmtNum(road.traffic.peak)} vehicles/hr · ${road.traffic.speed} km/h · congestion ${road.traffic.congestion}/10</span></div>
      <div class="kv"><span>BEST buses</span><span>${road.busRoute ? `Yes · ${road.traffic.buses} routes` : 'No'}</span></div>
      ${hotspots.map((h) => html`<div class="kv"><span>Flood hotspot</span><span class="warn">${h.name} — flooded ${h.years} of last 5 years${h.tide ? ', tide-sensitive' : ''}</span></div>`)}
      ${facilities.map((f) => html`<div class="kv"><span>${f.type === 'Hospital' ? 'Ambulance access' : 'School access'}</span><span>${f.name}${f.emergency ? ' (emergency)' : ''}</span></div>`)}
      <div class="kv"><span>Accidents 2024–25</span><span>${accidents.length} total · <b class=${roadAccidents.length ? 'bad' : ''}>${roadAccidents.length}</b> linked to road condition</span></div>
    </section>
    <div class="sec-h pad-x"><b>Repair history — did the fixes last?</b></div>
    <section class="list">${workOrders.length ? workOrders.map((w) => html`<${WorkOrderRow} w=${{ ...w, roadName: road.name, flagDetails: woFlags(w.flags) }} />`) : html`<${Empty}>No repairs recorded.</${Empty}>`}</section>
    <div class="sec-h pad-x"><b>Complaints on this road</b><span class="dim">${data.complaintCount}</span></div>
    ${posts.loading ? html`<${Loading} />` : html`<div class="feed">${posts.data.map((p) => html`<${PostCard} p=${p} compact />`)}</div>`}`;
}

// ---------------- Work order ----------------
export function WorkOrderPage({ id }) {
  const { data, error, loading } = useData(() => api('/workorders/' + id), [id]);
  if (loading) return html`<${Header} title="Work order" back /><${Loading} />`;
  if (error) return html`<${Header} title="Work order" back /><${ErrorBox} error=${error} />`;
  const { workOrder: w, road, complaints, sameRoad, rain } = data;
  const hrs = (w.completedAt - w.assignedAt) / 3600e3;
  return html`
    <${Header} title=${w.id} sub=${`${w.workType} · ${regionName(w.regionId)}`} back />
    <section class="card pad">
      <h2 class="h2">${w.method}</h2>
      <div class="kv"><span>Road</span><a href=${'#/road/' + w.roadId}>${road?.name} · segment ${road?.segment}</a></div>
      <div class="kv"><span>Contractor</span><a href=${'#/contractor/' + w.contractorId}>${w.contractorName}</a></div>
      <div class="kv"><span>Area repaired</span><span>${w.areaSqm} sq m</span></div>
      <div class="kv"><span>Billed</span><b>${rs(w.cost)}</b></div>
      <div class="kv"><span>Rate card</span><span>${rs(w.expected)} expected · <b class=${w.costRatio > 1.5 ? 'bad' : w.costRatio > 1.3 ? 'warn' : 'ok'}>${w.costRatio?.toFixed(2)}×</b></span></div>
      <div class="kv"><span>Assigned</span><span>${new Date(w.assignedAt).toLocaleString('en-IN')}</span></div>
      <div class="kv"><span>Completed</span><span>${new Date(w.completedAt).toLocaleString('en-IN')} (${hrs.toFixed(0)} h)</span></div>
      <div class="kv"><span>Time target</span><span class=${w.slaMet ? 'ok' : 'warn'}>${w.slaHours} h · ${w.slaMet ? 'met' : 'missed'}</span></div>
      <div class="kv"><span>Held for 30 days?</span><span class=${w.reopened ? 'bad' : 'ok'}>${w.reopened ? 'No — re-opened' : 'Yes'}</span></div>
      ${rain.assigned ? html`<div class="kv"><span>Rain that day</span><span>${Object.entries(rain.assigned).map(([st, r]) => `${st}: ${r.mm} mm (${r.cat})`).join(' · ')}</span></div>` : null}
      ${w.remark ? html`<div class="kv"><span>Engineer's note</span><span>${w.remark}</span></div>` : null}
    </section>
    ${w.flags.length ? html`<section class="card pad"><div class="sec-h"><b>Audit</b></div>${w.flags.map((f) => html`<div class=${'flag-box' + (f.severity === 'note' ? ' note' : '')}><${Icon} n=${f.severity === 'high' ? 'alert' : 'flag'} s=${18} /><div><b>${M().flagLabels[f.type]}</b><div>${f.text}</div>${f.type === 'duplicate' && w.twinId ? html`<a href=${'#/wo/' + w.twinId}>See ${w.twinId} ›</a>` : null}</div></div>`)}<p class="dim small">Flags are prompts to check the records, not proof of wrongdoing.</p></section>` : html`<section class="card pad"><b class="ok">No audit flags.</b></section>`}
    <div class="sec-h pad-x"><b>Complaints this fixed</b><span class="dim">${complaints.length}</span></div>
    ${complaints.length ? html`<div class="feed">${complaints.map((p) => html`<${PostCard} p=${p} compact />`)}</div>` : html`<${Empty}>No complaint was linked to this job.</${Empty}>`}
    <div class="sec-h pad-x"><b>Other repairs on this road</b></div>
    <section class="list">${sameRoad.map((o) => html`<${WorkOrderRow} w=${{ ...o, roadName: road?.name, workType: '', flagDetails: woFlags(o.flags) }} />`)}</section>`;
}

// ---------------- Audit list ----------------
export function AuditPage({ id, query }) {
  const [flag, setFlag] = useState(query.flag || 'any');
  const qs = new URLSearchParams({ region: id, flag, limit: 80, ...(query.contractor ? { contractor: query.contractor } : {}) });
  const { data, loading } = useData(() => api('/workorders?' + qs), [id, flag, query.contractor]);
  const labels = M().flagLabels;
  return html`<${Header} title="Audit flags" sub=${regionName(id) + (query.contractor ? ' · ' + contractor(query.contractor)?.name : '')} back />
    <div class="chips pad-x">${[['any', 'All high-priority'], ['dlp', labels.dlp], ['duplicate', labels.duplicate], ['overbilled', labels.overbilled], ['reopened', labels.reopened], ['sla', labels.sla]].map(([k, l]) => html`<button class=${'chip-btn' + (flag === k ? ' on' : '')} onClick=${() => setFlag(k)}>${l}</button>`)}</div>
    ${loading ? html`<${Loading} />` : html`<div class="dim small pad-x">${fmtNum(data.total)} work orders · ${rs(data.amount)} billed${data.total > data.items.length ? ` · showing latest ${data.items.length}` : ''}</div>
      <section class="list">${data.items.map((w) => html`<${WorkOrderRow} w=${w} />`)}</section>`}`;
}

export function Scorecards() {
  const { data, loading } = useData(() => api('/scorecards'), []);
  return html`<${Header} title="Contractor scorecards" sub="Monsoon 2025 · fair, evidence-based" back />
    ${loading ? html`<${Loading} />` : data.map((sc) => html`<${ScorecardPanel} sc=${sc} name=${html`<a href=${'#/contractor/' + sc.contractorId}>${sc.name}</a>`} />`)}`;
}

// ---------------- Position profile ----------------
export function PositionPage({ id }) {
  const s = useStore();
  const p = position(id);
  const [tab, setTab] = useState('posts');
  const posts = useData(() => api('/posts?position=' + id + '&limit=40'), [id]);
  const stats = useData(() => api(`/positions/${id}/stats`), [id]);
  if (!p) return html`<${Header} title="Position" back /><${ErrorBox} error="Position not found" />`;
  const holder = person(p.holderUserId);
  const projects = M().projects.filter((pj) => pj.positionId === id || pj.approvedByPositionId === id);
  const problems = posts.data?.filter((x) => x.tag === 'problem') || [];
  const updates = posts.data?.filter((x) => x.actingAs.type === 'position' && x.actingAs.id === id) || [];
  const st = stats.data;
  const mine = s.meta.me && p.holderUserId === s.meta.me.id;
  return html`
    <${Header} title=${p.title} sub=${regionName(p.regionId)} back />
    <section class="profile">
      <div class="profile-top">
        <${Avatar} name=${holder?.name || p.title} size=${88} ring="official" />
        <div class="profile-stats">
          <div><b>${st ? fmtNum(st.problems) : '—'}</b><span>problems</span></div>
          <div><b>${st ? fmtNum(st.updates) : '—'}</b><span>updates</span></div>
          <div><b>${st?.problems ? pct(st.responded / st.problems) : '—'}</b><span>responded</span></div>
        </div>
      </div>
      <div class="profile-name">${holder ? html`<a href=${'#/person/' + holder.id}>${holder.name}</a> <span class="verified" title="Verified"><${Icon} n="check" s=${12} w=${3} /></span>` : html`<i>Vacant position</i>`}</div>
      <div class="profile-sub">${p.title} · <a href=${'#/region/' + p.regionId}>${regionName(p.regionId)}</a> ${p.isHead ? html`<span class="head-badge">Area head</span>` : null}</div>
      ${holder?.party ? html`<div class="profile-sub"><${Party} party=${holder.party} /> · ${p.kind}</div>` : html`<div class="profile-sub dim">${p.kind}</div>`}
      <div class="btn-row">${mine ? html`<a class="btn btn-primary grow" href="#/dashboard" onClick=${() => setMode('position:' + id)}>Open dashboard</a>` : html`<${FollowButton} type="position" id=${id} />`}<a class="btn btn-ghost" href="#/new?tag=problem">Report problem</a></div>
    </section>
    <section class="card pad"><div class="sec-h"><b>Responsible for</b></div><ul class="bullets">${p.responsibilities.map((x) => html`<li>${x}</li>`)}</ul><div class="chips">${p.categories.map((c) => html`<span class="chip">${c}</span>`)}</div></section>
    <${PositionBudget} p=${p} st=${st} />
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['posts', 'Updates'], ['problems', 'Problems'], ['contractors', 'Contractors'], ['projects', 'Projects']]} />
    ${tab === 'posts' ? (posts.loading ? html`<${Loading} />` : updates.length ? html`<div class="feed">${updates.map((x) => html`<${PostCard} p=${x} compact />`)}</div>` : html`<${Empty}>No official updates yet.</${Empty}>`) : null}
    ${tab === 'problems' ? (posts.loading ? html`<${Loading} />` : problems.length ? html`<div class="feed">${problems.map((x) => html`<${PostCard} p=${x} compact />`)}</div>` : html`<${Empty}>No problems assigned.</${Empty}>`) : null}
    ${tab === 'contractors' ? html`<section class="list">${p.contractorIds.length ? p.contractorIds.map((cid) => html`<${ContractorRow} c=${contractor(cid)} />`) : html`<${Empty}>No contractors assigned.</${Empty}>`}</section>` : null}
    ${tab === 'projects' ? html`<section class="list">${projects.length ? projects.map((pj) => html`<${ProjectRow} pj=${pj} />`) : html`<${Empty}>No projects.</${Empty}>`}</section>` : null}`;
}

function PositionBudget({ p, st }) {
  const r = region(p.regionId);
  const areaTotal = Object.values(r.budget || {}).reduce((a, b) => a + b, 0);
  const peers = positionsIn(p.regionId).filter((x) => x.budget > 0);
  if (!p.budget) return html`<section class="card pad"><div class="sec-h"><b>Budget</b><span class="dim">No budget managed directly</span></div><a class="link" href=${'#/region/' + p.regionId + '?tab=budget'}>See ${r.shortName || r.name}'s budget ›</a></section>`;
  return html`<${BudgetPanel} title="Budget managed by this position" entries=${peers.map((x) => [x.id === p.id ? x.title + ' (this)' : x.title, x.budget])}
    context=${`${inr(p.budget)} — ${areaTotal ? ((p.budget / areaTotal) * 100).toFixed(0) + '% of the area budget (' + inr(areaTotal) + ')' : ''}${st ? ` · ${fmtNum(st.open)} open problems assigned` : ''}`} />`;
}

// ---------------- Contractor profile ----------------
export function ContractorPage({ id }) {
  const c = contractor(id);
  const [tab, setTab] = useState('score');
  const sc = useData(() => api(`/contractors/${id}/scorecard`), [id]);
  const wos = useData(() => (tab === 'jobs' || tab === 'flags' ? api(`/workorders?contractor=${id}&limit=60${tab === 'flags' ? '&flag=any' : ''}`) : Promise.resolve(null)), [id, tab]);
  if (!c) return html`<${Header} title="Contractor" back /><${ErrorBox} error="Contractor not found" />`;
  const projects = M().projects.filter((pj) => pj.contractorId === id || pj.bids.some((b) => b.contractorId === id));
  const d = sc.data;
  return html`
    <${Header} title=${c.name} sub="Contractor" back />
    <section class="profile">
      <div class="profile-top"><${Avatar} name=${c.name} size=${88} ring="contractor" />
        <div class="profile-stats"><div><b>${d ? fmtNum(d.jobs) : '—'}</b><span>jobs</span></div><div><b>${d ? rs(d.spend) : '—'}</b><span>billed</span></div><div><b>${d ? d.score : '—'}</b><span>score</span></div></div>
      </div>
      <div class="profile-name">${c.name}</div>
      <div class="profile-sub">${c.type === 'group' ? 'Group of citizens' : c.type === 'individual' ? 'Individual contractor' : 'Registered company'}${c.empanelledSince ? ` · empanelled since ${c.empanelledSince}` : ''}</div>
      <div class="btn-row"><${FollowButton} type="contractor" id=${id} /></div>
      <div class="profile-sub dim small">Members: ${c.memberUserIds.map((u, i) => html`${i ? ', ' : ''}<a href=${'#/person/' + u}>${person(u)?.name}</a>`)}</div>
    </section>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['score', 'Scorecard'], ['jobs', 'Jobs'], ['flags', 'Flags'], ['assigned', 'Assigned by'], ['projects', 'Projects']]} />
    ${tab === 'score' ? (sc.loading ? html`<${Loading} />` : d ? html`<${ScorecardPanel} sc=${d} />
      <section class="card pad"><div class="sec-h"><b>Durability by method</b></div>${d.methodStats.map((m) => html`<div class="budget-row"><div class="budget-l"><span>${m.m} (${m.n} jobs)</span><b class=${m.reopen > d.peer.reopen + 0.05 ? 'bad' : ''}>${pct(m.reopen)} failed</b></div><div class="bar over"><i style=${`width:${m.reopen * 100}%`}></i></div></div>`)}</section>` : html`<${Empty}>No repair jobs recorded.</${Empty}>`) : null}
    ${tab === 'jobs' || tab === 'flags' ? (wos.loading || !wos.data ? html`<${Loading} />` : html`<div class="dim small pad-x">${fmtNum(wos.data.total)} jobs · ${rs(wos.data.amount)}</div><section class="list">${wos.data.items.map((w) => html`<${WorkOrderRow} w=${w} />`)}</section>`) : null}
    ${tab === 'assigned' ? html`<section class="list">${c.assignedBy.map((a) => html`<a class="row" href=${'#/position/' + a.positionId}><div class="row-main"><div class="row-t">${position(a.positionId)?.title}</div><div class="row-s">for ${regionName(a.regionId)} · since ${new Date(a.at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div></div></a>`)}</section>` : null}
    ${tab === 'projects' ? html`<section class="list">${projects.length ? projects.map((pj) => html`<${ProjectRow} pj=${pj} />`) : html`<${Empty}>No projects or bids.</${Empty}>`}</section>` : null}`;
}

// ---------------- Project view ----------------
export function ProjectPage({ id }) {
  const s = useStore();
  const pj = project(id);
  const updates = useData(() => api('/posts?project=' + id), [id]);
  const [bidOpen, setBidOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  if (!pj) return html`<${Header} title="Project" back /><${ErrorBox} error="Project not found" />`;
  const me = s.meta.me;
  const pos = position(pj.positionId);
  const isOwner = me && pos?.holderUserId === me.id;
  const myCons = me ? me.contractorIds : [];
  const pctv = pj.budget ? Math.min(100, Math.round((pj.spent / pj.budget) * 100)) : 0;
  const bids = [...pj.bids].sort((a, b) => a.amount - b.amount);
  const minAmt = bids[0]?.amount, minDays = Math.min(...bids.map((b) => b.timelineDays));
  const award = async (contractorId) => { try { await post(`/projects/${id}/award`, { contractorId }); toast('Contract awarded'); } catch (e) { toast(e.message); } };
  const progressPosts = (updates.data || []).filter((x) => x.tag === 'progress');
  const problems = (updates.data || []).filter((x) => x.tag === 'problem');
  const road = pj.roadId && M().roads.find((r) => r.id === pj.roadId);
  return html`
    <${Header} title="Project" back />
    <section class="card pad">
      <div class="chips"><span class="chip">${pj.category}</span><${StatusPill} status=${pj.status} /></div>
      <h2 class="h2">${pj.title}</h2>
      <p>${pj.description}</p>
      <div class="budget-l"><span>Budget allocated</span><b>${inr(pj.budget)}</b></div>
      <div class="budget-l"><span>Spent so far</span><b>${inr(pj.spent)} (${pctv}%)</b></div>
      <div class="bar"><i style=${`width:${pctv}%`}></i></div>
      ${isOwner ? html`<div class="btn-row wrap"><button class="btn btn-ghost btn-sm" onClick=${() => setEditOpen(true)}>Update status / spend</button><a class="btn btn-progress btn-sm" href=${`#/new?tag=progress&project=${id}&link=${pj.linkedProblemIds.join(',')}`}>Post progress update</a></div>` : null}
      ${myCons.includes(pj.contractorId) ? html`<div class="btn-row"><a class="btn btn-progress btn-sm" href=${`#/new?tag=progress&project=${id}&link=${pj.linkedProblemIds.join(',')}`}>Post site update</a></div>` : null}
    </section>
    <section class="card pad accountable">
      <div class="sec-h"><b>Who is accountable</b></div>
      <div class="kv"><span>Area</span><a href=${'#/region/' + pj.regionId}>${regionName(pj.regionId)}</a></div>
      ${road ? html`<div class="kv"><span>Road</span><a href=${'#/road/' + road.id}>${road.name} · segment ${road.segment}</a></div>` : null}
      <div class="kv"><span>Position</span><a href=${'#/position/' + pj.positionId}>${pos?.title}</a></div>
      <div class="kv"><span>Person</span>${person(pos?.holderUserId) ? html`<a href=${'#/person/' + pos.holderUserId}>${person(pos.holderUserId).name}</a>` : 'Vacant'}</div>
      <div class="kv"><span>Approved by</span><span>${position(pj.approvedByPositionId)?.title} — ${person(pj.approvedByUserId)?.name || '—'}</span></div>
      <div class="kv"><span>Contractor</span>${pj.contractorId ? html`<a href=${'#/contractor/' + pj.contractorId}>${contractor(pj.contractorId).name}</a>` : html`<i>Not awarded yet</i>`}</div>
      <div class="kv"><span>Timeline</span><span>${fmtDate(pj.startDate)} → ${pj.endDate ? fmtDate(pj.endDate) : 'ongoing'}</span></div>
    </section>
    <section class="card pad">
      <div class="sec-h"><b>Bidders compared</b><span class="dim small">${bids.length} bids</span></div>
      ${bids.length ? html`<div class="table-wrap"><table class="bids">
        <thead><tr><th>Contractor</th><th>Bid</th><th>Days</th><th></th></tr></thead>
        <tbody>${bids.map((b) => html`<tr class=${b.contractorId === pj.contractorId ? 'won' : ''}>
          <td><a href=${'#/contractor/' + b.contractorId}>${contractor(b.contractorId)?.name}</a>${b.note ? html`<div class="dim small">${b.note}</div>` : null}</td>
          <td>${inr(b.amount)}${b.amount === minAmt ? html`<div class="best">lowest</div>` : null}</td>
          <td>${b.timelineDays}${b.timelineDays === minDays ? html`<div class="best">fastest</div>` : null}</td>
          <td>${b.contractorId === pj.contractorId ? html`<span class="status st-resolved">Awarded</span>` : isOwner && pj.status === 'bidding' ? html`<button class="btn btn-primary btn-sm" onClick=${() => award(b.contractorId)}>Award</button>` : null}</td>
        </tr>`)}</tbody></table></div>
        <a class="link small" href="#/scorecards">Compare their scorecards before awarding ›</a>` : html`<div class="dim small">No bids yet.</div>`}
      ${pj.status === 'bidding' && myCons.length ? html`<button class="btn btn-primary btn-block" onClick=${() => setBidOpen(true)}>Place a bid</button>` : null}
    </section>
    <div class="sec-h pad-x"><b>Linked problems</b></div>
    ${problems.length ? html`<div class="feed">${problems.map((x) => html`<${PostCard} p=${x} compact />`)}</div>` : html`<${Empty}>No linked problem posts.</${Empty}>`}
    <div class="sec-h pad-x"><b>Progress updates</b></div>
    ${progressPosts.length ? html`<div class="feed">${progressPosts.map((x) => html`<${PostCard} p=${x} compact />`)}</div>` : html`<${Empty}>No updates yet.</${Empty}>`}
    <${BidSheet} open=${bidOpen} onClose=${() => setBidOpen(false)} pj=${pj} contractorIds=${myCons} />
    <${EditProjectSheet} open=${editOpen} onClose=${() => setEditOpen(false)} pj=${pj} />`;
}

function BidSheet({ open, onClose, pj, contractorIds }) {
  const [f, setF] = useState({ contractorId: contractorIds[0], amount: '', timelineDays: '', note: '' });
  if (!open) return null;
  const submit = async (e) => { e.preventDefault(); try { await post(`/projects/${pj.id}/bids`, f); toast('Bid placed'); onClose(); } catch (err) { toast(err.message); } };
  return html`<${Sheet} open title="Place a bid" onClose=${onClose}><form class="form" onSubmit=${submit}>
    <label class="field"><span>As</span><select value=${f.contractorId} onChange=${(e) => setF({ ...f, contractorId: e.target.value })}>${contractorIds.map((c) => html`<option value=${c}>${contractor(c).name}</option>`)}</select></label>
    <label class="field"><span>Amount (₹ crore) — allocated ${inr(pj.budget)}</span><input type="number" step="0.01" required value=${f.amount} onInput=${(e) => setF({ ...f, amount: e.target.value })} /></label>
    <label class="field"><span>Timeline (days)</span><input type="number" required value=${f.timelineDays} onInput=${(e) => setF({ ...f, timelineDays: e.target.value })} /></label>
    <label class="field"><span>Note</span><input value=${f.note} onInput=${(e) => setF({ ...f, note: e.target.value })} /></label>
    <button class="btn btn-primary btn-block">Submit bid</button></form></${Sheet}>`;
}
function EditProjectSheet({ open, onClose, pj }) {
  const [f, setF] = useState({ status: pj.status, spent: pj.spent });
  if (!open) return null;
  const submit = async (e) => { e.preventDefault(); try { await post(`/projects/${pj.id}/update`, f); toast('Project updated'); onClose(); } catch (err) { toast(err.message); } };
  return html`<${Sheet} open title="Update project" onClose=${onClose}><form class="form" onSubmit=${submit}>
    <label class="field"><span>Status</span><select value=${f.status} onChange=${(e) => setF({ ...f, status: e.target.value })}>${['bidding', 'in_progress', 'completed'].map((x) => html`<option value=${x}>${STATUS[x]}</option>`)}</select></label>
    <label class="field"><span>Spent (₹ crore)</span><input type="number" step="0.01" value=${f.spent} onInput=${(e) => setF({ ...f, spent: e.target.value })} /></label>
    <button class="btn btn-primary btn-block">Save</button></form></${Sheet}>`;
}

// ---------------- Person / citizen page ----------------
export function PersonPage({ id }) {
  const info = useData(() => api('/people/' + id), [id]);
  const posts = useData(() => api('/posts?author=' + id + '&all=1'), [id]);
  if (info.loading) return html`<${Header} title="Profile" back /><${Loading} />`;
  if (info.error) return html`<${Header} title="Profile" back /><${ErrorBox} error=${info.error} />`;
  const p = info.data.person;
  const anon = p.kind === 'anon';
  return html`
    <${Header} title=${anon ? 'Citizen' : p.name} back />
    <section class="profile">
      <div class="profile-top"><${Avatar} name=${p.name} kind=${p.kind} size=${88} ring=${anon ? null : 'official'} />
        <div class="profile-stats"><div><b>${posts.data?.length ?? '—'}</b><span>posts</span></div><div><b>${info.data.followers}</b><span>followers</span></div><div><b>${posts.data?.reduce((a, x) => a + x.upvoteCount, 0) ?? '—'}</b><span>upvotes</span></div></div>
      </div>
      <div class="profile-name">${p.name}</div>
      <div class="profile-sub">${anon ? 'Verified citizen · identity hidden' : html`<${Party} party=${p.party} />`} · <a href=${'#/region/' + p.regionId}>${regionName(p.regionId)}</a></div>
      ${!info.data.isMe && p.kind !== 'admin' ? html`<div class="btn-row"><${FollowButton} type="user" id=${id} /></div>` : null}
    </section>
    ${!anon && p.positionIds?.length ? html`<section class="card pad"><div class="sec-h"><b>Positions held</b></div>${p.positionIds.map((pid) => html`<${PositionRow} p=${position(pid)} showRegion right=${null} />`)}</section>` : null}
    ${!anon && p.contractorIds?.length ? html`<section class="card pad"><div class="sec-h"><b>Contractor</b></div>${p.contractorIds.map((cid) => html`<${ContractorRow} c=${contractor(cid)} />`)}</section>` : null}
    <div class="sec-h pad-x"><b>${anon ? 'Posts' : 'Posts as a citizen'}</b></div>
    ${posts.loading ? html`<${Loading} />` : posts.data.length ? html`<div class="feed">${posts.data.map((x) => html`<${PostCard} p=${x} compact />`)}</div>` : html`<${Empty}>No posts yet.</${Empty}>`}`;
}
