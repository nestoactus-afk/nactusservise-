// ═══════════════════════════════════════════════════════════════
//  NACTUS-UI.JS  v4.1 (Correction Police & Traduction — corrigé)
//  Dark mode · Panel profil · Paramètres · Auth · Sidebar · Toast
//  Compatible avec TOUTES les pages du site.
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/11.2.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from "https://www.gstatic.com/firebasejs/11.2.0/firebase-auth.js";
import { getFirestore, doc, setDoc, getDoc, serverTimestamp }
  from "https://www.gstatic.com/firebasejs/11.2.0/firebase-firestore.js";

// ─── Config Firebase ───────────────────────────────────────────
const CFG = {
  apiKey: "AIzaSyCmUN4AsQ7oryWpF6ULtshkZEOuvFekAOo",
  authDomain: "videome-b7157.firebaseapp.com",
  databaseURL: "https://videome-b7157-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "videome-b7157",
  storageBucket: "videome-b7157.firebasestorage.app",
  messagingSenderId: "365500246890",
  appId: "1:365500246890:web:99423413909b9fcc631313",
  measurementId: "G-TB1NDCQT1Q"
};

const app  = getApps().length ? getApps()[0] : initializeApp(CFG);
const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence)
  .catch(err => console.error("Persistence:", err));
const db = getFirestore(app);

window.NACTUS = window.NACTUS || {};
window.NACTUS.firebase = { app, auth, db };

// Getter dynamique pour Appwrite Storage (Firebase Storage désactivé)
Object.defineProperty(window.NACTUS, 'storage', {
  configurable: true,
  get() { return window.NACTUS_STORAGE; }
});

let _user = null;
let _avatarUploading = false;
let _settingsSaving = false;

// ─── Dictionnaire de traduction (i18n) ─────────────────────────
const DICTIONARY = {
  fr: {
    sec_account: "Mon compte",
    sec_rubriques: "Rubriques",
    sec_activity: "Mon activité",
    sec_legal: "Légal",
    nav_settings: "⚙️ Paramètres",
    nav_admin: "Administration",
    nav_dark: "Mode sombre",
    nav_dark_desc: "Thème nuit / jour",
    nav_home: "Accueil",
    nav_sport: "Sport",
    nav_edu: "Éducation",
    nav_pol: "Politique",
    nav_search: "Rechercher",
    nav_fav: "Mes favoris",
    nav_privacy: "Confidentialité",
    btn_logout: "🚪 Se déconnecter",
    btn_login: "🔐 Se connecter",
    btn_register: "✨ Créer un compte",

    settings_saved: "✅ Paramètres enregistrés avec succès.",
    guest_saved: "✅ Préférences enregistrées sur cet appareil.",
    saving: "⏳ Sauvegarde...",
    saved: "✅ Enregistré !",

    avatar_uploading: "⏳ Téléchargement...",
    avatar_updated: "✅ Photo de profil mise à jour !",
    avatar_invalid: "❌ Ce fichier n'est pas une image.",
    avatar_too_large: "❌ Image trop volumineuse (5 Mo maximum).",
    avatar_read_error: "❌ Impossible de lire l'image.",
    avatar_storage_error: "❌ Espace de stockage insuffisant.",
    avatar_upload_error: "❌ Échec du téléversement de l'image.",

    logout_success: "👋 Déconnecté — À bientôt sur NACTUS !",
    logout_title: "Vous quittez NACTUS ?",
    logout_message: "Êtes-vous sûr de vouloir vous déconnecter ?",
    logout_cancel: "Non, rester",
    logout_confirm: "Oui, déconnecter",

    error: "❌ Une erreur est survenue.",
    network_error: "❌ Erreur réseau.",
    permission_error: "❌ Permission refusée.",
    loading_error: "❌ Impossible de charger les données.",
    storage_not_loaded: "❌ Module de stockage non chargé.",

    connected: "Connecté",
    disconnected: "Non connecté",
    loading: "Chargement...",
    guest: "Visiteur",
    user: "Utilisateur",

    save: "💾 Enregistrer les paramètres",
    choose: "📷 Choisir",
    upload: "📤 Téléverser",
    save_settings: "💾 Enregistrer les paramètres",

    firebase_error: "❌ Erreur Firebase.",
    profile_updated: "✅ Profil mis à jour.",

    yes: "Oui",
    no: "Non",
    cancel: "Annuler",
    close: "Fermer",
    back: "Retour",

    settings: "Paramètres",
    appearance: "Apparence",
    profile: "Profil",
    notifications: "Notifications",
    language_region: "Langue & Région",
    privacy_section: "Confidentialité",

    dark_mode: "Mode sombre",
    dark_desc: "Thème nuit / jour",

    font_size: "Taille du texte",
    font_desc: "Agrandir l'interface",
    font_small: "Petit",
    font_normal: "Normal",
    font_large: "Grand",
    font_xlarge: "Très grand",

    display_name: "Nom d'affichage",
    display_placeholder: "Votre nom complet",
    profile_photo: "Photo de profil",
    photo_desc: "JPG, PNG — max 5 Mo",
    choose_photo: "📷 Choisir",

    news_alert: "Alertes nouvelles",
    news_alert_desc: "Articles publiés",
    newsletter: "Newsletter",
    newsletter_desc: "Résumé quotidien",

    language: "Langue",
    french: "🇫🇷 Français",
    english: "🇬🇧 English",

    region: "Région",
    burkina: "🇧🇫 Burkina Faso",
    ivory: "🇨🇮 Côte d'Ivoire",
    senegal: "🇸🇳 Sénégal",
    mali: "🇲🇱 Mali",
    world: "🌍 Monde",

    history: "Historique de lecture",
    history_desc: "Mémoriser les articles lus",
    cookies: "Cookies analytiques",
    cookies_desc: "Améliorer l'expérience",

    privacy_title: "Politique & Confidentialité",
    privacy_intro: "Bienvenue sur NACTUS. La protection de vos données personnelles est notre priorité.",
    privacy_collect_title: "1. Collecte des données",
    privacy_collect_text: "Nous collectons votre nom, votre adresse e-mail, votre photo de profil et vos préférences via Firebase.",
    privacy_storage_title: "2. Stockage local",
    privacy_storage_text: "Nous utilisons localStorage pour mémoriser vos préférences, votre thème et certains paramètres de connexion.",
    privacy_security_title: "3. Sécurité",
    privacy_security_text: "Vos données sont stockées sur Google Cloud (Firebase) et protégées par des règles d'accès sécurisées.",
    privacy_rights_title: "4. Vos droits",
    privacy_rights_text: "Vous pouvez modifier ou supprimer vos données personnelles à tout moment depuis les paramètres de votre compte.",
    privacy_contact_title: "5. Contact",
    privacy_contact_text: "Pour toute question concernant vos données personnelles, contactez-nous à : contact@nactus.bf",

    search_title: "Rechercher un article",
    search_aria: "Rechercher",
    menu_title: "Menu profil",
    menu_aria: "Ouvrir le menu",
    close_aria: "Fermer",
    back_aria: "Retour",
    back_home: "← Retour à l'accueil"
  },

  en: {
    sec_account: "My Account",
    sec_rubriques: "Categories",
    sec_activity: "My Activity",
    sec_legal: "Legal",
    nav_settings: "⚙️ Settings",
    nav_admin: "Administration",
    nav_dark: "Dark Mode",
    nav_dark_desc: "Light / Dark theme",
    nav_home: "Home",
    nav_sport: "Sports",
    nav_edu: "Education",
    nav_pol: "Politics",
    nav_search: "Search",
    nav_fav: "Bookmarks",
    nav_privacy: "Privacy Policy",
    btn_logout: "🚪 Logout",
    btn_login: "🔐 Login",
    btn_register: "✨ Create Account",

    settings_saved: "✅ Settings saved successfully.",
    guest_saved: "✅ Preferences saved on this device.",
    saving: "⏳ Saving...",
    saved: "✅ Saved!",

    avatar_uploading: "⏳ Uploading...",
    avatar_updated: "✅ Profile picture updated!",
    avatar_invalid: "❌ This file is not an image.",
    avatar_too_large: "❌ Image is too large (5 MB max).",
    avatar_read_error: "❌ Unable to read the image.",
    avatar_storage_error: "❌ Not enough local storage.",
    avatar_upload_error: "❌ Failed to upload image.",

    logout_success: "👋 Signed out — See you soon on NACTUS!",
    logout_title: "Leaving NACTUS?",
    logout_message: "Are you sure you want to sign out?",
    logout_cancel: "Stay",
    logout_confirm: "Yes, sign out",

    error: "❌ An error occurred.",
    network_error: "❌ Network error.",
    permission_error: "❌ Permission denied.",
    loading_error: "❌ Unable to load data.",
    storage_not_loaded: "❌ Storage module not loaded.",

    connected: "Connected",
    disconnected: "Disconnected",
    loading: "Loading...",
    guest: "Guest",
    user: "User",

    save: "💾 Save settings",
    choose: "📷 Choose",
    upload: "📤 Upload",
    save_settings: "💾 Save settings",

    firebase_error: "❌ Firebase error.",
    profile_updated: "✅ Profile updated.",

    yes: "Yes",
    no: "No",
    cancel: "Cancel",
    close: "Close",
    back: "Back",

    settings: "Settings",
    appearance: "Appearance",
    profile: "Profile",
    notifications: "Notifications",
    language_region: "Language & Region",
    privacy_section: "Privacy",

    dark_mode: "Dark Mode",
    dark_desc: "Light / Dark theme",

    font_size: "Text size",
    font_desc: "Increase interface size",
    font_small: "Small",
    font_normal: "Normal",
    font_large: "Large",
    font_xlarge: "Extra Large",

    display_name: "Display name",
    display_placeholder: "Your full name",
    profile_photo: "Profile picture",
    photo_desc: "JPG, PNG — max 5 MB",
    choose_photo: "📷 Choose",

    news_alert: "Breaking news alerts",
    news_alert_desc: "Published articles",
    newsletter: "Newsletter",
    newsletter_desc: "Daily summary",

    language: "Language",
    french: "🇫🇷 French",
    english: "🇬🇧 English",

    region: "Region",
    burkina: "🇧🇫 Burkina Faso",
    ivory: "🇨🇮 Côte d'Ivoire",
    senegal: "🇸🇳 Senegal",
    mali: "🇲🇱 Mali",
    world: "🌍 World",

    history: "Reading history",
    history_desc: "Remember viewed articles",
    cookies: "Analytics cookies",
    cookies_desc: "Improve your experience",

    privacy_title: "Privacy Policy",
    privacy_intro: "Welcome to NACTUS. Protecting your personal data is our priority.",
    privacy_collect_title: "1. Data Collection",
    privacy_collect_text: "We collect your name, email address, profile picture and preferences through Firebase.",
    privacy_storage_title: "2. Local Storage",
    privacy_storage_text: "We use localStorage to remember your preferences, theme and certain login settings.",
    privacy_security_title: "3. Security",
    privacy_security_text: "Your data is stored on Google Cloud (Firebase) and protected by secure access rules.",
    privacy_rights_title: "4. Your Rights",
    privacy_rights_text: "You can modify or delete your personal data at any time from your account settings.",
    privacy_contact_title: "5. Contact",
    privacy_contact_text: "If you have any questions about your personal data, contact us at: contact@nactus.bf",

    search_title: "Search an article",
    search_aria: "Search",
    menu_title: "Profile menu",
    menu_aria: "Open menu",
    close_aria: "Close",
    back_aria: "Back",
    back_home: "← Back to home"
  }
};

