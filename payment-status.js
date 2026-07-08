// ═══════════════════════════════════════════════════════════════
//  /api/payment-status.js  —  Vercel Serverless Function
//  Appelé en polling depuis paiement.html toutes les 3 secondes.
//  Vérifie le statut du paiement chez le processeur ET dans Firestore.
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Méthode non autorisée' });

  const { txId, uid } = req.query;
  if (!txId || !uid) return res.status(400).json({ error: 'txId et uid requis' });

  try {
    // 1. Lire le document transaction dans Firestore (écrit par le webhook ou l'initiation)
    const projectId = process.env.FIREBASE_PROJECT_ID || 'videome-b7157';
    const txDoc = await getFirestoreDoc(projectId, 'transactions', txId);

    if (!txDoc) {
      return res.status(200).json({ status: 'pending', message: 'Transaction en cours...' });
    }

    // Vérifie que la transaction appartient bien à cet utilisateur (anti-IDOR)
    if (txDoc.uid !== uid) {
      return res.status(403).json({ error: 'Accès non autorisé' });
    }

    if (txDoc.status === 'completed') {
      return res.status(200).json({
        status: 'completed',
        transaction_id: txId,
        download_url: txDoc.downloadUrl || null
      });
    }

    if (txDoc.status === 'failed') {
      return res.status(200).json({ status: 'failed' });
    }

    // 2. Transaction toujours pending : interroger le processeur selon la méthode
    const method = txDoc.method;
    let processorStatus = 'pending';

    if (['orange_money','moov_money','mtn_money','wave','free_money'].includes(method)) {
      processorStatus = await checkCinetPay(txId);
    } else if (method === 'card') {
      // Stripe utilise des webhooks — le polling est géré via Firestore
      // Le webhook /api/payment-webhook met à jour Firestore dès confirmation
      processorStatus = txDoc.status || 'pending';
    } else if (['orange_bf','coris_money','visa_qr'].includes(method)) {
      processorStatus = await checkPayDunya(txId);
    }

    if (processorStatus === 'completed') {
      // Marquer comme complété dans Firestore et créer le droit d'accès
      await completeTransaction(txId, txDoc, projectId);
      return res.status(200).json({ status: 'completed', transaction_id: txId });
    }

    if (processorStatus === 'failed') {
      await updateTransactionStatus(projectId, txId, 'failed');
      return res.status(200).json({ status: 'failed' });
    }

    return res.status(200).json({ status: 'pending' });

  } catch (err) {
    console.error('[payment-status]', err);
    return res.status(200).json({ status: 'pending', debug: err.message });
  }
}

// ── CinetPay : vérifier le statut d'une transaction ──────────
async function checkCinetPay(txId) {
  const apiKey = process.env.CINETPAY_API_KEY;
  const siteId = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) return 'pending';

  const r = await fetch('https://api-checkout.cinetpay.com/v2/payment/check', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ apikey: apiKey, site_id: siteId, transaction_id: txId })
  });
  const d = await r.json();

  // Codes CinetPay : 00 = succès, -1/-2 = en cours, autre = échec
  if (d.code === '00' && d.data?.status === 'ACCEPTED') return 'completed';
  if (d.data?.status === 'REFUSED' || d.data?.status === 'CANCELLED') return 'failed';
  return 'pending';
}

// ── PayDunya : vérifier le statut ────────────────────────────
async function checkPayDunya(txId) {
  const masterKey  = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token      = process.env.PAYDUNYA_TOKEN;
  const mode       = process.env.PAYDUNYA_MODE || 'test';
  if (!masterKey) return 'pending';

  const baseUrl = mode === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';

  const r = await fetch(`${baseUrl}/checkout-invoice/confirm/${txId}`, {
    headers: {
      'PAYDUNYA-MASTER-KEY':  masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN':       token
    }
  });
  const d = await r.json();
  if (d.status === 'completed') return 'completed';
  if (d.status === 'cancelled') return 'failed';
  return 'pending';
}

// ── Finalisation de la transaction ───────────────────────────
async function completeTransaction(txId, txDoc, projectId) {
  // Créer le droit d'accès dans la collection "purchases"
  const purchaseId = `${txDoc.uid}_${txDoc.articleId}`;
  await writeFirestoreDoc(projectId, 'purchases', purchaseId, {
    uid:           txDoc.uid,
    articleId:     txDoc.articleId,
    method:        txDoc.method,
    mode:          txDoc.mode,
    amount:        txDoc.amount,
    currency:      txDoc.currency,
    transactionId: txId,
    status:        'completed',
    paidAt:        new Date().toISOString(),
    // Si abonnement : expire dans 30 jours
    expiresAt: txDoc.mode === 'sub'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null
  });

  // Marquer la transaction comme complétée
  await updateTransactionStatus(projectId, txId, 'completed');
}

// ── Firestore helpers (REST API, sans Firebase Admin SDK) ─────
async function getFirebaseToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return null;

  try {
    const now     = Math.floor(Date.now() / 1000);
    const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = btoa(JSON.stringify({
      iss: clientEmail, sub: clientEmail,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now, exp: now + 3600,
      scope: 'https://www.googleapis.com/auth/datastore'
    }));
    const sigInput = `${header}.${payload}`;
    const keyData  = privateKey.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
    const keyBuf   = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBuf.buffer, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
    const sigBuf   = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
    const sig      = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    const jwt      = `${sigInput}.${sig}`;
    const r = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
    });
    const d = await r.json();
    return d.access_token || null;
  } catch(e) { return null; }
}

async function getFirestoreDoc(projectId, collection, docId) {
  const token = await getFirebaseToken();
  if (!token) return null;
  const r = await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`,
    { headers: { 'Authorization': `Bearer ${token}` } }
  );
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.fields) return null;
  return Object.fromEntries(Object.entries(d.fields).map(([k,v]) => [k, v.stringValue ?? v.booleanValue ?? v.integerValue ?? null]));
}

async function writeFirestoreDoc(projectId, collection, docId, data) {
  const token = await getFirebaseToken();
  if (!token) return;
  await fetch(
    `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}/${docId}`,
    {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fields: Object.fromEntries(
          Object.entries(data).map(([k,v]) => [k, v === null ? {nullValue:null} : {stringValue: String(v)}])
        )
      })
    }
  );
}

async function updateTransactionStatus(projectId, txId, status) {
  await writeFirestoreDoc(projectId, 'transactions', txId, { status, updatedAt: new Date().toISOString() });
}
