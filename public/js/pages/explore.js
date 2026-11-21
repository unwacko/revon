import { html, useState, setMode, store, useStore, api, post, useData, go, toast, region, position, contractor, project, person, children, chain, positionsIn, levelLabel, inr, ago, fmtNum, M, STATUS } from '../lib.js';
import { Header, Icon, Avatar, Tabs, PostCard, PositionRow, ContractorRow, ProjectRow, RegionRow, Breadcrumb, BudgetBars, AreaMap, FollowButton, Loading, Empty, ErrorBox, StatusPill, Party, Sheet, ComingSoon } from '../components.js';

// ---------------- Explore ----------------
export function Explore() {
  const s = useStore();
  const [q, setQ] = useState('');
  const ql = q.trim().toLowerCase();
  const me = s.meta.me;
  const res = ql ? {
    regions: M().regions.filter((r) => r.name.toLowerCase().includes(ql)).slice(0, 6),
    positions: M().positions.filter((p) => (p.title + ' ' + (person(p.holderUserId)?.name || '') + ' ' + region(p.regionId).name).toLowerCase().includes(ql)).slice(0, 10),
    contractors: M().contractors.filter((c) => c.name.toLowerCase().includes(ql)).slice(0, 6),
    projects: M().projects.filter((p) => p.title.toLowerCase().includes(ql)).slice(0, 6),
  } : null;
  return html`
    <header class="topbar"><div class="search"><${Icon} n="search" s=${18} /><input placeholder="Search areas, positions, people, contractors" value=${q} onInput=${(e) => setQ(e.target.value)} aria-label="Search" /></div></header>
    ${res ? html`<div class="list">
      ${res.regions.map((r) => html`<${RegionRow} r=${r} />`)}
      ${res.positions.map((p) => html`<${PositionRow} p=${p} showRegion />`)}
      ${res.contractors.map((c) => html`<${ContractorRow} c=${c} />`)}
      ${res.projects.map((pj) => html`<${ProjectRow} pj=${pj} />`)}
      ${!Object.values(res).flat().length ? html`<${Empty}>No results for “${q}”.</${Empty}>` : null}
    </div>` : html`
      ${me ? html`<section class="card pad">
        <div class="sec-h"><b>Accountable for your area</b><a href=${'#/region/' + me.regionId} class="link">${region(me.regionId).name} ›</a></div>
        ${chain(me.regionId).slice(0, 3).flatMap((r) => positionsIn(r.id).slice(0, 3)).map((p) => html`<${PositionRow} p=${p} showRegion />`)}
      </section>` : null}
      <section class="card pad">
        <div class="sec-h"><b>Hierarchy of India</b><a class="link" href="#/structure">How it works ›</a></div>
        <p class="muted small">Area → positions → people. Tap to expand. Higher and lower are relative to where you are.</p>
        <${TreeNode} id="r_in" open depth=${0} />
      </section>
      <section class="card pad"><div class="sec-h"><b>Contractors & businesses</b></div>${M().contractors.map((c) => html`<${ContractorRow} c=${c} />`)}</section>
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
      <button class="tree-toggle" aria-label=${open ? 'Collapse' : 'Expand'} disabled=${!kids.length} onClick=${() => setOpen(!open)}>${kids.length ? (open ? '▾' : '▸') : '•'}</button>
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
    ['Nation', 'Prime Minister (Union Council of Ministers)', 'MPs — Lok Sabha constituencies (543)'],
    ['State / UT', 'Chief Minister (Governor is constitutional head)', 'MLAs — Vidhan Sabha constituencies'],
    ['Revenue Division', 'Divisional Commissioner (IAS)', 'Groups several districts (most states)'],
    ['District', 'District Collector / Magistrate (IAS), SP (IPS)', 'Administrative hub of every department'],
    ['Sub-division / Tehsil / Taluka', 'SDM, Tehsildar', 'Revenue & land records'],
    ['Urban: Municipal Corporation / Council / Nagar Panchayat', 'Mayor / Chairperson (elected), Municipal Commissioner / Chief Officer (appointed)', '74th Amendment local bodies'],
    ['Urban: Ward', 'Corporator / Councillor (Nagarsevak), Ward Officer, Junior Engineer', 'Smallest urban unit'],
    ['Rural: Zilla Parishad', 'ZP President (elected), CEO (IAS)', '73rd Amendment — district panchayat'],
    ['Rural: Panchayat Samiti (Block)', 'Sabhapati / Pradhan (elected), Block Development Officer', 'Intermediate panchayat'],
    ['Rural: Gram Panchayat', 'Sarpanch / Pradhan (elected), Gram Sevak / Panchayat Secretary', 'Village level; Gram Sabha of all voters'],
  ];
  return html`<${Header} title="How India is divided" back />
    <section class="card pad">
      <p>Every problem on this platform belongs to an <b>area</b>. Each area has a fixed head position plus other positions (police, engineers, departments). People and contractors are assigned to those positions.</p>
      <p class="muted small">Two parallel local tracks exist below the district: <b>urban</b> (74th Constitutional Amendment) and <b>rural</b> (73rd Amendment, three-tier Panchayati Raj). Electoral constituencies (Lok Sabha, Vidhan Sabha) overlap these administrative areas, so MPs and MLAs are attached to the area that best contains their constituency. Names vary by state (e.g. Taluka / Tehsil / Mandal; Sarpanch / Pradhan / Mukhiya).</p>
    </section>
    <section class="card pad structure">
      ${rows.map(([lvl, who, note], i) => html`<div class="st-row"><div class="st-n">${i + 1}</div><div><b>${lvl}</b><div>${who}</div><div class="muted small">${note}</div></div></div>`)}
    </section>
    <section class="card pad"><div class="muted small">Also outside this tree but often responsible for roads: NHAI (national highways), State PWD / MSRDC (state highways), Cantonment Boards, Development Authorities (e.g. PMRDA), and Smart City SPVs. These appear as positions attached to the area they serve.</div></section>`;
}

