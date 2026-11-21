import { html, useState, useEffect, useRef, useStore, api, post, go, toast, position, contractor, region, person, actingAs, setMode, loadMeta, chain, positionsIn, compressImage, M, TAGS, levelLabel } from '../lib.js';
import { Header, Icon, Avatar, ComingSoon, Sheet, PositionRow, ContractorRow, AreaMap, Loading } from '../components.js';

// Composer. One writing surface (headline, then body), the post type as a segmented control,
// clerical rows for where the problem is, and a routing card that says who is responsible and why.
// Patterns borrowed from Bluesky's Composer (cancel / post top bar, disabled-until-valid post,
// media strip, sticky footer toolbar), Phanpy (Enter in the first field moves to the body,
// Cmd/Ctrl+Enter posts, discard confirm) and Lemmy's post form (debounced suggestions while typing).

const TITLE_MAX = 120;
const BODY_MAX = 2000;
const TAG_INFO = {
  problem: 'Something broken that needs fixing. Shows who is responsible.',
  normal: 'Anything else for your neighbourhood: meet-ups, thanks, questions.',
  progress: 'Official update on problems or a project. People who reported them are notified.',
  position_change: 'Someone took charge of, or left, a position.',
  election: 'Election roles, responsibilities and dates.',
};
const RULES = {
  citizen: { tags: ['problem', 'normal'], note: 'A moderation bot will check tags before publishing (coming soon).' },
  position: { tags: ['progress'], note: 'Officials can only post official project or problem updates. No greetings or personal posts.' },
  contractor: { tags: ['progress'], note: 'Contractors can only post updates for projects and problems assigned to them.' },
  admin: { tags: ['position_change', 'election', 'normal'], note: 'Admin posts: blue for position changes, green for election roles and responsibilities.' },
};
const CONFIDENCE = { high: 'Strong match', medium: 'Likely match', low: 'Weak match: add detail' };

const autosize = (el) => { if (el) { el.style.height = 'auto'; el.style.height = el.scrollHeight + 'px'; } };

