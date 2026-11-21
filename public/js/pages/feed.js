import { html, useState, useEffect, store, useStore, api, post, useData, go, toast, position, person, region, actingAs, ago, positionsIn, chain, STATUS, M } from '../lib.js';
import { PostCard, Tabs, Loading, Empty, ErrorBox, Header, Icon, Avatar, AuthorLine, Sheet, ProjectRow, ComingSoon, DemoBanner } from '../components.js';

function RepsStrip() {
  // Instagram "stories" row → your representatives, nearest first
  const s = useStore();
  const me = s.meta?.me;
  if (!me) return null;
  const followed = new Set(me.following.positions);
  const reps = chain(me.regionId).flatMap((r) => positionsIn(r.id).filter((p) => p.isHead || followed.has(p.id))).slice(0, 12);
  return html`<div class="reps">${reps.map((p) => { const h = person(p.holderUserId); return html`<a class="rep" href=${'#/position/' + p.id}><${Avatar} name=${h?.name || p.title} size=${58} ring=${followed.has(p.id) ? 'official' : 'muted'} /><span>${p.title.split(/[,(]/)[0].replace('Corporator ', 'Corporator')}</span><small>${region(p.regionId)?.name.replace(/ (Ward|Gram Panchayat|Municipal Corporation)$/, '')}</small></a>`; })}</div>`;
}

export function Feed({ query }) {
  const s = useStore();
  const [tab, setTab] = useState(query.tab || 'problems');
  const { data, error, loading } = useData(() => api('/feed?tab=' + tab), [tab]);
  return html`
    <header class="topbar home">
      <div class="logo">Neta<span>Connect</span></div>
      <div class="topbar-right">
        <a class="icon-btn" href="#/new?camera=1" aria-label="Report with camera"><${Icon} n="camera" /></a>
        <a class="icon-btn mobile-only" href="#/notifications" aria-label="Notifications"><${Icon} n="bell" />${s.unread ? html`<i class="dot-badge">${s.unread}</i>` : null}</a>
      </div>
    </header>
    <${DemoBanner} />
    <${RepsStrip} />
    ${s.token ? html`<div class="card composer-cta">
      <${Avatar} kind="anon" size=${40} />
      <a class="fake-input" href="#/new?tag=problem">Report a problem in your area…</a>
      <div class="cta-row">
        <a class="cta" href="#/new?tag=problem"><span class="dot dot-problem"></span>Problem</a>
        <a class="cta" href="#/new?camera=1"><${Icon} n="camera" s=${18} />Camera</a>
        <a class="cta" href="#/new?tag=normal"><span class="dot dot-normal"></span>Post</a>
      </div>
    </div>` : html`<div class="card pad center"><b>See what's broken around you — and who is responsible.</b><p class="muted">Sign in with DigiLocker to post, upvote and follow your representatives.</p><a class="btn btn-primary" href="#/login">Sign in</a></div>`}
    <${Tabs} value=${tab} onChange=${setTab} tabs=${[['problems', 'Problems'], ['foryou', 'For you'], ['following', 'Following']]} />
    ${loading ? html`<${Loading} />` : error ? html`<${ErrorBox} error=${error} />` : !data.length ? html`<${Empty}>${tab === 'following' ? 'Follow positions and citizens to fill this feed.' : 'No posts yet.'}</${Empty}>` : data.map((p) => html`<${PostCard} key=${p.id} p=${p} compact />`)}
    <a class="fab" href="#/new?tag=problem" aria-label="Report a problem"><${Icon} n="plus" w=${2.2} /></a>
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
    <${Header} title=${p.tag === 'problem' ? 'Problem' : 'Post'} back />
    <${PostCard} p=${p} />
    ${officialMode ? html`<section class="card pad official-panel">
      <div class="sec-h"><b>Respond as ${actPos.title}</b><span class="muted small">Responding on behalf of position</span></div>
      <div class="btn-row wrap">
        <a class="btn btn-progress" href=${`#/new?tag=progress&link=${p.id}`}><${Icon} n="flag" s=${16} /> Post progress update</a>
        <button class="btn btn-ghost" onClick=${() => setAssignOpen(true)}>Assign to position</button>
        <a class="btn btn-ghost" href=${`#/dashboard?newProject=${p.id}`}>Add to project</a>
      </div>
      <div class="status-pick">${['acknowledged', 'in_progress', 'resolved'].map((st) => html`<button class=${'chip-btn' + (p.status === st ? ' on' : '')} onClick=${() => setStatus(st)}>${STATUS[st]}</button>`)}</div>
      <div class="muted small">Assigned: ${p.responsible.map((r) => html`<span class="assign-src">${position(r.positionId)?.title} (${r.assignedBy === 'rules' ? 'auto · rules' : r.assignedBy === 'person' ? 'by official' : 'by poster'})</span>`)}</div>
    </section>` : null}
    ${data.project ? html`<section class="card pad"><div class="sec-h"><b>Linked project</b></div><${ProjectRow} pj=${data.project} /></section>` : null}
    ${p.location ? html`<div class="muted small pad-x">📍 ${p.location.lat.toFixed(4)}, ${p.location.lng.toFixed(4)}${p.capturedWithCamera ? ' · captured with in-app camera' : ''}</div>` : null}
    <div class="pad-x muted small">${p.moderation?.note || ''}</div>
    <section class="comments">
      <div class="sec-h pad-x"><b>Comments</b><span class="muted">${data.comments.length}</span></div>
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
    <p class="muted small">Recorded as assigned by an official (vs. automatic rules / future AI).</p>
    ${cands.map((x) => html`<button class="row as-btn" onClick=${() => assign(x.id)}><div class="row-main"><div class="row-t">${x.title}</div><div class="row-s">${region(x.regionId).name} · ${person(x.holderUserId)?.name || 'Vacant'}</div></div><span class="btn btn-sm btn-ghost">Assign</span></button>`)}
  </${Sheet}>`;
}
