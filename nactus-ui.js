// ═══════════════════════════════════════════════════════════════
//  NACTUS-UI.JS  v3.1  —  chargé via <script type="module" src="nactus-ui.js">
//  Dark mode · Panel profil · Paramètres · Auth · Sidebar · Toast · Header Auth Buttons
//  Compatible avec TOUTES les pages du site.
// ═══════════════════════════════════════════════════════════════

import { initializeApp, getApps }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut, updateProfile }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Firebase Storage supprimé — avatars uploadés via Appwrite (window.NACTUS_STORAGE)
import { getFirestore, doc, setDoc, getDoc }
  from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ─── Config ────────────────────────────────────────────────────
const CFG = {
  apiKey: "AIzaSyCmUN4AsQ7oryWpF6ULtshkZEOuvFekAOo",
  authDomain: "videome-b7157.firebaseapp.com",
  projectId: "videome-b7157",
  storageBucket: "videome-b7157.appspot.com",
  messagingSenderId: "365500246890",
  appId: "1:365500246890:web:99423413909b9fcc631313"
};
const app     = getApps().length ? getApps()[0] : initializeApp(CFG);
const auth    = getAuth(app);
const db      = getFirestore(app);
// storage Firebase supprimé — window.NACTUS_STORAGE (Appwrite) utilisé à la place

// Expose pour les pages qui partagent la même instance Firebase
window.NACTUS = window.NACTUS || {};

window.NACTUS.firebase = {
    app,
    auth,
    db
};

window.NACTUS.storage = window.NACTUS_STORAGE;

let _user = null;

// ─── Helpers ───────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/[&<>"']/g, m =>
  ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
const ls = {
  get: k => localStorage.getItem(k) || '',
  set: (k,v) => localStorage.setItem(k, v),
  del: k => localStorage.removeItem(k)
};

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