export function Compose({ query }) {
  const s = useStore();
  const act = actingAs();
  const rule = RULES[act.type];
  const me = s.meta?.me;
  const [step, setStep] = useState(query.camera ? 'camera' : 'form');
  const [tag, setTag] = useState(query.camera ? 'problem' : rule.tags.includes(query.tag) ? query.tag : rule.tags[0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Pothole');
  const [catTouched, setCatTouched] = useState(false);
  const [roadId, setRoadId] = useState('');
  const [regionId, setRegionId] = useState(act.type === 'position' ? position(act.id)?.regionId : region(me?.regionId)?.type === 'ward' ? me.regionId : 'w_K-W');
  const [images, setImages] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [location, setLocation] = useState(null);
  const [captured, setCaptured] = useState(false);
  const [route, setRoute] = useState(null);
  const [routeBusy, setRouteBusy] = useState(false);
  const [chosen, setChosen] = useState(null);
  const [linked, setLinked] = useState(query.link ? query.link.split(',') : []);
  const [projectId, setProjectId] = useState(query.project || '');
  const [markResolved, setMarkResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(0);
  const [locBusy, setLocBusy] = useState(false);
  const [sheet, setSheet] = useState(null);
  const formRef = useRef();
  const titleRef = useRef();
  const bodyRef = useRef();
  const fileRef = useRef();
  const reqId = useRef(0);

  // Switching "posting as" can change which post types are allowed.
  useEffect(() => {
    if (!rule.tags.includes(tag)) setTag(rule.tags[0]);
    if (act.type === 'position') setRegionId(position(act.id)?.regionId);
  }, [s.mode]);

  // Routing suggestion, debounced while typing.
  useEffect(() => {
    if (tag !== 'problem' || step !== 'form') return;
    setRouteBusy(true);
    const id = ++reqId.current;
    const t = setTimeout(() => {
      post('/route-suggest', { title, body, category, categoryLocked: catTouched, regionId, roadId: roadId || null, location })
        .then((r) => {
          if (id !== reqId.current) return;
          setRoute(r);
          if (!catTouched && r.category && r.category !== category) setCategory(r.category);
          if (r.regionId && r.regionId !== regionId && region(r.regionId)?.type === 'ward') setRegionId(r.regionId);
        })
        .catch(() => {})
        .finally(() => { if (id === reqId.current) setRouteBusy(false); });
    }, 500);
    return () => clearTimeout(t);
  }, [tag, step, title, body, category, catTouched, regionId, roadId, location?.lat, location?.lng]);

  useEffect(() => { setChosen(null); }, [regionId]);
  useEffect(() => {
    const fit = () => { autosize(titleRef.current); autosize(bodyRef.current); };
    fit();
    addEventListener('resize', fit);
    return () => removeEventListener('resize', fit);
  }, [step]);

  const addImages = async (files) => {
    const list = [...(files || [])].slice(0, 4 - images.length);
    if (!list.length) return toast('Up to 4 photos per post');
    setUploading((n) => n + list.length);
    for (const f of list) {
      try { const dataUrl = await compressImage(f); const { url } = await post('/upload', { dataUrl }); setImages((x) => [...x, url].slice(0, 4)); } catch (e) { toast('Could not attach image'); }
      setUploading((n) => n - 1);
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast('Location is not available on this device');
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(async (p) => {
      const l = { lat: p.coords.latitude, lng: p.coords.longitude };
      try {
        const r = await api(`/locate?lat=${l.lat}&lng=${l.lng}`);
        if (!r.region) toast('This spot is outside the prototype’s wards. Pick the ward instead.');
        else { setLocation(l); if (r.region.type === 'ward') setRegionId(r.region.id); if (r.road) setRoadId(r.road.id); }
      } catch { toast('Could not look up this location'); }
      setLocBusy(false);
    }, () => { setLocBusy(false); toast('Location blocked. Pick the ward and road instead.'); }, { enableHighAccuracy: true, timeout: 8000 });
  };

  const titleLen = title.trim().length;
  const bodyLen = body.trim().length;
  const missing = !titleLen ? 'Add a headline' : titleLen < 5 ? 'Headline needs 5+ characters' : bodyLen < 10 ? 'Add a few words of detail' : tag === 'progress' && !linked.length && !projectId ? 'Link a problem or project' : uploading ? 'Uploading photo…' : '';
  const valid = !missing && !busy;
  const chosenId = chosen || route?.positionId || null;
  const userPicked = !!chosen && chosen !== route?.positionId;

  const submit = async (e) => {
    e?.preventDefault();
    if (!valid) return;
    setBusy(true);
    try {
      const p = await post('/posts', {
        tag, title, body, category, regionId, images, mentions, location, capturedWithCamera: captured, roadId: roadId || null,
        responsiblePositionIds: tag === 'problem' && chosenId ? [chosenId] : [], responsibleAssignedBy: userPicked ? 'user' : 'rules',
        linkedProblemIds: linked, projectId: projectId || null, markResolved, actingAs: act,
      });
      toast(tag === 'progress' && linked.length ? 'Posted. Linked problem posts were notified' : 'Posted');
      go('#/post/' + p.id);
    } catch (err) { toast(err.message); }
    setBusy(false);
  };

  const cancel = () => {
    if ((title.trim() || body.trim() || images.length) && !confirm('Discard this post? What you wrote will be lost.')) return;
    history.length > 1 ? history.back() : go('#/');
  };

  if (step === 'camera') return html`<${CameraStep} onDone=${({ image, loc, region: r, road }) => { if (image) setImages([image]); if (loc) setLocation(loc); if (r && region(r)?.type === 'ward') setRegionId(r); if (road) setRoadId(road); setCaptured(true); setTag('problem'); setStep('form'); }} />`;

  const isProblem = tag === 'problem';
  const canCamera = act.type === 'citizen';
  const isPublicPerson = !!(me?.positionIds?.length || me?.contractorIds?.length || me?.role === 'admin');
  const wardRoads = M().roads.filter((r) => r.regionId === regionId);
  const road = M().roads.find((r) => r.id === roadId);
  const identity = act.type === 'position' ? { name: position(act.id)?.title, sub: person(position(act.id)?.holderUserId)?.name || 'Official', ring: 'official' }
    : act.type === 'contractor' ? { name: contractor(act.id)?.name, sub: 'Contractor', ring: 'contractor' }
    : act.type === 'admin' ? { name: 'Platform Admin', sub: 'Verified platform account', ring: 'admin' }
    : { name: me?.handle || 'Citizen', sub: isPublicPerson ? 'Citizen, under your public name' : 'Citizen', kind: isPublicPerson ? 'public' : me?.showName ? 'citizen' : 'anon' };
  const modes = [['citizen', me?.handle || 'Citizen', 'Citizen'],
    ...(me?.positionIds || []).map((id) => ['position:' + id, position(id)?.title, 'Official']),
    ...(me?.contractorIds || []).map((id) => ['contractor:' + id, contractor(id)?.name, 'Contractor']),
    ...(me?.role === 'admin' ? [['admin', 'Platform Admin', 'Admin']] : [])];
  const titlePh = isProblem ? 'What is the problem? e.g. Deep potholes on SV Road' : tag === 'progress' ? 'What changed? e.g. SV Road potholes patched' : 'Headline';
  const bodyPh = isProblem ? 'Exact spot, since when, who is affected, how bad it is…' : tag === 'progress' ? 'What was done, what is next, expected dates…' : 'Write your post…';
  const postBtn = (cls) => html`<button class=${'btn btn-primary ' + cls} type="submit" form="compose" disabled=${!valid}>${busy ? 'Posting…' : 'Post'}</button>`;

  return html`
    <div class="cmp">
      <header class="cmp-top">
        <button type="button" class="cmp-cancel" onClick=${cancel}>Cancel</button>
        <h1 class="cmp-title">${isProblem ? 'Report a problem' : tag === 'progress' ? 'Progress update' : 'New post'}</h1>
        ${postBtn('btn-sm cmp-post-top')}
      </header>

      <form id="compose" ref=${formRef} class="cmp-form" onSubmit=${submit} onKeyDown=${(e) => { if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submit(); } }}>
        <div class="cmp-id">
          <${Avatar} name=${identity.name} kind=${identity.kind || 'public'} ring=${identity.ring} size=${40} />
          <div class="grow">
            <div class="cmp-id-k">Posting as</div>
            ${modes.length > 1
              ? html`<button type="button" class="cmp-id-pick" onClick=${() => setSheet('identity')} aria-haspopup="dialog"><span class="cmp-id-name">${identity.name}</span><${Icon} n="down" s=${16} /></button>`
              : html`<div class="cmp-id-name">${identity.name}</div>`}
          </div>
        </div>
        ${act.type === 'citizen' ? html`<div class="cmp-mask">
          ${isPublicPerson
            ? html`<div class="grow"><div class="cmp-mask-k">Hide my name</div><div class="cmp-mask-v">You hold a public role, so citizen posts show your name.</div></div><${ComingSoon} label="Hide my name" icon="user" />`
            : html`<label class="cmp-switch-row"><div class="grow"><div class="cmp-mask-k">Hide my name</div><div class="cmp-mask-v">${me?.showName ? `Off: people see “${me.realName}”.` : `On: people see “${me?.handle || 'Citizen'}”, never your real name.`}</div></div><input type="checkbox" class="cmp-switch" role="switch" checked=${!me?.showName} onChange=${async (e) => { try { await post('/me/identity', { showName: !e.target.checked }); await loadMeta(); } catch { toast('Could not save'); } }} aria-label="Hide my name" /></label>`}
        </div>` : null}

        <div class="cmp-types" role="radiogroup" aria-label="Post type">
          ${rule.tags.map((t) => html`<button type="button" role="radio" aria-checked=${tag === t} class=${'cmp-type t-' + t + (tag === t ? ' on' : '')} onClick=${() => setTag(t)}><span class="cmp-sw"></span>${TAGS[t].label}</button>`)}
        </div>
        <p class="cmp-type-info">${TAG_INFO[tag]} <span class="cmp-rule">${rule.note}</span></p>

        <div class="cmp-write">
          <textarea ref=${titleRef} class="cmp-headline" rows="1" aria-label="Headline" placeholder=${titlePh} value=${title} maxlength=${TITLE_MAX}
            onInput=${(e) => { setTitle(e.target.value.replace(/\n/g, ' ')); autosize(e.target); }}
            onKeyDown=${(e) => { if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); bodyRef.current?.focus(); } }}></textarea>
          <div class=${'cmp-count' + (TITLE_MAX - title.length <= 10 ? ' near' : '')} aria-live="polite">${title.length} / ${TITLE_MAX}</div>
          <textarea ref=${bodyRef} class="cmp-body" rows="4" aria-label="Details" placeholder=${bodyPh} value=${body} maxlength=${BODY_MAX}
            onInput=${(e) => { setBody(e.target.value); autosize(e.target); }}></textarea>
          <div class=${'cmp-count' + (BODY_MAX - body.length <= 100 ? ' near' : '')}>${body.length} / ${BODY_MAX}</div>
        </div>

        ${mentions.length ? html`<div class="cmp-mentions">${mentions.map((m) => html`<span class="cmp-mention">@${m.type === 'position' ? position(m.id)?.title : contractor(m.id)?.name}<button type="button" aria-label="Remove mention" onClick=${() => setMentions((x) => x.filter((y) => y !== m))}><${Icon} n="x" s=${14} /></button></span>`)}</div>` : null}

        <div class="cmp-media">
          <div class="cmp-strip">
            ${images.map((src, i) => html`<div class="cmp-thumb"><img src=${src} alt=${'Attached photo ' + (i + 1)} /><button type="button" class="cmp-thumb-x" aria-label=${'Remove photo ' + (i + 1)} onClick=${() => setImages((x) => x.filter((y) => y !== src))}><${Icon} n="x" s=${16} /></button></div>`)}
            ${uploading ? html`<div class="cmp-thumb cmp-thumb-wait"><${Loading} /></div>` : null}
            ${images.length + uploading < 4 ? html`<button type="button" class="cmp-tile" onClick=${() => fileRef.current.click()}><${Icon} n="image" s=${22} /><span>Add photo</span></button>` : null}
            ${canCamera && isProblem ? html`<button type="button" class="cmp-tile" onClick=${() => setStep('camera')}><${Icon} n="camera" s=${22} /><span>Camera + location</span></button>` : null}
          </div>
          <p class="cmp-note">Text comes first. Photos are optional evidence.</p>
          <input ref=${fileRef} type="file" accept="image/*" multiple hidden onChange=${(e) => { addImages(e.target.files); e.target.value = ''; }} />
        </div>

        ${isProblem ? html`
          <section class="cmp-rows" aria-label="Where is it">
            <label class="cmp-row"><span class="cmp-row-k">Category${!catTouched && route?.keywords?.length ? html`<small>from your text</small>` : null}</span>
              <select class="cmp-row-v" value=${category} onChange=${(e) => { setCategory(e.target.value); setCatTouched(true); }}>${M().categories.map((c) => html`<option value=${c}>${c}</option>`)}</select><${Icon} n="down" s=${16} /></label>
            <label class="cmp-row"><span class="cmp-row-k">Ward</span>
              <select class="cmp-row-v" value=${regionId} onChange=${(e) => { setRegionId(e.target.value); setRoadId(''); setLocation(null); }}>${M().regions.filter((r) => r.type === 'ward').map((r) => html`<option value=${r.id}>${r.name}</option>`)}</select><${Icon} n="down" s=${16} /></label>
            <label class="cmp-row"><span class="cmp-row-k">Road</span>
              <select class="cmp-row-v" value=${roadId} onChange=${(e) => setRoadId(e.target.value)}><option value="">Not sure</option>${wardRoads.map((r) => html`<option value=${r.id}>${r.name} · segment ${r.segment}${r.underDlp ? ' (under DLP)' : ''}</option>`)}</select><${Icon} n="down" s=${16} /></label>
            <div class="cmp-row"><span class="cmp-row-k">Location</span>
              ${location
                ? html`<span class="cmp-row-v cmp-num">${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}<button type="button" class="cmp-link" onClick=${() => setLocation(null)}>Remove</button></span>`
                : html`<button type="button" class="cmp-row-v cmp-link" onClick=${useMyLocation} disabled=${locBusy}>${locBusy ? 'Finding you…' : 'Use my location'}</button>`}</div>
          </section>
          ${road?.underDlp ? html`<div class="cmp-dlp" role="note"><${Icon} n="shield" s=${18} /><div><b>${road.name} is under its Defect Liability Period.</b> The original contractor must repair it at no cost to BMC.${route?.contractorId ? html` Latest contractor on record: <a class="cmp-a" href=${'#/contractor/' + route.contractorId}>${contractor(route.contractorId)?.name}</a>.` : null}</div></div>` : null}

          <${RouteCard} route=${route} busy=${routeBusy} chosenId=${chosenId} userPicked=${userPicked} onChange=${() => setSheet('position')} onReset=${() => setChosen(null)} />` : null}

        ${tag === 'progress' ? html`<${ProgressLinker} act=${act} linked=${linked} setLinked=${setLinked} projectId=${projectId} setProjectId=${setProjectId} markResolved=${markResolved} setMarkResolved=${setMarkResolved} />` : null}

        <div class="cmp-bar">
          <button type="button" class="cmp-tool" aria-label="Add photo" title="Add photo" onClick=${() => fileRef.current.click()} disabled=${images.length + uploading >= 4}><${Icon} n="image" s=${22} /></button>
          ${canCamera ? html`<button type="button" class="cmp-tool" aria-label="Camera and location" title="Camera and location" onClick=${() => setStep('camera')}><${Icon} n="camera" s=${22} /></button>` : null}
          <button type="button" class="cmp-tool" aria-label="Mention a position or contractor" title="Mention" onClick=${() => setSheet('mention')}><${Icon} n="at" s=${22} /></button>
          ${isProblem ? html`<button type="button" class=${'cmp-tool' + (location ? ' on' : '')} aria-label="Use my location" title="Use my location" onClick=${useMyLocation} disabled=${locBusy}><${Icon} n="pin" s=${22} /></button>` : null}
          <span class="cmp-hint" aria-live="polite">${missing}</span>
          ${postBtn('cmp-post')}
        </div>
      </form>

      <${Sheet} open=${sheet === 'identity'} onClose=${() => setSheet(null)} title="Posting as">
        ${modes.map(([m, name, kind]) => html`<button type="button" class=${'cmp-opt' + (s.mode === m || (m === 'citizen' && act.type === 'citizen') ? ' on' : '')} onClick=${() => { setMode(m); setSheet(null); }}>
          <div class="grow"><div class="cmp-opt-t">${name}</div><div class="cmp-opt-s">${kind}</div></div>${s.mode === m || (m === 'citizen' && act.type === 'citizen') ? html`<${Icon} n="check" s=${20} />` : null}</button>`)}
      <//>
      <${Sheet} open=${sheet === 'position'} onClose=${() => setSheet(null)} title="Who is responsible?">
        <${PositionPicker} regionId=${regionId} category=${category} route=${route} chosenId=${chosenId} onPick=${(id) => { setChosen(id === route?.positionId ? null : id); setSheet(null); }} />
      <//>
      <${Sheet} open=${sheet === 'mention'} onClose=${() => setSheet(null)} title="Mention">
        <${MentionPicker} regionId=${regionId} onPick=${(m) => { if (!mentions.some((x) => x.id === m.id)) setMentions((x) => [...x, m]); setSheet(null); }} />
      <//>
    </div>`;
}

function RouteCard({ route, busy, chosenId, userPicked, onChange, onReset }) {
  const p = position(chosenId);
  const holder = p && person(p.holderUserId);
  const suggested = route && position(route.positionId);
  return html`<section class="cmp-route" aria-label="Responsible position" aria-busy=${busy}>
    <div class="cmp-route-h">
      <span class="cmp-eyebrow">Responsible position</span>
      <span class="cmp-route-st">${busy ? 'Checking…' : userPicked ? 'Chosen by you' : route ? CONFIDENCE[route.confidence] : ''}</span>
    </div>
    ${!route && busy ? html`<${Loading} />` : !p ? html`<p class="cmp-muted">Write a headline and pick the ward to see who is responsible.</p>` : html`
      <a class="cmp-route-who" href=${'#/position/' + p.id}>
        <${Avatar} name=${holder?.name || p.title} kind=${holder ? 'public' : 'anon'} ring="official" size=${44} />
        <div class="grow"><div class="cmp-route-t">${p.title}</div><div class="cmp-route-s">${holder?.name || 'Vacant'} · ${region(p.regionId)?.shortName || region(p.regionId)?.name}</div></div>
      </a>
      <div class="cmp-why-h">Why this position</div>
      <ul class="cmp-why">
        ${userPicked && suggested ? html`<li>You changed this from ${suggested.title}. It will be recorded as your choice, not the system’s.</li>` : null}
        ${(route?.reasons || []).map((r) => html`<li>${r}</li>`)}
      </ul>`}
    <div class="cmp-route-act">
      <button type="button" class="btn btn-sm cmp-btn-quiet" onClick=${onChange} disabled=${!route}>Change</button>
      ${userPicked ? html`<button type="button" class="cmp-link" onClick=${onReset}>Use suggestion</button>` : null}
      <span class="grow"></span>
      <${ComingSoon} label="AI model routing" icon="sparkle" />
    </div>
    <p class="cmp-route-foot">Suggested automatically (rules-based in this demo). You can change it before posting.</p>
  </section>`;
}

function PositionPicker({ regionId, category, route, chosenId, onPick }) {
  const alts = new Set(route?.alternatives || []);
  const levels = chain(regionId).slice(0, 5);
  return html`<div class="cmp-pp">
    <p class="cmp-muted">Positions that cover this area, nearest first. Ones that handle ${category} are listed first in each group.</p>
    ${levels.map((r) => {
      const rank = (p) => (p.id === route?.positionId ? 2 : 0) + (p.categories.includes(category) ? 1 : 0);
      const ps = positionsIn(r.id).sort((a, b) => rank(b) - rank(a));
      if (!ps.length) return null;
      return html`<div class="cmp-pp-g">
        <div class="cmp-pp-h">${r.shortName || r.name} <span>${levelLabel(r.type)}</span></div>
        ${ps.map((p) => {
          const on = p.id === chosenId;
          const tagLine = p.id === route?.positionId ? 'Suggested' : alts.has(p.id) ? 'Also fits' : p.categories.includes(category) ? `Handles ${category}` : '';
          return html`<button type="button" class=${'cmp-opt' + (on ? ' on' : '')} aria-pressed=${on} onClick=${() => onPick(p.id)}>
            <div class="grow"><div class="cmp-opt-t">${p.title}</div><div class="cmp-opt-s">${person(p.holderUserId)?.name || 'Vacant'}${tagLine ? html` · <b>${tagLine}</b>` : null}</div></div>
            ${on ? html`<${Icon} n="check" s=${20} />` : null}
          </button>`;
        })}
      </div>`;
    })}
  </div>`;
}

function MentionPicker({ regionId, onPick }) {
  const [q, setQ] = useState('');
  const ql = q.toLowerCase();
  const near = new Set(chain(regionId).map((r) => r.id));
  const ps = M().positions.filter((p) => (!q ? near.has(p.regionId) : (p.title + ' ' + (person(p.holderUserId)?.name || '') + ' ' + region(p.regionId).name).toLowerCase().includes(ql))).slice(0, 8);
  const cs = M().contractors.filter((c) => !q || c.name.toLowerCase().includes(ql)).slice(0, 4);
  return html`<div class="cmp-pp">
    <input class="cmp-search" placeholder="Search positions or contractors" aria-label="Search positions or contractors" value=${q} onInput=${(e) => setQ(e.target.value)} autofocus />
    ${ps.map((p) => html`<button type="button" class="cmp-opt" onClick=${() => onPick({ type: 'position', id: p.id })}><div class="grow"><div class="cmp-opt-t">@${p.title}</div><div class="cmp-opt-s">${region(p.regionId).name}</div></div></button>`)}
    ${cs.map((c) => html`<button type="button" class="cmp-opt" onClick=${() => onPick({ type: 'contractor', id: c.id })}><div class="grow"><div class="cmp-opt-t">@${c.name}</div><div class="cmp-opt-s">Contractor</div></div></button>`)}
    ${!ps.length && !cs.length ? html`<p class="cmp-muted">No matches.</p>` : null}
  </div>`;
}

function ProgressLinker({ act, linked, setLinked, projectId, setProjectId, markResolved, setMarkResolved }) {
  const [problems, setProblems] = useState(null);
  const [showAll, setShowAll] = useState(false);
  const projects = act.type === 'contractor' ? M().projects.filter((p) => p.contractorId === act.id) : M().projects.filter((p) => { const pos = position(act.id); return pos && chain(p.regionId).some((r) => r.id === pos.regionId); });
  useEffect(() => {
    if (act.type === 'position') api('/dashboard/position/' + act.id).then((d) => setProblems(d.problems));
    else Promise.all(projects.flatMap((pj) => pj.linkedProblemIds).map((id) => api('/posts/' + id).then((r) => r.post).catch(() => null))).then((x) => setProblems(x.filter(Boolean)));
  }, [act.id]);
  return html`<section class="cmp-link-box">
    <div class="cmp-route-h"><span class="cmp-eyebrow">Link to problem posts</span><span class="cmp-route-st">${linked.length} selected · authors get notified</span></div>
    ${!problems ? html`<${Loading} />` : !problems.length ? html`<p class="cmp-muted">No problems you are responsible for.</p>` : html`${(showAll ? problems : problems.filter((p, i) => i < 6 || linked.includes(p.id))).map((p) => html`<label class="cmp-check"><input type="checkbox" checked=${linked.includes(p.id)} onChange=${(e) => setLinked((x) => e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id))} /><div class="grow"><div>${p.title}</div><div class="cmp-opt-s">${p.regionName} · ${p.upvoteCount} upvotes</div></div></label>`)}
      ${problems.length > 6 ? html`<button type="button" class="cmp-link cmp-more" onClick=${() => setShowAll(!showAll)}>${showAll ? 'Show fewer' : `Show all ${problems.length} problems`}</button>` : null}`}
    <label class="cmp-row"><span class="cmp-row-k">Project</span><select class="cmp-row-v" value=${projectId} onChange=${(e) => setProjectId(e.target.value)}><option value="">None</option>${projects.map((p) => html`<option value=${p.id}>${p.title}</option>`)}</select><${Icon} n="down" s=${16} /></label>
    <label class="cmp-check"><input type="checkbox" checked=${markResolved} onChange=${(e) => setMarkResolved(e.target.checked)} /><div class="grow">Mark linked problems as resolved</div></label>
  </section>`;
}

// Camera flow: take photo → get geolocation → show who is in charge here
function CameraStep({ onDone }) {
  const [image, setImage] = useState(null);
  const [loc, setLoc] = useState(null);
  const [found, setFound] = useState(null);
  const [status, setStatus] = useState('');
  const fileRef = useRef();

  const take = async (files) => {
    if (!files?.[0]) return;
    setStatus('Processing photo…');
    try { const dataUrl = await compressImage(files[0]); const { url } = await post('/upload', { dataUrl }); setImage(url); } catch { toast('Could not read photo'); }
    getLoc();
  };
  const getLoc = () => {
    setStatus('Getting your location…');
    if (!navigator.geolocation) return setStatus('Location not available. Tap the map to set it.');
    navigator.geolocation.getCurrentPosition((p) => useLoc({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setStatus('Location blocked. Tap the map to set where the problem is.'), { enableHighAccuracy: true, timeout: 8000 });
  };
  const useLoc = async (l) => {
    setLoc(l); setStatus('Finding who is in charge here…');
    const r = await api(`/locate?lat=${l.lat}&lng=${l.lng}`);
    setFound(r); setStatus(r.region ? '' : 'This spot is outside Mumbai’s wards in the prototype. Tap the map inside Mumbai.');
  };
  const pune = [M().regions.find((r) => r.id === 'r_bmc')];

  return html`
    <${Header} title="Report with camera" back />
    <div class="camera">
      ${image ? html`<img class="cam-preview" src=${image} alt="Captured problem" />` : html`<button class="cam-shutter" onClick=${() => fileRef.current.click()}><${Icon} n="camera" s=${42} /><b>Take a photo of the problem</b><span class="dim small">Opens your phone camera</span></button>`}
      <input ref=${fileRef} type="file" accept="image/*" capture="environment" hidden onChange=${(e) => take(e.target.files)} />
      <div class="btn-row">${!image ? html`<button class="btn btn-ghost btn-sm" onClick=${getLoc}>Skip photo, use location</button>` : html`<button class="btn btn-ghost btn-sm" onClick=${() => fileRef.current.click()}>Retake</button>`}</div>
      ${status ? html`<div class="dim small center">${status}</div>` : null}
      ${(loc || status.includes('map')) ? html`<${AreaMap} regions=${found?.region ? [found.region] : pune} marker=${loc} height=${180} onPick=${(ll) => useLoc({ lat: ll.lat, lng: ll.lng })} />` : null}
      ${found?.region ? html`<section class="card pad">
        <div class="sec-h"><b class="with-ic"><${Icon} n="pin" s=${16} /> ${found.region.name}</b><span class="dim small">${levelLabel(found.region.type)}</span></div>
        ${found.road ? html`<div class="road-link"><${Icon} n="road" s=${16} /> Nearest road: ${found.road.name} · segment ${found.road.segment}${found.road.underDlp ? html` <span class="flag">Under DLP</span>` : null}</div>` : null}
        <div class="dim small">In charge here, nearest first:</div>
        ${found.positionIds.slice(0, 6).map((id) => html`<${PositionRow} p=${position(id)} showRegion right=${null} />`)}
        ${found.contractorIds.length ? html`<div class="dim small" style="margin-top:8px">Contractors working for these positions:</div>${found.contractorIds.map((id) => html`<${ContractorRow} c=${contractor(id)} />`)}` : null}
        <${ComingSoon} label="AI: detect who is accountable from photo" block />
        <button class="btn btn-primary btn-block" onClick=${() => onDone({ image, loc, region: found.region.id, road: found.road?.id })}>Continue to describe problem</button>
      </section>` : null}
    </div>`;
}
