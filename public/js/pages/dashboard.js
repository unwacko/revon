import { html, useState, useEffect, store, useStore, api, post, useData, go, toast, region, position, contractor, person, chain, positionsIn, setMode, inr, ago, M, STATUS } from '../lib.js';
import { Header, Icon, Avatar, Tabs, PostCard, PositionRow, ContractorRow, ProjectRow, Loading, Empty, ErrorBox, StatusPill, Sheet, TagPill, ComingSoon } from '../components.js';

export function Dashboard({ query }) {
  const s = useStore();
  const m = s.mode;
  if (m.startsWith('position:')) return html`<${PositionDashboard} id=${m.slice(9)} query=${query} />`;
  if (m.startsWith('contractor:')) return html`<${ContractorDashboard} id=${m.slice(11)} />`;
  if (m === 'admin') return html`<${AdminPage} />`;
  return html`<${Header} title="Dashboard" back /><${Empty}>Switch to a position or contractor role from your profile to see a dashboard.</${Empty}>`;
}

export function ModeSwitch() {
  const s = useStore();
  const me = s.meta.me;
  if (!me) return null;
  const opts = [['citizen', 'Citizen view', 'Browse, post problems, upvote'], ...me.positionIds.map((id) => ['position:' + id, position(id).title, region(position(id).regionId).name]), ...me.contractorIds.map((id) => ['contractor:' + id, contractor(id).name, 'Contractor']), ...(me.role === 'admin' ? [['admin', 'Platform admin', 'Assign positions & contractors']] : [])];
  if (opts.length < 2) return null;
  return html`<section class="card pad"><div class="sec-h"><b>Acting as</b><${Icon} n="swap" s=${18} /></div>
    ${opts.map(([k, t, sub]) => html`<button class=${'mode-opt' + (s.mode === k ? ' on' : '')} onClick=${() => { setMode(k); toast('Switched to ' + t); go(k === 'citizen' ? '#/' : '#/dashboard'); }}><div><b>${t}</b><div class="muted small">${sub}</div></div>${s.mode === k ? html`<${Icon} n="check" />` : null}</button>`)}
  </section>`;
}

