(() => {
'use strict';
const APP_VERSION = '1.0.7';
const KEY = 'zikr.v1';
const THEMES = {
  AL: '--bg:#F4EEE1;--sf:#FBF8F1;--sf2:#ECE4D3;--ink:#1B2A22;--ink2:#56635A;--line:#DCD2BD;--pri:#1F4D3A;--onpri:#F8F3E7;--pris:#E1E9DD;--acc:#A8874A;--acct:#7A5D27;--hero:#1F4D3A;--onhero:#F8F3E7;--heroacc:#D9BC80;--ok:#2E6F48;--oks:#DFEDE3;--warn:#8A5D0E;--warns:#F3E6CC;--err:#9E3B2C;--errs:#F5DFD9;--scrim:rgba(20,30,25,.45)',
  AD: '--bg:#0E1813;--sf:#15221C;--sf2:#1C2D25;--ink:#EDE6D4;--ink2:#A7B2A7;--line:#2A3C33;--pri:#9CCBB0;--onpri:#0E1813;--pris:#1D3329;--acc:#C8A765;--acct:#D8BA7C;--hero:#1B382B;--onhero:#EDE6D4;--heroacc:#D8BA7C;--ok:#86C9A0;--oks:#183226;--warn:#E3B75E;--warns:#342813;--err:#EE9A89;--errs:#3B1F1A;--scrim:rgba(0,0,0,.6)',
  BL: '--bg:#F6F3EA;--sf:#FFFDF7;--sf2:#ECE8DC;--ink:#141B2D;--ink2:#4E576D;--line:#DAD5C7;--pri:#1B2645;--onpri:#F6F3EA;--pris:#E3E6EE;--acc:#2A9D95;--acct:#17706A;--hero:#1B2645;--onhero:#F6F3EA;--heroacc:#6FD6CC;--ok:#2E6F48;--oks:#DFEDE3;--warn:#8A5D0E;--warns:#F3E6CC;--err:#9E3B2C;--errs:#F5DFD9;--scrim:rgba(15,20,35,.45)',
  BD: '--bg:#0A0F1E;--sf:#111830;--sf2:#18213C;--ink:#ECE9DF;--ink2:#A3AAC0;--line:#253052;--pri:#6FD3C9;--onpri:#0A0F1E;--pris:#16253C;--acc:#5CC6BC;--acct:#7ADBD1;--hero:#18244A;--onhero:#ECE9DF;--heroacc:#7ADBD1;--ok:#86C9A0;--oks:#183226;--warn:#E3B75E;--warns:#342813;--err:#EE9A89;--errs:#3B1F1A;--scrim:rgba(0,0,0,.6)'
};

/* ---------- content ---------- */
const ZIKRS = {
  astaghfirullah: { goal: 100, fr: 'Astaghfirullah', ar: 'أستغفر الله', text: 'أَسْتَغْفِرُ اللَّهَ', tl: 'Astaghfirullâh', tr: 'Je demande pardon à Dieu.' },
  salat: { goal: 100, fr: 'Salât sur le Prophète', ar: 'الصلاة على النبي', text: 'اللَّهُمَّ صَلِّ عَلَى سَيِّدِنَا مُحَمَّدٍ', tl: "Allâhumma salli 'alâ sayyidinâ Muhammad", tr: 'Ô Dieu, prie sur notre maître Muhammad.' },
  tahlil: { goal: 100, fr: 'Lâ ilâha illâ Llâh', ar: 'لا إله إلا الله', text: 'لَا إِلَهَ إِلَّا اللَّهُ', tl: 'Lâ ilâha illâ Llâh', tr: 'Il n’y a de divinité que Dieu.' },
  latif: { goal: 1000, collective: true, fr: 'Yâ Latîf', ar: 'يا لطيف', text: 'يَا لَطِيفُ', tl: 'Yâ Latîf', tr: 'Ô Bienveillant.' }
};
const DAILY = ['astaghfirullah', 'salat', 'tahlil'];
const COLLECTIVE = { id: 'latif', goal: 100000, baseTotal: 65220, participants: 16, roster: [
  { fr: 'Abdoulaye Kane', ar: 'عبد الله كان', n: 2900 }, { fr: 'Aminata Fall', ar: 'أميناتا فال', n: 6500 },
  { fr: 'Awa Seck', ar: 'عوا سيك', n: 4300 }, { fr: 'Cheikh Sy', ar: 'شيخ سي', n: 3600 }] };
const ROSTER = { '771234567': { name: 'Moussa Diop', first: 'Moussa', firstAr: 'موسى', init: 'MD', initAr: 'م' } };

const I18N = {
  fr: {
    dir: 'ltr', lang: 'Français', other: 'العربية', salam: n => `Salam, ${n}`,
    today: "Aujourd'hui", collective: 'Collectif', history: 'Historique', profile: 'Profil',
    step1: 'Étape 1 sur 2', step2: 'Étape 2 sur 2', login: 'Connexion', loginLead: "Entrez le numéro de téléphone que vous avez communiqué au cheikh.",
    phone: 'Numéro de téléphone', cont: 'Continuer', noAccount: 'Pas encore de compte ? Les comptes sont créés par le cheikh.',
    badPhone: 'Ce numéro semble incomplet. Vérifiez et réessayez.',
    enterPw: 'Saisir mon mot de passe', modify: 'Modifier', pw: 'Mot de passe', signIn: 'Se connecter',
    wrongPw: 'Ce mot de passe ne correspond pas. Prenez le temps de réessayer.', forgot: 'Mot de passe oublié ? Le cheikh peut le réinitialiser pour vous.',
    choosePw: 'Choisir mon mot de passe', welcome: n => `Bienvenue ${n}. C'est votre première connexion : choisissez un mot de passe facile à retenir pour vous.`,
    newPw: 'Nouveau mot de passe', confirmPw: 'Confirmer le mot de passe', rule6: 'Au moins 6 caractères', ruleSame: 'Les deux saisies sont identiques', saveEnter: 'Enregistrer et entrer',
    show: 'Afficher le mot de passe', back: 'Retour', upToDate: 'À jour', pendingPill: 'En attente',
    collLive: 'Zikr collectif en cours', of: (a, b) => `${a} sur ${b}`, myDhikr: 'Mes zikrs du jour', doneN: (a, b) => `${a} sur ${b} terminé${a > 1 ? 's' : ''}`,
    done: 'Fait', ongoing: 'En cours', notStarted: 'Pas commencé', waiting: "En attente d'envoi",
    individual: g => `Individuel · objectif ${g}`, collectiveSub: g => `Collectif · objectif ${g}`, translit: 'Translittération', translation: 'Traduction',
    goalReached: 'Objectif atteint', undo: 'Annuler le dernier ajout', lastAdd: n => `Dernier ajout : +${n}`, save: 'Enregistrer', saved: 'Enregistré sur l’appareil',
    collTitle: 'Zikr collectif', myShare: 'Ma part', participants: 'Participants', contribs: 'Contributions', alpha: 'Ordre alphabétique', you: 'Vous', addMine: 'Ajouter ma récitation',
    histTitle: 'Historique', allDone: 'Tout est fait', partial: 'En partie', todayLong: d => `Aujourd'hui, ${d}`, histEmpty: 'Vos récitations enregistrées apparaîtront ici.', collBadge: 'Collectif',
    synced: 'Tout est synchronisé', lastSync: t => `Dernière synchro ${t}`, neverSync: "Pas encore de synchro", syncNow: 'Synchroniser maintenant',
    pendingN: n => `${n} récitation${n > 1 ? 's' : ''} en attente d'envoi`, pendingSub: "Elles partiront automatiquement dès le retour de la connexion.",
    language: 'Langue', arSize: 'Taille du texte arabe', dark: 'Mode sombre', logout: 'Se déconnecter', version: v => `Version ${v}`,
    offline: "Hors ligne · tout est gardé sur l'appareil", offlineColl: 'Le total du zikr collectif sera mis à jour à la prochaine connexion.',
    syncOk: 'Synchronisation réussie', sentN: n => `${n} récitation${n > 1 ? 's' : ''} envoyée${n > 1 ? 's' : ''}`, noNet: 'Pas de connexion pour le moment',
    updTitle: 'Nouvelle version disponible', updBody: "Vos récitations sont déjà enregistrées. La mise à jour recharge l'application.", later: 'Plus tard', update: 'Mettre à jour',
    install: 'Installer Zikr', installSub: "Sur l'écran d'accueil de ce téléphone", inst1: "S'ouvre d'un geste, comme une application", inst2: 'Fonctionne même sans connexion', installBtn: 'Installer',
    iosTitle: "Ajouter Zikr à l'écran d'accueil", close: 'Fermer', iosS1: "Touchez <b>Partager</b> dans la barre de Safari, en bas de l'écran.", iosS2: "Choisissez <b>Sur l'écran d'accueil</b>, puis touchez Ajouter.", iosItem: "Sur l'écran d'accueil",
    initials: u => u.init, userName: u => u.name, first: u => u.first, trLabel: 'Traduction', tlSub: 'Translittération'
  },
  ar: {
    dir: 'rtl', lang: 'Français', other: 'Français', salam: n => `السلام عليكم، ${n}`,
    today: 'اليوم', collective: 'جماعي', history: 'السجل', profile: 'حسابي',
    step1: 'الخطوة 1 من 2', step2: 'الخطوة 2 من 2', login: 'تسجيل الدخول', loginLead: 'أدخل رقم الهاتف الذي أعطيته للشيخ.',
    phone: 'رقم الهاتف', cont: 'متابعة', noAccount: 'ليس لديك حساب بعد؟ الحسابات ينشئها الشيخ.',
    badPhone: 'يبدو أن الرقم غير مكتمل. تحقق وحاول مجددًا.',
    enterPw: 'أدخل كلمة المرور', modify: 'تعديل', pw: 'كلمة المرور', signIn: 'دخول',
    wrongPw: 'كلمة المرور غير مطابقة. خذ وقتك وحاول مرة أخرى.', forgot: 'نسيت كلمة المرور؟ يستطيع الشيخ إعادة تعيينها لك.',
    choosePw: 'اختر كلمة المرور', welcome: n => `مرحبًا ${n}. هذا أول دخول لك: اختر كلمة مرور يسهل عليك تذكرها.`,
    newPw: 'كلمة المرور الجديدة', confirmPw: 'تأكيد كلمة المرور', rule6: '6 أحرف على الأقل', ruleSame: 'الإدخالان متطابقان', saveEnter: 'حفظ ودخول',
    show: 'إظهار كلمة المرور', back: 'رجوع', upToDate: 'محدَّث', pendingPill: 'بانتظار الإرسال',
    collLive: 'ذكر جماعي جارٍ', of: (a, b) => `${a} من ${b}`, myDhikr: 'أذكاري اليوم', doneN: (a, b) => `${a} من ${b} مكتمل`,
    done: 'مكتمل', ongoing: 'جارٍ', notStarted: 'لم يبدأ', waiting: 'بانتظار الإرسال',
    individual: g => `فردي · الهدف ${g}`, collectiveSub: g => `جماعي · الهدف ${g}`, translit: 'النطق بالحروف اللاتينية', translation: 'الترجمة الفرنسية',
    goalReached: 'اكتمل الهدف', undo: 'إلغاء آخر إضافة', lastAdd: n => `آخر إضافة: ${n}+`, save: 'حفظ', saved: 'حُفظ على الجهاز',
    collTitle: 'ذكر جماعي', myShare: 'نصيبي', participants: 'المشاركون', contribs: 'المساهمات', alpha: 'ترتيب أبجدي', you: 'أنت', addMine: 'أضف تلاوتي',
    histTitle: 'السجل', allDone: 'اكتمل كل شيء', partial: 'جزئيًا', todayLong: d => `اليوم، ${d}`, histEmpty: 'ستظهر هنا تلاواتك المحفوظة.', collBadge: 'جماعي',
    synced: 'تمت مزامنة كل شيء', lastSync: t => `آخر مزامنة ${t}`, neverSync: 'لا مزامنة بعد', syncNow: 'زامن الآن',
    pendingN: n => `${n} تلاوة بانتظار الإرسال`, pendingSub: 'ستُرسل تلقائيًا عند عودة الاتصال.',
    language: 'اللغة', arSize: 'حجم الخط العربي', dark: 'الوضع الداكن', logout: 'تسجيل الخروج', version: v => `الإصدار ${v}`,
    offline: 'بلا اتصال · كل شيء محفوظ على الجهاز', offlineColl: 'سيتم تحديث مجموع الذكر الجماعي عند الاتصال التالي.',
    syncOk: 'تمت المزامنة', sentN: n => `أُرسلت ${n} تلاوة`, noNet: 'لا يوجد اتصال حاليًا',
    updTitle: 'إصدار جديد متاح', updBody: 'تلاواتك محفوظة بالفعل. التحديث يعيد تحميل التطبيق.', later: 'لاحقًا', update: 'تحديث',
    install: 'تثبيت Zikr', installSub: 'على الشاشة الرئيسية لهذا الهاتف', inst1: 'يُفتح بلمسة، مثل أي تطبيق', inst2: 'يعمل حتى بدون اتصال', installBtn: 'تثبيت',
    iosTitle: 'إضافة Zikr إلى الشاشة الرئيسية', close: 'إغلاق', iosS1: 'اضغط <b>مشاركة</b> في شريط Safari أسفل الشاشة.', iosS2: 'اختر <b>إضافة إلى الشاشة الرئيسية</b> ثم اضغط إضافة.', iosItem: 'إضافة إلى الشاشة الرئيسية',
    initials: u => u.initAr || u.init, userName: u => u.nameAr || u.name, first: u => u.firstAr || u.first
  }
};

/* ---------- state ---------- */
const blank = () => ({ accounts: {}, session: null, lang: 'fr', dark: false, palette: 'A', arSize: 55, days: {}, pending: 0, lastSync: null, collMine: 0, unsynced: {}, dismissedInstall: false });
let S;
try { S = Object.assign(blank(), JSON.parse(localStorage.getItem(KEY) || '{}')); } catch { S = blank(); }
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch {} };
const t = () => I18N[S.lang];
const $app = document.getElementById('app');
const ui = { phone: '', pw: '', pw2: '', showPw: false, err: '', tr: true, td: false, rec: null, toast: null, update: null, installEvt: null, sheet: null };

/* ---------- helpers ---------- */
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const nf = n => new Intl.NumberFormat('fr-FR').format(n);
const dayKey = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const loc = () => (S.lang === 'ar' ? 'ar-u-nu-latn' : 'fr-FR');
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
const fmtDay = d => { const s = new Intl.DateTimeFormat(loc(), { weekday: 'long', day: 'numeric', month: 'long' }).format(d); return S.lang === 'fr' ? cap(s) : s; };
const online = () => navigator.onLine;
const user = () => S.session && (ROSTER[S.session] || { name: 'Disciple', first: 'Disciple', init: 'D' });
const fmtPhone = d => d.replace(/\D/g, '').slice(0, 9).replace(/^(\d{2})(\d{0,3})(\d{0,2})(\d{0,2}).*/, (m, a, b, c, e) => [a, b, c, e].filter(Boolean).join(' '));
const todayData = () => S.days[dayKey()] || {};
const count = (id, key = dayKey()) => (S.days[key] && S.days[key][id]) || 0;
const goalOf = id => ZIKRS[id].goal;
const collTotal = () => COLLECTIVE.baseTotal + S.collMine;
async function hash(pw, phone) {
  try { const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`zikr:${phone}:${pw}`)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join(''); }
  catch { return 'x' + btoa(unescape(encodeURIComponent(`${phone}:${pw}`))); }
}
const I = {
  back: '<svg class="ico flip" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
  next: '<svg class="ico flip" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 5l7 7-7 7"/></svg>',
  chev: '<svg class="ico chev" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9l6 6 6-6"/></svg>',
  check: (s = 16, w = 2.2) => `<svg class="ico" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>`,
  eye: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  warn: '<svg class="ico" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" style="margin-top:2px"><circle cx="12" cy="12" r="9"/><path d="M12 7.5v5.5M12 16.5v.1"/></svg>',
  undo: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
  plus: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  sync: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18 3v4h-4M6 21v-4h4"/></svg>',
  off: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M3 3l18 18M8.5 16.5a5 5 0 0 1 7 0M5 13a10 10 0 0 1 5.2-2.8M19 13a10 10 0 0 0-2.6-1.9M2 9.5a15 15 0 0 1 4.3-2.7M22 9.5a15 15 0 0 0-10-3.9"/></svg>',
  cloud: '<svg class="ico" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M7 18a4.5 4.5 0 0 1-.6-9 6 6 0 0 1 11.4 1.5A3.8 3.8 0 0 1 17.5 18"/><path d="M12 12v7M9 15l3-3 3 3"/></svg>',
  share: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M7 11H5v10h14V11h-2"/></svg>',
  addbox: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M12 8v8M8 12h8"/></svg>',
  x: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  logo: (s = 48, c = 'var(--pri)', d = 'var(--acc)') => `<svg width="${s}" height="${s}" viewBox="0 0 44 44" fill="none"><circle cx="22" cy="22" r="16" stroke="${c}" stroke-width="2"/><circle cx="22" cy="6" r="4.5" fill="${d}"/></svg>`,
  tab: {
    today: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
    collective: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.4 3.5 5.2"/>',
    history: '<rect x="3.5" y="5" width="17" height="15.5" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
    profile: '<circle cx="12" cy="8.5" r="4"/><path d="M4 21c1-4 4.2-6 8-6s7 2 8 6"/>'
  }
};

