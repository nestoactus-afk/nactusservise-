// ═══════════════════════════════════════════════════════════════
//  /api/payment-webhook.js  —  Vercel Serverless Function
//  Reçoit les confirmations de paiement des processeurs.
//  C'est la SOURCE DE VÉRITÉ pour marquer un paiement comme complété.
//  Le polling côté client est un complément, pas le mécanisme principal.
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';

export default async function handler(req, res) {
  // Les webhooks sont toujours POST
  if (req.method !== 'POST') return res.status(405).end();

  const projectId = process.env.FIREBASE_PROJECT_ID || 'videome-b7157';

  try {
    // Détermine l'origine du webhook selon l'en-tête ou le corps
    const source = detectWebhookSource(req);

    let txId = null, status = 'failed', rawBody = null;

    if (source === 'stripe') {
      // Stripe envoie la signature dans l'en-tête pour authentifier
      const result = await handleStripeWebhook(req);
      txId   = result.txId;
      status = result.status;

    } else if (source === 'cinetpay') {
      const result = handleCinetPayWebhook(req.body);
      txId   = result.txId;
      status = result.status;

    } else if (source === 'paydunya') {
      const result = handlePayDunyaWebhook(req.body);
      txId   = result.txId;
      status = result.status;

    } else {
      console.warn('[webhook] Source inconnue:', req.headers, req.body);
      return res.status(200).json({ received: true }); // 200 pour éviter les retentatives
    }

    if (!txId) {
      console.warn('[webhook] txId manquant');
      return res.status(200).json({ received: true });
    }

    if (status === 'completed') {
      // Lire la transaction pour récupérer les infos
      const txDoc = await getFirestoreDoc(projectId, 'transactions', txId);
      if (txDoc && txDoc.uid && txDoc.articleId) {
        await completeTransaction(txId, txDoc, projectId);
        console.log('[webhook] Paiement confirmé:', txId);
      }
    } else {
      await updateTransactionStatus(projectId, txId, status);
    }

    // Toujours répondre 200 rapidement aux processeurs
    return res.status(200).json({ received: true });

  } catch (err) {
    console.error('[webhook] Erreur:', err);
    // On répond 200 quand même pour éviter les retentatives infinies
    return res.status(200).json({ received: true, warning: err.message });
  }
}

// ── Détection de la source du webhook ────────────────────────
function detectWebhookSource(req) {
  if (req.headers['stripe-signature'])       return 'stripe';
  if (req.headers['x-cinetpay-signature'])   return 'cinetpay';
  if (req.body?.hash && req.body?.invoice)   return 'paydunya';
  return 'unknown';
}

// ── Stripe webhook ────────────────────────────────────────────
async function handleStripeWebhook(req) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const sig           = req.headers['stripe-signature'];

  if (!webhookSecret || !sig) {
    throw new Error('Stripe webhook secret ou signature manquante');
  }

  // Vérification de la signature Stripe (HMAC SHA256)
  // Le body doit être brut (non parsé) — Vercel le fournit dans req.body si configuré
  const rawBody = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
  const timestamp = sig.split(',').find(p => p.startsWith('t=')).split('=')[1];
  const sigHash   = sig.split(',').find(p => p.startsWith('v1=')).split('=')[1];

  const expectedSig = crypto
    .createHmac('sha256', webhookSecret)
    .update(`${timestamp}.${rawBody}`)
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(sigHash, 'hex'), Buffer.from(expectedSig, 'hex'))) {
    throw new Error('Signature Stripe invalide');
  }

  const event = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    return {
      txId:   session.metadata?.transaction_id,
      status: session.payment_status === 'paid' ? 'completed' : 'failed'
    };
  }

  return { txId: null, status: 'pending' };
}

// ── CinetPay webhook ──────────────────────────────────────────
function handleCinetPayWebhook(body) {
  // CinetPay envoie : cpm_trans_id (= notre txId), cpm_result, cpm_error_message
  const txId   = body?.cpm_trans_id || body?.transaction_id;
  const result = body?.cpm_result;
  // 00 = succès chez CinetPay
  const status = result === '00' ? 'completed' : 'failed';
  return { txId, status };
}

// ── PayDunya webhook ──────────────────────────────────────────
function handlePayDunyaWebhook(body) {
  const txId   = body?.custom_data?.transaction_id || body?.invoice?.token;
  const status = body?.status === 'completed' ? 'completed' : 'failed';
  return { txId, status };
}

// ── Finalisation ──────────────────────────────────────────────
async function completeTransaction(txId, txDoc, projectId) {
  const purchaseId = `${txDoc.uid}_${txDoc.articleId}`;
  await writeFirestoreDoc(projectId, 'purchases', purchaseId, {
    uid:           txDoc.uid,
    articleId:     txDoc.articleId,
    method:        txDoc.method,
    mode:          txDoc.mode,
    amount:        txDoc.amount,
    currency:      txDoc.currency || 'XOF',
    transactionId: txId,
    status:        'completed',
    paidAt:        new Date().toISOString(),
    expiresAt:     txDoc.mode === 'sub'
      ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
      : null
  });
  await updateTransactionStatus(projectId, txId, 'completed');
}

// ── Firestore helpers ─────────────────────────────────────────
async function getFirebaseToken() {
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (!clientEmail || !privateKey) return null;
  try {
    const now     = Math.floor(Date.now() / 1000);
    const header  = btoa(JSON.stringify({ alg:'RS256', typ:'JWT' }));
    const payload = btoa(JSON.stringify({ iss:clientEmail, sub:clientEmail, aud:'https://oauth2.googleapis.com/token', iat:now, exp:now+3600, scope:'https://www.googleapis.com/auth/datastore' }));
    const sigInput = `${header}.${payload}`;
    const keyData  = privateKey.replace('-----BEGIN PRIVATE KEY-----','').replace('-----END PRIVATE KEY-----','').replace(/\s/g,'');
    const keyBuf   = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
    const cryptoKey = await crypto.subtle.importKey('pkcs8', keyBuf.buffer, { name:'RSASSA-PKCS1-v1_5', hash:'SHA-256' }, false, ['sign']);
    const sigBuf   = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
    const sig      = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
    const r = await fetch('https://oauth2.googleapis.com/token', { method:'POST', headers:{'Content-Type':'application/x-www-form-urlencoded'}, body:`grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${sigInput}.${sig}` });
    return (await r.json()).access_token || null;
  } catch(e) { return null; }
}

async function getFirestoreDoc(projectId, col, docId) {
  const token = await getFirebaseToken();
  if (!token) return null;
  const r = await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}/${docId}`, { headers:{'Authorization':`Bearer ${token}`} });
  if (!r.ok) return null;
  const d = await r.json();
  if (!d.fields) return null;
  return Object.fromEntries(Object.entries(d.fields).map(([k,v]) => [k, v.stringValue ?? v.booleanValue ?? null]));
}

async function writeFirestoreDoc(projectId, col, docId, data) {
  const token = await getFirebaseToken();
  if (!token) return;
  await fetch(`https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${col}/${docId}`, {
    method:'PATCH',
    headers:{'Authorization':`Bearer ${token}`,'Content-Type':'application/json'},
    body: JSON.stringify({ fields: Object.fromEntries(Object.entries(data).map(([k,v]) => [k, v === null ? {nullValue:null} : {stringValue:String(v)}])) })
  });
}

async function updateTransactionStatus(projectId, txId, status) {
  await writeFirestoreDoc(projectId, 'transactions', txId, { status, updatedAt: new Date().toISOString() });
}
