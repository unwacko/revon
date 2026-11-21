import { html, useState, useEffect, store, useStore, api, post, useData, go, toast, position, contractor, person, region, actingAs, ago, positionsIn, chain, STATUS, rs, fmtDate, regionName } from '../lib.js';
import { PostCard, Tabs, Loading, Empty, ErrorBox, Header, Icon, LanguageButton, Avatar, AuthorLine, authorInfo, Sheet, ProjectRow, DemoBanner, StoriesPill, NewStory, JointStoryAction } from '../components.js';

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
      <div class="logo">Revon</div>
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
  const [assignOpen, setAssignOpen] = useState(false);
  const act = actingAs();
  const actPos = act.type === 'position' ? position(act.id) : null;

  useEffect(() => { if (actPos && data?.post?.tag === 'problem') post(`/posts/${id}/view`, { positionId: actPos.id }).catch(() => {}); }, [actPos?.id, data?.post?.id]);
  if (loading) return html`<${Header} title="Post" back /><${Loading} />`;
  if (error) return html`<${Header} title="Post" back /><${ErrorBox} error=${error} />`;
  const p = data.post;

  const setStatus = async (status) => { try { await post(`/posts/${id}/status`, { status, positionId: actPos.id }); toast('Status updated'); } catch (e) { toast(e.message); } };
  const officialMode = actPos && p.tag === 'problem';

  return html`
    <${Header} title=${p.tag === 'problem' ? 'Problem' : 'Post'} sub=${p.id} back />
    <div class="thread">
      <${PostCard} p=${p} full />
      ${officialMode ? html`<section class="card pad official-panel">
        <div class="sec-h"><b>Respond as ${actPos.title}</b></div>
        <div class="btn-row wrap">
          <a class="btn btn-progress" href=${`#/new?tag=progress&link=${p.id}`}><${Icon} n="flag" s=${18} /> Post progress update</a>
          <button class="btn btn-ghost" onClick=${() => setAssignOpen(true)}>Assign to position</button>
          <a class="btn btn-ghost" href=${`#/dashboard?newProject=${p.id}`}>Add to project</a>
        </div>
        <div class="joint-action"><${JointStoryAction} post=${p} /></div>
        <div class="status-pick">${['acknowledged', 'in_progress', 'resolved'].map((st) => html`<button class=${'chip-btn' + (p.status === st ? ' on' : '')} onClick=${() => setStatus(st)}>${STATUS[st]}</button>`)}</div>
        <div class="dim small">Assigned: ${p.responsible.map((r) => html`<span class="assign-src">${position(r.positionId)?.title} (${r.assignedBy === 'rules' ? 'automatic · rules' : r.assignedBy === 'person' ? 'by an official' : 'by the citizen'})</span>`)}</div>
      </section>` : null}
      <${PostDetails} p=${p} workOrders=${data.workOrders} project=${data.project} />
      <${Thread} p=${p} comments=${data.comments} />
    </div>
    <${AssignSheet} open=${assignOpen} onClose=${() => setAssignOpen(false)} post=${p} actPos=${actPos} />
  `;
}