/* ---------- data ops ---------- */
function setCount(id, n) {
  const k = dayKey(); const prev = count(id, k);
  S.days[k] = Object.assign({}, S.days[k], { [id]: n });
  if (ZIKRS[id].collective) S.collMine = Math.max(0, S.collMine + (n - prev));
  if (n !== prev) { S.pending += 1; S.unsynced = Object.assign({}, S.unsynced, { [id]: true }); }
  persist();
  if (online()) syncNow(true);
}
function syncNow(silent) {
  if (!online()) { if (!silent) toast(t().noNet, ''); return; }
  const sent = S.pending;
  S.pending = 0; S.unsynced = {}; S.lastSync = Date.now(); persist();
  if (sent > 0) toast(t().syncOk, t().sentN(sent));
  else if (!silent) toast(t().syncOk, '');
  else render();
}
function toast(title, sub) {
  ui.toast = { title, sub }; render();
  clearTimeout(toast.h); toast.h = setTimeout(() => { ui.toast = null; render(); }, 3500);
}
function dayState(key) {
  const d = S.days[key] || {};
  const done = DAILY.filter(id => (d[id] || 0) >= goalOf(id)).length;
  const any = DAILY.some(id => (d[id] || 0) > 0) || (d.latif || 0) > 0;
  return done === DAILY.length ? 'full' : any ? 'part' : 'none';
}
function status(id) {
  const c = count(id), g = goalOf(id);
  if (c >= g) return ['ok', t().done, true];
  if (c > 0) return ['warn', t().ongoing, true];
  return ['idle', t().notStarted, false];
}