/**
 * Applique la langue à la page active et la sauvegarde localement.
 * Ne s'occupe QUE du rendu — la persistance (visiteur vs connecté) est
 * gérée par doSaveSettings()/refreshAuthUI(), pas ici, pour éviter deux
 * sources de vérité (voir init()).
 */
let _currentLang = "fr";
function t(key) {
  return (DICTIONARY[_currentLang] && DICTIONARY[_currentLang][key]) || DICTIONARY.fr[key] || key;
}

function applyLanguage(lang = "fr") {
  if (!DICTIONARY[lang]) lang = "fr";
  _currentLang = lang;
  document.documentElement.lang = lang;

  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.dataset.i18n;
    if (DICTIONARY[lang][key]) el.textContent = DICTIONARY[lang][key];
  });
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.dataset.i18nPlaceholder;
    if (DICTIONARY[lang][key]) el.placeholder = DICTIONARY[lang][key];
  });
  document.querySelectorAll("[data-i18n-title]").forEach(el => {
    const key = el.dataset.i18nTitle;
    if (DICTIONARY[lang][key]) el.title = DICTIONARY[lang][key];
  });
  document.querySelectorAll("[data-i18n-aria]").forEach(el => {
    const key = el.dataset.i18nAria;
    if (DICTIONARY[lang][key]) el.setAttribute('aria-label', DICTIONARY[lang][key]);
  });
  document.querySelectorAll("[data-i18n-value]").forEach(el => {
    const key = el.dataset.i18nValue;
    if (DICTIONARY[lang][key]) el.value = DICTIONARY[lang][key];
  });

  const selector = $('ns-lang');
  if (selector) selector.value = lang;

  // #ns-status affiche un état dynamique (connecté/invité) qui n'est pas
  // un simple libellé statique : on le resynchronise ici pour éviter
  // qu'un changement de langue ne l'écrase avec un texte figé.
  const sd = $('ns-status');
  if (sd) sd.textContent = _user ? t('connected') : t('disconnected');
}

// ─── Helpers ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/[&<>"']/g, m =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ls = {
  get: k => localStorage.getItem(k) || '',
  set: (k,v) => {
    try { localStorage.setItem(k, v); return true; }
    catch (e) { console.warn('NACTUS: échec localStorage.setItem', k, e); return false; }
  },
  del: k => localStorage.removeItem(k)
};