// ─── Theme ─────────────────────────────────────────────────────
function applyDark(on) {
  document.documentElement.setAttribute('data-theme', on ? 'dark' : 'light');
  ls.set('nactus_dark', on ? '1' : '0');
  const q = $('ns-dark-q'), s = $('ns-dark-s');
  if (q) q.checked = on;
  if (s) s.checked = on;
}
function applyFont(v) {
  document.body.style.fontSize = v + 'px';
  ls.set('nactus_font', v);
  const sel = $('ns-font');
  if (sel) sel.value = v;
}
function initTheme() {
  const dark = ls.get('nactus_dark') === '1';
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  const fs = ls.get('nactus_font');
  if (fs) document.body.style.fontSize = fs + 'px';
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
  // Synchronise les toggles avec l'état réel
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

// Expose pour footer/liens
window.NACTUS.openPrivacy = openPrivacy;

// ─── Auth ──────────────────────────────────────────────────────
async function refreshAuthUI(user) {
  _user = user;
  const isIn = !!user;

  const authIn  = $('ns-auth-in');
  const authOut = $('ns-auth-out');
  const headerAuth = $('nactus-header-auth');

  if (authIn)  authIn.style.display  = isIn ? 'block' : 'none';
  if (authOut) authOut.style.display = isIn ? 'none'  : 'block';
  
  // Cache ou affiche les boutons de connexion du header selon le statut
  if (headerAuth) headerAuth.style.display = isIn ? 'none' : 'flex';

  if (isIn) {
    const name  = user.displayName || ls.get('nactus_name') || 'Utilisateur';
    const email = user.email || '';
    const nd = $('ns-name-disp');
    const ed = $('ns-email-disp');
    const sd = $('ns-status');
    const dot= $('ns-dot');
    const ni = $('ns-name-input');
    if (nd)  nd.textContent  = name;
    if (ed)  ed.textContent  = email;
    if (sd)  sd.textContent  = 'Connecté';
    if (dot) dot.style.background = '#4ade80';
    if (ni)  ni.value = name;
    setAvatar(user.photoURL || ls.get('nactus_avatar') || '');

    try {
      const snap = await getDoc(doc(db,'users',user.uid));
      const isAdmin = snap.exists() && snap.data().role === 'admin';
      const al = $('ns-admin-link-wrap');
      if (al) al.style.display = isAdmin ? 'block' : 'none';
    } catch(e) {
      const al = $('ns-admin-link-wrap');
      if (al) al.style.display = 'none';
    }

    try {
      const psnap = await getDoc(doc(db,'userPrefs',user.uid));
      if (psnap.exists()) {
        const p = psnap.data();
        if (p.dark !== undefined) applyDark(p.dark);
        if (p.fontSize) applyFont(p.fontSize);
        const lang = $('ns-lang'), region = $('ns-region');
        const news = $('ns-news'), notif = $('ns-notif');
        const hist = $('ns-hist'), cook  = $('ns-cookies');
        if (lang   && p.lang)       lang.value = p.lang;
        if (region && p.region)     region.value = p.region;
        if (news   && p.newsletter !== undefined) news.checked = p.newsletter;
        if (notif  && p.notif !== undefined)      notif.checked = p.notif;
        if (hist   && p.history !== undefined)    hist.checked  = p.history;
        if (cook   && p.cookies !== undefined)    cook.checked  = p.cookies;
      }
    } catch(e) { /* silencieux */ }

  } else {
    const nd  = $('ns-name-disp');
    const ed  = $('ns-email-disp');
    const sd  = $('ns-status');
    const dot = $('ns-dot');
    const al  = $('ns-admin-link-wrap');
    if (nd)  nd.textContent  = 'Visiteur';
    if (ed)  ed.textContent  = 'Non connecté';
    if (sd)  sd.textContent  = 'Non connecté';
    if (dot) dot.style.background = '#f59e0b';
    if (al)  al.style.display = 'none';
  }
  document.dispatchEvent(new CustomEvent('nactus:auth', {detail:{user,isAdmin:false}}));
}

async function doLogout() {
  closeLogoutModal();
  try {
    if (_user) await signOut(auth);
    ['nactus_avatar','nactus_name'].forEach(k => ls.del(k));
    setAvatar('');
    closePanel();
    toast('👋 Déconnecté — À bientôt sur NACTUS !', 3500);
    if (/admin\.html/.test(window.location.pathname))
      setTimeout(() => window.location.href = 'index.html', 600);
  } catch(e) { toast('❌ ' + e.message); }
}

async function doSaveSettings() {
  const btn = $('ns-save-btn');
  if (!btn) return;
  btn.disabled = true;
  btn.textContent = '⏳ Sauvegarde...';

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
  if (name) {
    const nd = $('ns-name-disp');
    if (nd) nd.textContent = name;
    ls.set('nactus_name', name);
  }

  try {
    if (_user) {
      if (name) await updateProfile(_user, { displayName: name });
      await setDoc(doc(db,'userPrefs',_user.uid),
        { dark, fontSize, lang, region, newsletter, notif, history, cookies, updatedAt: new Date() },
        { merge: true });
    }
    btn.textContent = '✅ Enregistré !';
    btn.style.background = 'linear-gradient(135deg,#16a34a,#22c55e)';
    toast('✅ Paramètres enregistrés avec succès');
    setTimeout(() => {
      btn.disabled = false;
      btn.textContent = '💾 Enregistrer les paramètres';
      btn.style.background = '';
      closeSettings();
      closePanel();
    }, 1400);
  } catch(e) {
    toast('❌ Erreur : ' + e.message);
    btn.disabled = false;
    btn.textContent = '💾 Enregistrer les paramètres';
  }
}

async function handleAvatarUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  if (file.size > 2*1024*1024) { toast('❌ Image trop lourde (max 2 Mo)'); return; }
  toast('⏳ Téléchargement...');
  try {
    let src;
    if (_user) {
      if (!window.NACTUS_STORAGE) throw new Error("Module Appwrite non chargé. Rechargez la page.");
      const { url } = await window.NACTUS_STORAGE.upload(file, 'avatar');
      src = url;
      await updateProfile(_user, { photoURL: src });
    } else {
      // Visiteur non connecté : stockage local temporaire (base64)
      src = await new Promise(res => {
        const rd = new FileReader();
        rd.onload = ev => res(ev.target.result);
        rd.readAsDataURL(file);
      });
      ls.set('nactus_avatar', src);
    }
    setAvatar(src);
    toast('✅ Photo mise à jour !');
  } catch(err) { toast('❌ ' + err.message); }
}

