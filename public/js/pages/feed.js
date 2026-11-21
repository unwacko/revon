import { html, useState, useEffect, store, useStore, api, post, useData, go, toast, position, person, region, actingAs, ago, positionsIn, chain, STATUS, rs, fmtDate, regionName } from '../lib.js';
import { PostCard, Tabs, Loading, Empty, ErrorBox, Header, Icon, LanguageButton, Avatar, AuthorLine, Sheet, ProjectRow, DemoBanner, StoriesPill, NewStory } from '../components.js';

function RepsStrip() {
  const s = useStore();
  const me = s.meta?.me;
  if (!me) return null;
  const followed = new Set(me.following.positions);
  const reps = chain(me.regionId).flatMap((r) => positionsIn(r.id).filter((p) => p.isHead || followed.has(p.id))).slice(0, 12);
  const short = (t) => t.replace(/\s*\(.*\)/, '').replace(/,.*$/, '').replace('Assistant Municipal Commissioner', 'Asst. Commissioner').replace('Deputy Municipal Commissioner', 'Dy. Commissioner').replace('Executive Engineer', 'Exec. Engineer').replace('Assistant Engineer', 'Asst. Engineer');
  return html`<div class="reps"><div class="rep story-slot"><${StoriesPill} /></div>${reps.map((p) => { const h = person(p.holderUserId); return html`<a class="rep" href=${'#/position/' + p.id}><${Avatar} name=${h?.name || p.title} size=${66} ring=${followed.has(p.id) ? 'official' : 'muted'} /><span>${short(p.title)}</span><small>${regionName(p.regionId)}</small></a>`; })}</div>`;
}

// Home shows one post box. Tapping it opens the composer, which asks for the post type first.
export function PostBox() {
  const s = useStore();
  if (!s.token) return html`<div class="card pad center"><b>See what's broken on Mumbai's roads — and who is responsible.</b><p class="dim">Sign in with DigiLocker to post, upvote and follow your representatives.</p><a class="btn btn-primary" href="#/login">Sign in</a></div>`;
  const placeholder = s.mode === 'citizen' ? 'Report a road problem…' : s.mode === 'admin' ? 'Post an announcement…' : 'Post a progress update…';
  return html`<div class="postbox">
    <${Avatar} kind=${s.mode === 'citizen' ? 'anon' : 'public'} name=${s.meta.me.realName} size=${44} />
    <a class="postbox-input" href="#/new">${placeholder}</a>
    ${s.mode === 'citizen' ? html`<a class="postbox-cam" href="#/new?camera=1" aria-label="Report with camera"><${Icon} n="camera" s=${28} /></a>` : null}
  </div>`;
}

export function Feed({ query }) {
  const s = useStore();
  const [tab, setTab] = useState(query.tab || 'problems');
  const [extra, setExtra] = useState([]);
  const [more, setMore] = useState(true);
  const { data, error, loading } = useData(() => api('/feed?tab=' + tab), [tab]);
  useEffect(() => { setExtra([]); setMore(true); }, [tab, data]);
  const loadMore = async () => {
    const next = await api(`/feed?tab=${tab}&offset=${(data?.length || 0) + extra.length}`);
    setExtra((x) => [...x, ...next]);
    if (next.length < 40) setMore(false);
  };
  const posts = [...(data || []), ...extra];
  return html`
    <header class="topbar home">
      <div class="logo">Neta<span>Connect</span></div>
      <div class="topbar-right"><${LanguageButton} /><a class="icon-btn mobile-only" href="#/notifications" aria-label="Notifications"><${Icon} n="bell" s=${28} />${s.unread ? html`<i class="dot-badge">${s.unread}</i>` : null}</a></div>
    </header>
    <${RepsStrip} />
    <${PostBox} />
    <${NewStory} />
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['problems', 'Problems'], ['foryou', 'For you'], ['following', 'Following']]} />
    ${loading ? html`<${Loading} />` : error ? html`<${ErrorBox} error=${error} />` : !posts.length ? html`<${Empty}>${tab === 'following' ? 'Follow positions and citizens to fill this feed.' : 'No posts yet.'}</${Empty}>` : html`<div class="feed">${posts.map((p) => html`<${PostCard} key=${p.id} p=${p} compact />`)}</div>`}
    ${!loading && more && posts.length >= 40 ? html`<button class="btn btn-ghost btn-block" onClick=${loadMore}>Load more</button>` : null}
    <${DemoBanner} />
  `;
}

