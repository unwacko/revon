// Placeholder demo data. All people, parties and businesses are FICTIONAL.
// The region hierarchy mirrors India's real governance structure (see README).
// When the road-problems dataset arrives, regenerate posts/users from it here.

const now = Date.now();
const H = 3600 * 1000;
const D = 24 * H;

// ---------- Region levels (lower number = higher area) ----------
// Two parallel tracks exist in India below the district:
//   Urban: Municipal Corporation / Council / Nagar Panchayat -> Ward
//   Rural (73rd Amendment): Zilla Parishad -> Panchayat Samiti (Block) -> Gram Panchayat
// Electoral constituencies (Lok Sabha -> MP, Vidhan Sabha -> MLA) overlap these
// and are attached to the admin region that best contains them.
export const LEVELS = {
  nation: { depth: 0, label: 'Nation' },
  state: { depth: 1, label: 'State / UT' },
  division: { depth: 2, label: 'Revenue Division' },
  district: { depth: 3, label: 'District' },
  municipal_corporation: { depth: 4, label: 'Municipal Corporation' },
  zilla_parishad: { depth: 4, label: 'Zilla Parishad (District Panchayat)' },
  block: { depth: 5, label: 'Panchayat Samiti / Block' },
  ward: { depth: 6, label: 'Ward' },
  gram_panchayat: { depth: 6, label: 'Gram Panchayat (Village)' },
};

export const CATEGORIES = ['Roads', 'Water', 'Drainage', 'Streetlights', 'Sanitation', 'Traffic', 'Law & Order', 'Health', 'Education', 'Other'];

function region(id, name, type, parentId, center, radiusKm, population, extra = {}) {
  return { id, name, type, parentId, center, radiusKm, population, budget: {}, ...extra };
}