const GUEST_PREFS_KEY = 'nactus_guest_prefs';
function getGuestPrefs() {
  try { return JSON.parse(localStorage.getItem(GUEST_PREFS_KEY) || '{}'); }
  catch (e) { return {}; }
}
function setGuestPrefs(prefs) {
  return ls.set(GUEST_PREFS_KEY, JSON.stringify(prefs));
}

function compressImage(file, maxWidth = 200) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ratio = maxWidth / img.width;
        canvas.width = maxWidth;
        canvas.height = img.height * ratio;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error(t('avatar_invalid')));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error(t('avatar_read_error')));
    reader.readAsDataURL(file);
  });
}

async function waitStorage(timeout = 5000) {
  const start = Date.now();
  while (!window.NACTUS_STORAGE) {
    if (Date.now() - start > timeout) throw new Error(t('storage_not_loaded'));
    await new Promise(r => setTimeout(r, 100));
  }
  return window.NACTUS_STORAGE;
}

// ─── Toast ─────────────────────────────────────────────────────
function toast(msg, dur=2800) {
  let t = $('nactus-toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(t._t);
  t._t = setTimeout(() => t.classList.remove('show'), dur);
}
window.NACTUS.toast = toast;

// ─── Theme & Police ────────────────────────────────────────────
function applyDark(on) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  ls.set('nactus_dark', on ? '1' : '0');
  const q = $('ns-dark-q'), s = $('ns-dark-s');
  if (q) q.checked = on;
  if (s) s.checked = on;
}

function applyFont(v) {
  // Appliqué à documentElement (HTML) pour que les unités 'rem' suivent.
  document.documentElement.style.fontSize = v + 'px';
  ls.set('nactus_font', v);
  const sel = $('ns-font');
  if (sel) sel.value = v;
}

function initTheme() {
  const dark = ls.get('nactus_dark') === '1';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const fs = ls.get('nactus_font');
  document.documentElement.style.fontSize = (fs || '16') + 'px';
}

// ─── Avatar ────────────────────────────────────────────────────
function setAvatar(src) {
  const inner = src ? `<img src="${esc(src)}" alt="avatar">` : '🧑';
  const ids = ['ns-avatar-main','ns-avatar-sm'];
  ids.forEach(id => { const e = $(id); if (e) e.innerHTML = inner; });
}

// ─── Panel open/close ──────────────────────────────────────────
function openPanel() {
  const p = $('nactus-sidebar'), o = $('nactus-overlay');
  if (!p || !o) return;
  p.classList.add('open');
  o.classList.add('open');
  document.body.style.overflow = 'hidden';
  const dark = ls.get('nactus_dark') === '1';
  const q = $('ns-dark-q'), s = $('ns-dark-s');
  if (q) q.checked = dark;
  if (s) s.checked = dark;
}
function closePanel() {
  const p = $('nactus-sidebar'), o = $('nactus-overlay');
  if (p) p.classList.remove('open');
  if (o) o.classList.remove('open');
  document.body.style.overflow = '';
  closeSettings();
}
function openSettings() {
  const sv = $('ns-settings');
  if (!sv) return;
  sv.classList.add('open');
  const dark = ls.get('nactus_dark') === '1';
  const s = $('ns-dark-s');
  if (s) s.checked = dark;
  const fsel = $('ns-font');
  if (fsel) fsel.value = ls.get('nactus_font') || '16';

  if (!_user) {
    const p = getGuestPrefs();
    const lang = $('ns-lang'), region = $('ns-region');
    const news = $('ns-news'), notif = $('ns-notif');
    const hist = $('ns-hist'), cook  = $('ns-cookies');
    const ni = $('ns-name-input');
    if (lang   && p.lang)                     lang.value = p.lang;
    if (region && p.region)                   region.value = p.region;
    if (news   && p.newsletter !== undefined) news.checked = p.newsletter;
    if (notif  && p.notif !== undefined)      notif.checked = p.notif;
    if (hist   && p.history !== undefined)    hist.checked  = p.history;
    if (cook   && p.cookies !== undefined)    cook.checked  = p.cookies;
    if (ni)                                   ni.value = ls.get('nactus_name') || '';
  }
}
function closeSettings() {
  const sv = $('ns-settings');
  if (sv) sv.classList.remove('open');
}

// ─── Modals ────────────────────────────────────────────────────
function openModal(overlayId, cardId) {
  const el = $(overlayId), card = $(cardId);
  if (!el) return;
  el.style.display = 'flex';
  requestAnimationFrame(() => {
    el.style.opacity = '1';
    if (card) card.style.transform = 'scale(1)';
  });
  document.body.style.overflow = 'hidden';
}
function closeModal(overlayId, cardId, defaultTransform='scale(.9)') {
  const el = $(overlayId), card = $(cardId);
  if (!el) return;
  el.style.opacity = '0';
  if (card) card.style.transform = defaultTransform;
  setTimeout(() => { el.style.display = 'none'; }, 260);
  document.body.style.overflow = '';
}

function openLogoutModal() { openModal('ns-logout-modal','ns-logout-card'); }
function closeLogoutModal() { closeModal('ns-logout-modal','ns-logout-card'); }
function openPrivacy() { openModal('ns-privacy-modal','ns-privacy-card'); closePanel(); }
function closePrivacy() { closeModal('ns-privacy-modal','ns-privacy-card','scale(.95)'); }
window.NACTUS.openPrivacy = openPrivacy;