export function PostPage({ id }) {
  const s = useStore();
  const { data, error, loading } = useData(() => api('/posts/' + id), [id]);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const act = actingAs();
  const actPos = act.type === 'position' ? position(act.id) : null;

  useEffect(() => { if (actPos && data?.post?.tag === 'problem') post(`/posts/${id}/view`, { positionId: actPos.id }).catch(() => {}); }, [actPos?.id, data?.post?.id]);
  if (loading) return html`<${Header} title="Post" back /><${Loading} />`;
  if (error) return html`<${Header} title="Post" back /><${ErrorBox} error=${error} />`;
  const p = data.post;

  const send = async (e) => {
    e.preventDefault();
    if (!s.token) return go('#/login');
    setBusy(true);
    try { await post(`/posts/${id}/comments`, { body: text, actingAs: act.type === 'admin' ? { type: 'citizen' } : act }); setText(''); } catch (err) { toast(err.message); }
    setBusy(false);
  };
  const setStatus = async (status) => { try { await post(`/posts/${id}/status`, { status, positionId: actPos.id }); toast('Status updated'); } catch (e) { toast(e.message); } };
  const officialMode = actPos && p.tag === 'problem';
  const actLabel = act.type === 'position' ? actPos?.title : act.type === 'contractor' ? 'contractor' : 'citizen';

  return html`
    <${Header} title=${p.tag === 'problem' ? 'Problem' : 'Post'} sub=${p.id} back />
    <div class="feed"><${PostCard} p=${p} full /></div>
    ${data.workOrders.length ? html`<section class="card pad">
      <div class="sec-h"><b>Repair record</b><span class="dim small">Did the fix last?</span></div>
      ${data.workOrders.map((w) => html`<a class="wo-detail" href=${'#/wo/' + w.id}>
        <div class="sec-h"><b>${w.id} · ${w.method}</b><span class="dim small">${w.contractorName}</span></div>
        <div class="kv"><span>Billed</span><b>${rs(w.cost)} <span class=${w.costRatio > 1.5 ? 'bad' : 'dim'}>(${w.costRatio?.toFixed(2)}× rate card ${rs(w.expected)})</span></b></div>
        <div class="kv"><span>Assigned → completed</span><span>${fmtDate(w.assignedAt)} → ${fmtDate(w.completedAt)}</span></div>
        <div class="kv"><span>Time target (${w.slaHours} h)</span><span class=${w.slaMet ? 'ok' : 'warn'}>${w.slaMet ? 'Met' : 'Missed'}</span></div>
        <div class="kv"><span>Held for 30 days?</span><span class=${w.reopened ? 'bad' : 'ok'}>${w.reopened ? 'No — re-opened' : 'Yes'}</span></div>
        ${w.remark ? html`<div class="kv"><span>Engineer's note</span><span>${w.remark}</span></div>` : null}
        ${w.flagDetails.filter((f) => f.severity === 'high').map((f) => html`<div class="flag-box"><${Icon} n="alert" s=${18} /> ${f.text}</div>`)}
      </a>`)}
    </section>` : p.tag === 'problem' && ['open', 'in_progress'].includes(p.status) ? html`<section class="card pad"><div class="sec-h"><b>Repair record</b></div><p class="dim">No work order yet. ${p.status === 'open' ? 'This complaint is waiting for action.' : ''}</p></section>` : null}
    ${officialMode ? html`<section class="card pad official-panel">
      <div class="sec-h"><b>Respond as ${actPos.title}</b></div>
      <div class="btn-row wrap">
        <a class="btn btn-progress" href=${`#/new?tag=progress&link=${p.id}`}><${Icon} n="flag" s=${18} /> Post progress update</a>
        <button class="btn btn-ghost" onClick=${() => setAssignOpen(true)}>Assign to position</button>
        <a class="btn btn-ghost" href=${`#/dashboard?newProject=${p.id}`}>Add to project</a>
      </div>
      <div class="status-pick">${['acknowledged', 'in_progress', 'resolved'].map((st) => html`<button class=${'chip-btn' + (p.status === st ? ' on' : '')} onClick=${() => setStatus(st)}>${STATUS[st]}</button>`)}</div>
      <div class="dim small">Assigned: ${p.responsible.map((r) => html`<span class="assign-src">${position(r.positionId)?.title} (${r.assignedBy === 'rules' ? 'automatic · rules' : r.assignedBy === 'person' ? 'by an official' : 'by the citizen'})</span>`)}</div>
    </section>` : null}
    ${data.project ? html`<section class="card pad"><div class="sec-h"><b>Linked project</b></div><${ProjectRow} pj=${data.project} /></section>` : null}
    ${p.progressUpdates?.length ? html`<section class="card pad"><div class="sec-h"><b>Progress updates</b></div>${p.progressUpdates.map((u) => html`<a class="linked-row" href=${'#/post/' + u.id}><span class="dot dot-progress"></span><span class="grow">${u.title}</span><span class="dim small">${ago(u.createdAt)}</span></a>`)}</section>` : null}
    ${p.location ? html`<div class="dim small pad-x">📍 ${p.location.lat.toFixed(4)}, ${p.location.lng.toFixed(4)}${p.capturedWithCamera ? ' · captured with in-app camera' : ''}</div>` : null}
    <section class="comments">
      <div class="sec-h pad-x"><b>Comments</b><span class="dim">${data.comments.length}</span></div>
      ${data.comments.map((c) => html`<div class=${'comment' + (c.actingAs.type !== 'citizen' ? ' official' : '')}>
        <${AuthorLine} author=${c.author} regionId=${p.regionId} regionName=${p.regionName} createdAt=${c.createdAt} />
        <p>${c.body}</p>
      </div>`)}
      ${!data.comments.length ? html`<${Empty}>No comments yet.</${Empty}>` : null}
    </section>
    ${s.token ? html`<form class="comment-box" onSubmit=${send}>
      <input value=${text} onInput=${(e) => setText(e.target.value)} placeholder=${'Comment as ' + actLabel + '…'} aria-label="Write a comment" />
      <button class="btn btn-primary btn-sm" disabled=${busy || !text.trim()}>Post</button>
    </form>` : null}
    <${AssignSheet} open=${assignOpen} onClose=${() => setAssignOpen(false)} post=${p} actPos=${actPos} />
  `;
}

function AssignSheet({ open, onClose, post: p, actPos }) {
  if (!open) return null;
  const cands = chain(p.regionId).flatMap((r) => positionsIn(r.id)).filter((x) => !p.responsible.some((r) => r.positionId === x.id));
  const assign = async (positionId) => { try { await post(`/posts/${p.id}/assign`, { positionId, actingPositionId: actPos?.id }); toast('Assigned'); onClose(); } catch (e) { toast(e.message); } };
  return html`<${Sheet} open title="Assign responsibility" onClose=${onClose}>
    <p class="dim small">Recorded as assigned by an official (rather than automatic rules or the future AI layer).</p>
    ${cands.map((x) => html`<button class="row as-btn" onClick=${() => assign(x.id)}><div class="row-main"><div class="row-t">${x.title}</div><div class="row-s">${regionName(x.regionId)} · ${person(x.holderUserId)?.name || 'Vacant'}</div></div><span class="btn btn-sm btn-ghost">Assign</span></button>`)}
  </${Sheet}>`;
}
