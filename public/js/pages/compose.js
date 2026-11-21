import { html, useState, useEffect, useRef, store, useStore, api, post, go, toast, position, contractor, region, person, actingAs, chain, positionsIn, compressImage, M, TAGS, levelLabel, regionName } from '../lib.js';
import { Header, Icon, TagPill, ComingSoon, PositionRow, ContractorRow, AreaMap, Loading } from '../components.js';

const TAG_INFO = {
  problem: 'Something broken that needs fixing — potholes, cave-ins, waterlogging, open manholes. Shows who is responsible.',
  normal: 'Anything else for your neighbourhood — meet-ups, thanks, questions.',
  progress: 'Official update on problems or a project. People who reported them are notified.',
  position_change: 'Someone took charge of, or left, a position.',
  election: 'Election roles, responsibilities and dates.',
};
const RULES = {
  citizen: { tags: ['problem', 'normal'], note: 'Tags are checked by a moderation bot before publishing (coming soon).' },
  position: { tags: ['progress'], note: 'Officials can only post official project / problem updates — no greetings or personal content.' },
  contractor: { tags: ['progress'], note: 'Contractors can only post updates for projects and problems assigned to them.' },
  admin: { tags: ['position_change', 'election', 'normal'], note: 'Admin posts: blue for position changes, green for election roles & responsibilities.' },
};