// ─── CSS injecté ───────────────────────────────────────────────
function injectCSS() {
  if ($('nactus-ui-css')) return;
  const s = document.createElement('style');
  s.id = 'nactus-ui-css';
  s.textContent = `
/* ── Tokens dark/light synchronisés avec les pages ── */
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

/* ── Bouton recherche ── */
#nactus-search-btn{
  display:flex;align-items:center;justify-content:center;
  width:42px;height:42px;border-radius:12px;font-size:17px;
  text-decoration:none;background:var(--card);border:1.5px solid var(--border);
  color:var(--ink);flex-shrink:0;
  transition:all .28s cubic-bezier(.4,0,.2,1);margin-right:8px
}
#nactus-search-btn:hover{border-color:#e85d26;background:rgba(232,93,38,.06);transform:translateY(-2px)}

/* ── Hamburger ── */
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

/* ── Overlay + Sidebar ── */
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

/* ── Header panel ── */
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

/* ── Body du panel ── */
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

/* ── Toggle ── */
.ns-toggle{position:relative;width:44px;height:24px;flex-shrink:0;cursor:pointer;margin-left:auto}
.ns-toggle input{opacity:0;width:0;height:0;position:absolute}
.ns-toggle-slposition:absolute;inset:0;background:#cbd5e1;border-radius:30px;transition:.3s}
.ns-toggle-sl::before{content:'';position:absolute;width:18px;height:18px;left:3px;top:3px;background:white;border-radius:50%;transition:.3s;box-shadow:0 1px 4px rgba(0,0,0,.2)}
.ns-toggle input:checked+.ns-toggle-sl{background:linear-gradient(135deg,#e85d26,#f5a623)}
.ns-toggle input:checked+.ns-toggle-sl::before{transform:translateX(20px)}

/* ── Footer panel ── */
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

/* ── Settings slide-in ── */
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
.ns-save{
  width:calc(100% - 40px);margin:18px 20px;padding:14px;
  background:linear-gradient(135deg,#e85d26,#f5a623);color:white;border:none;
  border-radius:30px;font-size:15px;font-weight:700;cursor:pointer;font-family:inherit;
  box-shadow:0 6px 20px rgba(232,93,38,.3);transition:.22s
}
.ns-save:hover{opacity:.95;transform:translateY(-2px)}
.ns-save:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none}

/* ── Toast ── */
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

/* ── Modals ── */
.ns-modal-overlay{
  position:fixed;inset:0;z-index:9999;display:none;align-items:center;justify-content:center;
  background:rgba(0,0,0,.55);backdrop-filter:blur(8px);
  opacity:0;transition:opacity .28s ease
}

/* ── Back bar ── */
.nactus-back-bar{padding:14px 32px 0;background:transparent}
.nactus-back-btn{
  display:inline-flex;align-items:center;gap:8px;color:var(--muted);font-size:14px;
  font-weight:500;text-decoration:none;padding:8px 18px;border-radius:30px;
  border:1px solid var(--border);background:var(--white);transition:.2s
}
.nactus-back-btn:hover{color:#e85d26;border-color:#e85d26;background:rgba(232,93,38,.05)}

/* ── Boutons Auth Header ── */
#nactus-header-auth {
  display:flex;align-items:center;gap:8px;margin-right:8px
}
.nh-btn {
  padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;
  text-decoration:none;transition:all .28s;font-family:'Inter',sans-serif
}
.nh-login {
  background:var(--card);color:var(--ink);border:1.5px solid var(--border)
}
.nh-login:hover {
  border-color:#e85d26;color:#e85d26;background:rgba(232,93,38,.05)
}
.nh-register {
  background:linear-gradient(135deg,#e85d26,#f5a623);color:white;border:none;
  box-shadow:0 4px 12px rgba(232,93,38,.2)
}
.nh-register:hover {
  transform:translateY(-2px);box-shadow:0 6px 16px rgba(232,93,38,.35)
}

@media(max-width:600px){
  .nactus-back-bar{padding:10px 16px 0}
  #nactus-sidebar{width:100vw}
}
@media(max-width:550px){
  #nactus-header-auth {display:none!important}
}
`;
  document.head.appendChild(s);
}