// ─── Auth ──────────────────────────────────────────────────────
async function refreshAuthUI(user) {
  _user = user;
  const isIn = !!user;

  const authIn  = $('ns-auth-in');
  const authOut = $('ns-auth-out');
  if (authIn)  authIn.style.display  = isIn ? 'block' : 'none';
  if (authOut) authOut.style.display = isIn ? 'none'  : 'block';

  const navLogin  = $('nactus-nav-login');
  const navRegister = $('nactus-nav-register');
  if (navLogin)    navLogin.style.display    = isIn ? 'none' : 'flex';
  if (navRegister) navRegister.style.display = isIn ? 'none' : 'flex';

  if (isIn) {
    const name  = user.displayName || ls.get('nactus_name') || t('user');
    const email = user.email || '';
    const nd = $('ns-name-disp');
    const ed = $('ns-email-disp');
    const sd = $('ns-status');
    const dot= $('ns-dot');
    const ni = $('ns-name-input');
    if (nd)  nd.textContent  = name;
    if (ed)  ed.textContent  = email;
    if (sd)  sd.textContent  = t('connected');
    if (dot) dot.style.background = '#4ade80';
    if (ni)  ni.value = name;
    setAvatar(user.photoURL || ls.get('nactus_avatar') || '');

    let isAdmin = false;
    try {
      const snap = await getDoc(doc(db, "users", user.uid));
      if (snap.exists()) isAdmin = snap.data().role === "admin";
    } catch (e) {}

    const al = $("ns-admin-link-wrap");
    if (al) al.style.display = isAdmin ? "block" : "none";

    try {
      const psnap = await getDoc(doc(db,'userPrefs',user.uid));
      if (psnap.exists()) {
        const p = psnap.data();
        if (p.dark !== undefined) applyDark(p.dark);
        if (p.fontSize) applyFont(p.fontSize);
        const lang = $('ns-lang'), region = $('ns-region');
        const news = $('ns-news'), notif = $('ns-notif');
        const hist = $('ns-hist'), cook  = $('ns-cookies');

        if (p.lang) {
          if (lang) lang.value = p.lang;
          applyLanguage(p.lang);
        }
        if (region && p.region)     region.value = p.region;
        if (news   && p.newsletter !== undefined) news.checked = p.newsletter;
        if (notif  && p.notif !== undefined)      notif.checked = p.notif;
        if (hist   && p.history !== undefined)    hist.checked  = p.history;
        if (cook   && p.cookies !== undefined)    cook.checked  = p.cookies;
      }
    } catch(e) { /* silencieux */ }

    document.dispatchEvent(new CustomEvent('nactus:auth', {detail:{user,isAdmin}}));
  } else {
    const nd  = $('ns-name-disp');
    const ed  = $('ns-email-disp');
    const sd  = $('ns-status');
    const dot = $('ns-dot');
    const al  = $('ns-admin-link-wrap');
    if (nd)  nd.textContent  = t('guest');
    if (ed)  ed.textContent  = t('disconnected');
    if (sd)  sd.textContent  = t('disconnected');
    if (dot) dot.style.background = '#f59e0b';
    if (al)  al.style.display = 'none';
    setAvatar(ls.get('nactus_avatar') || '');

    document.dispatchEvent(new CustomEvent('nactus:auth', {detail:{user:null,isAdmin:false}}));
  }
}

async function doLogout() {
  closeLogoutModal();
  try {
    if (_user) await signOut(auth);
    ['nactus_avatar','nactus_name'].forEach(k => ls.del(k));
    setAvatar('');
    closePanel();
    toast(t('logout_success'), 3500);
    if (/admin\.html/.test(window.location.pathname))
      setTimeout(() => window.location.href = 'index.html', 600);
  } catch(e) { toast(t('error') + ' ' + e.message); }
}

async function doSaveSettings() {
  if (_settingsSaving) return;
  const btn = $('ns-save-btn');
  if (!btn) return;
  _settingsSaving = true;
  btn.disabled = true;
  btn.textContent = t('saving');

  const name       = ($('ns-name-input')?.value || '').trim();
  const dark       = $('ns-dark-s')?.checked ?? false;
  const fontSize   = $('ns-font')?.value || '16';
  const lang       = $('ns-lang')?.value || 'fr';
  const region     = $('ns-region')?.value || 'bf';
  const newsletter = $('ns-news')?.checked ?? false;
  const notif      = $('ns-notif')?.checked ?? true;
  const history    = $('ns-hist')?.checked ?? true;
  const cookies    = $('ns-cookies')?.checked ?? true;

  applyDark(dark);
  applyFont(fontSize);
  applyLanguage(lang); // Application immédiate de la langue

  if (name) {
    const nd = $('ns-name-disp');
    if (nd) nd.textContent = name;
    ls.set('nactus_name', name);
  }

  try {
    if (_user) {
      if (name) await updateProfile(_user, { displayName: name });
      await _user.reload();
      await setDoc(doc(db,'userPrefs',_user.uid),
        { dark, fontSize, lang, region, newsletter, notif, history, cookies, updatedAt: serverTimestamp() },
        { merge: true });
    } else {
      // Visiteur : seule source de vérité pour ses préférences (y compris
      // la langue), afin que applyLanguage() n'ait pas à lire une autre clé.
      setGuestPrefs({ lang, region, newsletter, notif, history, cookies });
    }
    btn.textContent = t('saved');
    btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
    toast(_user ? t('settings_saved') : t('guest_saved'));
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = t('save_settings');
      btn.style.background = '';
      _settingsSaving = false;
      closeSettings();
      closePanel();
    }, 1400);
  } catch(e) {
    toast(t('error') + ' ' + e.message);
    btn.disabled = false;
    btn.textContent = t('save_settings');
    btn.style.background = '';
    _settingsSaving = false;
  }
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (_avatarUploading) return;

  if (!file.type || !file.type.startsWith("image/")) {
    toast(t('avatar_invalid'));
    e.target.value = "";
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    toast(t('avatar_too_large'));
    e.target.value = "";
    return;
  }

  _avatarUploading = true;
  const btn = $("ns-avatar-btn");
  if (btn) btn.disabled = true;

  toast(t('avatar_uploading'));

  try {
    let src;
    if (_user) {
      const storage = await waitStorage();
      const { url } = await storage.upload(file, "avatar");
      src = url;

      await updateProfile(_user, { photoURL: src });
      await auth.currentUser.reload();
      _user = auth.currentUser;
    } else {
      src = await compressImage(file, 200);
      if (!ls.set("nactus_avatar", src)) {
        throw new Error(t('avatar_storage_error'));
      }
    }
    setAvatar(src);
    toast(t('avatar_updated'));
  } catch (err) {
    toast(t('error') + ' ' + err.message);
  } finally {
    _avatarUploading = false;
    if (btn) btn.disabled = false;
    e.target.value = "";
  }
}