/* ---------- views ---------- */
const nav = cur => `<nav class="tabs" aria-label="Navigation">${['today', 'collective', 'history', 'profile'].map(k =>
  `<a href="#/${k}" class="${cur === k ? 'on' : ''}" ${cur === k ? 'aria-current="page"' : ''}><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${I.tab[k]}</svg>${t()[k]}</a>`).join('')}</nav>`;
const backBtn = (href) => `<a class="iconbtn" href="${href}" aria-label="${t().back}">${I.back}</a>`;
const offlineBar = () => online() ? '' : `<div class="banner" role="status">${I.off}${t().offline}</div>`;

function vLogin() {
  const T = t();
  return `<main class="screen auth" style="gap:28px">
    <div class="row" style="justify-content:flex-end"><button class="btn ghost small" style="width:auto;padding:0 16px;font-size:16px;height:48px;border-radius:14px" data-a="lang" lang="${S.lang === 'fr' ? 'ar' : 'fr'}">${T.other}</button></div>
    <div class="logo">${I.logo()}<div class="w">Zikr</div></div>
    <div class="col" style="gap:8px"><span class="eyebrow">${T.step1}</span><h1>${T.login}</h1><p class="lead">${T.loginLead}</p></div>
    <label class="field">${T.phone}
      <div class="input ltr ${ui.err ? 'err' : ''}"><span class="pre">+221</span><input id="phone" inputmode="tel" autocomplete="tel-national" placeholder="77 123 45 67" value="${esc(ui.phone)}" autofocus></div>
    </label>
    ${ui.err ? `<div class="alert" role="alert">${I.warn}<span>${ui.err}</span></div>` : ''}
    <button class="btn" data-a="phoneNext">${T.cont}</button>
    <p class="note grow">${T.noAccount}</p></main>`;
}
function vPassword() {
  const T = t(), acc = S.accounts[ui.phone.replace(/\D/g, '')];
  const first = !acc; const u = ROSTER[ui.phone.replace(/\D/g, '')] || { first: 'Disciple', firstAr: 'مريد' };
  const phone = '+221 ' + ui.phone;
  const eye = `<button class="eye" data-a="eye" aria-label="${T.show}" type="button">${I.eye}</button>`;
  const type = ui.showPw ? 'text' : 'password';
  const back = `<button class="iconbtn" data-a="toPhone" aria-label="${T.back}">${I.back}</button>`;
  if (!first) return `<main class="screen auth">
    ${back}
    <div class="col" style="gap:8px;padding-top:40px"><span class="eyebrow">${T.step2}</span><h1>${T.enterPw}</h1></div>
    <div class="recap"><span class="ltr" style="font-size:17px;font-weight:500">${phone}</span><button data-a="toPhone">${T.modify}</button></div>
    <label class="field">${T.pw}<div class="input ${ui.err ? 'err' : ''}"><input id="pw" type="${type}" autocomplete="current-password" value="${esc(ui.pw)}" autofocus>${eye}</div></label>
    ${ui.err ? `<div class="alert" role="alert">${I.warn}<span>${ui.err}</span></div>` : ''}
    <button class="btn" data-a="signIn">${T.signIn}</button>
    <p class="note grow">${T.forgot}</p></main>`;
  const ok6 = ui.pw.length >= 6, same = ui.pw.length > 0 && ui.pw === ui.pw2;
  return `<main class="screen auth" style="gap:22px">
    ${back}
    <div class="col" style="gap:8px;padding-top:24px"><span class="eyebrow">${T.step2}</span><h1>${T.choosePw}</h1><p class="lead">${T.welcome(S.lang === 'ar' ? u.firstAr : u.first)}</p></div>
    <label class="field">${T.newPw}<div class="input"><input id="pw" type="${type}" autocomplete="new-password" value="${esc(ui.pw)}">${eye}</div></label>
    <label class="field">${T.confirmPw}<div class="input"><input id="pw2" type="${type}" autocomplete="new-password" value="${esc(ui.pw2)}"></div></label>
    <div class="checks"><div id="r6" class="${ok6 ? 'on' : ''}">${I.check(20)}${T.rule6}</div><div id="rs" class="${same ? 'on' : ''}">${I.check(20)}${T.ruleSame}</div></div>
    <button class="btn grow" id="createBtn" data-a="create" ${ok6 && same ? '' : 'disabled'}>${T.saveEnter}</button></main>`;
}
function zikrCard(id, cur) {
  const T = t(), z = ZIKRS[id], c = count(id), g = z.goal, [cls, label, started] = status(id);
  const pend = !!(S.unsynced && S.unsynced[id]);
  const name = S.lang === 'ar' ? z.ar : z.fr;
  const badge = pend ? `<span class="badge pend">${T.waiting}</span>` : `<span class="badge ${cls}">${cls === 'ok' ? '' : `<span class="dot ${started ? '' : 'o'}"></span>`}${label}</span>`;
  return `<a class="card ${cur ? 'cur' : ''}" href="#/dhikr/${id}"><div class="row between"><div class="col" style="gap:2px"><span style="font-size:16px;font-weight:600">${name}</span><span class="muted" style="font-size:14px">${T.of(nf(c), nf(g))}</span></div>${badge}</div><div class="bar"><i style="width:${Math.min(c / g, 1) * 100}%"></i></div></a>`;
}
function vToday() {
  const T = t(), u = user(), now = new Date();
  const doneN = DAILY.filter(id => count(id) >= goalOf(id)).length;
  const curId = DAILY.find(id => count(id) > 0 && count(id) < goalOf(id));
  const tot = collTotal(), pct = Math.min(tot / COLLECTIVE.goal, 1);
  const z = ZIKRS.latif;
  const pill = S.pending > 0 ? `<span class="pill pending">${T.pendingPill}</span>` : `<span class="pill">${I.check()}${T.upToDate}</span>`;
  const pendingBox = S.pending > 0 ? `<div class="warnbox">${I.cloud}<div class="col" style="gap:4px"><span style="font-size:16px;font-weight:600">${T.pendingN(S.pending)}</span><span style="font-size:14px;line-height:1.5">${T.pendingSub}</span></div></div>` : '';
  return `${offlineBar()}<main class="screen" style="gap:18px">
    <div class="row between"><div class="col" style="gap:2px"><span class="muted" style="font-size:14px">${fmtDay(now)}</span><span style="font-size:26px;font-weight:600">${T.salam(esc(T.first(u)))}</span></div>${pill}</div>
    ${pendingBox}
    <a class="hero" href="#/collective"><div class="row between"><span class="eb">${T.collLive}</span>${I.next}</div>
      <div class="row between" style="align-items:baseline"><span style="font-size:18px;font-weight:600">${S.lang === 'ar' ? z.ar : z.fr}</span><span class="ar" lang="ar" dir="rtl" style="font-size:30px;line-height:1.4">${z.text}</span></div>
      <div class="bar"><i style="width:${pct * 100}%"></i></div>
      <div class="row between" style="font-size:14px"><span>${T.of(nf(tot), nf(COLLECTIVE.goal))}</span><span style="font-weight:600">${Math.floor(pct * 100)}${S.lang === 'ar' ? '٪' : ' %'}</span></div></a>
    <div class="row between" style="align-items:baseline"><h2 style="font-size:20px;font-weight:600">${T.myDhikr}</h2><span class="muted" style="font-size:14px">${T.doneN(doneN, DAILY.length)}</span></div>
    <div class="col" style="gap:12px">${DAILY.map(id => zikrCard(id, id === curId)).join('')}</div>
    ${!online() ? `<p class="lead" style="font-size:14px">${T.offlineColl}</p>` : ''}
  </main>${nav('today')}`;
}
function vDhikr(id) {
  const T = t(), z = ZIKRS[id]; if (!z) return vToday();
  if (!ui.rec || ui.rec.id !== id) ui.rec = { id, count: count(id), stack: [], saved: false, base: count(id) };
  const name = S.lang === 'ar' ? z.ar : z.fr;
  const scale = 0.8 + (S.arSize / 100) * 0.5;
  return `<main class="screen rec">
    <div class="row">${backBtn(z.collective ? '#/collective' : '#/today')}<div class="col"><span style="font-size:17px;font-weight:600">${name}</span><span class="muted" style="font-size:13px">${z.collective ? T.collectiveSub(z.goal) : T.individual(z.goal)}</span></div></div>
    <div class="arabic" lang="ar" dir="rtl" style="font-size:${Math.round(40 * scale)}px">${z.text}</div>
    <div class="acc"><div class="${ui.tr ? 'open' : ''}"><button data-a="tr" aria-expanded="${ui.tr}"><span>${T.translit}</span>${I.chev}</button>${ui.tr ? `<p class="tl ltr">${esc(z.tl)}</p>` : ''}</div>
    <div class="${ui.td ? 'open' : ''}" style="border-top:1px solid var(--line)"><button data-a="td" aria-expanded="${ui.td}"><span>${T.translation}</span>${I.chev}</button>${ui.td ? `<p>${esc(z.tr)}</p>` : ''}</div></div>
    <div class="counter"><button class="cbtn" data-a="tap" aria-label="+1"><svg width="232" height="232" viewBox="0 0 232 232"><circle cx="116" cy="116" r="108" fill="none" stroke="var(--sf2)" stroke-width="8"/><circle id="dash" cx="116" cy="116" r="108" fill="none" stroke="var(--acc)" stroke-width="8" stroke-linecap="round" transform="rotate(-90 116 116)"/></svg><div class="in"><span class="n" id="cnt" aria-live="polite"></span><span class="s" id="csub"></span></div></button></div>
    <div class="quick"><button class="undo" id="undo" data-a="undo" aria-label="${T.undo}">${I.undo}</button><button data-a="add10">+10</button><button data-a="add100">+100</button></div>
    <span class="last" id="last"></span>
    <button class="btn" id="saveBtn" data-a="saveRec"></button></main>`;
}
function paintRec() {
  const r = ui.rec; if (!r) return; const T = t(), g = goalOf(r.id);
  const C = 678.6, q = id => document.getElementById(id); if (!q('cnt')) return;
  q('cnt').textContent = nf(r.count); q('csub').textContent = r.count >= g ? T.goalReached : T.of('', nf(g)).trim().replace(/^(sur|من)\s*/, '$1 ');
  q('dash').setAttribute('stroke-dasharray', `${Math.min(r.count / g, 1) * C} ${C}`);
  const last = r.stack[r.stack.length - 1];
  q('last').textContent = last ? T.lastAdd(last) : '';
  q('undo').disabled = !r.stack.length;
  q('saveBtn').textContent = r.saved ? T.saved : T.save;
}
function vCollective() {
  const T = t(), tot = collTotal(), pct = Math.min(tot / COLLECTIVE.goal, 1), z = ZIKRS.latif, u = user();
  const rows = COLLECTIVE.roster.map(p => ({ name: S.lang === 'ar' ? p.ar : p.fr, n: p.n }));
  rows.sort((a, b) => a.name.localeCompare(b.name, S.lang === 'ar' ? 'ar' : 'fr'));
  const parts = COLLECTIVE.participants + (S.collMine > 0 ? 1 : 0);
  return `<main class="screen" style="gap:16px;padding-bottom:0">
    <div class="row">${backBtn('#/today')}<span style="font-size:17px;font-weight:600">${T.collTitle}</span></div>
    <div class="col" style="align-items:center;gap:4px"><span class="ar" lang="ar" dir="rtl" style="font-size:40px;line-height:1.5">${z.text}</span><span class="muted" style="font-size:15px">${S.lang === 'ar' ? 'الهدف ' + nf(COLLECTIVE.goal) : `Yâ Latîf · ${z.tr.replace('.', '')}`}</span></div>
    <div class="ring"><svg width="184" height="184" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--sf2)" stroke-width="9"/><circle cx="60" cy="60" r="52" fill="none" stroke="var(--acc)" stroke-width="9" stroke-linecap="round" stroke-dasharray="${pct * 326.7} 327" transform="rotate(-90 60 60)"/></svg>
      <div class="c"><span style="font-size:40px;font-weight:600;line-height:1.1">${Math.floor(pct * 100)}${S.lang === 'ar' ? '٪' : ' %'}</span><span class="muted" style="font-size:13px">${nf(tot)} / ${nf(COLLECTIVE.goal)}</span></div></div>
    <div class="stats"><div class="stat"><span>${T.myShare}</span><span>${nf(S.collMine)}</span></div><div class="stat"><span>${T.participants}</span><span>${T.of(parts, 20)}</span></div></div>
    <div class="row between" style="align-items:baseline"><h2 style="font-size:18px;font-weight:600">${T.contribs}</h2><span class="muted" style="font-size:13px">${T.alpha}</span></div>
    <div class="col"><div class="person me"><span class="av">${esc(T.initials(u))}</span><span class="nm">${T.you}</span><span>${nf(S.collMine)}</span></div>
      ${rows.map(p => `<div class="person"><span class="av">${esc(p.name.charAt(0))}</span><span class="nm">${esc(p.name)}</span><span>${nf(p.n)}</span></div>`).join('')}</div>
    <div class="cta" style="margin-top:auto"><a class="btn" href="#/dhikr/latif" style="text-decoration:none">${I.plus}${T.addMine}</a></div></main>${nav('collective')}`;
}
function vHistory() {
  const T = t(), now = new Date(), keys = Object.keys(S.days).filter(k => Object.keys(S.days[k]).some(i => S.days[k][i] > 0)).sort().reverse();
  const dow = (now.getDay() + 6) % 7, mon = new Date(now); mon.setDate(now.getDate() - dow);
  const wk = [...Array(7)].map((_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return d; });
  const nar = new Intl.DateTimeFormat(loc(), { weekday: 'narrow' });
  const today = dayKey();
  const week = wk.map(d => { const k = dayKey(d), st = dayState(k); return `<div class="${k === today ? 'today' : ''}"><span>${nar.format(d)}</span><span class="d ${st === 'none' ? '' : st}"></span><span>${d.getDate()}</span></div>`; }).join('');
  const groups = keys.map(k => {
    const [y, m, dd] = k.split('-').map(Number), d = new Date(y, m - 1, dd);
    const items = [...DAILY, 'latif'].filter(id => count(id, k) > 0);
    return `<div><span class="dayh">${k === today ? T.todayLong(fmtDay(d)) : fmtDay(d)}</span><div class="list">${items.map(id => {
      const z = ZIKRS[id], nm = S.lang === 'ar' ? z.ar : z.fr;
      return `<div><span>${nm}${z.collective ? `<span class="tag">${T.collBadge}</span>` : ''}</span><b>${nf(count(id, k))}</b></div>`; }).join('')}</div></div>`;
  }).join('');
  return `<main class="screen"><h1>${T.histTitle}</h1>
    <div class="week">${week}</div>
    <div class="legend"><span><i class="d full"></i>${T.allDone}</span><span><i class="d part"></i>${T.partial}</span></div>
    ${groups || `<p class="lead empty">${T.histEmpty}</p>`}</main>${nav('history')}`;
}
function vProfile() {
  const T = t(), u = user();
  const synced = S.pending === 0;
  const lastT = S.lastSync ? new Intl.DateTimeFormat(loc(), { hour: 'numeric', minute: '2-digit' }).format(S.lastSync) : '';
  return `${offlineBar()}<main class="screen" style="gap:14px">
    <div class="row" style="gap:14px"><span class="avatar">${esc(T.initials(u))}</span><div class="col"><span style="font-size:20px;font-weight:600">${esc(T.userName(u))}</span><span class="ltr muted" style="font-size:15px;text-align:start">+221 ${esc(fmtPhone(S.session))}</span></div></div>
    <div class="card sm"><div class="row"><span style="width:36px;height:36px;border-radius:50%;background:${synced ? 'var(--oks)' : 'var(--warns)'};color:${synced ? 'var(--ok)' : 'var(--warn)'};display:flex;align-items:center;justify-content:center">${synced ? I.check(18) : I.cloud}</span>
      <div class="col"><span style="font-size:15px;font-weight:600">${synced ? T.synced : T.pendingN(S.pending)}</span><span class="muted" style="font-size:13px">${S.lastSync ? T.lastSync(lastT) : T.neverSync}</span></div></div>
      <button class="btn ghost small" data-a="sync">${I.sync}${T.syncNow}</button></div>
    <div class="card sm" style="gap:10px"><span style="font-size:15px;font-weight:600">${T.language}</span><div class="seg"><button data-a="setlang" data-v="fr" class="${S.lang === 'fr' ? 'on' : ''}">Français</button><button lang="ar" data-a="setlang" data-v="ar" class="${S.lang === 'ar' ? 'on' : ''}" style="font-size:16px">العربية</button></div></div>
    <div class="card sm" style="gap:8px"><span style="font-size:15px;font-weight:600">${T.arSize}</span><div class="arabic" lang="ar" dir="rtl" id="arPrev" style="font-size:${Math.round(34 * (0.8 + S.arSize / 200))}px;line-height:1.6">سُبْحَانَ اللَّهِ</div>
      <div class="row ltr"><span class="ar" lang="ar" style="width:32px;font-size:18px;text-align:center">أ</span><input type="range" id="arSize" min="0" max="100" value="${S.arSize}" aria-label="${T.arSize}"><span class="ar" lang="ar" style="width:32px;font-size:30px;text-align:center">أ</span></div></div>
    <div class="card sm" style="padding-block:0"><button class="setrow" style="border:0;background:none;padding:0" role="switch" aria-checked="${S.dark}" data-a="dark"><span>${T.dark}</span><span class="switch ${S.dark ? 'on' : ''}"><i></i></span></button></div>
    <button class="btn danger" data-a="logout">${T.logout}</button>
    <span class="muted" style="font-size:13px;text-align:center">${T.version(APP_VERSION)}</span></main>${nav('profile')}`;
}
function overlays() {
  const T = t(); let h = '';
  if (ui.toast) h += `<div class="toast" role="status"><span class="ok">${I.check(18)}</span><div class="col"><span style="font-size:15px;font-weight:600">${esc(ui.toast.title)}</span>${ui.toast.sub ? `<span class="muted" style="font-size:13px">${esc(ui.toast.sub)}</span>` : ''}</div></div>`;
  if (ui.update) h += `<div class="upd" role="alertdialog"><div class="col" style="gap:2px"><span style="font-size:16px;font-weight:600">${T.updTitle}</span><span style="font-size:14px;line-height:1.5;opacity:.9">${T.updBody}</span></div><div class="row" style="gap:8px"><button class="btn ghost small" data-a="updLater">${T.later}</button><button class="btn solid small" data-a="updNow">${T.update}</button></div></div>`;
  if (ui.sheet === 'android') h += `<div class="scrim" data-a="installLater"></div><div class="sheet" role="dialog" aria-modal="true"><span class="grab"></span>
    <div class="row" style="gap:16px"><span class="appico">${I.logo(40, 'var(--onhero)', 'var(--heroacc)')}</span><div class="col" style="gap:2px"><span style="font-size:20px;font-weight:600">${T.install}</span><span class="muted" style="font-size:14px">${T.installSub}</span></div></div>
    <div class="col" style="gap:10px;font-size:15px;line-height:1.5"><div class="row" style="gap:10px;color:var(--ok)">${I.check(20, 2.2)}<span style="color:var(--ink)">${T.inst1}</span></div><div class="row" style="gap:10px;color:var(--ok)">${I.check(20, 2.2)}<span style="color:var(--ink)">${T.inst2}</span></div></div>
    <div class="row" style="gap:10px"><button class="btn ghost" style="font-size:16px" data-a="installLater">${T.later}</button><button class="btn" style="font-size:16px" data-a="installNow">${T.installBtn}</button></div></div>`;
  if (ui.sheet === 'ios') h += `<div class="scrim" data-a="installLater"></div><div class="ios" role="dialog" aria-modal="true">
    <div class="row between" style="align-items:flex-start"><span style="font-size:20px;font-weight:600;line-height:1.3">${T.iosTitle}</span><button class="iconbtn" style="width:44px;height:44px;border:0;margin:-8px" data-a="installLater" aria-label="${T.close}">${I.x}</button></div>
    <div class="step"><span class="n">1</span><div class="col"><span>${T.iosS1}</span><span class="mock">${I.share}</span></div></div>
    <div class="step"><span class="n">2</span><div class="col"><span>${T.iosS2}</span><span class="mock wide">${T.iosItem}${I.addbox}</span></div></div></div>`;
  return h;
}