// ─── HTML sidebar + modals + toast ────────────────────────────
function buildUI() {
  if ($('nactus-sidebar')) return; // déjà injecté
  const wrap = document.createElement('div');
  wrap.innerHTML = `
<div id="nactus-overlay"></div>

<aside id="nactus-sidebar">
  <div id="ns-settings">
    <div class="ns-set-head">
      <button class="ns-back" id="ns-set-back" aria-label="Retour">‹</button>
      <span class="ns-set-title">⚙️ Paramètres</span>
    </div>
    <div class="ns-set-body">
      <div class="ns-set-sec">Apparence</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Mode sombre</strong><span>Thème nuit / jour</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-dark-s"><div class="ns-toggle-sl"></div></label>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Taille du texte</strong><span>Agrandir l'interface</span></div>
        <select id="ns-font" class="ns-sel">
          <option value="14">Petit</option><option value="16" selected>Normal</option>
          <option value="18">Grand</option><option value="20">Très grand</option>
        </select>
      </div>

      <div class="ns-set-sec">Profil</div>
      <div class="ns-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div class="ns-lbl"><strong>Nom d'affichage</strong></div>
        <input id="ns-name-input" class="ns-input" type="text" placeholder="Votre nom complet">
      </div>
      <div class="ns-row" style="flex-direction:column;align-items:flex-start;gap:8px">
        <div class="ns-lbl"><strong>Photo de profil</strong><span>JPG, PNG — max 2 Mo</span></div>
        <div style="display:flex;align-items:center;gap:10px;width:100%">
          <div class="ns-av-sm" id="ns-avatar-sm">🧑</div>
          <input type="file" id="ns-avatar-file" accept="image/*" style="display:none">
          <button class="ns-upload" id="ns-avatar-btn">📷 Choisir</button>
        </div>
      </div>

      <div class="ns-set-sec">Notifications</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Alertes nouvelles</strong><span>Articles publiés</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-notif" checked><div class="ns-toggle-sl"></div></label>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Newsletter</strong><span>Résumé quotidien</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-news"><div class="ns-toggle-sl"></div></label>
      </div>

      <div class="ns-set-sec">Langue & Région</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Langue</strong></div>
        <select id="ns-lang" class="ns-sel">
          <option value="fr">🇫🇷 Français</option><option value="en">🇬🇧 English</option>
        </select>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Région</strong></div>
        <select id="ns-region" class="ns-sel">
          <option value="bf">🇧🇫 Burkina Faso</option><option value="ci">🇨🇮 Côte d'Ivoire</option>
          <option value="sn">🇸🇳 Sénégal</option><option value="ml">🇲🇱 Mali</option>
          <option value="world">🌍 Monde</option>
        </select>
      </div>

      <div class="ns-set-sec">Confidentialité</div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Historique de lecture</strong><span>Mémoriser les articles lus</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-hist" checked><div class="ns-toggle-sl"></div></label>
      </div>
      <div class="ns-row">
        <div class="ns-lbl"><strong>Cookies analytiques</strong><span>Améliorer l'expérience</span></div>
        <label class="ns-toggle"><input type="checkbox" id="ns-cookies" checked><div class="ns-toggle-sl"></div></label>
      </div>

      <button class="ns-save" id="ns-save-btn">💾 Enregistrer les paramètres</button>
    </div>
  </div>

  <div class="ns-head">
    <button class="ns-close" id="ns-close-btn" aria-label="Fermer">✕</button>
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
    <div class="ns-section">Mon compte</div>
    <button class="ns-item" id="ns-open-settings">
      <span class="ns-icon" style="background:linear-gradient(135deg,#fff4ee,#fde8d6)">⚙️</span>
      <span style="flex:1">
        <span style="display:block;font-weight:600">Paramètres</span>
        <span style="font-size:11px;color:var(--muted)">Apparence, profil, notifications</span>
      </span>
      <span style="color:var(--muted)">›</span>
    </button>

    <div id="ns-admin-link-wrap" style="display:none">
      <a href="admin.html" class="ns-item">
        <span class="ns-icon" style="background:linear-gradient(135deg,#dbeafe,#bfdbfe)">🛠️</span>
        <span style="flex:1">
          <span style="display:block;font-weight:600">Administration</span>
          <span style="font-size:11px;color:var(--muted)">Publier des articles</span>
        </span>
        <span style="color:var(--muted)">›</span>
      </a>
    </div>

    <div style="display:flex;align-items:center;gap:14px;padding:13px 20px">
      <span class="ns-icon" style="background:linear-gradient(135deg,#1e293b,#334155)">🌙</span>
      <span style="flex:1;font-size:14px;font-weight:600;color:var(--ink-soft)">Mode sombre</span>
      <label class="ns-toggle"><input type="checkbox" id="ns-dark-q"><div class="ns-toggle-sl"></div></label>
    </div>

    <div class="ns-divider"></div>
    <div class="ns-section">Rubriques</div>
    <a href="index.html"    class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#eff6ff,#dbeafe)">🏠</span><span style="flex:1">Accueil</span><span style="color:var(--muted)">›</span></a>
    <a href="sport.html"    class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#fff4ee,#fde8d6)">⚽</span><span style="flex:1">Sport</span><span style="color:var(--muted)">›</span></a>
    <a href="education.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#f0fdf4,#dcfce7)">📚</span><span style="flex:1">Éducation</span><span style="color:var(--muted)">›</span></a>
    <a href="politique.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#f5f3ff,#ede9fe)">🏛️</span><span style="flex:1">Politique</span><span style="color:var(--muted)">›</span></a>

    <div class="ns-divider"></div>
    <div class="ns-section">Mon activité</div>
    <a href="recherche.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#fef3c7,#fde68a)">🔍</span><span style="flex:1">Rechercher</span><span style="color:var(--muted)">›</span></a>
    <a href="mes-favoris.html" class="ns-item"><span class="ns-icon" style="background:linear-gradient(135deg,#fef3c7,#fde68a)">🔖</span><span style="flex:1">Mes favoris</span><span style="color:var(--muted)">›</span></a>

    <div class="ns-divider"></div>
    <div class="ns-section">Légal</div>
    <button class="ns-item" id="ns-open-privacy">
      <span class="ns-icon" style="background:linear-gradient(135deg,#f0f9ff,#e0f2fe)">🛡️</span>
      <span style="flex:1">Confidentialité</span>
      <span style="color:var(--muted)">›</span>
    </button>

    <div id="ns-auth-out" style="display:none;padding:14px 20px">
      <a href="auth.html" class="ns-signin" style="margin-bottom:10px">🔐 Se connecter</a>
      <a href="auth.html?tab=register" class="ns-signin" style="background:var(--card);color:var(--ink);border:1.5px solid var(--border);box-shadow:none">✨ Créer un compte</a>
    </div>
  </div>

  <div class="ns-footer">
    <div id="ns-auth-in" style="display:none">
      <button class="ns-logout" id="ns-logout-btn">🚪 Se déconnecter</button>
    </div>
  </div>
</aside>

<div id="ns-logout-modal" class="ns-modal-overlay" style="display:none">
  <div id="ns-logout-card" style="background:var(--card);border-radius:20px;padding:40px 30px 32px;max-width:360px;width:92%;text-align:center;box-shadow:0 24px 60px rgba(0,0,0,.25);transform:scale(.9);transition:all .3s cubic-bezier(.34,1.56,.64,1)">
    <div style="font-size:2.2rem;margin-bottom:16px">🚪</div>
    <div style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:800;color:var(--ink);margin-bottom:10px">Vous quittez NACTUS ?</div>
    <p style="color:var(--muted);font-size:14px;line-height:1.6;margin-bottom:24px">Êtes-vous sûr de vouloir vous déconnecter ?</p>
    <div style="display:flex;gap:10px">
      <button id="ns-logout-cancel" style="flex:1;padding:13px;border:1.5px solid var(--border);background:var(--bg);color:var(--ink-soft);border-radius:12px;font-size:14px;font-weight:600;cursor:pointer;font-family:inherit">Non, rester</button>
      <button id="ns-logout-confirm" style="flex:1;padding:13px;border:none;background:linear-gradient(135deg,#dc2626,#ef4444);color:white;border-radius:12px;font-size:14px;font-weight:700;cursor:pointer">Oui, déconnecter</button>
    </div>
  </div>
</div>

<div id="ns-privacy-modal" class="ns-modal-overlay" style="display:none">
  <div id="ns-privacy-card" style="background:var(--card);border-radius:20px;width:92%;max-width:620px;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 60px rgba(0,0,0,.25);transform:scale(.95);transition:transform .3s cubic-bezier(.34,1.56,.64,1);overflow:hidden">
    <div style="padding:22px 28px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center">
      <h3 style="font-family:'Playfair Display',serif;font-size:1.3rem;font-weight:800;color:var(--ink)">Politique & Confidentialité</h3>
      <button id="ns-privacy-close" style="background:var(--border);border:none;width:34px;height:34px;border-radius:50%;font-size:16px;cursor:pointer;color:var(--ink-soft);display:flex;align-items:center;justify-content:center;transition:.2s">✕</button>
    </div>
    <div style="padding:28px;overflow-y:auto;color:var(--ink-soft);font-size:14px;line-height:1.7">
      <p>Bienvenue sur <strong style="color:var(--ink)">NACTUS</strong>. La protection de vos données personnelles est notre priorité.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px">1. Collecte des données</h4>
      <p>Nous collectons votre nom, e-mail, photo de profil et préférences via Firebase.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px">2. Stockage local</h4>
      <p>Nous utilisons localStorage pour mémoriser vos préférences de thème et connexion.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px">3. Sécurité</h4>
      <p>Données stockées sur Google Cloud (Firebase), protégées par des règles d'accès strictes.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px">4. Vos droits</h4>
      <p>Modifiez ou supprimez vos données depuis les paramètres ou en nous contactant.</p>
      <h4 style="color:var(--ink);margin:20px 0 8px">5. Contact</h4>
      <p>contact@nactus.bf</p>
    </div>
  </div>
</div>

<div id="nactus-toast"></div>
`;
  document.body.appendChild(wrap);
}