// ─── CSS injecté ───────────────────────────────────────────────
function injectCSS() {
  if ($('nactus-ui-css')) return;
  const s = document.createElement('style');
  s.id = 'nactus-ui-css';
  s.textContent = `
[data-theme="dark"]{
  --bg:#0d1117;--white:#161b27;--card:#1e2435;
  --ink:#f1f5f9;--ink-soft:#cbd5e1;--muted:#94a3b8;
  --border:#2d3a52;--border-soft:rgba(255,255,255,.06);
  --shadow:0 4px 24px rgba(0,0,0,.35);
  --shadow-lg:0 12px 40px rgba(0,0,0,.5);
}
[data-theme="light"]{
  --bg:#f9f8f6;--white:#ffffff;--card:#ffffff;
  --ink:#0b0f1a;--ink-soft:#374151;--muted:#6b7280;
  --border:#e2e8f0;--border-soft:rgba(0,0,0,.06);
  --shadow:0 4px 24px rgba(11,15,26,.08);
  --shadow-lg:0 12px 40px rgba(11,15,26,.15);
}
html,body{transition:background .3s,color .3s}
body{background:var(--bg)!important;color:var(--ink)!important}
header{transition:background .3s}

#nactus-search-btn{
  display:flex;align-items:center;justify-content:center;
  width:42px;height:42px;border-radius:12px;font-size:17px;
  text-decoration:none;background:var(--card);border:1.5px solid var(--border);
  color:var(--ink);flex-shrink:0;
  transition:all .28s cubic-bezier(.4,0,.2,1);margin-right:8px
}
#nactus-search-btn:hover{border-color:#e85d26;background:rgba(232,93,38,.06);transform:translateY(-2px)}

.nactus-nav-auth-btn{
  display:flex;align-items:center;justify-content:center;
  height:42px;padding:0 18px;border-radius:30px;font-size:13px;font-weight:600;
  text-decoration:none;white-space:nowrap;flex-shrink:0;margin-right:8px;
  transition:all .28s cubic-bezier(.4,0,.2,1);font-family:'Inter',sans-serif
}
.nactus-nav-login{
  background:var(--card,#fff);color:var(--ink,#0b0f1a);
  border:1.5px solid var(--border,#e2e8f0)
}
.nactus-nav-login:hover{border-color:#e85d26;color:#e85d26;transform:translateY(-2px)}
.nactus-nav-register{
  background:linear-gradient(135deg,#e85d26,#f5a623);color:white;border:none;
  box-shadow:0 4px 16px rgba(232,93,38,.32)
}
.nactus-nav-register:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,93,38,.46)}
@media(max-width:640px){
  .nactus-nav-login{display:none!important}
  .nactus-nav-register{padding:0 14px;font-size:12px}
}

#nactus-menu-btn{
  background:linear-gradient(135deg,#e85d26,#f5a623);border:none;cursor:pointer;
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  gap:5px;padding:11px 13px;border-radius:12px;
  box-shadow:0 4px 16px rgba(232,93,38,.38);
  transition:all .28s cubic-bezier(.4,0,.2,1);flex-shrink:0
}
#nactus-menu-btn:hover{transform:translateY(-2px);box-shadow:0 8px 24px rgba(232,93,38,.52)}
#nactus-menu-btn span{display:block;height:2px;background:white;border-radius:3px}
#nactus-menu-btn span:nth-child(1){width:20px}
#nactus-menu-btn span:nth-child(2){width:13px;align-self:flex-start}
#nactus-menu-btn span:nth-child(3){width:20px}

#nactus-overlay{
  position:fixed;inset:0;background:rgba(0,0,0,.5);backdrop-filter:blur(5px);
  z-index:8000;opacity:0;pointer-events:none;transition:opacity .3s
}
#nactus-overlay.open{opacity:1;pointer-events:all}
#nactus-sidebar{
  position:fixed;top:0;right:0;width:340px;max-width:95vw;height:100vh;
  z-index:8001;background:var(--card);
  box-shadow:-10px 0 60px rgba(0,0,0,.25);
  transform:translateX(102%);
  transition:transform .38s cubic-bezier(.4,0,.2,1);
  display:flex;flex-direction:column;overflow:hidden;
  font-family:'Inter',sans-serif
}
#nactus-sidebar.open{transform:translateX(0)}

.ns-head{
  background:linear-gradient(135deg,#e85d26,#f5a623);
  padding:40px 20px 28px;position:relative;text-align:center;flex-shrink:0
}
.ns-close{
  position:absolute;top:14px;right:14px;
  background:rgba(255,255,255,.18);border:1.5px solid rgba(255,255,255,.28);
  color:white;width:32px;height:32px;border-radius:50%;font-size:15px;
  cursor:pointer;display:flex;align-items:center;justify-content:center;transition:.2s
}
.ns-close:hover{background:rgba(255,255,255,.32);transform:scale(1.05)}
.ns-avatar-wrap{position:relative;width:84px;height:84px;margin:0 auto 14px;cursor:pointer}
.ns-avatar{
  width:84px;height:84px;border-radius:50%;border:3px solid rgba(255,255,255,.85);
  background:white;display:flex;align-items:center;justify-content:center;
  font-size:2.2rem;overflow:hidden;box-shadow:0 4px 16px rgba(0,0,0,.2)
}
.ns-avatar img{width:100%;height:100%;object-fit:cover}
.ns-avatar-edit{
  position:absolute;bottom:2px;right:2px;background:white;border-radius:50%;
  width:26px;height:26px;display:flex;align-items:center;justify-content:center;
  font-size:12px;box-shadow:0 2px 8px rgba(0,0,0,.2)
}
.ns-name{color:white;font-weight:700;font-size:1.05rem}
.ns-email{color:rgba(255,255,255,.75);font-size:12px;margin-top:3px}
.ns-badge{
  display:inline-flex;align-items:center;gap:6px;margin-top:10px;
  background:rgba(255,255,255,.16);padding:4px 12px;border-radius:20px;
  font-size:12px;color:white;border:1px solid rgba(255,255,255,.22)
}
.ns-dot{width:6px;height:6px;border-radius:50%;display:inline-block}

.ns-body{flex:1;overflow-y:auto;padding:8px 0}
.ns-section{padding:14px 20px 6px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px}
.ns-item{
  display:flex;align-items:center;gap:14px;width:100%;padding:13px 20px;
  border:none;background:none;cursor:pointer;color:var(--ink-soft);font-size:14px;
  font-weight:500;font-family:inherit;transition:.2s;text-align:left;text-decoration:none
}
.ns-item:hover{background:rgba(232,93,38,.07);color:#e85d26;padding-left:24px}
.ns-icon{width:36px;height:36px;border-radius:10px;display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0}
.ns-divider{height:1px;background:var(--border);margin:6px 20px}

.ns-toggle{position:relative;width:44px;height:24px;flex-shrink:0;cursor:pointer;margin-left:auto}
.ns-toggle input{opacity:0;width:0;height:0;position:absolute}
.ns-toggle-sl{position:absolute;inset:0;background:#cbd5e1;border-radius:30px;transition:.3s}
.ns-toggle-sl::before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:white;border-radius:50%;transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.ns-toggle input:checked+.ns-toggle-sl{background:linear-gradient(135deg,#e85d26,#f5a623)}
.ns-toggle input:checked+.ns-toggle-sl::before{transform:translateX(20px)}

.ns-footer{padding:14px 20px 22px;border-top:1px solid var(--border);flex-shrink:0}
.ns-logout{
  display:flex;align-items:center;justify-content:center;gap:10px;width:100%;
  padding:13px;border-radius:12px;border:1.5px solid #fecaca;background:#fff5f5;
  color:#dc2626;font-size:14px;font-weight:700;cursor:pointer;font-family:inherit;transition:.22s
}
.ns-logout:hover{background:#dc2626;color:white;border-color:#dc2626;transform:translateY(-1px)}
[data-theme="dark"] .ns-logout{background:rgba(220,38,38,.1);border-color:rgba(220,38,38,.3)}
.ns-signin{
  display:flex;align-items:center;justify-content:center;gap:8px;width:100%;padding:13px;
  background:linear-gradient(135deg,#e85d26,#f5a623);color:white;border-radius:12px;
  font-size:14px;font-weight:600;text-decoration:none;transition:.2s
}
.ns-signin:hover{transform:translateY(-2px);opacity:.92}

#ns-settings{
  position:absolute;inset:0;background:var(--card);
  transform:translateX(102%);transition:transform .32s cubic-bezier(.4,0,.2,1);
  display:flex;flex-direction:column;overflow:hidden;z-index:1
}
#ns-settings.open{transform:translateX(0)}
.ns-set-head{display:flex;align-items:center;gap:12px;padding:18px 20px;border-bottom:1px solid var(--border);flex-shrink:0}
.ns-back{background:none;border:none;font-size:24px;cursor:pointer;color:var(--muted);transition:.2s;line-height:1}
.ns-back:hover{color:#e85d26;transform:translateX(-3px)}
.ns-set-title{font-size:16px;font-weight:700;color:var(--ink)}
.ns-set-body{flex:1;overflow-y:auto;padding-bottom:20px}
.ns-set-sec{padding:14px 20px 6px;font-size:11px;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:1.2px}
.ns-row{display:flex;align-items:center;justify-content:space-between;padding:14px 20px;border-bottom:1px solid var(--border)}
.ns-lbl strong{display:block;font-size:13px;color:var(--ink);font-weight:600}
.ns-lbl span{font-size:11px;color:var(--muted);margin-top:1px;display:block}
.ns-sel{padding:7px 10px;border:1.5px solid var(--border);border-radius:8px;background:var(--bg);color:var(--ink);font-size:13px;font-family:inherit;cursor:pointer}
.ns-sel:focus,.ns-input:focus{border-color:#e85d26;outline:none}
.ns-input{width:100%;padding:11px 13px;border:1.5px solid var(--border);border-radius:9px;font-size:13px;background:var(--bg);color:var(--ink);font-family:inherit;margin-top:6px}
.ns-av-sm{width:48px;height:48px;border-radius:50%;border:2px solid var(--border);background:var(--bg);display:flex;align-items:center;justify-content:center;font-size:1.4rem;overflow:hidden;flex-shrink:0}
.ns-av-sm img{width:100%;height:100%;object-fit:cover}
.ns-upload{display:flex;align-items:center;gap:8px;padding:9px 16px;background:linear-gradient(135deg,#e85d26,#f5a623);color:white;border:none;border-radius:30px;font-size:13px;font-weight:600;cursor:pointer;font-family:inherit;transition:.2s}
.ns-upload:hover{opacity:.9;transform:translateY(-1px)}
.ns-upload:disabled{opacity:.6;cursor:not-allowed;transform:none}
.ns-save{
  width:calc(100% - 40px);margin:18px 20px;padding:14px;
  background:linear-gradient(135deg,#e85d26,#f5a623);color:white;border:none;
  border-radius:30px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
  box-shadow:0 6px 20px rgba(232,93,38,.3);transition:.22s
}
.ns-save:hover{opacity:.95;transform:translateY(-2px)}
.ns-save:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none}

#nactus-toast{
  position:fixed;bottom:28px;left:50%;transform:translateX(-50%) translateY(20px);
  z-index:9998;background:var(--ink);color:var(--bg);padding:13px 26px;
  border-radius:50px;font-size:14px;font-weight:500;
  box-shadow:0 8px 28px rgba(0,0,0,.25);opacity:0;
  transition:all .32s cubic-bezier(.175,.885,.32,1.275);
  white-space:nowrap;pointer-events:none;max-width:90vw;
  font-family:'Inter',sans-serif
}
#nactus-toast.show{opacity:1;transform:translateX(-50%) translateY(0)}

.ns-modal-overlay{
  position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.55);backdrop-filter:blur(8px);
  opacity:0;transition:opacity .28s ease
}

.nactus-back-bar{padding:14px 32px 0;background:transparent}
.nactus-back-btn{
  display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:14px;
  font-weight:500;text-decoration:none;padding:8px 18px;border-radius:30px;
  border:1px solid var(--border);background:var(--white);transition:.2s
}
.nactus-back-btn:hover{color:#e85d26;border-color:#e85d26;background:rgba(232,93,38,.05)}
@media(max-width:600px){
  .nactus-back-bar{padding:10px 16px 0}
  #nactus-sidebar{width:100vw}
}
`;
  document.head.appendChild(s);
}