// ---------------- Details: clerical label / value rows (moved off the card) ----------------
const Row = ({ k, children }) => html`<div class="dt-row"><dt>${k}</dt><dd>${children}</dd></div>`;
function PostDetails({ p, workOrders, project }) {
  const rows = [];
  rows.push(html`<${Row} k="Area"><a href=${'#/region/' + p.regionId}>${p.regionName}</a><//>`);
  if (p.road) rows.push(html`<${Row} k="Road"><a href=${'#/road/' + p.road.id}>${p.road.name}</a><span class="dt-sub">Segment ${p.road.segment}${p.road.underDlp ? ' · under Defect Liability Period' : ''}</span><//>`);
  if (p.location) rows.push(html`<${Row} k="Location"><span class="num">${p.location.lat.toFixed(4)}, ${p.location.lng.toFixed(4)}</span>${p.capturedWithCamera ? html`<span class="dt-sub">Captured with in-app camera</span>` : null}<//>`);
  if (p.responsible?.length) rows.push(html`<${Row} k="Responsible">${p.responsible.map((r) => html`<a class="dt-line" href=${'#/position/' + r.positionId}>${position(r.positionId)?.title || r.positionId}</a>`)}<//>`);
  if (p.mentions?.length) rows.push(html`<${Row} k="Mentions">${p.mentions.map((m) => m.type === 'position' ? html`<a class="dt-line" href=${'#/position/' + m.id}>${position(m.id)?.title}</a>` : html`<a class="dt-line" href=${'#/contractor/' + m.id}>${contractor(m.id)?.name}</a>`)}<//>`);
  if (p.linkedProblems?.length) rows.push(html`<${Row} k=${'Update for ' + (p.linkedProblemCount > 1 ? p.linkedProblemCount + ' problems' : 'problem')}>${p.linkedProblems.map((x) => html`<a class="dt-line" href=${'#/post/' + x.id}>${x.title}<span class="dt-sub">${STATUS[x.status] || ''}</span></a>`)}<//>`);
  if (p.progressUpdates?.length) rows.push(html`<${Row} k="Progress updates">${p.progressUpdates.map((u) => html`<a class="dt-line" href=${'#/post/' + u.id}>${u.title}<span class="dt-sub">${fmtDate(u.createdAt)}</span></a>`)}<//>`);
  if (project) rows.push(html`<${Row} k="Project"><a href=${'#/project/' + project.id}>${project.title}</a><span class="dt-sub">${STATUS[project.status] || project.status}</span><//>`);
  if (p.photoNote) rows.push(html`<${Row} k="Photo described as">${p.photoNote}<//>`);
  if (p.originalLanguage) rows.push(html`<${Row} k="Original language">${p.originalLanguage}<//>`);
  if (p.source?.channel) rows.push(html`<${Row} k="Reported via">${p.source.channel}<//>`);
  rows.push(html`<${Row} k="Posted"><span class="num">${fmtDate(p.createdAt)}</span><//>`);
  return html`<section class="details" aria-label="Details">
    <h2 class="details-h">Details</h2>
    <dl class="dt">${rows}</dl>
    ${workOrders.length ? workOrders.map((w) => html`
      <h3 class="details-sub">Repair record <a href=${'#/wo/' + w.id} class="num">${w.id}</a></h3>
      <dl class="dt">
        <${Row} k="Method">${w.method}<//>
        <${Row} k="Contractor"><a href=${'#/contractor/' + w.contractorId}>${w.contractorName}</a><//>
        <${Row} k="Billed"><span class="num">${rs(w.cost)}</span><span class=${'dt-sub' + (w.costRatio > 1.5 ? ' bad' : '')}>${w.costRatio?.toFixed(2)}× rate card (${rs(w.expected)})</span><//>
        <${Row} k="Assigned to completed"><span class="num">${fmtDate(w.assignedAt)} to ${fmtDate(w.completedAt)}</span><//>
        <${Row} k=${`Time target (${w.slaHours} h)`}><span class=${w.slaMet ? 'ok' : 'warn'}>${w.slaMet ? 'Met' : 'Missed'}</span><//>
        <${Row} k="Held for 30 days"><span class=${w.reopened ? 'bad' : 'ok'}>${w.reopened ? 'No, re-opened' : 'Yes'}</span><//>
        ${w.remark ? html`<${Row} k="Engineer's note">${w.remark}<//>` : null}
        ${w.flagDetails.filter((f) => f.severity === 'high').map((f) => html`<${Row} k="Flag"><span class="bad">${f.text}</span><//>`)}
      </dl>`) : p.tag === 'problem' && ['open', 'in_progress'].includes(p.status) ? html`<dl class="dt"><${Row} k="Repair record"><span class="dim">No work order yet${p.status === 'open' ? '. Waiting for action.' : ''}</span><//></dl>` : null}
  </section>`;
}

// ---------------- Thread: Reddit-style nested comments ----------------
// Patterns borrowed (not code): inline reply box under the comment that closes on submit and
// collapse-by-rail (lemmy-ui), 2px reply line + spacing-token indent (bluesky social-app),
// depth overflow after level 4 handed off to a focused sub-thread (phanpy / Reddit "Continue thread").
const MAX_DEPTH = 4;
const ROLE = { position: 'Official', contractor: 'Contractor', admin: 'Admin' };
const fmtN = (n) => (n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : n);

function Thread({ p, comments }) {
  const s = useStore();
  const [sort, setSort] = useState('top');
  const [replyTo, setReplyTo] = useState(null);
  const [focus, setFocus] = useState(null);
  const act = actingAs();
  const asAct = act.type === 'admin' ? { type: 'citizen' } : act;
  const actLabel = act.type === 'position' ? position(act.id)?.title : act.type === 'contractor' ? contractor(act.id)?.name || 'contractor' : 'citizen';

  const kids = new Map();
  const byId = new Map(comments.map((c) => [c.id, c]));
  for (const c of comments) { const k = c.parentId && byId.has(c.parentId) ? c.parentId : null; if (!kids.has(k)) kids.set(k, []); kids.get(k).push(c); }
  const order = sort === 'top' ? (a, b) => b.upvoteCount - a.upvoteCount || a.createdAt - b.createdAt : (a, b) => b.createdAt - a.createdAt;
  for (const list of kids.values()) list.sort(order);

  const send = async (body, parentId) => {
    if (!s.token) { go('#/login'); return false; }
    try { await post(`/posts/${p.id}/comments`, { body, parentId, actingAs: asAct }); setReplyTo(null); return true; } catch (err) { toast(err.message); return false; }
  };
  const ctx = { kids, replyTo, setReplyTo, send, setFocus, actLabel, postId: p.id };
  const roots = focus && byId.has(focus) ? [byId.get(focus)] : kids.get(null) || [];

  return html`<section class="thread-comments" aria-label="Comments">
    <div class="thread-bar">
      <h2 class="thread-count"><span class="num">${comments.length}</span> ${comments.length === 1 ? 'comment' : 'comments'}</h2>
      <div class="thread-sort" role="group" aria-label="Sort comments">
        ${[['top', 'Top'], ['new', 'New']].map(([k, l]) => html`<button class=${sort === k ? 'on' : ''} aria-pressed=${sort === k} onClick=${() => setSort(k)}>${l}</button>`)}
      </div>
    </div>
    ${s.token ? html`<${ReplyBox} top placeholder=${'Add a comment as ' + actLabel} onSend=${(b) => send(b, null)} />` : html`<a class="thread-signin" href="#/login">Sign in to add a comment</a>`}
    ${focus ? html`<button class="thread-back" onClick=${() => setFocus(null)}><${Icon} n="back" s=${16} /> Back to all comments</button>` : null}
    ${roots.length ? html`<div class="cm-list">${roots.map((c) => html`<${CommentNode} key=${c.id} c=${c} depth=${0} ctx=${ctx} />`)}</div>` : html`<p class="thread-empty">No comments yet. Start the conversation.</p>`}
  </section>`;
}

function CommentNode({ c, depth, ctx }) {
  const [up, setUp] = useState({ on: c.upvoted, n: c.upvoteCount });
  const [collapsed, setCollapsed] = useState(false);
  useEffect(() => setUp({ on: c.upvoted, n: c.upvoteCount }), [c.upvoted, c.upvoteCount]);
  const a = authorInfo(c.author);
  const role = ROLE[c.actingAs?.type];
  const children = ctx.kids.get(c.id) || [];
  const count = (id) => (ctx.kids.get(id) || []).reduce((n, k) => n + 1 + count(k.id), 0);
  const vote = async () => {
    if (!store.token) return go('#/login');
    setUp((u) => ({ on: !u.on, n: u.n + (u.on ? -1 : 1) }));
    try { const r = await post(`/comments/${c.id}/upvote`); setUp({ on: r.upvoted, n: r.upvoteCount }); } catch (err) { toast(err.message); }
  };
  const share = () => { navigator.clipboard?.writeText(location.origin + '/#/post/' + ctx.postId); toast('Link copied'); };
  const replying = ctx.replyTo === c.id;
  return html`<div class=${'cm' + (role ? ' cm-official' : '') + (collapsed ? ' collapsed' : '')} id=${'c-' + c.id}>
    <div class="cm-gutter">
      <a href=${a.href} class="cm-av" aria-label=${a.name}><${Avatar} name=${a.avatar || a.name} kind=${a.kind} size=${24} ring=${a.ring} /></a>
      ${!collapsed ? html`<button class="cm-rail" aria-label=${'Collapse thread from ' + a.name} title="Collapse" onClick=${() => setCollapsed(true)}><i></i></button>` : null}
    </div>
    <div class="cm-main">
      <div class="cm-self">
        <div class="cm-head">
          <a class="cm-name" href=${a.href}>${a.name}</a>
          ${role ? html`<span class="cm-role">${role}</span>` : null}
          ${a.sub && c.actingAs?.type === 'position' ? html`<span class="cm-sub">${a.sub}</span>` : null}
          <span class="cm-time">${ago(c.createdAt)}</span>
          ${collapsed ? html`<button class="cm-expand" onClick=${() => setCollapsed(false)}>Show${children.length ? ` ${count(c.id) + 1} comments` : ''}</button>` : null}
        </div>
        ${collapsed ? null : html`
          <p class="cm-body">${c.body}</p>
          <div class="cm-actions">
            <button class=${'cm-act' + (up.on ? ' on' : '')} aria-pressed=${up.on} aria-label="Upvote" onClick=${vote}><${Icon} n="up" s=${16} fill=${up.on ? 'currentColor' : 'none'} /><span class="num">${fmtN(up.n)}</span></button>
            <button class="cm-act" aria-expanded=${replying} onClick=${() => (store.token ? ctx.setReplyTo(replying ? null : c.id) : go('#/login'))}><${Icon} n="comment" s=${16} /><span>Reply</span></button>
            <button class="cm-act" onClick=${share}><${Icon} n="share" s=${16} /><span>Share</span></button>
          </div>`}
      </div>
      ${!collapsed && replying ? html`<${ReplyBox} placeholder=${'Reply to ' + a.name + ' as ' + ctx.actLabel} onSend=${(b) => ctx.send(b, c.id)} onCancel=${() => ctx.setReplyTo(null)} />` : null}
      ${!collapsed && children.length ? (depth + 1 >= MAX_DEPTH
        ? html`<button class="cm-continue" onClick=${() => { ctx.setFocus(c.id); scrollTo(0, 0); }}>Continue thread (${count(c.id)} more)<${Icon} n="chev" s=${14} /></button>`
        : html`<div class="cm-children">${children.map((k) => html`<${CommentNode} key=${k.id} c=${k} depth=${depth + 1} ctx=${ctx} />`)}</div>`) : null}
    </div>
  </div>`;
}

function ReplyBox({ placeholder, onSend, onCancel, top }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(!top);
  const submit = async (e) => {
    e.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    const ok = await onSend(text.trim());
    setBusy(false);
    if (ok) { setText(''); if (top) setOpen(false); }
  };
  return html`<form class=${'reply-box' + (top ? ' reply-top' : '') + (open ? ' open' : '')} onSubmit=${submit}>
    <textarea rows=${open ? 3 : 1} value=${text} placeholder=${placeholder} aria-label=${placeholder} maxlength="2000"
      ref=${(el) => { if (el && !top && !el.dataset.f) { el.dataset.f = 1; el.focus(); } }}
      onFocus=${() => setOpen(true)} onInput=${(e) => setText(e.target.value)}
      onKeyDown=${(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit(e); if (e.key === 'Escape' && onCancel) onCancel(); }}></textarea>
    ${open ? html`<div class="reply-actions">
      ${onCancel ? html`<button type="button" class="btn btn-ghost btn-sm" onClick=${onCancel}>Cancel</button>` : top ? html`<button type="button" class="btn btn-ghost btn-sm" onClick=${() => { setText(''); setOpen(false); }}>Cancel</button>` : null}
      <button class="btn btn-primary btn-sm" disabled=${busy || !text.trim()}>${top ? 'Comment' : 'Reply'}</button>
    </div>` : null}
  </form>`;
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