export function Compose({ query }) {
  const s = useStore();
  const act = actingAs();
  const rule = RULES[act.type];
  const me = s.meta?.me;
  const [step, setStep] = useState(query.camera ? 'camera' : query.tag || rule.tags.length === 1 ? 'form' : 'pick');
  const [tag, setTag] = useState(rule.tags.includes(query.tag) ? query.tag : rule.tags[0]);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [category, setCategory] = useState('Pothole');
  const [roadId, setRoadId] = useState('');
  const [regionId, setRegionId] = useState(act.type === 'position' ? position(act.id)?.regionId : region(me?.regionId)?.type === 'ward' ? me.regionId : 'w_K-W');
  const [images, setImages] = useState([]);
  const [mentions, setMentions] = useState([]);
  const [location, setLocation] = useState(null);
  const [captured, setCaptured] = useState(false);
  const [suggested, setSuggested] = useState([]);
  const [responsible, setResponsible] = useState([]);
  const [linked, setLinked] = useState(query.link ? query.link.split(',') : []);
  const [projectId, setProjectId] = useState(query.project || '');
  const [markResolved, setMarkResolved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);

  useEffect(() => {
    if (tag !== 'problem' || !regionId) return;
    api(`/suggest?regionId=${regionId}&category=${encodeURIComponent(category)}`).then((r) => { setSuggested(r.positionIds); setResponsible(r.positionIds); });
  }, [tag, regionId, category]);

  const addImages = async (files) => {
    for (const f of [...files].slice(0, 4 - images.length)) {
      try { const dataUrl = await compressImage(f); const { url } = await post('/upload', { dataUrl }); setImages((x) => [...x, url]); } catch (e) { toast('Could not attach image'); }
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const p = await post('/posts', { tag, title, body, category, regionId, images, mentions, location, capturedWithCamera: captured, roadId: roadId || null, responsiblePositionIds: responsible, linkedProblemIds: linked, projectId: projectId || null, markResolved, actingAs: act });
      toast(tag === 'progress' && linked.length ? 'Posted — linked problem posts were notified' : 'Posted');
      go('#/post/' + p.id);
    } catch (err) { toast(err.message); }
    setBusy(false);
  };

  if (step === 'camera') return html`<${CameraStep} onDone=${({ image, loc, region: r, road }) => { if (image) setImages([image]); if (loc) setLocation(loc); if (r) setRegionId(r); if (road) setRoadId(road); setCaptured(true); setTag('problem'); setStep('form'); }} />`;

  if (step === 'pick') return html`
    <${Header} title="New post" back />
    <div class="pick-step">
      <h2 class="h2">What are you posting?</h2>
      <p class="dim">Each type has its own colour in the feed.</p>
      ${rule.tags.map((t) => html`<button class=${'type-opt type-' + t} onClick=${() => { setTag(t); setStep('form'); }}>
        <span class=${'type-swatch sw-' + t}></span>
        <div class="grow"><b>${TAGS[t].label}</b><div class="dim small">${TAG_INFO[t]}</div></div><${Icon} n="chev" s=${22} />
      </button>`)}
      ${act.type === 'citizen' ? html`<button class="type-opt type-problem" onClick=${() => setStep('camera')}><span class="type-swatch sw-problem"><${Icon} n="camera" s=${22} /></span><div class="grow"><b>Problem — with camera</b><div class="dim small">Take a photo; your location shows who is in charge of that spot.</div></div><${Icon} n="chev" s=${22} /></button>` : null}
      <div class="rule-note"><${Icon} n="shield" s=${18} /> ${rule.note}</div>
    </div>`;

  const wardRoads = M().roads.filter((r) => r.regionId === regionId);
  const actorTitle = act.type === 'position' ? position(act.id)?.title : act.type === 'contractor' ? contractor(act.id)?.name : act.type === 'admin' ? 'Platform Admin' : 'yourself (anonymous citizen)';
  return html`
    <${Header} title="New post" back right=${html`<button class="btn btn-primary btn-sm" form="compose" disabled=${busy}>Share</button>`} />
    <form id="compose" class="compose" onSubmit=${submit}>
      <div class="dim small">Posting as <b>${actorTitle}</b></div>
      <div class="tag-pick"><${TagPill} tag=${tag} />${rule.tags.length > 1 ? html`<button type="button" class="link-btn" onClick=${() => setStep('pick')}>Change type</button>` : null}</div>
      <div class="rule-note"><${Icon} n="shield" s=${16} /> ${rule.note}</div>

      <input class="title-input" placeholder=${tag === 'problem' ? 'What is the problem? (e.g. Deep potholes on Karve Road)' : 'Title'} value=${title} onInput=${(e) => setTitle(e.target.value)} maxlength="140" required />
      <textarea class="body-input" rows="6" placeholder=${tag === 'problem' ? 'Describe it clearly: exact spot, since when, who is affected, how severe…' : tag === 'progress' ? 'What was done, what is next, expected dates…' : 'Write your post…'} value=${body} onInput=${(e) => setBody(e.target.value)} required></textarea>

      ${tag === 'problem' ? html`
        <div class="field-row">
          <label class="field"><span>Category</span><select value=${category} onChange=${(e) => setCategory(e.target.value)}>${M().categories.map((c) => html`<option>${c}</option>`)}</select></label>
          <label class="field"><span>Ward</span><select value=${regionId} onChange=${(e) => { setRegionId(e.target.value); setRoadId(''); }}>${M().regions.filter((r) => r.type === 'ward').map((r) => html`<option value=${r.id}>${r.name}</option>`)}</select></label>
        </div>
        <label class="field"><span>Road (optional)</span><select value=${roadId} onChange=${(e) => setRoadId(e.target.value)}><option value="">— not sure —</option>${wardRoads.map((r) => html`<option value=${r.id}>${r.name} · segment ${r.segment}${r.underDlp ? ' (under DLP)' : ''}</option>`)}</select></label>
        ${M().roads.find((r) => r.id === roadId)?.underDlp ? html`<div class="flag-box"><${Icon} n="shield" s=${18} /> This road is still under its Defect Liability Period — the original contractor must repair it at no cost to BMC.</div>` : null}
        ${location ? html`<div class="dim small">📍 Location attached (${location.lat.toFixed(4)}, ${location.lng.toFixed(4)})</div>` : null}
        <section class="card pad inset">
          <div class="sec-h"><b>Who is responsible?</b><${ComingSoon} label="AI check" /></div>
          <p class="dim small">Suggested from the area's positions and their remit. You can change it.</p>
          ${chain(regionId).slice(0, 4).flatMap((r) => positionsIn(r.id).filter((p) => p.categories.includes(category) || responsible.includes(p.id))).slice(0, 8).map((p) => html`<label class="check-row"><input type="checkbox" checked=${responsible.includes(p.id)} onChange=${(e) => setResponsible((x) => e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id))} /><div class="grow"><div>${p.title}</div><div class="dim small">${region(p.regionId).name} · ${person(p.holderUserId)?.name || 'Vacant'}${suggested.includes(p.id) ? ' · suggested' : ''}</div></div></label>`)}
        </section>` : null}

      ${tag === 'progress' ? html`<${ProgressLinker} act=${act} linked=${linked} setLinked=${setLinked} projectId=${projectId} setProjectId=${setProjectId} />
        <label class="check-row"><input type="checkbox" checked=${markResolved} onChange=${(e) => setMarkResolved(e.target.checked)} /> Mark linked problems as resolved</label>` : null}

      <div class="attach-row">
        <label class="btn btn-ghost btn-sm"><${Icon} n="image" s=${16} /> Photo<input type="file" accept="image/*" multiple hidden onChange=${(e) => addImages(e.target.files)} /></label>
        <button type="button" class="btn btn-ghost btn-sm" onClick=${() => setMentionOpen(!mentionOpen)}><${Icon} n="at" s=${16} /> Mention</button>
        ${tag === 'problem' && act.type === 'citizen' ? html`<button type="button" class="btn btn-ghost btn-sm" onClick=${() => setStep('camera')}><${Icon} n="camera" s=${16} /> Camera + location</button>` : null}
      </div>
      <div class="dim small">Text comes first — photos are optional supporting evidence.</div>
      ${images.length ? html`<div class="thumbs">${images.map((src) => html`<div class="thumb"><img src=${src} alt="" /><button type="button" aria-label="Remove photo" onClick=${() => setImages((x) => x.filter((y) => y !== src))}>×</button></div>`)}</div>` : null}
      ${mentions.length ? html`<div class="mentions">${mentions.map((m) => html`<span class="mention">@${m.type === 'position' ? position(m.id)?.title : contractor(m.id)?.name} <button type="button" aria-label="Remove" onClick=${() => setMentions((x) => x.filter((y) => y !== m))}>×</button></span>`)}</div>` : null}
      ${mentionOpen ? html`<${MentionPicker} regionId=${regionId} onPick=${(m) => { if (!mentions.some((x) => x.id === m.id)) setMentions((x) => [...x, m]); setMentionOpen(false); }} />` : null}
      <button class="btn btn-primary btn-block" disabled=${busy}>${busy ? 'Posting…' : 'Share post'}</button>
    </form>`;
}