// ─── HTML sidebar + modals + toast ────────────────────────────
function buildUI() {
  if ($('nactus-sidebar')) return;
  const wrap = document.createElement('div');

  wrap.innerHTML = `
<div id="nactus-overlay"></div>

<aside id="nactus-sidebar">
  <div id="ns-settings">
    <div class="ns-set-head">
      <button class="ns-back" id="ns-set-back" aria-label="Retour" data-i18n-aria="back_aria">‹</button>
      <span class="ns-set-title" data-i18n="nav_settings">⚙️ Paramètres</span>
    </div>
    <div class="ns-set-body">
      <div class="ns-set-sec" data-i18n="appearance">Apparence</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="dark_mode">Mode sombre</strong><span data-i18n="dark_desc">Thème nuit / jour</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-dark-s"><div class="ns-toggle-sl"></div></label>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="font_size">Taille du texte</strong><span data-i18n="font_desc">Agrandir l'interface</span></div>
        <select id="ns-font" class="ns-sel">
          <option value="14" data-i18n="font_small">Petit</option><option value="16" selected data-i18n="font_normal">Normal</option>
          <option value="18" data-i18n="font_large">Grand</option><option value="20" data-i18n="font_xlarge">Très grand</option>
        </select>
      </div>

      <div class="ns-set-sec" data-i18n="profile">Profil</div>
      <div class="ns-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div class="ns-lbl"><strong data-i18n="display_name">Nom d'affichage</strong></div>
        <input id="ns-name-input" class="ns-input" type="text" data-i18n-placeholder="display_placeholder" placeholder="Votre nom complet">
      </div>
      <div class="ns-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div class="ns-lbl"><strong data-i18n="profile_photo">Photo de profil</strong><span data-i18n="photo_desc">JPG, PNG — max 5 Mo</span></div>
        <div style="display:flex;align-items:center;gap:10px;width:100%">
          <div class="ns-av-sm" id="ns-avatar-sm">🧑</div>
          <input type="file" id="ns-avatar-file" accept="image/*" style="display:none">
          <button class="ns-upload" id="ns-avatar-btn" data-i18n="choose_photo">📷 Choisir</button>
        </div>
      </div>

      <div class="ns-set-sec" data-i18n="notifications">Notifications</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="news_alert">Alertes nouvelles</strong><span data-i18n="news_alert_desc">Articles publiés</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-notif" checked><div class="ns-toggle-sl"></div></label>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="newsletter">Newsletter</strong><span data-i18n="newsletter_desc">Résumé quotidien</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-news"><div class="ns-toggle-sl"></div></label>
      </div>

      <div class="ns-set-sec" data-i18n="language_region">Langue & Région</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="language">Langue</strong></div>
        <select id="ns-lang" class="ns-sel">
          <option value="fr" data-i18n="french">🇫🇷 Français</option><option value="en" data-i18n="english">🇬🇧 English</option>
        </select>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="region">Région</strong></div>
        <select id="ns-region" class="ns-sel">
          <option value="bf" data-i18n="burkina">🇧🇫 Burkina Faso</option><option value="ci" data-i18n="ivory">🇨🇮 Côte d'Ivoire</option>
          <option value="sn" data-i18n="senegal">🇸🇳 Sénégal</option><option value="ml" data-i18n="mali">🇲🇱 Mali</option>
          <option value="world" data-i18n="world">🌍 Monde</option>
        </select>
      </div>

      <div class="ns-set-sec" data-i18n="privacy_section">Confidentialité</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="history">Historique de lecture</strong><span data-i18n="history_desc">Mémoriser les articles lus</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-hist" checked><div class="ns-toggle-sl"></div></label>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong data-i18n="cookies">Cookies analytiques</strong><span data-i18n="cookies_desc">Améliorer l'expérience</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-cookies" checked><div class="ns-toggle-sl"></div></label>
      </div>

      <button class="ns-save" id="ns-save-btn" data-i18n="save_settings">💾 Enregistrer les paramètres</button>
    </div>
  </div>

  <div class="ns-head">
    <button class="ns-close" id="ns-close-btn" aria-label="Fermer" data-i18n-aria="close_aria">✕</button>
    <div class="ns-avatar-wrap" id="ns-avatar-wrap-click">
      <div class="ns-avatar" id="ns-avatar-main">🧑</div>
      <div class="ns-avatar-edit">📷</div>
    </div>
    <div class="ns-name" id="ns-name-disp">Utilisateur</div>
    <div class="ns-email" id="ns-email-disp">—</div>
    <div class="ns-badge">
      <span class="ns-dot" id="ns-dot" style="background:#f59e0b"></span>
      <span id="ns-status">Chargement...</span>
    </div>
  </div>

  <div class="ns-body">
    <div class="ns-section" data-i18n="sec_account">Mon compte</div>
    <button class="ns-item" id="ns-open-settings">
      <span class="ns-icon" style="background:linear-gradient(135deg,#fff4ee,#fde8d6)">⚙️</span>
      <span style="flex:1">
        <span style="display:block;font-weight:600" data-i18n="nav_settings">Paramètres</span>
        <span style="font-size:11px;color:var(--muted)">Apparence, profil, notifications</span>
      </span>
      <span style="color:var(--muted)">›</span>
    </button>

    <div id="ns-admin-link-wrap" style="display:none">
      <a href="admin.html" class="ns-item">
        <span class="ns-icon" style="background:linear-gradient(135deg,#dbeafe,#bfdbfe)">🛠️</span>
        <span style="flex:1">
          <span style="display:block;font-weight:600" data-i18n="nav_admin">Administration</span>
          <span style="font-size:11px;color:var(--muted)">Publier des articles</span>
        </span>
        <span style="color:var(--muted)">›</span>
      </a>
    </div>

    <div style="display:flex;align-items:center;gap:14px;padding:13px 20px">
      <span class="ns-icon" style="background:linear-gradient(135deg,#1e293b,#334155)">🌙</span>
      <span style="flex:1;font-size:14px;font-weight:600;color:var(--ink-soft)" data-i18n="nav_dark">Mode sombre</span>
      <label class="ns-toggle"><input type="checkbox" id="ns-dark-q"><div class="ns-toggle-sl"></div></label>
    </div>

    <div class="ns-divider"></div>
    <div class="ns-section" data-i18n="sec_rubriques">Rubriques</div>
    <a href="index.html"    class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">🏠</span><span style="flex:1" data-i18n="nav_home">Accueil</span><span style="color:var(--muted)">›</span></a>
    <a href="sport.html"    class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#fff4ee,#fde8d6)">⚽</span><span style="flex:1" data-i18n="nav_sport">Sport</span><span style="color:var(--muted)">›</span></a>
    <a href="education.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7)">📚</span><span style="flex:1" data-i18n="nav_edu">Éducation</span><span style="color:var(--muted)">›</span></a>
    <a href="politique.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#f5f3ff,#ede9fe)">🏛️</span><span style="flex:1" data-i18n="nav_pol">Politique</span><span style="color:var(--muted)">›</span></a>

    <div class="ns-divider"></div>
    <div class="ns-section" data-i18n="sec_activity">Mon activité</div>
    <a href="recherche.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#fef3c7,#fde68a)">🔍</span><span style="flex:1" data-i18n="nav_search">Rechercher</span><span style="color:var(--muted)">›</span></a>
    <a href="mes-favoris.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#fef3c7,#fde68a)">🔖</span><span style="flex:1" data-i18n="nav_fav">Mes favoris</span><span style="color:var(--muted)">›</span></a>

    <div class="ns-divider"></div>
    <div class="ns-section" data-i18n="sec_legal">Légal</div>
    <button class="ns-item" id="ns-open-privacy">
      <span class="ns-icon" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe)">🛡️</span>
      <span style="flex:1" data-i18n="nav_privacy">Confidentialité</span>
      <span style="color:var(--muted)">›</span>
    </button>

    <div id="ns-auth-out" style="display:none;padding:14px 20px">
      <a href="auth.html" class="ns-signin" style="margin-bottom:10px" data-i18n="btn_login">🔐 Se connecter</a>
      <a href="auth.html?tab=register" class="ns-signin" style="background:var(--card);color:var(--ink);border:1.5px solid var(--border);box-shadow:none" data-i18n="btn_register">✨ Créer un compte</a>
    </div>
  </div>

  <div class="ns-footer">
    <div id="ns-auth-in" style="display:none">
      <button class="ns-logout" id="ns-logout-btn" data-i18n="btn_logout">🚪 Se déconnecter</button>
    </div>
  </div>
</aside>

<div id="ns-logout-modal" class="ns-modal-overlay" style="display:none">
  <div id="ns-logout-card" style="background:var(--card);border-radius:20px;padding:40px 30px 32px;max-width:360px;width:92%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.25);transform:scale(.9);transition:all .3s cubic-bezier(.34,1.56,.64,1)">
    <div style="font-size:2.2rem;margin-bottom:16px">🚪</div>
    <div style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:800;color:var(--ink);margin-bottom:10px" data-i18n="logout_title">Vous quittez NACTUS ?</div>
    <p style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:24px" data-i18n="logout_message">Êtes-vous sûr de vouloir vous déconnecter ?</p>
    <div style="display:flex;gap:10px">
      <button id="ns-logout-cancel" style="flex:1;padding:13px;border:1.5px solid var(--border);background:var(--bg);color:var(--ink-soft);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit" data-i18n="logout_cancel">Non, rester</button>
      <button id="ns-logout-confirm" style="flex:1;padding:13px;border:none;background:linear-gradient(135deg,#dc2626,#ef4444);color:white;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer" data-i18n="logout_confirm">Oui, déconnecter</button>
    </div>
  </div>
</div>

<div id="ns-privacy-modal" class="ns-modal-overlay" style="display:none">
  <div id="ns-privacy-card" style="background:var(--card);border-radius:20px;width:92%;max-width:620px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25);transform:scale(.95);transition:transform .3s cubic-bezier(.34,1.56,.64,1);overflow:hidden">
    <div style="padding:22px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <h3 style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:800;color:var(--ink)" data-i18n="privacy_title">Politique & Confidentialité</h3>
      <button id="ns-privacy-close" style="background:var(--border);border:none;width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;color:var(--ink-soft);display:flex;align-items:center;justify-content:center;transition:.2s">✕</button>
    </div>
    <div style="padding:28px;overflow-y:auto;color:var(--ink-soft);font-size:14px;line-height:1.7">
      <p data-i18n="privacy_intro">Bienvenue sur NACTUS. La protection de vos données personnelles est notre priorité.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px" data-i18n="privacy_collect_title">1. Collecte des données</h4>
      <p data-i18n="privacy_collect_text">Nous collectons votre nom, e-mail, photo de profil et préférences via Firebase.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px" data-i18n="privacy_storage_title">2. Stockage local</h4>
      <p data-i18n="privacy_storage_text">Nous utilisons localStorage pour mémoriser vos préférences de thème et connexion.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px" data-i18n="privacy_security_title">3. Sécurité</h4>
      <p data-i18n="privacy_security_text">Données stockées sur Google Cloud (Firebase), protégées par des règles d'accès strictes.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px" data-i18n="privacy_rights_title">4. Vos droits</h4>
      <p data-i18n="privacy_rights_text">Modifiez ou supprimez vos données depuis les paramètres ou en nous contactant.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px" data-i18n="privacy_contact_title">5. Contact</h4>
      <p data-i18n="privacy_contact_text">contact@nactus.bf</p>
    </div>
  </div>
</div>

<div id="nactus-toast"></div>
`;
  document.body.appendChild(wrap);
}

