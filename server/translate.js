// Rule-based English translation for the dataset's Hindi, Marathi and Hinglish texts.
// The dataset uses a small set of sentence patterns; each rule translates one pattern.
// Anything not covered falls back to an English summary built from structured fields.

const DEV = /[\u0900-\u097F]/;
const HINGLISH = /\b(hai|hain|mein|kya|nahi|paani|kab|bhi|aur|ke|ki|ko|se|ho|kar|raha|rahi|gaya|gayi|phir|sab|bhai|yaar|wala|abhi|kuch|log|nahin|aaj|lag|ekdum|hua|toh|tak)\b/i;
export const needsTranslation = (t) => DEV.test(t || '') || HINGLISH.test(t || '');

const LANDMARKS = {
  '\u0930\u0947\u0932\u094D\u0935\u0947 \u0938\u094D\u091F\u0947\u0936\u0928': 'railway station', '\u0930\u0947\u0932\u0935\u0947 \u0938\u094D\u091F\u0947\u0936\u0928': 'railway station', '\u092C\u0938 \u0938\u094D\u091F\u0949\u092A': 'bus stop', '\u092C\u0938 \u0938\u094D\u091F\u0948\u0902\u0921': 'bus stop', '\u092A\u0947\u091F\u094D\u0930\u094B\u0932 \u092A\u0902\u092A': 'petrol pump',
  '\u0938\u093F\u0917\u094D\u0928\u0932': 'signal', '\u092E\u0902\u0926\u093F\u0930': 'temple', '\u092E\u0938\u094D\u091C\u093F\u0926': 'mosque', '\u092E\u0936\u0940\u0926': 'mosque', '\u091A\u0930\u094D\u091A': 'church', '\u092C\u093E\u091C\u093E\u0930': 'market', '\u092C\u093E\u091C\u093E\u0930\u092A\u0947\u0920': 'market', '\u092D\u093E\u091C\u0940 \u092E\u0902\u0921\u0908': 'vegetable market',
  '\u0938\u092C\u094D\u091C\u093C\u0940 \u092E\u0902\u0921\u0940': 'vegetable market', '\u0936\u093E\u0933\u093E': 'school', '\u0938\u094D\u0915\u0942\u0932': 'school', '\u092A\u094B\u0938\u094D\u091F \u0911\u092B\u093F\u0938': 'post office', '\u0939\u0949\u0938\u094D\u092A\u093F\u091F\u0932': 'hospital', '\u0930\u0941\u0917\u094D\u0923\u093E\u0932\u092F': 'hospital', '\u0905\u0938\u094D\u092A\u0924\u093E\u0932': 'hospital',
  '\u092E\u0947\u091F\u094D\u0930\u094B \u0938\u094D\u091F\u0947\u0936\u0928': 'metro station', '\u092B\u094D\u0932\u093E\u092F\u0913\u0935\u094D\u0939\u0930': 'flyover', '\u092B\u094D\u0932\u093E\u0908\u0913\u0935\u0930': 'flyover', '\u092A\u094B\u0932\u0940\u0938 \u091A\u094C\u0915\u0940': 'police chowky', '\u092A\u0941\u0932\u093F\u0938 \u091A\u094C\u0915\u0940': 'police chowky',
  '\u092E\u093E\u0930\u094D\u0915\u0947\u091F': 'market', '\u091A\u093E\u0933 \u0917\u0947\u091F': 'chawl gate', '\u091A\u0949\u0932 \u0917\u0947\u091F': 'chawl gate', '\u092E\u0947\u0921\u093F\u0915\u0932 \u0938\u094D\u091F\u094B\u0905\u0930': 'medical store', '\u092E\u0947\u0921\u093F\u0915\u0932 \u0938\u094D\u091F\u094B\u0930': 'medical store', '\u0939\u0949\u0938\u094D\u092A\u093F\u091F\u0932 \u0917\u0947\u091F': 'hospital gate', '\u092C\u0947\u0938\u094D\u091F \u0921\u0947\u092A\u094B': 'BEST depot', '\u0917\u0923\u092A\u0924\u0940 \u092E\u0902\u0921\u0933 \u092A\u0902\u0921\u093E\u0932': 'Ganpati mandal pandal', '\u092E\u094D\u092F\u0941\u0928\u093F\u0938\u093F\u092A\u0932 \u0936\u093E\u0933\u093E': 'municipal school', '\u0928\u0917\u0930\u092A\u093E\u0932\u093F\u0915\u093E \u0938\u094D\u0915\u0942\u0932': 'municipal school', '\u092A\u094B\u0932\u0940\u0938 \u091A\u094C\u0915\u0940': 'police chowky', '\u092E\u0947\u091F\u094D\u0930\u094B': 'metro',
  mandir: 'temple', masjid: 'mosque', 'Ganpati mandal pandal': 'Ganpati mandal pandal',
};
let localityAlias = {};
export function setLocalityAliases(map) { localityAlias = map; }
const titleCase = (s) => s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Bmc|Best|Sv|Lbs|Lt|Gd|Jvlr|Ss)\b/g, (w) => w.toUpperCase());
const place = (s) => {
  s = s.trim();
  if (!DEV.test(s) && (s === s.toUpperCase() || s === s.toLowerCase())) { const lm = Object.keys(LANDMARKS).find((k) => k.toLowerCase() === s.toLowerCase()); s = lm ? LANDMARKS[lm] : /^(signal|bus stop|petrol pump|market|vegetable market|post office|metro station|railway station|flyover|police chowky|chawl gate|hospital gate|medical store|municipal school|church|mandir|masjid|best depot|ganpati mandal pandal)$/i.test(s) ? s.toLowerCase().replace('best depot', 'BEST depot').replace('ganpati', 'Ganpati') : titleCase(s); }
  if (LANDMARKS[s]) return LANDMARKS[s];
  if (localityAlias[s]) return localityAlias[s];
  for (const [k, v] of Object.entries(localityAlias)) if (DEV.test(k) && s.includes(k)) s = s.replace(k, v);
  for (const [k, v] of Object.entries(LANDMARKS)) if (s.includes(k)) s = s.replace(k, v);
  return s;
};
const the = (s) => (/^(the |[A-Z])/.test(s) ? s : 'the ' + s);