// ─── Bouton hamburger + recherche dans la nav ─────────────────
function injectMenuBtn() {
  // Ne rien faire si la page admin (elle a son propre header)
  if (/admin\.html/.test(window.location.pathname)) return;
  const nav = document.querySelector('.nav');
  if (!nav) return;

  // 1. Bouton recherche (à gauche)
  if (!$('nactus-search-btn') && !/recherche\.html/.test(window.location.pathname)) {
    const search = document.createElement('a');
    search.id = 'nactus-search-btn';
    search.href = 'recherche.html';
    search.title = 'Rechercher un article';
    search.setAttribute('aria-label', 'Rechercher');
    search.innerHTML = '🔍';
    nav.appendChild(search);
  }

  // 2. Nouveaux Boutons d'Authentification (au milieu)
  if (!$('nactus-header-auth')) {
    const authWrap = document.createElement('div');
    authWrap.id = 'nactus-header-auth';
    authWrap.style.display = 'none'; // Géré dynamiquement par refreshAuthUI
    authWrap.innerHTML = `
      <a href="auth.html" class="nh-btn nh-login">Connexion</a>
      <a href="auth.html?tab=register" class="nh-btn nh-register">Créer un compte</a>
    `;
    nav.appendChild(authWrap);
  }

  // 3. Hamburger Menu (à droite)
  if ($('nactus-menu-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'nactus-menu-btn';
  btn.title = 'Menu profil';
  btn.setAttribute('aria-label','Ouvrir le menu');
  btn.innerHTML = '<span></span><span></span><span></span>';
  btn.addEventListener('click', openPanel);
  nav.appendChild(btn);
}

// ─── Back bar (pages secondaires) ────────────────────────────
function injectBackBar() {
  const path = window.location.pathname;
  const isHome = /index\.html$/.test(path) || path.endsWith('/') || path === '';
  const isAdmin = /admin\.html/.test(path);
  const isLogin = /login\.html/.test(path);
  if (isHome || isAdmin || isLogin) return;
  if ($('nactus-back-bar') || document.querySelector('.nactus-back-bar')) return;
  const bar = document.createElement('div');
  bar.id = 'nactus-back-bar';
  bar.className = 'nactus-back-bar';
  bar.innerHTML = `<a class="nactus-back-btn" href="index.html">← Retour à l'accueil</a>`;
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

  // Ferme la modal logout en cliquant sur le fond
  const lm = $('ns-logout-modal');
  if (lm) lm.addEventListener('click', e => { if (e.target === lm) closeLogoutModal(); });
  const pm = $('ns-privacy-modal');
  if (pm) pm.addEventListener('click', e => { if (e.target === pm) closePrivacy(); });
}

// ─── Init principal ───────────────────────────────────────────
function init() {
  initTheme();
  injectCSS();
  buildUI();
  injectMenuBtn();
  injectBackBar();
  bindEvents();
  onAuthStateChanged(auth, refreshAuthUI);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}