// ─── Bouton hamburger + recherche dans la nav ─────────────────
function injectMenuBtn() {
  if (/admin\.html/.test(window.location.pathname)) return;
  const nav = document.querySelector('.nav');
  if (!nav) return;

  if (!$('nactus-search-btn') && !/recherche\.html/.test(window.location.pathname)) {
    const search = document.createElement('a');
    search.id = 'nactus-search-btn';
    search.href = 'recherche.html';
    search.title = t('search_title');
    search.setAttribute('aria-label', t('search_aria'));
    search.setAttribute('data-i18n-title', 'search_title');
    search.setAttribute('data-i18n-aria', 'search_aria');
    search.innerHTML = '🔍';
    nav.appendChild(search);
  }

  const isAuthPage = /auth\.html/.test(window.location.pathname);
  if (!$('nactus-nav-login') && !isAuthPage) {
    const login = document.createElement('a');
    login.id = 'nactus-nav-login';
    login.className = 'nactus-nav-auth-btn nactus-nav-login';
    login.href = 'auth.html';
    login.textContent = 'Connexion';
    login.setAttribute('data-i18n', 'btn_login');
    login.style.display = 'none';
    nav.appendChild(login);
  }
  if (!$('nactus-nav-register') && !isAuthPage) {
    const register = document.createElement('a');
    register.id = 'nactus-nav-register';
    register.className = 'nactus-nav-auth-btn nactus-nav-register';
    register.href = 'auth.html?tab=register';
    register.textContent = 'Créer un compte';
    register.setAttribute('data-i18n', 'btn_register');
    register.style.display = 'none';
    nav.appendChild(register);
  }

  if ($('nactus-menu-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'nactus-menu-btn';
  btn.title = t('menu_title');
  btn.setAttribute('aria-label', t('menu_aria'));
  btn.setAttribute('data-i18n-title', 'menu_title');
  btn.setAttribute('data-i18n-aria', 'menu_aria');
  btn.innerHTML = '<span></span><span></span><span></span>';
  btn.addEventListener('click', openPanel);
  nav.appendChild(btn);
}

// ─── Back bar ──────────────────────────────────────────────────
function injectBackBar() {
  if ($('nactus-back-bar') || document.querySelector('.nactus-back-bar')) return;
  const path = window.location.pathname;
  const isHome = /index\.html$/.test(path) || path.endsWith('/') || path === '';
  const isAdmin = /admin\.html/.test(path);
  const isAuth = /auth\.html/.test(path);
  if (isHome || isAdmin || isAuth) return;

  const bar = document.createElement('div');
  bar.id = 'nactus-back-bar';
  bar.className = 'nactus-back-bar';
  bar.innerHTML = `<a class="nactus-back-btn" href="index.html" data-i18n="back_home" data-i18n-title="back_home" data-i18n-aria="back_aria" aria-label="Retour à l'accueil">← Retour à l'accueil</a>`;
  const header = document.querySelector('header');
  if (header) header.insertAdjacentElement('afterend', bar);
  else document.body.prepend(bar);
}

// ─── Bind events ──────────────────────────────────────────────
function bindEvents() {
  const safe = (id, evt, fn) => {
    const el = $(id);
    if (el) el.addEventListener(evt, fn);
  };
  safe('nactus-overlay',   'click', closePanel);
  safe('ns-close-btn',     'click', closePanel);
  safe('ns-open-settings', 'click', openSettings);
  safe('ns-set-back',      'click', closeSettings);
  safe('ns-open-privacy',  'click', openPrivacy);
  safe('ns-privacy-close', 'click', closePrivacy);
  safe('ns-logout-btn',    'click', openLogoutModal);
  safe('ns-logout-cancel', 'click', closeLogoutModal);
  safe('ns-logout-confirm','click', doLogout);
  safe('ns-save-btn',      'click', doSaveSettings);
  safe('ns-avatar-wrap-click','click', () => $('ns-avatar-file')?.click());
  safe('ns-avatar-btn',    'click', () => $('ns-avatar-file')?.click());
  safe('ns-avatar-file',   'change', handleAvatarUpload);
  safe('ns-dark-q', 'change', e => applyDark(e.target.checked));
  safe('ns-dark-s', 'change', e => applyDark(e.target.checked));
  safe('ns-font',   'change', e => applyFont(e.target.value));
  safe('ns-lang',   'change', e => applyLanguage(e.target.value));

  const lm = $('ns-logout-modal');
  if (lm) lm.addEventListener('click', e => { if (e.target === lm) closeLogoutModal(); });
  const pm = $('ns-privacy-modal');
  if (pm) pm.addEventListener('click', e => { if (e.target === pm) closePrivacy(); });
}

// ─── Init principal ──────────────────────────────────────────
function init() {
  initTheme();

  injectCSS();
  buildUI();
  injectMenuBtn();
  injectBackBar();
  bindEvents();

  // Langue au chargement : préférences visiteur (nactus_guest_prefs).
  // Si l'utilisateur est connecté, refreshAuthUI() écrasera avec la
  // langue enregistrée côté Firestore une fois l'auth résolue.
  const prefs = getGuestPrefs();
  applyLanguage(prefs.lang || "fr");

  onAuthStateChanged(auth, refreshAuthUI);
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