// ---------------- Position dashboard ----------------
function PositionDashboard({ id, query }) {
  const { data, error, loading } = useData(() => api('/dashboard/position/' + id), [id]);
  const [tab, setTab] = useState('problems');
  const [filter, setFilter] = useState('all');
  const [sel, setSel] = useState([]);
  const [projOpen, setProjOpen] = useState(!!query.newProject);
  const p = position(id);
  if (loading) return html`<${Header} title="Dashboard" /><${Loading} />`;
  if (error) return html`<${Header} title="Dashboard" /><${ErrorBox} error=${error} />`;
  const { counts, problems, projects } = data;
  const list = problems.filter((x) => filter === 'all' || (filter === 'unviewed' && !x.viewed) || (filter === 'unresponded' && !x.responded && x.status !== 'resolved') || (filter === 'mine' && x.assignedToMe));
  const toggle = (pid) => setSel((x) => (x.includes(pid) ? x.filter((y) => y !== pid) : [...x, pid]));
  return html`
    <${Header} title=${p.title} sub=${region(p.regionId).name + ' · official dashboard'} right=${html`<button class="btn btn-ghost btn-sm" onClick=${() => { setMode('citizen'); go('#/'); }}>Citizen view</button>`} />
    <div class="kpis">
      <button class=${'kpi warn' + (filter === 'unviewed' ? ' on' : '')} onClick=${() => { setTab('problems'); setFilter('unviewed'); }}><b>${counts.unviewed}</b><span>Unviewed</span></button>
      <button class=${'kpi danger' + (filter === 'unresponded' ? ' on' : '')} onClick=${() => { setTab('problems'); setFilter('unresponded'); }}><b>${counts.unresponded}</b><span>Need response</span></button>
      <button class=${'kpi' + (filter === 'all' ? ' on' : '')} onClick=${() => { setTab('problems'); setFilter('all'); }}><b>${counts.total}</b><span>Total problems</span></button>
      <div class="kpi ok"><b>${counts.resolved}</b><span>Resolved</span></div>
    </div>
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['problems', 'Ranked problems'], ['projects', 'Projects', projects.length || null], ['contractors', 'Contractors'], ['budget', 'Budget']]} />
    ${tab === 'problems' ? html`
      <div class="chips pad-x">${[['all', 'All'], ['mine', 'Assigned to me'], ['unviewed', 'Unviewed'], ['unresponded', 'Unresponded']].map(([k, l]) => html`<button class=${'chip-btn' + (filter === k ? ' on' : '')} onClick=${() => setFilter(k)}>${l}</button>`)}</div>
      <div class="muted small pad-x">Ranked by upvotes, comments and recency (Reddit-style hot score). Select several to send one update to all.</div>
      ${list.length ? list.map((x, i) => html`<div class=${'dash-item' + (!x.viewed ? ' unviewed' : '')}>
        <label class="dash-check" aria-label="Select"><input type="checkbox" checked=${sel.includes(x.id)} onChange=${() => toggle(x.id)} /><span class="rank">#${i + 1}</span></label>
        <a class="dash-main" href=${'#/post/' + x.id}>
          <div class="row-t">${x.title}</div>
          <div class="row-s">▲ ${x.upvoteCount} · 💬 ${x.commentCount} · ${x.regionName} · ${ago(x.createdAt)}</div>
          <div class="chips"><${StatusPill} status=${x.status} />${!x.viewed ? html`<span class="flag-new">New</span>` : null}${!x.responded && x.status !== 'resolved' ? html`<span class="flag-due">No response</span>` : null}${x.assignedToMe ? html`<span class="chip">Assigned to you</span>` : null}</div>
        </a>
      </div>`) : html`<${Empty}>Nothing here — good work.</${Empty}>`}
      ${sel.length ? html`<div class="bulk-bar"><span>${sel.length} selected</span><a class="btn btn-progress btn-sm" href=${'#/new?tag=progress&link=' + sel.join(',')}>Post update to all</a><button class="btn btn-ghost btn-sm" onClick=${() => setProjOpen(true)}>New project</button></div>` : null}
    ` : null}
    ${tab === 'projects' ? html`<section class="list"><button class="btn btn-primary btn-block" onClick=${() => setProjOpen(true)}>+ New project</button>${projects.map((pj) => html`<${ProjectRow} pj=${pj} />`)}</section>` : null}
    ${tab === 'contractors' ? html`<${ContractorsTab} pos=${p} />` : null}
    ${tab === 'budget' ? html`<section class="card pad"><div class="sec-h"><b>Budget for this position</b><b>${inr(p.budget)}</b></div>
      <div class="budget-l"><span>Committed to projects</span><b>${inr(projects.filter((pj) => pj.positionId === id).reduce((a, pj) => a + pj.budget, 0))}</b></div>
      <div class="budget-l"><span>Spent</span><b>${inr(projects.filter((pj) => pj.positionId === id).reduce((a, pj) => a + pj.spent, 0))}</b></div></section>` : null}
    <section class="card pad"><div class="sec-h"><b>Settings</b></div><a class="row" href="#/settings"><${Icon} n="settings" /><div class="row-main">Notification & account settings</div></a><a class="row" href=${'#/position/' + id}><${Icon} n="user" /><div class="row-main">View public position profile</div></a></section>
    <${NewProjectSheet} open=${projOpen} onClose=${() => setProjOpen(false)} pos=${p} preLinked=${query.newProject ? [query.newProject, ...sel] : sel} problems=${problems} />`;
}

function ContractorsTab({ pos }) {
  const [open, setOpen] = useState(false);
  const [regOpen, setRegOpen] = useState(false);
  const others = M().contractors.filter((c) => !pos.contractorIds.includes(c.id));
  const assign = async (contractorId, remove) => { try { await post(`/positions/${pos.id}/contractors`, { contractorId, remove }); toast(remove ? 'Removed' : 'Contractor assigned'); setOpen(false); } catch (e) { toast(e.message); } };
  return html`<section class="list">
    ${pos.contractorIds.map((cid) => html`<${ContractorRow} c=${contractor(cid)} right=${html`<button class="btn btn-ghost btn-sm" onClick=${(e) => { e.preventDefault(); assign(cid, true); }}>Remove</button>`} />`)}
    ${!pos.contractorIds.length ? html`<${Empty}>No contractors assigned to this position yet.</${Empty}>` : null}
    <div class="btn-row"><button class="btn btn-primary grow" onClick=${() => setOpen(true)}>Assign existing contractor</button><button class="btn btn-ghost grow" onClick=${() => setRegOpen(true)}>Register citizens as contractor</button></div>
    <${Sheet} open=${open} title="Assign contractor" onClose=${() => setOpen(false)}>${others.map((c) => html`<${ContractorRow} c=${c} right=${html`<button class="btn btn-primary btn-sm" onClick=${(e) => { e.preventDefault(); assign(c.id); }}>Assign</button>`} />`)}</${Sheet}>
    <${RegisterContractorSheet} open=${regOpen} onClose=${() => setRegOpen(false)} positionId=${pos.id} />
  </section>`;
}