// ---------------- Area page ----------------
export function RegionPage({ id }) {
  const s = useStore();
  const r = region(id);
  const [tab, setTab] = useState('positions');
  const [addOpen, setAddOpen] = useState(false);
  const posts = useData(() => api(`/posts?region=${id}&subtree=1`), [id]);
  if (!r) return html`<${Header} title="Area" back /><${ErrorBox} error="Area not found" />`;
  const ps = positionsIn(id);
  const head = ps.find((p) => p.isHead);
  const kids = children(id);
  const me = s.meta.me;
  const canEdit = me && (me.role === 'admin' || (head && head.holderUserId === me.id));
  const problems = posts.data?.filter((p) => p.tag === 'problem') || [];
  const projects = M().projects.filter((pj) => chain(pj.regionId).some((c) => c.id === id));
  return html`
    <${Header} title=${r.name} sub=${levelLabel(r.type)} back right=${html`<${FollowButton} type="region" id=${id} small />`} />
    <${Breadcrumb} regionId=${id} />
    <${AreaMap} regions=${[r, ...kids]} height=${190} />
    <div class="stats">
      <div><b>${fmtNum(r.population)}</b><span>people</span></div>
      <div><b>${ps.length}</b><span>positions</span></div>
      <div><b>${problems.filter((p) => p.status !== 'resolved').length}</b><span>open problems</span></div>
      <div><b>${inr(Object.values(r.budget).reduce((a, b) => a + b, 0))}</b><span>budget</span></div>
    </div>
    ${r.note ? html`<div class="muted small pad-x">${r.note}</div>` : null}
    ${head ? html`<section class="card pad head-card"><div class="muted small">Fixed head position — can edit this area's positions</div><${PositionRow} p=${head} /></section>` : null}
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['positions', 'Positions'], ['problems', 'Problems', problems.length || null], ['projects', 'Projects'], ['budget', 'Budget'], ...(kids.length ? [['areas', 'Sub-areas']] : [])]} />
    ${tab === 'positions' ? html`<section class="list">
      ${ps.map((p) => html`<div class="pos-block"><${PositionRow} p=${p} /><div class="resp-list">${p.responsibilities.slice(0, 3).map((x) => html`<span>${x}</span>`)}</div></div>`)}
      ${canEdit ? html`<button class="btn btn-ghost btn-block" onClick=${() => setAddOpen(true)}>+ Add position to this area</button>` : null}
    </section>` : null}
    ${tab === 'problems' ? (posts.loading ? html`<${Loading} />` : problems.length ? problems.map((p) => html`<${PostCard} p=${p} compact />`) : html`<${Empty}>No problems reported here yet.</${Empty}>`) : null}
    ${tab === 'projects' ? html`<section class="list">${projects.length ? projects.map((pj) => html`<${ProjectRow} pj=${pj} />`) : html`<${Empty}>No projects yet.</${Empty}>`}</section>` : null}
    ${tab === 'budget' ? html`<${BudgetBars} budget=${r.budget} />
      <section class="card pad"><div class="sec-h"><b>By position</b></div>${ps.filter((p) => p.budget).map((p) => html`<div class="budget-row"><div class="budget-l"><a href=${'#/position/' + p.id}>${p.title}</a><b>${inr(p.budget)}</b></div></div>`)}</section>` : null}
    ${tab === 'areas' ? html`<section class="list">${kids.map((k) => html`<${RegionRow} r=${k} right=${html`<span class="muted small">${positionsIn(k.id).length} positions</span>`} />`)}</section>` : null}
    <${AddPositionSheet} open=${addOpen} onClose=${() => setAddOpen(false)} regionId=${id} />`;
}

function AddPositionSheet({ open, onClose, regionId }) {
  const [f, setF] = useState({ title: '', kind: 'appointed', categories: ['Roads'], responsibilities: '', budget: '' });
  if (!open) return null;
  const submit = async (e) => {
    e.preventDefault();
    try { await post('/admin/positions', { ...f, regionId, responsibilities: f.responsibilities.split('\n') }); toast('Position added'); onClose(); } catch (err) { toast(err.message); }
  };
  return html`<${Sheet} open title="Add position" onClose=${onClose}><form class="form" onSubmit=${submit}>
    <label class="field"><span>Title</span><input required value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Assistant Engineer (Drainage)" /></label>
    <label class="field"><span>Type</span><select value=${f.kind} onChange=${(e) => setF({ ...f, kind: e.target.value })}><option value="elected">Elected</option><option value="appointed">Appointed</option><option value="department">Department</option></select></label>
    <div class="field"><span>Responsible for categories</span><div class="chips">${M().categories.map((c) => html`<button type="button" class=${'chip-btn' + (f.categories.includes(c) ? ' on' : '')} onClick=${() => setF({ ...f, categories: f.categories.includes(c) ? f.categories.filter((x) => x !== c) : [...f.categories, c] })}>${c}</button>`)}</div></div>
    <label class="field"><span>Responsibilities (one per line)</span><textarea rows="3" value=${f.responsibilities} onInput=${(e) => setF({ ...f, responsibilities: e.target.value })}></textarea></label>
    <label class="field"><span>Budget (₹ crore)</span><input type="number" step="0.01" value=${f.budget} onInput=${(e) => setF({ ...f, budget: e.target.value })} /></label>
    <button class="btn btn-primary btn-block">Add position</button>
    <p class="muted small">People are assigned to positions by platform admins.</p>
  </form></${Sheet}>`;
}

// ---------------- Position profile ----------------
export function PositionPage({ id }) {
  const s = useStore();
  const p = position(id);
  const [tab, setTab] = useState('posts');
  const posts = useData(() => api('/posts?position=' + id), [id]);
  if (!p) return html`<${Header} title="Position" back /><${ErrorBox} error="Position not found" />`;
  const holder = person(p.holderUserId);
  const r = region(p.regionId);
  const projects = M().projects.filter((pj) => pj.positionId === id || pj.approvedByPositionId === id);
  const problems = posts.data?.filter((x) => x.tag === 'problem') || [];
  const updates = posts.data?.filter((x) => x.actingAs.type === 'position' && x.actingAs.id === id) || [];
  const responded = problems.filter((x) => x.respondedByPositions?.includes(id)).length;
  const mine = s.meta.me && p.holderUserId === s.meta.me.id;
  return html`
    <${Header} title=${p.title} sub=${r.name} back />
    <section class="profile">
      <div class="profile-top">
        <${Avatar} name=${holder?.name || p.title} size=${84} ring="official" />
        <div class="profile-stats">
          <div><b>${problems.length}</b><span>problems</span></div>
          <div><b>${problems.length ? Math.round((responded / problems.length) * 100) + '%' : '—'}</b><span>responded</span></div>
          <div><b>${projects.length}</b><span>projects</span></div>
        </div>
      </div>
      <div class="profile-name">${holder ? html`<a href=${'#/person/' + holder.id}>${holder.name}</a> <span class="verified">✓</span>` : html`<i>Vacant position</i>`}</div>
      <div class="profile-sub">${p.title} · <a href=${'#/region/' + r.id}>${r.name}</a> ${p.isHead ? html`<span class="head-badge">Area head</span>` : null}</div>
      ${holder?.party ? html`<div class="profile-sub"><${Party} party=${holder.party} /> · ${p.kind}</div>` : html`<div class="profile-sub muted">${p.kind}</div>`}
      <div class="btn-row">${mine ? html`<a class="btn btn-primary grow" href="#/dashboard" onClick=${() => setMode('position:' + id)}>Open dashboard</a>` : html`<${FollowButton} type="position" id=${id} />`}<a class="btn btn-ghost" href=${'#/new?tag=problem'}>Report problem</a></div>
    </section>
    <section class="card pad"><div class="sec-h"><b>Responsible for</b></div><ul class="bullets">${p.responsibilities.map((x) => html`<li>${x}</li>`)}</ul><div class="chips">${p.categories.map((c) => html`<span class="chip">${c}</span>`)}</div></section>
    <section class="card pad"><div class="sec-h"><b>Budget allocated</b><b>${inr(p.budget)}</b></div><div class="muted small">Annual allocation managed by this position (sample).</div></section>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['posts', 'Updates'], ['problems', 'Problems', problems.filter((x) => x.status !== 'resolved').length || null], ['contractors', 'Contractors'], ['projects', 'Projects']]} />
    ${tab === 'posts' ? (posts.loading ? html`<${Loading} />` : updates.length ? updates.map((x) => html`<${PostCard} p=${x} compact />`) : html`<${Empty}>No official updates yet.</${Empty}>`) : null}
    ${tab === 'problems' ? (posts.loading ? html`<${Loading} />` : problems.length ? problems.map((x) => html`<${PostCard} p=${x} compact />`) : html`<${Empty}>No problems assigned.</${Empty}>`) : null}
    ${tab === 'contractors' ? html`<section class="list">${p.contractorIds.length ? p.contractorIds.map((cid) => html`<${ContractorRow} c=${contractor(cid)} />`) : html`<${Empty}>No contractors assigned.</${Empty}>`}</section>` : null}
    ${tab === 'projects' ? html`<section class="list">${projects.length ? projects.map((pj) => html`<${ProjectRow} pj=${pj} />`) : html`<${Empty}>No projects.</${Empty}>`}</section>` : null}`;
}

// ---------------- Contractor profile ----------------
export function ContractorPage({ id }) {
  const c = contractor(id);
  const [tab, setTab] = useState('current');
  const posts = useData(() => api('/posts?contractor=' + id), [id]);
  if (!c) return html`<${Header} title="Contractor" back /><${ErrorBox} error="Contractor not found" />`;
  const projects = M().projects.filter((pj) => pj.contractorId === id);
  const current = projects.filter((pj) => pj.status !== 'completed');
  const past = projects.filter((pj) => pj.status === 'completed');
  const bids = M().projects.filter((pj) => pj.bids.some((b) => b.contractorId === id) && pj.contractorId !== id);
  const total = projects.reduce((a, pj) => a + pj.budget, 0);
  return html`
    <${Header} title=${c.name} sub="Contractor" back />
    <section class="profile">
      <div class="profile-top"><${Avatar} name=${c.name} size=${84} ring="contractor" />
        <div class="profile-stats"><div><b>${current.length}</b><span>active</span></div><div><b>${past.length}</b><span>completed</span></div><div><b>${inr(total)}</b><span>awarded</span></div></div>
      </div>
      <div class="profile-name">${c.name}</div>
      <div class="profile-sub">${c.type === 'group' ? 'Group of citizens' : c.type === 'individual' ? 'Individual contractor' : 'Registered company'} · ${c.specialties.join(', ')}</div>
      <div class="profile-sub muted small">Members: ${c.memberUserIds.map((u, i) => html`${i ? ', ' : ''}<a href=${'#/person/' + u}>${person(u)?.name}</a>`)}</div>
    </section>
    <section class="card pad"><div class="sec-h"><b>Assigned by</b></div>
      ${c.assignedBy.map((a) => { const p = position(a.positionId); return html`<a class="row" href=${'#/position/' + a.positionId}><div class="row-main"><div class="row-t">${p?.title}</div><div class="row-s">for ${region(a.regionId)?.name} · since ${new Date(a.at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}</div></div></a>`; })}
    </section>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['current', 'Working on', current.length || null], ['past', 'Past'], ['bids', 'Bids'], ['updates', 'Updates']]} />
    ${tab === 'current' ? html`<section class="list">${current.length ? current.map((pj) => html`<${ProjectDetailRow} pj=${pj} />`) : html`<${Empty}>No active projects.</${Empty}>`}</section>` : null}
    ${tab === 'past' ? html`<section class="list">${past.length ? past.map((pj) => html`<${ProjectDetailRow} pj=${pj} />`) : html`<${Empty}>No completed projects yet.</${Empty}>`}</section>` : null}
    ${tab === 'bids' ? html`<section class="list">${bids.length ? bids.map((pj) => { const b = pj.bids.find((x) => x.contractorId === id); return html`<a class="row" href=${'#/project/' + pj.id}><div class="row-main"><div class="row-t">${pj.title}</div><div class="row-s">Bid ${inr(b.amount)} · ${b.timelineDays} days · <${StatusPill} status=${pj.status} /></div></div></a>`; }) : html`<${Empty}>No open bids.</${Empty}>`}</section>` : null}
    ${tab === 'updates' ? (posts.loading ? html`<${Loading} />` : posts.data.length ? posts.data.map((x) => html`<${PostCard} p=${x} compact />`) : html`<${Empty}>No posts.</${Empty}>`) : null}`;
}

function ProjectDetailRow({ pj }) {
  const pct = pj.budget ? Math.min(100, Math.round((pj.spent / pj.budget) * 100)) : 0;
  return html`<a class="card pad proj-card" href=${'#/project/' + pj.id}>
    <div class="row-t">${pj.title}</div>
    <div class="row-s">${region(pj.regionId).name} · for ${position(pj.positionId)?.title} · <${StatusPill} status=${pj.status} /></div>
    <div class="budget-l"><span>Spent ${inr(pj.spent)} of ${inr(pj.budget)}</span><b>${pct}%</b></div>
    <div class="bar"><i style=${`width:${pct}%`}></i></div>
  </a>`;
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
  const pct = pj.budget ? Math.min(100, Math.round((pj.spent / pj.budget) * 100)) : 0;
  const bids = [...pj.bids].sort((a, b) => a.amount - b.amount);
  const minAmt = bids[0]?.amount, minDays = Math.min(...bids.map((b) => b.timelineDays));
  const award = async (contractorId) => { try { await post(`/projects/${id}/award`, { contractorId }); toast('Contract awarded'); } catch (e) { toast(e.message); } };
  const progressPosts = (updates.data || []).filter((x) => x.tag === 'progress');
  const problems = (updates.data || []).filter((x) => x.tag === 'problem');
  return html`
    <${Header} title="Project" back />
    <section class="card pad">
      <div class="chips"><span class="chip">${pj.category}</span><${StatusPill} status=${pj.status} /></div>
      <h2 class="h2">${pj.title}</h2>
      <p>${pj.description}</p>
      <div class="budget-l"><span>Budget allocated</span><b>${inr(pj.budget)}</b></div>
      <div class="budget-l"><span>Spent so far</span><b>${inr(pj.spent)} (${pct}%)</b></div>
      <div class="bar"><i style=${`width:${pct}%`}></i></div>
      ${isOwner ? html`<div class="btn-row wrap"><button class="btn btn-ghost btn-sm" onClick=${() => setEditOpen(true)}>Update status / spend</button><a class="btn btn-progress btn-sm" href=${`#/new?tag=progress&project=${id}&link=${pj.linkedProblemIds.join(',')}`}>Post progress update</a></div>` : null}
      ${myCons.includes(pj.contractorId) ? html`<div class="btn-row"><a class="btn btn-progress btn-sm" href=${`#/new?tag=progress&project=${id}&link=${pj.linkedProblemIds.join(',')}`}>Post site update</a></div>` : null}
    </section>
    <section class="card pad accountable">
      <div class="sec-h"><b>Who is accountable</b></div>
      <div class="kv"><span>Area</span><a href=${'#/region/' + pj.regionId}>${region(pj.regionId).name}</a></div>
      <div class="kv"><span>Position</span><a href=${'#/position/' + pj.positionId}>${pos?.title}</a></div>
      <div class="kv"><span>Person</span>${person(pos?.holderUserId) ? html`<a href=${'#/person/' + pos.holderUserId}>${person(pos.holderUserId).name}</a>` : 'Vacant'}</div>
      <div class="kv"><span>Approved by</span><span>${position(pj.approvedByPositionId)?.title} — ${person(pj.approvedByUserId)?.name || '—'}</span></div>
      <div class="kv"><span>Contractor</span>${pj.contractorId ? html`<a href=${'#/contractor/' + pj.contractorId}>${contractor(pj.contractorId).name}</a>` : html`<i>Not awarded yet</i>`}</div>
      <div class="kv"><span>Timeline</span><span>${pj.startDate ? new Date(pj.startDate).toLocaleDateString('en-IN') : '—'} → ${pj.endDate ? new Date(pj.endDate).toLocaleDateString('en-IN') : 'ongoing'}</span></div>
    </section>
    <section class="card pad">
      <div class="sec-h"><b>Bidders comparison</b><span class="muted small">${bids.length} bids</span></div>
      ${bids.length ? html`<div class="table-wrap"><table class="bids">
        <thead><tr><th>Contractor</th><th>Bid</th><th>Days</th><th></th></tr></thead>
        <tbody>${bids.map((b) => html`<tr class=${b.contractorId === pj.contractorId ? 'won' : ''}>
          <td><a href=${'#/contractor/' + b.contractorId}>${contractor(b.contractorId)?.name}</a>${b.note ? html`<div class="muted small">${b.note}</div>` : null}</td>
          <td>${inr(b.amount)}${b.amount === minAmt ? html`<div class="best">lowest</div>` : null}</td>
          <td>${b.timelineDays}${b.timelineDays === minDays ? html`<div class="best">fastest</div>` : null}</td>
          <td>${b.contractorId === pj.contractorId ? html`<span class="status st-resolved">Awarded</span>` : isOwner && pj.status === 'bidding' ? html`<button class="btn btn-primary btn-sm" onClick=${() => award(b.contractorId)}>Award</button>` : null}</td>
        </tr>`)}</tbody></table></div>` : html`<div class="muted small">No bids yet.</div>`}
      ${pj.status === 'bidding' && myCons.length ? html`<button class="btn btn-primary btn-block" onClick=${() => setBidOpen(true)}>Place a bid</button>` : null}
    </section>
    <div class="sec-h pad-x"><b>Linked problems</b></div>
    ${problems.length ? problems.map((x) => html`<${PostCard} p=${x} compact />`) : html`<${Empty}>No linked problem posts.</${Empty}>`}
    <div class="sec-h pad-x"><b>Progress updates</b></div>
    ${progressPosts.length ? progressPosts.map((x) => html`<${PostCard} p=${x} compact />`) : html`<${Empty}>No updates yet.</${Empty}>`}
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
  const s = useStore();
  const info = useData(() => api('/people/' + id), [id]);
  const posts = useData(() => api('/posts?author=' + id), [id]);
  if (info.loading) return html`<${Header} title="Profile" back /><${Loading} />`;
  if (info.error) return html`<${Header} title="Profile" back /><${ErrorBox} error=${info.error} />`;
  const p = info.data.person;
  const anon = p.kind === 'anon';
  return html`
    <${Header} title=${anon ? 'Citizen' : p.name} back />
    <section class="profile">
      <div class="profile-top"><${Avatar} name=${p.name} kind=${p.kind} size=${84} ring=${anon ? null : 'official'} />
        <div class="profile-stats"><div><b>${posts.data?.length ?? '—'}</b><span>posts</span></div><div><b>${info.data.followers}</b><span>followers</span></div><div><b>${posts.data?.reduce((a, x) => a + x.upvoteCount, 0) ?? '—'}</b><span>upvotes</span></div></div>
      </div>
      <div class="profile-name">${p.name}</div>
      <div class="profile-sub">${anon ? 'Verified citizen · identity hidden' : html`<${Party} party=${p.party} />`} · <a href=${'#/region/' + p.regionId}>${region(p.regionId)?.name}</a></div>
      ${!info.data.isMe && p.kind !== 'admin' ? html`<div class="btn-row"><${FollowButton} type="user" id=${id} /></div>` : null}
    </section>
    ${!anon && p.positionIds?.length ? html`<section class="card pad"><div class="sec-h"><b>Positions held</b></div>${p.positionIds.map((pid) => html`<${PositionRow} p=${position(pid)} showRegion right=${null} />`)}</section>` : null}
    ${!anon && p.contractorIds?.length ? html`<section class="card pad"><div class="sec-h"><b>Contractor</b></div>${p.contractorIds.map((cid) => html`<${ContractorRow} c=${contractor(cid)} />`)}</section>` : null}
    <div class="sec-h pad-x"><b>${anon ? 'Problem posts' : 'Posts as citizen'}</b></div>
    ${posts.loading ? html`<${Loading} />` : posts.data.length ? posts.data.map((x) => html`<${PostCard} p=${x} compact />`) : html`<${Empty}>No posts yet.</${Empty}>`}`;
}