export function buildSeed() {
  const regions = [
    region('r_in', 'India', 'nation', null, [22.5, 79.0], 1500, 1428000000),
    region('r_mh', 'Maharashtra', 'state', 'r_in', [19.4, 75.7], 330, 126000000),
    region('r_pune_div', 'Pune Division', 'division', 'r_mh', [18.2, 74.4], 160, 32000000),
    region('r_pune_dist', 'Pune District', 'district', 'r_pune_div', [18.55, 73.95], 70, 9400000, { note: 'Pune Lok Sabha constituency (MP) is attached here' }),
    region('r_pmc', 'Pune Municipal Corporation', 'municipal_corporation', 'r_pune_dist', [18.52, 73.855], 11, 4200000),
    region('r_w_kothrud', 'Kothrud Ward', 'ward', 'r_pmc', [18.5074, 73.8077], 2.2, 95000, { note: 'Part of Kothrud Vidhan Sabha constituency (MLA)' }),
    region('r_w_shivaji', 'Shivajinagar Ward', 'ward', 'r_pmc', [18.5308, 73.8475], 1.8, 78000),
    region('r_w_kasba', 'Kasba Peth Ward', 'ward', 'r_pmc', [18.5196, 73.8553], 1.2, 70000),
    region('r_w_aundh', 'Aundh Ward', 'ward', 'r_pmc', [18.558, 73.8075], 2.0, 88000),
    region('r_w_hadapsar', 'Hadapsar Ward', 'ward', 'r_pmc', [18.5089, 73.926], 2.6, 120000),
    region('r_zp_pune', 'Zilla Parishad Pune', 'zilla_parishad', 'r_pune_dist', [18.6, 74.0], 60, 3600000),
    region('r_ps_haveli', 'Haveli Panchayat Samiti', 'block', 'r_zp_pune', [18.58, 73.97], 15, 650000),
    region('r_gp_wagholi', 'Wagholi Gram Panchayat', 'gram_panchayat', 'r_ps_haveli', [18.5793, 73.9787], 3, 60000),
    region('r_gp_lohegaon', 'Lohegaon Gram Panchayat', 'gram_panchayat', 'r_ps_haveli', [18.6, 73.93], 3, 48000),
  ];

  // Budgets (₹ crore) by category, per area
  const B = (o) => o;
  const budgets = {
    r_in: B({ Roads: 278000, Health: 90000, Education: 125000, 'Law & Order': 200000 }),
    r_mh: B({ Roads: 19900, Water: 9500, Health: 18000, Education: 80000 }),
    r_pune_div: B({ Roads: 1400, Water: 600 }),
    r_pune_dist: B({ Roads: 820, Water: 340, Health: 410, 'Law & Order': 290 }),
    r_pmc: B({ Roads: 1650, Water: 880, Drainage: 610, Streetlights: 120, Sanitation: 540, Traffic: 95 }),
    r_w_kothrud: B({ Roads: 38, Drainage: 9, Streetlights: 3.2, Sanitation: 6 }),
    r_w_shivaji: B({ Roads: 31, Drainage: 7, Streetlights: 2.5, Sanitation: 5 }),
    r_w_kasba: B({ Roads: 22, Drainage: 8, Streetlights: 2.1, Sanitation: 4.4 }),
    r_w_aundh: B({ Roads: 29, Drainage: 6, Streetlights: 2.8, Sanitation: 4.9 }),
    r_w_hadapsar: B({ Roads: 44, Drainage: 14, Streetlights: 3.9, Sanitation: 7.5 }),
    r_zp_pune: B({ Roads: 410, Water: 260, Health: 180, Education: 520 }),
    r_ps_haveli: B({ Roads: 36, Water: 22 }),
    r_gp_wagholi: B({ Roads: 6.5, Water: 3.1, Streetlights: 0.8 }),
    r_gp_lohegaon: B({ Roads: 4.2, Water: 2.6, Streetlights: 0.6 }),
  };
  for (const r of regions) r.budget = budgets[r.id] || {};

  // ---------- Users ----------
  const users = [];
  const user = (id, o) => { const u = { id, role: 'citizen', verified: true, onboarded: true, following: { positions: [], users: [], regions: [] }, createdAt: now - 200 * D, ...o }; users.push(u); return u; };

  user('u_admin', { role: 'admin', realName: 'Platform Admin', handle: 'admin', regionId: 'r_w_shivaji' });

  // Fictional office holders
  const people = [
    ['u_pm', 'Arvind Mehra', 'Bharat Pragati Party', 'r_w_shivaji'],
    ['u_moRTH', 'Sushila Rao', 'Bharat Pragati Party', 'r_w_shivaji'],
    ['u_cm', 'Vikram Shinde-Patil', 'Lok Vikas Aghadi', 'r_w_kasba'],
    ['u_pwdmin', 'Neha Kadam', 'Lok Vikas Aghadi', 'r_w_aundh'],
    ['u_divcom', 'Rakesh Iyer (IAS)', null, 'r_w_shivaji'],
    ['u_collector', 'Priya Natarajan (IAS)', null, 'r_w_shivaji'],
    ['u_mp', 'Harish Gokhale', 'Bharat Pragati Party', 'r_w_kasba'],
    ['u_sp', 'Imran Shaikh (IPS)', null, 'r_w_aundh'],
    ['u_mayor', 'Kavita Sathe', 'Lok Vikas Aghadi', 'r_w_kothrud'],
    ['u_commissioner', 'Manoj Deshpande (IAS)', null, 'r_w_shivaji'],
    ['u_cityeng', 'Sanjay Kulkarni', null, 'r_w_kasba'],
    ['u_trafficdcp', 'Anita Pillai (IPS)', null, 'r_w_shivaji'],
    ['u_corp_kothrud', 'Rohan Joshi', 'Bharat Pragati Party', 'r_w_kothrud'],
    ['u_corp_kothrud2', 'Swati Bapat', 'Lok Vikas Aghadi', 'r_w_kothrud'],
    ['u_mla_kothrud', 'Deepak Bhosale', 'Bharat Pragati Party', 'r_w_kothrud'],
    ['u_wo_kothrud', 'Farhan Qureshi', null, 'r_w_kothrud'],
    ['u_je_kothrud', 'Pooja Wagh', null, 'r_w_kothrud'],
    ['u_corp_shivaji', 'Amit Phadke', 'Jan Shakti Dal', 'r_w_shivaji'],
    ['u_corp_kasba', 'Leena Mane', 'Lok Vikas Aghadi', 'r_w_kasba'],
    ['u_corp_aundh', 'Suresh Gaikwad', 'Independent', 'r_w_aundh'],
    ['u_corp_hadapsar', 'Nilesh Tupe', 'Jan Shakti Dal', 'r_w_hadapsar'],
    ['u_je_hadapsar', 'Ritu Salunkhe', null, 'r_w_hadapsar'],
    ['u_zp_pres', 'Bhagyashree Kale', 'Lok Vikas Aghadi', 'r_gp_wagholi'],
    ['u_zp_ceo', 'Ajay Menon (IAS)', null, 'r_w_shivaji'],
    ['u_ps_sabhapati', 'Dnyaneshwar Jagtap', 'Jan Shakti Dal', 'r_gp_lohegaon'],
    ['u_bdo', 'Sunanda More', null, 'r_gp_wagholi'],
    ['u_sarpanch_wagholi', 'Ganesh Satav', 'Independent', 'r_gp_wagholi'],
    ['u_sarpanch_lohegaon', 'Manisha Khandve', 'Lok Vikas Aghadi', 'r_gp_lohegaon'],
  ];
  for (const [id, name, party, regionId] of people) user(id, { realName: name, party, regionId, handle: id.replace('u_', '') });

  // Contractor members
  user('u_c_sahyadri', { realName: 'Prakash Shirole', regionId: 'r_w_kothrud', handle: 'sahyadri' });
  user('u_c_deccan', { realName: 'Yusuf Merchant', regionId: 'r_w_hadapsar', handle: 'deccan' });
  user('u_c_patil', { realName: 'Sachin Patil', regionId: 'r_gp_wagholi', handle: 'patil' });
  user('u_c_patil2', { realName: 'Vaishali Patil', regionId: 'r_gp_wagholi', handle: 'patil2' });
  user('u_c_metro', { realName: 'Gaurav Shah', regionId: 'r_w_aundh', handle: 'metro' });

  // Anonymous citizens
  const citizens = [
    ['u_cit1', 'Aarav Kulkarni', 'r_w_kothrud'],
    ['u_cit2', 'Sneha Deshmukh', 'r_w_kothrud'],
    ['u_cit3', 'Omkar Jadhav', 'r_w_shivaji'],
    ['u_cit4', 'Fatima Sayyed', 'r_w_hadapsar'],
    ['u_cit5', 'Rahul Nair', 'r_w_aundh'],
    ['u_cit6', 'Isha Thakur', 'r_w_kasba'],
    ['u_cit7', 'Tejas Kamble', 'r_gp_wagholi'],
    ['u_cit8', 'Priyanka Rane', 'r_w_hadapsar'],
  ];
  for (const [id, name, regionId] of citizens) user(id, { realName: name, regionId, handle: id });

  // ---------- Positions ----------
  // isHead = the fixed position of an area that can edit the area's positions
  const positions = [];
  const pos = (id, regionId, title, kind, holderUserId, categories, responsibilities, budget, extra = {}) => {
    positions.push({ id, regionId, title, kind, holderUserId, categories, responsibilities, budget, contractorIds: [], isHead: false, rank: 5, createdAt: now - 300 * D, ...extra });
  };
  pos('p_pm', 'r_in', 'Prime Minister', 'elected', 'u_pm', ['Roads', 'Health', 'Education', 'Law & Order', 'Water', 'Other'], ['Heads the Union Government', 'National policy & Union budget', 'Leads Council of Ministers'], 0, { isHead: true, rank: 0 });
  pos('p_morth', 'r_in', 'Union Minister, Road Transport & Highways', 'elected', 'u_moRTH', ['Roads', 'Traffic'], ['National Highways (via NHAI)', 'Road transport policy', 'Motor Vehicles Act'], 278000, { rank: 1 });
  pos('p_cm', 'r_mh', 'Chief Minister', 'elected', 'u_cm', ['Roads', 'Water', 'Health', 'Education', 'Law & Order', 'Other'], ['Heads the State Government', 'State budget & policy', 'Leads state Council of Ministers'], 0, { isHead: true, rank: 0 });
  pos('p_pwdmin', 'r_mh', 'Minister, Public Works Department (PWD)', 'elected', 'u_pwdmin', ['Roads'], ['State highways & major district roads', 'Government buildings', 'Bridges'], 19900, { rank: 1 });
  pos('p_divcom', 'r_pune_div', 'Divisional Commissioner', 'appointed', 'u_divcom', ['Other', 'Roads', 'Water'], ['Supervises district collectors in the division', 'Revenue administration', 'Development coordination'], 1400, { isHead: true, rank: 0 });
  pos('p_collector', 'r_pune_dist', 'District Collector & Magistrate', 'appointed', 'u_collector', ['Other', 'Law & Order', 'Roads', 'Water'], ['District administration & revenue', 'Disaster management', 'Elections officer for district', 'Coordinates all departments'], 820, { isHead: true, rank: 0 });
  pos('p_mp', 'r_pune_dist', 'Member of Parliament (Pune Lok Sabha)', 'elected', 'u_mp', ['Roads', 'Other'], ['Represents constituency in Lok Sabha', 'MPLADS fund (₹5 cr/yr) for local works', 'Raises issues with Union ministries'], 5, { rank: 1 });
  pos('p_sp', 'r_pune_dist', 'Superintendent of Police (Pune Rural)', 'appointed', 'u_sp', ['Law & Order', 'Traffic'], ['Policing in rural district', 'Highway safety enforcement'], 290, { rank: 2 });
  pos('p_mayor', 'r_pmc', 'Mayor', 'elected', 'u_mayor', ['Roads', 'Water', 'Drainage', 'Sanitation', 'Streetlights', 'Other'], ['Ceremonial head of the corporation', 'Presides over General Body', 'City development agenda'], 0, { isHead: true, rank: 0 });
  pos('p_commissioner', 'r_pmc', 'Municipal Commissioner', 'appointed', 'u_commissioner', ['Roads', 'Water', 'Drainage', 'Sanitation', 'Streetlights', 'Traffic', 'Other'], ['Executive head of PMC', 'Implements budget & projects', 'Approves tenders'], 3895, { rank: 1 });
  pos('p_cityeng', 'r_pmc', 'City Engineer (Road Department)', 'department', 'u_cityeng', ['Roads', 'Traffic'], ['City road network', 'Road resurfacing & potholes', 'Tendering for road works'], 1650, { rank: 2 });
  pos('p_trafficdcp', 'r_pmc', 'DCP Traffic, Pune City Police', 'appointed', 'u_trafficdcp', ['Traffic', 'Law & Order'], ['Traffic management & signals enforcement', 'Road safety drives'], 95, { rank: 3 });
  pos('p_corp_kothrud', 'r_w_kothrud', 'Corporator (Nagarsevak), Seat A', 'elected', 'u_corp_kothrud', ['Roads', 'Drainage', 'Streetlights', 'Sanitation', 'Water', 'Other'], ['Represents ward in PMC General Body', 'Ward-level works & budget', 'First point of contact for residents'], 28, { isHead: true, rank: 0 });
  pos('p_corp_kothrud2', 'r_w_kothrud', 'Corporator (Nagarsevak), Seat B', 'elected', 'u_corp_kothrud2', ['Roads', 'Drainage', 'Sanitation', 'Other'], ['Represents ward in PMC General Body', 'Ward-level works'], 18, { rank: 1 });
  pos('p_mla_kothrud', 'r_w_kothrud', 'MLA (Kothrud Vidhan Sabha)', 'elected', 'u_mla_kothrud', ['Roads', 'Other', 'Law & Order'], ['Represents constituency in State Assembly', 'Local Area Development fund', 'Raises issues with state departments'], 5, { rank: 1 });
  pos('p_wo_kothrud', 'r_w_kothrud', 'Ward Officer (Asst. Municipal Commissioner)', 'appointed', 'u_wo_kothrud', ['Roads', 'Drainage', 'Sanitation', 'Streetlights'], ['Executes ward works', 'Complaint redressal', 'Encroachment removal'], 8, { rank: 2 });
  pos('p_je_kothrud', 'r_w_kothrud', 'Junior Engineer (Roads)', 'department', 'u_je_kothrud', ['Roads'], ['Inspects road damage', 'Supervises contractors on site', 'Measurement books & quality checks'], 2, { rank: 3 });
  pos('p_corp_shivaji', 'r_w_shivaji', 'Corporator (Nagarsevak)', 'elected', 'u_corp_shivaji', ['Roads', 'Drainage', 'Streetlights', 'Sanitation', 'Water', 'Other'], ['Represents ward in PMC General Body', 'Ward-level works & budget'], 25, { isHead: true, rank: 0 });
  pos('p_wo_shivaji', 'r_w_shivaji', 'Ward Officer', 'appointed', null, ['Roads', 'Drainage', 'Sanitation'], ['Executes ward works', 'Complaint redressal'], 6, { rank: 2 });
  pos('p_corp_kasba', 'r_w_kasba', 'Corporator (Nagarsevak)', 'elected', 'u_corp_kasba', ['Roads', 'Drainage', 'Streetlights', 'Sanitation', 'Water', 'Other'], ['Represents ward in PMC General Body', 'Heritage area works'], 20, { isHead: true, rank: 0 });
  pos('p_corp_aundh', 'r_w_aundh', 'Corporator (Nagarsevak)', 'elected', 'u_corp_aundh', ['Roads', 'Drainage', 'Streetlights', 'Sanitation', 'Water', 'Other'], ['Represents ward in PMC General Body', 'Ward-level works'], 24, { isHead: true, rank: 0 });
  pos('p_corp_hadapsar', 'r_w_hadapsar', 'Corporator (Nagarsevak)', 'elected', 'u_corp_hadapsar', ['Roads', 'Drainage', 'Streetlights', 'Sanitation', 'Water', 'Other'], ['Represents ward in PMC General Body', 'Ward-level works'], 36, { isHead: true, rank: 0 });
  pos('p_je_hadapsar', 'r_w_hadapsar', 'Junior Engineer (Roads)', 'department', 'u_je_hadapsar', ['Roads', 'Drainage'], ['Inspects road damage', 'Supervises contractors on site'], 3, { rank: 3 });
  pos('p_zp_pres', 'r_zp_pune', 'Zilla Parishad President', 'elected', 'u_zp_pres', ['Roads', 'Water', 'Health', 'Education', 'Other'], ['Heads district panchayat', 'Rural development schemes', 'District rural roads'], 410, { isHead: true, rank: 0 });
  pos('p_zp_ceo', 'r_zp_pune', 'CEO, Zilla Parishad', 'appointed', 'u_zp_ceo', ['Roads', 'Water', 'Health', 'Education'], ['Executive head of ZP', 'Implements PMGSY & rural schemes'], 360, { rank: 1 });
  pos('p_ps_sabhapati', 'r_ps_haveli', 'Sabhapati (Panchayat Samiti Chairperson)', 'elected', 'u_ps_sabhapati', ['Roads', 'Water', 'Other'], ['Heads block-level panchayat', 'Block development plan'], 20, { isHead: true, rank: 0 });
  pos('p_bdo', 'r_ps_haveli', 'Block Development Officer (BDO)', 'appointed', 'u_bdo', ['Roads', 'Water', 'Sanitation'], ['Executes block schemes', 'Supervises gram panchayats'], 16, { rank: 1 });
  pos('p_sarpanch_wagholi', 'r_gp_wagholi', 'Sarpanch', 'elected', 'u_sarpanch_wagholi', ['Roads', 'Water', 'Streetlights', 'Sanitation', 'Drainage', 'Other'], ['Heads Gram Panchayat', 'Village roads, water, streetlights', 'Gram Sabha meetings'], 6.5, { isHead: true, rank: 0 });
  pos('p_gramsevak_wagholi', 'r_gp_wagholi', 'Gram Sevak (Panchayat Secretary)', 'appointed', null, ['Roads', 'Water', 'Sanitation'], ['Panchayat records & accounts', 'Implements schemes'], 1, { rank: 1 });
  pos('p_sarpanch_lohegaon', 'r_gp_lohegaon', 'Sarpanch', 'elected', 'u_sarpanch_lohegaon', ['Roads', 'Water', 'Streetlights', 'Sanitation', 'Drainage', 'Other'], ['Heads Gram Panchayat', 'Village roads, water, streetlights'], 4.2, { isHead: true, rank: 0 });

  // ---------- Contractors / businesses ----------
  const contractors = [
    { id: 'c_sahyadri', name: 'Sahyadri Roadworks Pvt Ltd', type: 'company', memberUserIds: ['u_c_sahyadri'], regionIds: ['r_pmc'], specialties: ['Roads', 'Drainage'], gstin: 'Sample-GSTIN-27AAA', assignedBy: [{ positionId: 'p_cityeng', regionId: 'r_pmc', at: now - 120 * D }], createdAt: now - 400 * D },
    { id: 'c_deccan', name: 'Deccan Infra Builders', type: 'company', memberUserIds: ['u_c_deccan'], regionIds: ['r_pmc', 'r_zp_pune'], specialties: ['Roads', 'Water', 'Drainage'], gstin: 'Sample-GSTIN-27BBB', assignedBy: [{ positionId: 'p_cityeng', regionId: 'r_pmc', at: now - 90 * D }], createdAt: now - 500 * D },
    { id: 'c_patil', name: 'Patil & Sons Civil Works', type: 'group', memberUserIds: ['u_c_patil', 'u_c_patil2'], regionIds: ['r_ps_haveli'], specialties: ['Roads', 'Water'], gstin: 'Sample-GSTIN-27CCC', assignedBy: [{ positionId: 'p_bdo', regionId: 'r_ps_haveli', at: now - 60 * D }], createdAt: now - 300 * D },
    { id: 'c_metro', name: 'Metro Asphalt Co.', type: 'company', memberUserIds: ['u_c_metro'], regionIds: ['r_pmc'], specialties: ['Roads', 'Streetlights'], gstin: 'Sample-GSTIN-27DDD', assignedBy: [{ positionId: 'p_cityeng', regionId: 'r_pmc', at: now - 200 * D }], createdAt: now - 600 * D },
  ];
  const P = (id) => positions.find((p) => p.id === id);
  P('p_cityeng').contractorIds = ['c_sahyadri', 'c_deccan', 'c_metro'];
  P('p_corp_kothrud').contractorIds = ['c_sahyadri'];
  P('p_corp_hadapsar').contractorIds = ['c_deccan'];
  P('p_bdo').contractorIds = ['c_patil'];
  P('p_sarpanch_wagholi').contractorIds = ['c_patil'];
  P('p_corp_aundh').contractorIds = ['c_metro'];

  // ---------- Posts (placeholder road problems — replace with dataset) ----------
  const posts = [];
  const comments = [];
  let pc = 0;
  const post = (o) => {
    const p = {
      id: 'post_' + ++pc, images: [], mentions: [], linkedProblemIds: [], upvotes: [], status: o.tag === 'problem' ? 'open' : null,
      viewedByPositions: [], respondedByPositions: [], responsible: [], category: null, location: null, projectId: null,
      moderation: { botVerified: null, note: 'Bot verification — coming soon' }, ...o,
    };
    posts.push(p);
    return p;
  };
  const resp = (ids, by = 'rules') => ids.map((positionId) => ({ positionId, assignedBy: by }));
  const ups = (n) => ['u_cit1', 'u_cit2', 'u_cit3', 'u_cit4', 'u_cit5', 'u_cit6', 'u_cit7', 'u_cit8', 'u_admin'].slice(0, n);

  const pr1 = post({ authorId: 'u_cit1', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Roads', title: 'Deep potholes on Karve Road near Nal Stop', body: 'Three large potholes in the left lane between Nal Stop and SNDT. Two-wheelers are swerving into the bus lane to avoid them, especially after dark. One is about 30cm wide and filled with water after yesterday\'s rain.', regionId: 'r_w_kothrud', location: { lat: 18.5085, lng: 73.8285 }, responsible: resp(['p_corp_kothrud', 'p_je_kothrud', 'p_cityeng']), mentions: [{ type: 'position', id: 'p_corp_kothrud' }], upvotes: ups(7), createdAt: now - 3 * D });
  const pr2 = post({ authorId: 'u_cit2', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Roads', title: 'Road dug up for cable work, never restored — Paud Road lane 4', body: 'Trench along the full lane length was dug three weeks ago for an internet cable. Loose gravel and an open edge. Elderly residents can\'t walk on it. Who gave the digging permission and who restores it?', regionId: 'r_w_kothrud', location: { lat: 18.5064, lng: 73.8031 }, responsible: resp(['p_wo_kothrud', 'p_je_kothrud']), upvotes: ups(4), createdAt: now - 6 * D });
  const pr3 = post({ authorId: 'u_cit3', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Roads', title: 'Broken footpath tiles on FC Road forcing pedestrians onto the road', body: 'Between Goodluck Chowk and the college gate, ~40m of footpath tiles are uprooted. Pedestrians walk on the carriageway in peak traffic.', regionId: 'r_w_shivaji', location: { lat: 18.5236, lng: 73.8412 }, responsible: resp(['p_corp_shivaji', 'p_cityeng']), upvotes: ups(6), createdAt: now - 1.5 * D });
  const pr4 = post({ authorId: 'u_cit4', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Drainage', title: 'Waterlogging at Magarpatta underpass every time it rains', body: 'Knee-deep water within 20 minutes of rain. Storm drain inlet looks blocked with debris. Cars stall daily; ambulances take a 3km detour.', regionId: 'r_w_hadapsar', location: { lat: 18.5143, lng: 73.9262 }, responsible: resp(['p_corp_hadapsar', 'p_je_hadapsar']), upvotes: ups(8), createdAt: now - 9 * D, status: 'in_progress' });
  const pr5 = post({ authorId: 'u_cit5', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Traffic', title: 'Unmarked speed breaker on ITI Road — no paint, no sign board', body: 'New speed breaker near the bakery has no white paint or warning sign. Saw two bikes skid this week.', regionId: 'r_w_aundh', location: { lat: 18.5603, lng: 73.8079 }, responsible: resp(['p_corp_aundh', 'p_trafficdcp']), upvotes: ups(3), createdAt: now - 20 * H });
  const pr6 = post({ authorId: 'u_cit6', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Streetlights', title: 'Streetlights out on Laxmi Road stretch for 2 weeks', body: 'Six consecutive poles are dark near the old temple junction. Road surface is also uneven here, which makes it worse at night.', regionId: 'r_w_kasba', location: { lat: 18.5165, lng: 73.8565 }, responsible: resp(['p_corp_kasba']), upvotes: ups(2), createdAt: now - 4 * D });
  const pr7 = post({ authorId: 'u_cit7', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Roads', title: 'Kachha road to Wagholi school turns to mud in monsoon', body: 'The 800m approach road to the ZP school is unpaved. Children walk through mud; school vans refuse to come in. Requested concreting in last Gram Sabha.', regionId: 'r_gp_wagholi', location: { lat: 18.5812, lng: 73.9822 }, responsible: resp(['p_sarpanch_wagholi', 'p_bdo']), upvotes: ups(5), createdAt: now - 12 * D, status: 'in_progress' });
  const pr8 = post({ authorId: 'u_cit8', actingAs: { type: 'citizen' }, tag: 'problem', category: 'Roads', title: 'Expansion joint gap on Hadapsar flyover is widening', body: 'The metal joint at the Solapur Road end has a visible gap and loud bang when trucks pass. Could be a safety issue — needs inspection.', regionId: 'r_w_hadapsar', location: { lat: 18.5019, lng: 73.9312 }, responsible: resp(['p_cityeng', 'p_je_hadapsar'], 'user'), upvotes: ups(4), createdAt: now - 2 * D });

  post({ authorId: 'u_cit3', actingAs: { type: 'citizen' }, tag: 'normal', title: 'Shivajinagar residents meet-up on road safety this Sunday', body: 'A few of us are mapping the worst crossings around the bus stand. Join at the library steps, 9am. Bring photos of problem spots so we can file them here.', regionId: 'r_w_shivaji', upvotes: ups(3), createdAt: now - 10 * H });
  post({ authorId: 'u_cit5', actingAs: { type: 'citizen' }, tag: 'normal', title: 'Thank you to whoever fixed the Baner Road signal timer', body: 'The countdown timer is working again after months. Small fix, big difference for crossing pedestrians.', regionId: 'r_w_aundh', upvotes: ups(2), createdAt: now - 30 * H });

  // Progress (purple) by positions
  const prog1 = post({ authorId: 'u_je_hadapsar', actingAs: { type: 'position', id: 'p_je_hadapsar' }, tag: 'progress', title: 'Magarpatta underpass: drain inlet cleared, pump installed', body: 'Debris removed from 3 storm-drain inlets. A temporary 10HP dewatering pump is stationed during rain. Permanent fix (wider culvert) is included in the Hadapsar drainage project — tender closes next week.', regionId: 'r_w_hadapsar', linkedProblemIds: [pr4.id], upvotes: ups(5), createdAt: now - 5 * D });
  const prog2 = post({ authorId: 'u_sarpanch_wagholi', actingAs: { type: 'position', id: 'p_sarpanch_wagholi' }, tag: 'progress', title: 'School approach road: concreting approved, work starts Monday', body: 'Gram Sabha resolution passed. Work awarded to Patil & Sons Civil Works under the block roads scheme. Expected completion: 45 days.', regionId: 'r_gp_wagholi', linkedProblemIds: [pr7.id], mentions: [{ type: 'contractor', id: 'c_patil' }], upvotes: ups(6), createdAt: now - 7 * D });
  pr4.respondedByPositions = ['p_je_hadapsar']; pr4.viewedByPositions = ['p_je_hadapsar', 'p_corp_hadapsar'];
  pr7.respondedByPositions = ['p_sarpanch_wagholi']; pr7.viewedByPositions = ['p_sarpanch_wagholi'];
  pr1.viewedByPositions = ['p_je_kothrud'];

  // Admin posts
  post({ authorId: 'u_admin', actingAs: { type: 'admin' }, tag: 'position_change', title: 'New Junior Engineer (Roads) for Kothrud Ward', body: 'Pooja Wagh has taken charge as Junior Engineer (Roads), Kothrud Ward, replacing the previous officer who was transferred. Road complaints in Kothrud will now route to her.', regionId: 'r_w_kothrud', mentions: [{ type: 'position', id: 'p_je_kothrud' }], upvotes: ups(2), createdAt: now - 14 * D });
  post({ authorId: 'u_admin', actingAs: { type: 'admin' }, tag: 'election', title: 'PMC General Elections: what your Corporator is responsible for', body: 'Ahead of the municipal elections: Corporators handle ward roads, drainage, streetlights and sanitation. The Municipal Commissioner (appointed) executes works; the Mayor presides over the General Body. Check your ward page to see current office holders and budgets.', regionId: 'r_pmc', upvotes: ups(6), createdAt: now - 2.5 * D });

  // Comments
  let cc = 0;
  const comment = (postId, authorId, actingAs, body, createdAt) => comments.push({ id: 'cm_' + ++cc, postId, authorId, actingAs, body, createdAt });
  comment(pr1.id, 'u_cit2', { type: 'citizen' }, 'Same on the opposite side near the petrol pump. Almost fell yesterday.', now - 2.5 * D);
  comment(pr1.id, 'u_cit3', { type: 'citizen' }, 'Upvoted. This has been reported at least twice before offline.', now - 2 * D);
  comment(pr4.id, 'u_corp_hadapsar', { type: 'position', id: 'p_corp_hadapsar' }, 'Visited the site with the JE today. Temporary pump arranged; permanent culvert widening is in the drainage project.', now - 6 * D);
  comment(pr4.id, 'u_cit8', { type: 'citizen' }, 'Pump helped during Tuesday\'s rain. Thank you — please keep it till the permanent fix.', now - 3 * D);
  comment(pr7.id, 'u_c_patil', { type: 'contractor', id: 'c_patil' }, 'Material is on site. Curing will need 2 dry weeks — we will update with photos.', now - 4 * D);
  comment(pr3.id, 'u_cit6', { type: 'citizen' }, 'Also the tactile paving for visually impaired is missing on this stretch.', now - 1 * D);

  // ---------- Projects ----------
  const projects = [
    { id: 'pj_karve', title: 'Karve Road resurfacing — Phase 1 (Nal Stop to SNDT)', description: 'Milling and bituminous resurfacing of 1.2km, pothole patching on service lanes, lane markings.', category: 'Roads', regionId: 'r_w_kothrud', positionId: 'p_corp_kothrud', approvedByPositionId: 'p_commissioner', approvedByUserId: 'u_commissioner', contractorId: null, budget: 3.8, spent: 0, status: 'bidding', linkedProblemIds: [pr1.id], bids: [
      { contractorId: 'c_sahyadri', amount: 3.55, timelineDays: 40, note: 'Night work to avoid traffic', at: now - 1 * D },
      { contractorId: 'c_metro', amount: 3.42, timelineDays: 55, note: 'Includes 2-year defect liability', at: now - 0.8 * D },
      { contractorId: 'c_deccan', amount: 3.71, timelineDays: 35, note: 'Fastest timeline', at: now - 0.5 * D },
    ], startDate: null, endDate: null, createdAt: now - 2 * D },
    { id: 'pj_hadapsar_drain', title: 'Hadapsar storm-water drainage & culvert widening', description: 'Widen culvert at Magarpatta underpass, desilt 2.4km drain line, add 18 new inlets.', category: 'Drainage', regionId: 'r_w_hadapsar', positionId: 'p_corp_hadapsar', approvedByPositionId: 'p_commissioner', approvedByUserId: 'u_commissioner', contractorId: 'c_deccan', budget: 6.2, spent: 1.1, status: 'in_progress', linkedProblemIds: [pr4.id], bids: [
      { contractorId: 'c_deccan', amount: 6.2, timelineDays: 120, note: '', at: now - 40 * D },
      { contractorId: 'c_sahyadri', amount: 6.6, timelineDays: 110, note: '', at: now - 39 * D },
    ], startDate: now - 20 * D, endDate: null, createdAt: now - 45 * D },
    { id: 'pj_wagholi_school', title: 'Wagholi ZP school approach road concreting (800m)', description: 'Cement concrete road with side drains under block roads scheme.', category: 'Roads', regionId: 'r_gp_wagholi', positionId: 'p_sarpanch_wagholi', approvedByPositionId: 'p_bdo', approvedByUserId: 'u_bdo', contractorId: 'c_patil', budget: 0.92, spent: 0.3, status: 'in_progress', linkedProblemIds: [pr7.id], bids: [{ contractorId: 'c_patil', amount: 0.92, timelineDays: 45, note: '', at: now - 9 * D }], startDate: now - 6 * D, endDate: null, createdAt: now - 10 * D },
    { id: 'pj_aundh_footpath', title: 'ITI Road footpath reconstruction', description: 'Rebuilt 1.1km footpath with tactile paving and ramps.', category: 'Roads', regionId: 'r_w_aundh', positionId: 'p_corp_aundh', approvedByPositionId: 'p_cityeng', approvedByUserId: 'u_cityeng', contractorId: 'c_metro', budget: 2.1, spent: 2.04, status: 'completed', linkedProblemIds: [], bids: [{ contractorId: 'c_metro', amount: 2.1, timelineDays: 90, note: '', at: now - 260 * D }], startDate: now - 240 * D, endDate: now - 150 * D, createdAt: now - 270 * D },
  ];
  prog1.projectId = 'pj_hadapsar_drain';
  prog2.projectId = 'pj_wagholi_school';

  // Follows
  const U = (id) => users.find((u) => u.id === id);
  U('u_cit1').following.positions = ['p_corp_kothrud', 'p_je_kothrud', 'p_mla_kothrud', 'p_mayor'];
  U('u_cit1').following.users = ['u_cit2'];
  U('u_cit4').following.positions = ['p_corp_hadapsar', 'p_je_hadapsar'];

  const notifications = [
    { id: 'n_1', userId: 'u_cit4', type: 'progress', text: 'Junior Engineer (Roads), Hadapsar posted a progress update on your problem "Waterlogging at Magarpatta underpass…"', link: '#/post/' + prog1.id, read: false, createdAt: now - 5 * D },
    { id: 'n_2', userId: 'u_cit7', type: 'progress', text: 'Sarpanch, Wagholi posted a progress update on your problem "Kachha road to Wagholi school…"', link: '#/post/' + prog2.id, read: false, createdAt: now - 7 * D },
  ];

  return { version: 1, regions, positions, users, contractors, posts, comments, projects, notifications, sessions: {}, counters: { post: pc, comment: cc, user: 100, notif: 10, project: 10, position: 100, contractor: 10 } };
}