function NewProjectSheet({ open, onClose, pos, preLinked, problems }) {
  const [f, setF] = useState({ title: '', description: '', category: 'Roads', budget: '', regionId: pos.regionId, contractorId: '', linkedProblemIds: preLinked.filter(Boolean) });
  useEffect(() => { if (open) setF((x) => ({ ...x, linkedProblemIds: [...new Set(preLinked.filter(Boolean))] })); }, [open]);
  if (!open) return null;
  const areas = M().regions.filter((r) => chain(r.id).some((c) => c.id === pos.regionId));
  const submit = async (e) => { e.preventDefault(); try { const pj = await post('/projects', { ...f, positionId: pos.id }); toast('Project created — linked problem posters notified'); onClose(); go('#/project/' + pj.id); } catch (err) { toast(err.message); } };
  return html`<${Sheet} open title="New project" onClose=${onClose}><form class="form" onSubmit=${submit}>
    <label class="field"><span>Title</span><input required value=${f.title} onInput=${(e) => setF({ ...f, title: e.target.value })} placeholder="e.g. Karve Road resurfacing — Phase 2" /></label>
    <label class="field"><span>Description</span><textarea rows="3" value=${f.description} onInput=${(e) => setF({ ...f, description: e.target.value })}></textarea></label>
    <div class="field-row">
      <label class="field"><span>Category</span><select value=${f.category} onChange=${(e) => setF({ ...f, category: e.target.value })}>${M().categories.map((c) => html`<option>${c}</option>`)}</select></label>
      <label class="field"><span>Budget (₹ crore)</span><input type="number" step="0.01" required value=${f.budget} onInput=${(e) => setF({ ...f, budget: e.target.value })} /></label>
    </div>
    <label class="field"><span>Area</span><select value=${f.regionId} onChange=${(e) => setF({ ...f, regionId: e.target.value })}>${areas.map((r) => html`<option value=${r.id}>${r.name}</option>`)}</select></label>
    <label class="field"><span>Contractor</span><select value=${f.contractorId} onChange=${(e) => setF({ ...f, contractorId: e.target.value })}><option value="">Open for bids</option>${M().contractors.map((c) => html`<option value=${c.id}>${c.name}${pos.contractorIds.includes(c.id) ? ' (assigned to you)' : ''}</option>`)}</select></label>
    <div class="field"><span>Problems this fixes</span>${problems.slice(0, 15).map((p) => html`<label class="check-row"><input type="checkbox" checked=${f.linkedProblemIds.includes(p.id)} onChange=${(e) => setF({ ...f, linkedProblemIds: e.target.checked ? [...f.linkedProblemIds, p.id] : f.linkedProblemIds.filter((x) => x !== p.id) })} /><span class="grow">${p.title}</span></label>`)}</div>
    <button class="btn btn-primary btn-block">Create project</button>
  </form></${Sheet}>`;
}