const RULES = [
  [/^(.+?) station road pe itna paani hai ki bus band hai\. BMC kab aayegi\?$/, (a) => `The station road in ${place(a)} is so waterlogged that buses have stopped. When will BMC come?`],
  [/^Kitni baar complaint karein\? (.+?) pe wahi gadda phir se khul gaya$/, (a) => `How many times do we have to complain? The same pothole on ${place(a)} has opened up again.`],
  [/^(.+?) \u0935\u0930 \u0917\u091F\u093E\u0930\u093E\u091A\u0947 \u091D\u093E\u0915\u0923 \u0909\u0918\u0921\u0947 \u0906\u0939\u0947, \u0916\u0942\u092A \u0927\u094B\u0915\u093E\u0926\u093E\u092F\u0915 \u0906\u0939\u0947\.?$/, (a) => `The drain cover on ${place(a)} is open — very dangerous.`],
  [/^(.+?) \u092E\u0927\u094D\u092F\u0947 \u092A\u093E\u0923\u0940 \u0938\u093E\u091A\u0932\u0947 \u0906\u0939\u0947, \u0917\u093E\u0921\u094D\u092F\u093E \u0905\u0921\u0915\u0932\u094D\u092F\u093E \u0906\u0939\u0947\u0924\. \u092A\u0902\u092A \u092A\u093E\u0920\u0935\u093E\.?$/, (a) => `Water has collected in ${place(a)} and vehicles are stuck. Please send a pump.`],
  [/^(.+?) \u092E\u0947\u0902 \u092A\u093E\u0928\u0940 \u092D\u0930 \u0917\u092F\u093E \u0939\u0948, \u090F\u092E\u094D\u092C\u0941\u0932\u0947\u0902\u0938 \u0928\u0939\u0940\u0902 \u0928\u093F\u0915\u0932 \u092A\u093E \u0930\u0939\u0940\.?$/, (a) => `${place(a)} is waterlogged and ambulances can't get through.`],
  [/^(.+?) \u092A\u0930 \u092E\u0948\u0928\u0939\u094B\u0932 \u0916\u0941\u0932\u093E \u0939\u0948, \u092C\u0939\u0941\u0924 \u0916\u0924\u0930\u0928\u093E\u0915 \u0939\u0948\.?$/, (a) => `There's an open manhole on ${place(a)} — very dangerous.`],
  [/^(.+?) mein (.+?) ke saamne paani bhar gaya hai ghutne tak, gaadi nahi nikal rahi$/, (a, b) => `Knee-deep water in front of ${the(place(b))} in ${place(a)}; vehicles can't get through.`],
  [/^(.+?) ke paas gutter ka dhakkan khula hai, paani mein dikh nahi raha\. Koi gir jayega$/, (a) => `The gutter cover near ${the(place(a))} is open and hidden under the water. Someone will fall in.`],
  [/^Bhai (.+?) pe (.+?) ke paas bahut bada khadda hai, roz koi na koi girta hai\. Please jaldi theek karo$/, (a, b) => `There's a huge pothole on ${place(a)} near ${the(place(b))} — someone falls every day. Please fix it soon.`],
  [/^(.+?) \u0938\u092E\u094B\u0930 \u0916\u0921\u094D\u0921\u0947 \u092C\u0941\u091C\u0935\u0932\u0947 \u0939\u094B\u0924\u0947 \u092A\u0923 \u092A\u0941\u0928\u094D\u0939\u093E \u0909\u0916\u0921\u0932\u0947\. \u0915\u093E\u092E \u0928\u093F\u0915\u0943\u0937\u094D\u091F \u0926\u0930\u094D\u091C\u093E\u091A\u0947 \u0906\u0939\u0947\.?$/, (a) => `The potholes in front of ${the(place(a))} were filled but have broken open again. The work is poor quality.`],
  [/^(.+?) \u091C\u0935\u0933 \u0930\u0938\u094D\u0924\u094D\u092F\u093E\u0935\u0930 \u092E\u094B\u0920\u093E \u0916\u0921\u094D\u0921\u093E \u0906\u0939\u0947, (.+?)\. \u0932\u0935\u0915\u0930 \u0926\u0941\u0930\u0941\u0938\u094D\u0924 \u0915\u0930\u093E\.?$/, (a, b) => `Big pothole on the road near ${the(place(a))}, ${place(b)}. Please repair it soon.`],
  [/^(.+?) \u0915\u0947 \u092A\u093E\u0938 \u0938\u0921\u093C\u0915 \u092A\u0930 \u092C\u0921\u093C\u093E \u0917\u0921\u094D\u0922\u093E \u0939\u0948, (.+?)\. \u091C\u0932\u094D\u0926\u0940 \u0920\u0940\u0915 \u0915\u0930\u0947\u0902\.?$/, (a, b) => `Big pothole on the road near ${the(place(a))}, ${place(b)}. Please fix it soon.`],
  // social posts
  [/^(.+?) mein phir se paani bhar gaya (🌊) har saal same story\. Kab sudhrega\? (#\S+)$/, (a, e, h) => `${place(a)} is flooded again ${e} Same story every year. When will it improve? ${h}`],
  [/^(.+?) — road dhas gaya hai, pipeline phuti lag rahi hai\. Barricade bhi nahi hai$/, (a) => `${place(a)} — the road has caved in; looks like a burst pipeline. There's no barricade either.`],
  [/^Good morning group (🌞) aaj school band hai kya\? (.+?) mein paani hai$/, (e, a) => `Good morning group ${e} Are schools closed today? There's water in ${place(a)}.`],
  [/^Society group fwd: (.+?) pe bada gaddha, ek bike wala gira kal raat\. Share karo taaki BMC dekhe (.*)$/, (a, e) => `Society group forward: big pothole on ${place(a)} — a biker fell last night. Please share so BMC sees it ${e}`],
  [/^Kya mast swimming pool banaya hai BMC ne (.+?) mein (😂😂) (#\S+)$/, (a, e, h) => `What a lovely swimming pool BMC has built in ${place(a)} ${e} ${h}`],
  [/^(@mybmc @mybmcRoads) bhai (.+?) ka (.+?) dekho ek baar, khadde mein road hai ya road mein khadda (\S+) (#\S+)$/, (m, a, b, e, h) => `${m} please take one look at ${place(b)} in ${place(a)} — is the road in the pothole or the pothole in the road? ${e} ${h}`],
  [/^(.+?) \u092A\u093E\u0936\u0940 \u0916\u0921\u094D\u0921\u0947 \u0907\u0924\u0915\u0947 \u0906\u0939\u0947\u0924 \u0915\u0940 \u0930\u093F\u0915\u094D\u0937\u093E\u0935\u093E\u0932\u0947 \u092A\u0923 \u0928\u093E\u0939\u0940 \u092E\u094D\u0939\u0923\u0924\u093E\u0924 (😡) (@\S+)$/, (a, e, m) => `So many potholes near ${the(place(a))} that even rickshaw drivers refuse to go there ${e} ${m}`],
];

export function translate(text) {
  const t = (text || '').trim();
  if (!needsTranslation(t)) return null;
  for (const [re, fn] of RULES) { const m = t.match(new RegExp(re.source, 'i')); if (m) { const out = fn(...m.slice(1)); return /[\u0900-\u097F]/.test(out) ? null : out; } }
  return null;
}
export const LANG_NAMES = { 'hi-en': 'Hinglish', hi: 'Hindi', mr: 'Marathi', en: 'English' };
export function guessLang(t) { return /[\u0900-\u097F]/.test(t) ? (/(\u0906\u0939\u0947|\u092E\u0927\u094D\u092F\u0947|\u0935\u0930 |\u091C\u0935\u0933|\u0938\u092E\u094B\u0930|\u092A\u093E\u0936\u0940)/.test(t) ? 'mr' : 'hi') : 'hi-en'; }
