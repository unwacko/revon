// Rule-based English translation for the dataset's Hindi, Marathi and Hinglish texts.
// The dataset uses a small set of sentence patterns; each rule translates one pattern.
// Anything not covered falls back to an English summary built from structured fields.

const DEV = /[ऀ-ॿ]/;
const HINGLISH = /\b(hai|hain|mein|kya|nahi|paani|kab|bhi|aur|ke|ki|ko|se|ho|kar|raha|rahi|gaya|gayi|phir|sab|bhai|yaar|wala|abhi|kuch|log|nahin|aaj|lag|ekdum|hua|toh|tak)\b/i;
export const needsTranslation = (t) => DEV.test(t || '') || HINGLISH.test(t || '');

const LANDMARKS = {
  'रेल्वे स्टेशन': 'railway station', 'रेलवे स्टेशन': 'railway station', 'बस स्टॉप': 'bus stop', 'बस स्टैंड': 'bus stop', 'पेट्रोल पंप': 'petrol pump',
  'सिग्नल': 'signal', 'मंदिर': 'temple', 'मस्जिद': 'mosque', 'मशीद': 'mosque', 'चर्च': 'church', 'बाजार': 'market', 'बाजारपेठ': 'market', 'भाजी मंडई': 'vegetable market',
  'सब्ज़ी मंडी': 'vegetable market', 'शाळा': 'school', 'स्कूल': 'school', 'पोस्ट ऑफिस': 'post office', 'हॉस्पिटल': 'hospital', 'रुग्णालय': 'hospital', 'अस्पताल': 'hospital',
  'मेट्रो स्टेशन': 'metro station', 'फ्लायओव्हर': 'flyover', 'फ्लाईओवर': 'flyover', 'पोलीस चौकी': 'police chowky', 'पुलिस चौकी': 'police chowky',
  'मार्केट': 'market', 'चाळ गेट': 'chawl gate', 'चॉल गेट': 'chawl gate', 'मेडिकल स्टोअर': 'medical store', 'मेडिकल स्टोर': 'medical store', 'हॉस्पिटल गेट': 'hospital gate', 'बेस्ट डेपो': 'BEST depot', 'गणपती मंडळ पंडाल': 'Ganpati mandal pandal', 'म्युनिसिपल शाळा': 'municipal school', 'नगरपालिका स्कूल': 'municipal school', 'पोलीस चौकी': 'police chowky', 'मेट्रो': 'metro',
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
  [/^(.+?) वर गटाराचे झाकण उघडे आहे, खूप धोकादायक आहे\.?$/, (a) => `The drain cover on ${place(a)} is open — very dangerous.`],
  [/^(.+?) मध्ये पाणी साचले आहे, गाड्या अडकल्या आहेत\. पंप पाठवा\.?$/, (a) => `Water has collected in ${place(a)} and vehicles are stuck. Please send a pump.`],
  [/^(.+?) में पानी भर गया है, एम्बुलेंस नहीं निकल पा रही\.?$/, (a) => `${place(a)} is waterlogged and ambulances can't get through.`],
  [/^(.+?) पर मैनहोल खुला है, बहुत खतरनाक है\.?$/, (a) => `There's an open manhole on ${place(a)} — very dangerous.`],
  [/^(.+?) mein (.+?) ke saamne paani bhar gaya hai ghutne tak, gaadi nahi nikal rahi$/, (a, b) => `Knee-deep water in front of ${the(place(b))} in ${place(a)}; vehicles can't get through.`],
  [/^(.+?) ke paas gutter ka dhakkan khula hai, paani mein dikh nahi raha\. Koi gir jayega$/, (a) => `The gutter cover near ${the(place(a))} is open and hidden under the water. Someone will fall in.`],
  [/^Bhai (.+?) pe (.+?) ke paas bahut bada khadda hai, roz koi na koi girta hai\. Please jaldi theek karo$/, (a, b) => `There's a huge pothole on ${place(a)} near ${the(place(b))} — someone falls every day. Please fix it soon.`],
  [/^(.+?) समोर खड्डे बुजवले होते पण पुन्हा उखडले\. काम निकृष्ट दर्जाचे आहे\.?$/, (a) => `The potholes in front of ${the(place(a))} were filled but have broken open again. The work is poor quality.`],
  [/^(.+?) जवळ रस्त्यावर मोठा खड्डा आहे, (.+?)\. लवकर दुरुस्त करा\.?$/, (a, b) => `Big pothole on the road near ${the(place(a))}, ${place(b)}. Please repair it soon.`],
  [/^(.+?) के पास सड़क पर बड़ा गड्ढा है, (.+?)\. जल्दी ठीक करें\.?$/, (a, b) => `Big pothole on the road near ${the(place(a))}, ${place(b)}. Please fix it soon.`],
  // social posts
  [/^(.+?) mein phir se paani bhar gaya (🌊) har saal same story\. Kab sudhrega\? (#\S+)$/, (a, e, h) => `${place(a)} is flooded again ${e} Same story every year. When will it improve? ${h}`],
  [/^(.+?) — road dhas gaya hai, pipeline phuti lag rahi hai\. Barricade bhi nahi hai$/, (a) => `${place(a)} — the road has caved in; looks like a burst pipeline. There's no barricade either.`],
  [/^Good morning group (🌞) aaj school band hai kya\? (.+?) mein paani hai$/, (e, a) => `Good morning group ${e} Are schools closed today? There's water in ${place(a)}.`],
  [/^Society group fwd: (.+?) pe bada gaddha, ek bike wala gira kal raat\. Share karo taaki BMC dekhe (.*)$/, (a, e) => `Society group forward: big pothole on ${place(a)} — a biker fell last night. Please share so BMC sees it ${e}`],
  [/^Kya mast swimming pool banaya hai BMC ne (.+?) mein (😂😂) (#\S+)$/, (a, e, h) => `What a lovely swimming pool BMC has built in ${place(a)} ${e} ${h}`],
  [/^(@mybmc @mybmcRoads) bhai (.+?) ka (.+?) dekho ek baar, khadde mein road hai ya road mein khadda (\S+) (#\S+)$/, (m, a, b, e, h) => `${m} please take one look at ${place(b)} in ${place(a)} — is the road in the pothole or the pothole in the road? ${e} ${h}`],
  [/^(.+?) पाशी खड्डे इतके आहेत की रिक्षावाले पण नाही म्हणतात (😡) (@\S+)$/, (a, e, m) => `So many potholes near ${the(place(a))} that even rickshaw drivers refuse to go there ${e} ${m}`],
];

export function translate(text) {
  const t = (text || '').trim();
  if (!needsTranslation(t)) return null;
  for (const [re, fn] of RULES) { const m = t.match(new RegExp(re.source, 'i')); if (m) { const out = fn(...m.slice(1)); return /[\u0900-\u097F]/.test(out) ? null : out; } }
  return null;
}
export const LANG_NAMES = { 'hi-en': 'Hinglish', hi: 'Hindi', mr: 'Marathi', en: 'English' };
export function guessLang(t) { return /[ऀ-ॿ]/.test(t) ? (/(आहे|मध्ये|वर |जवळ|समोर|पाशी)/.test(t) ? 'mr' : 'hi') : 'hi-en'; }