/* ---------- render / router ---------- */
let routeName = 'login', routeArg = '';
function route() {
  const h = location.hash.replace(/^#\/?/, '').split('/');
  const wasRec = ui.rec; const next = h[0] || 'today';
  if (wasRec && !(next === 'dhikr' && h[1] === wasRec.id)) commitRec();
  if (!S.session && next !== 'login') { routeName = 'login'; if (!ui.step) ui.step = 'phone'; }
  else if (S.session && next === 'login') { location.replace('#/today'); return; }
  else { routeName = next; routeArg = h[1] || ''; }
  render();
}
function commitRec() {
  const r = ui.rec; ui.rec = null;
  if (r && r.count !== r.base && !r.saved) setCount(r.id, r.count);
}
function render() {
  const T = t();
  document.documentElement.lang = S.lang; document.documentElement.dir = T.dir;
  const th = THEMES[(S.palette === 'B' ? 'B' : 'A') + (S.dark ? 'D' : 'L')];
  th.split(';').forEach(kv => { const i = kv.indexOf(':'); document.documentElement.style.setProperty(kv.slice(0, i), kv.slice(i + 1)); });
  const meta = document.querySelector('meta[name=theme-color]'); if (meta) meta.content = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim();
  let body;
  if (!S.session) body = ui.step === 'pw' ? vPassword() : vLogin();
  else body = { today: vToday, collective: vCollective, history: vHistory, profile: vProfile }[routeName] ? { today: vToday, collective: vCollective, history: vHistory, profile: vProfile }[routeName]() : routeName === 'dhikr' ? vDhikr(routeArg) : vToday();
  const act = document.activeElement, id = act && act.id, pos = act && act.selectionStart;
  const keepScroll = ($app.querySelector('.screen') || {}).scrollTop || 0;
  $app.innerHTML = body + overlays();
  const sc = $app.querySelector('.screen'); if (sc) sc.scrollTop = keepScroll;
  if (id) { const el = document.getElementById(id); if (el) { el.focus(); try { el.setSelectionRange(pos, pos); } catch {} } }
  if (routeName === 'dhikr' && S.session) paintRec();
}

/* ---------- events ---------- */
$app.addEventListener('input', e => {
  if (e.target.id === 'phone') { ui.phone = fmtPhone(e.target.value); e.target.value = ui.phone; ui.err = ''; }
  else if (e.target.id === 'pw' || e.target.id === 'pw2') {
    ui[e.target.id] = e.target.value; ui.err = '';
    const r6 = document.getElementById('r6'); if (r6) {
      r6.classList.toggle('on', ui.pw.length >= 6); document.getElementById('rs').classList.toggle('on', ui.pw.length > 0 && ui.pw === ui.pw2);
      document.getElementById('createBtn').disabled = !(ui.pw.length >= 6 && ui.pw === ui.pw2);
    }
  } else if (e.target.id === 'arSize') {
    S.arSize = +e.target.value; persist();
    document.getElementById('arPrev').style.fontSize = Math.round(34 * (0.8 + S.arSize / 200)) + 'px';
  }
});
$app.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (e.target.id === 'phone') act('phoneNext'); else if (e.target.id === 'pw') { if (document.getElementById('pw2')) document.getElementById('pw2').focus(); else act('signIn'); } else if (e.target.id === 'pw2') act('create');
});
$app.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (el) act(el.dataset.a, el);
});
async function act(a, el) {
  const T = t(), r = ui.rec;
  switch (a) {
    case 'lang': S.lang = S.lang === 'fr' ? 'ar' : 'fr'; persist(); return render();
    case 'setlang': S.lang = el.dataset.v; persist(); return render();
    case 'dark': S.dark = !S.dark; persist(); return render();
    case 'phoneNext': if (ui.phone.replace(/\D/g, '').length < 9) { ui.err = T.badPhone; return render(); } ui.step = 'pw'; ui.pw = ''; ui.pw2 = ''; ui.err = ''; return render();
    case 'toPhone': ui.step = 'phone'; ui.err = ''; return render();
    case 'eye': ui.showPw = !ui.showPw; return render();
    case 'signIn': { const p = ui.phone.replace(/\D/g, ''); if (await hash(ui.pw, p) !== S.accounts[p]) { ui.err = T.wrongPw; return render(); } login(p); return; }
    case 'create': { const p = ui.phone.replace(/\D/g, ''); if (ui.pw.length < 6 || ui.pw !== ui.pw2) return; S.accounts[p] = await hash(ui.pw, p); login(p); return; }
    case 'logout': S.session = null; ui.step = 'phone'; ui.phone = ''; persist(); location.hash = '#/login'; return render();
    case 'sync': return syncNow(false);
    case 'tr': ui.tr = !ui.tr; return render();
    case 'td': ui.td = !ui.td; return render();
    case 'tap': if (r) { navigator.vibrate && navigator.vibrate(8); push(1); } return;
    case 'add10': if (r) push(10); return;
    case 'add100': if (r) push(100); return;
    case 'undo': if (r && r.stack.length) { r.count -= r.stack.pop(); r.saved = false; paintRec(); } return;
    case 'saveRec': if (r) { r.stack = []; r.saved = true; r.base = r.count; setCount(r.id, r.count); paintRec(); } return;
    case 'updLater': ui.update = null; return render();
    case 'updNow': if (ui.update) { ui.update.postMessage('SKIP_WAITING'); } return;
    case 'installNow': if (ui.installEvt) { ui.installEvt.prompt(); await ui.installEvt.userChoice.catch(() => {}); ui.installEvt = null; } ui.sheet = null; return render();
    case 'installLater': ui.sheet = null; S.dismissedInstall = true; persist(); return render();
  }
}
function push(n) { const r = ui.rec; n = Math.min(n, goalOf(r.id) - r.count); if (n <= 0) return; r.count += n; r.stack.push(n); r.saved = false; paintRec(); }
function login(p) {
  S.session = p; persist(); ui.step = 'phone'; ui.pw = ui.pw2 = ''; ui.err = '';
  location.hash = '#/today'; route(); maybeInstall();
}
window.addEventListener('hashchange', route);
window.addEventListener('online', () => { syncNow(true); render(); });
window.addEventListener('offline', render);
window.addEventListener('pagehide', () => commitRec());
document.addEventListener('visibilitychange', () => { if (document.hidden) commitRec(); });

/* ---------- install prompts ---------- */
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); ui.installEvt = e; maybeInstall(); });
function maybeInstall() {
  if (!S.session || S.dismissedInstall || standalone() || ui.sheet) return;
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !/crios|fxios/i.test(navigator.userAgent);
  if (ui.installEvt) ui.sheet = 'android'; else if (ios) ui.sheet = 'ios'; else return;
  render();
}

/* ---------- service worker ---------- */
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').then(reg => {
    const watch = w => w && w.addEventListener('statechange', () => { if (w.state === 'installed' && navigator.serviceWorker.controller) { ui.update = w; render(); } });
    if (reg.waiting && navigator.serviceWorker.controller) { ui.update = reg.waiting; render(); }
    reg.addEventListener('updatefound', () => watch(reg.installing));
  }).catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (!reloading) { reloading = true; location.reload(); } });
}

if (!location.hash) location.replace(S.session ? '#/today' : '#/login');
route();
setTimeout(maybeInstall, 1500);
})();