function RegisterContractorSheet({ open, onClose, positionId }) {
  const [f, setF] = useState({ name: '', type: 'group', specialties: ['Roads'], members: [] });
  const [q, setQ] = useState('');
  const users = useData(() => (store.meta.me.role === 'admin' && q ? api('/admin/users?q=' + encodeURIComponent(q)) : Promise.resolve([])), [q]);
  if (!open) return null;
  const submit = async (e) => { e.preventDefault(); try { await post('/admin/contractors', { name: f.name, type: f.type, specialties: f.specialties, memberUserIds: f.members.map((m) => m.id), positionId }); toast('Contractor registered'); onClose(); } catch (err) { toast(err.message); } };
  const isAdmin = store.meta.me.role === 'admin';
  return html`<${Sheet} open title="Register contractor" onClose=${onClose}><form class="form" onSubmit=${submit}>
    <label class="field"><span>Name</span><input required value=${f.name} onInput=${(e) => setF({ ...f, name: e.target.value })} placeholder="Business or group name" /></label>
    <label class="field"><span>Type</span><select value=${f.type} onChange=${(e) => setF({ ...f, type: e.target.value })}><option value="company">Company</option><option value="group">Group of citizens</option><option value="individual">Individual</option></select></label>
    <div class="field"><span>Specialties</span><div class="chips">${M().categories.map((c) => html`<button type="button" class=${'chip-btn' + (f.specialties.includes(c) ? ' on' : '')} onClick=${() => setF({ ...f, specialties: f.specialties.includes(c) ? f.specialties.filter((x) => x !== c) : [...f.specialties, c] })}>${c}</button>`)}</div></div>
    ${isAdmin ? html`<label class="field"><span>Add members (search verified citizens)</span><input value=${q} onInput=${(e) => setQ(e.target.value)} placeholder="Name" /></label>
      ${(users.data || []).map((u) => html`<button type="button" class="pick" onClick=${() => !f.members.some((m) => m.id === u.id) && setF({ ...f, members: [...f.members, u] })}>${u.realName} <span class="muted small">${region(u.regionId)?.name}</span></button>`)}` : html`<div class="muted small">Member lookup by DigiLocker ID is admin-only in the prototype; you will be added as the first member for testing.</div>`}
    ${f.members.length ? html`<div class="chips">${f.members.map((m) => html`<span class="chip">${m.realName}</span>`)}</div>` : null}
    <button class="btn btn-primary btn-block" onClick=${() => { if (!isAdmin && !f.members.length) f.members.push({ id: store.meta.me.id, realName: 'You' }); }}>Register</button>
  </form></${Sheet}>`;
}