function MentionPicker({ regionId, onPick }) {
  const [q, setQ] = useState('');
  const ql = q.toLowerCase();
  const near = new Set(chain(regionId).map((r) => r.id));
  const ps = M().positions.filter((p) => (!q ? near.has(p.regionId) : (p.title + ' ' + (person(p.holderUserId)?.name || '') + ' ' + region(p.regionId).name).toLowerCase().includes(ql))).slice(0, 8);
  const cs = M().contractors.filter((c) => !q || c.name.toLowerCase().includes(ql)).slice(0, 4);
  return html`<div class="card inset picker">
    <input placeholder="Search positions or contractors" value=${q} onInput=${(e) => setQ(e.target.value)} autofocus />
    ${ps.map((p) => html`<button type="button" class="pick" onClick=${() => onPick({ type: 'position', id: p.id })}>@${p.title} <span class="dim small">${region(p.regionId).name}</span></button>`)}
    ${cs.map((c) => html`<button type="button" class="pick" onClick=${() => onPick({ type: 'contractor', id: c.id })}>@${c.name} <span class="dim small">Contractor</span></button>`)}
  </div>`;
}

function ProgressLinker({ act, linked, setLinked, projectId, setProjectId }) {
  const [problems, setProblems] = useState(null);
  const projects = act.type === 'contractor' ? M().projects.filter((p) => p.contractorId === act.id) : M().projects.filter((p) => { const pos = position(act.id); return pos && chain(p.regionId).some((r) => r.id === pos.regionId); });
  useEffect(() => {
    if (act.type === 'position') api('/dashboard/position/' + act.id).then((d) => setProblems(d.problems));
    else Promise.all(projects.flatMap((pj) => pj.linkedProblemIds).map((id) => api('/posts/' + id).then((r) => r.post).catch(() => null))).then((x) => setProblems(x.filter(Boolean)));
  }, [act.id]);
  return html`<section class="card pad inset">
    <div class="sec-h"><b>Link to problem posts</b><span class="dim small">${linked.length} selected · authors get notified</span></div>
    ${!problems ? html`<${Loading} />` : !problems.length ? html`<div class="dim small">No problems you are responsible for.</div>` : problems.map((p) => html`<label class="check-row"><input type="checkbox" checked=${linked.includes(p.id)} onChange=${(e) => setLinked((x) => e.target.checked ? [...x, p.id] : x.filter((y) => y !== p.id))} /><div class="grow"><div>${p.title}</div><div class="dim small">${p.regionName} · ▲ ${p.upvoteCount}</div></div></label>`)}
    <label class="field"><span>Project (optional)</span><select value=${projectId} onChange=${(e) => setProjectId(e.target.value)}><option value="">— none —</option>${projects.map((p) => html`<option value=${p.id}>${p.title}</option>`)}</select></label>
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
    if (!navigator.geolocation) return setStatus('Location not available — tap the map to set it.');
    navigator.geolocation.getCurrentPosition((p) => useLoc({ lat: p.coords.latitude, lng: p.coords.longitude }), () => setStatus('Location blocked — tap the map to set where the problem is.'), { enableHighAccuracy: true, timeout: 8000 });
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
        <div class="sec-h"><b>📍 ${found.region.name}</b><span class="dim small">${levelLabel(found.region.type)}</span></div>
        ${found.road ? html`<div class="road-link"><${Icon} n="road" s=${16} /> Nearest road: ${found.road.name} · segment ${found.road.segment}${found.road.underDlp ? html` <span class="flag">Under DLP</span>` : null}</div>` : null}
        <div class="dim small">In charge here, nearest first:</div>
        ${found.positionIds.slice(0, 6).map((id) => html`<${PositionRow} p=${position(id)} showRegion right=${null} />`)}
        ${found.contractorIds.length ? html`<div class="dim small" style="margin-top:8px">Contractors working for these positions:</div>${found.contractorIds.map((id) => html`<${ContractorRow} c=${contractor(id)} />`)}` : null}
        <${ComingSoon} label="AI: detect who is accountable from photo" block />
        <button class="btn btn-primary btn-block" onClick=${() => onDone({ image, loc, region: found.region.id, road: found.road?.id })}>Continue to describe problem</button>
      </section>` : null}
    </div>`;
}