// ---------------- Contractor dashboard ----------------
function ContractorDashboard({ id }) {
  const c = contractor(id);
  if (!c) return html`<${ErrorBox} error="Contractor not found" />`;
  const mine = M().projects.filter((pj) => pj.contractorId === id);
  const open = M().projects.filter((pj) => pj.status === 'bidding' && c.regionIds.some((r) => chain(pj.regionId).some((x) => x.id === r)));
  return html`
    <${Header} title=${c.name} sub="Contractor dashboard" right=${html`<button class="btn btn-ghost btn-sm" onClick=${() => { setMode('citizen'); go('#/'); }}>Citizen view</button>`} />
    <div class="kpis"><div class="kpi"><b>${mine.filter((x) => x.status === 'in_progress').length}</b><span>Active</span></div><div class="kpi ok"><b>${mine.filter((x) => x.status === 'completed').length}</b><span>Completed</span></div><div class="kpi warn"><b>${open.length}</b><span>Open for bids</span></div><div class="kpi"><b>${inr(mine.reduce((a, x) => a + x.budget, 0))}</b><span>Awarded</span></div></div>
    <section class="card pad"><div class="sec-h"><b>Assigned by</b></div>${c.assignedBy.map((a) => html`<${PositionRow} p=${position(a.positionId)} showRegion right=${null} />`)}</section>
    <section class="card pad"><div class="sec-h"><b>Your projects</b></div>${mine.length ? mine.map((pj) => html`<div><${ProjectRow} pj=${pj} />${pj.status === 'in_progress' ? html`<a class="btn btn-progress btn-sm" href=${`#/new?tag=progress&project=${pj.id}&link=${pj.linkedProblemIds.join(',')}`}>Post site update</a>` : null}</div>`) : html`<div class="muted small">No projects yet.</div>`}</section>
    <section class="card pad"><div class="sec-h"><b>Open for bidding in your areas</b></div>${open.length ? open.map((pj) => html`<${ProjectRow} pj=${pj} />`) : html`<div class="muted small">No open tenders.</div>`}</section>
    <section class="card pad"><a class="row" href=${'#/contractor/' + id}><${Icon} n="user" /><div class="row-main">View public contractor profile</div></a><a class="row" href="#/settings"><${Icon} n="settings" /><div class="row-main">Settings</div></a></section>`;
}

// ---------------- Admin ----------------
function AdminPage() {
  const [tab, setTab] = useState('assign');
  return html`
    <${Header} title="Admin" sub="Positions, people, contractors" right=${html`<a class="btn btn-ghost btn-sm" href="#/new?tag=position_change">New post</a>`} />
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['assign', 'Assign people'], ['contractors', 'Contractors'], ['log', 'Problem routing'], ['bots', 'Bots']]} />
    ${tab === 'assign' ? html`<${AssignPeople} />` : null}
    ${tab === 'contractors' ? html`<${AdminContractors} />` : null}
    ${tab === 'log' ? html`<${AssignmentLog} />` : null}
    ${tab === 'bots' ? html`<section class="card pad"><div class="sec-h"><b>Moderation & AI layer</b></div><p class="muted small">Planned: verify post tags, block promotional / vulgar / unconstitutional content, and detect accountable positions from problem posts.</p>
      <div class="btn-col"><${ComingSoon} label="Tag verification bot" block /><${ComingSoon} label="Content policy bot" icon="shield" block /><${ComingSoon} label="AI responsibility detection" icon="sparkle" block /></div></section>` : null}`;
}

function AssignPeople() {
  const [regionId, setRegionId] = useState('r_w_kothrud');
  const [pick, setPick] = useState(null);
  const [q, setQ] = useState('');
  const [party, setParty] = useState('');
  const users = useData(() => (q ? api('/admin/users?q=' + encodeURIComponent(q)) : Promise.resolve([])), [q]);
  const assign = async (userId) => { try { await post('/admin/assign', { positionId: pick.id, userId, party: pick.kind === 'elected' ? party : null }); toast(userId ? 'Assigned — position-change post published' : 'Position vacated'); setPick(null); setQ(''); } catch (e) { toast(e.message); } };
  return html`<section class="card pad">
    <label class="field"><span>Area</span><select value=${regionId} onChange=${(e) => setRegionId(e.target.value)}>${M().regions.map((r) => html`<option value=${r.id}>${'— '.repeat(chain(r.id).length - 1)}${r.name}</option>`)}</select></label>
    ${positionsIn(regionId).map((p) => html`<${PositionRow} p=${p} right=${html`<button class="btn btn-primary btn-sm" onClick=${(e) => { e.preventDefault(); setPick(p); setParty(person(p.holderUserId)?.party || ''); }}>${p.holderUserId ? 'Change' : 'Assign'}</button>`} />`)}
    <a class="btn btn-ghost btn-block" href=${'#/region/' + regionId}>Edit positions on area page</a>
  </section>
  <${Sheet} open=${!!pick} title=${'Assign: ' + (pick?.title || '')} onClose=${() => setPick(null)}>
    <p class="muted small">Search verified citizens (admins see real names; the public sees names only once a position is assigned).</p>
    <input class="input" placeholder="Search by name" value=${q} onInput=${(e) => setQ(e.target.value)} />
    ${pick?.kind === 'elected' ? html`<label class="field"><span>Party (shown small on profile)</span><input value=${party} onInput=${(e) => setParty(e.target.value)} placeholder="Independent" /></label>` : null}
    ${(users.data || []).map((u) => html`<button class="row as-btn" onClick=${() => assign(u.id)}><${Avatar} name=${u.realName} size=${36} /><div class="row-main"><div class="row-t">${u.realName}</div><div class="row-s">${u.handle} · ${region(u.regionId)?.name}</div></div><span class="btn btn-sm btn-primary">Assign</span></button>`)}
    ${pick?.holderUserId ? html`<button class="btn btn-ghost btn-block" onClick=${() => assign(null)}>Vacate position</button>` : null}
  </${Sheet}>`;
}

function AdminContractors() {
  const [open, setOpen] = useState(false);
  return html`<section class="list"><button class="btn btn-primary btn-block" onClick=${() => setOpen(true)}>+ Register contractor / group</button>${M().contractors.map((c) => html`<${ContractorRow} c=${c} />`)}</section><${RegisterContractorSheet} open=${open} onClose=${() => setOpen(false)} positionId=${null} />`;
}

function AssignmentLog() {
  const { data, loading } = useData(() => api('/admin/assignments'), []);
  if (loading) return html`<${Loading} />`;
  return html`<section class="list">${data.map((x) => html`<a class="card pad" href=${'#/post/' + x.id}><div class="row-t">${x.title}</div><div class="row-s">${x.regionName}</div>
    ${x.responsible.map((r) => html`<div class="kv small"><span>${r.title}</span><span class=${'src src-' + r.assignedBy}>${r.assignedBy === 'rules' ? 'Auto (rules) · AI soon' : r.assignedBy === 'person' ? 'Official: ' + (r.assignedByName || '') : 'Chosen by poster'}</span></div>`)}</a>`)}</section>`;
}
