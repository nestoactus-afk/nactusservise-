// ═══════════════════════════════════════════════════════════════
//  /api/initiate-payment.js  —  Vercel Serverless Function
//  Reçoit la demande de paiement du frontend, crée la session
//  chez le bon processeur, retourne l'URL ou le statut.
//
//  Variables d'environnement à configurer dans Vercel Dashboard :
//  CINETPAY_API_KEY, CINETPAY_SITE_ID
//  STRIPE_SECRET_KEY
//  PAYDUNYA_MASTER_KEY, PAYDUNYA_PRIVATE_KEY, PAYDUNYA_TOKEN, PAYDUNYA_MODE
//  FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
// ═══════════════════════════════════════════════════════════════

export default async function handler(req, res) {
  // CORS — autorise votre domaine de production
  res.setHeader('Access-Control-Allow-Origin', process.env.ALLOWED_ORIGIN || '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Méthode non autorisée' });

  try {
    const {
      method, mode, amount, currency = 'XOF',
      articleId, uid, email, phone,
      returnUrl, notifyUrl, description
    } = req.body;

    // Validation de base
    if (!method || !amount || !uid || !articleId) {
      return res.status(400).json({ error: 'Paramètres manquants' });
    }
    if (amount < 100 || amount > 1000000) {
      return res.status(400).json({ error: 'Montant invalide' });
    }

    // ID de transaction unique
    const txId = `NACTUS_${Date.now()}_${uid.substring(0,8)}_${Math.random().toString(36).substring(2,7).toUpperCase()}`;

    // ── Enregistrement préliminaire dans Firebase Firestore ──────
    // On crée le document "pending" AVANT de contacter le processeur
    // pour éviter les pertes en cas d'erreur réseau.
    await saveTransaction(txId, {
      uid, articleId, method, mode,
      amount, currency, description,
      status: 'pending',
      createdAt: new Date().toISOString()
    });

    // ── Routage vers le bon processeur ───────────────────────────
    let result;

    if (['orange_money', 'moov_money', 'mtn_money', 'wave', 'free_money'].includes(method)) {
      result = await initCinetPay({ txId, amount, currency, phone, email, description, returnUrl, notifyUrl });

    } else if (method === 'card') {
      result = await initStripe({ txId, amount, currency, email, description, articleId, mode, uid, returnUrl });

    } else if (['orange_bf', 'coris_money', 'visa_qr'].includes(method)) {
      result = await initPayDunya({ txId, amount, currency, phone, email, description, returnUrl, notifyUrl });

    } else {
      return res.status(400).json({ error: `Méthode de paiement non supportée : ${method}` });
    }

    return res.status(200).json({ ...result, transaction_id: txId });

  } catch (err) {
    console.error('[initiate-payment]', err);
    return res.status(500).json({ error: err.message || 'Erreur interne du serveur' });
  }
}

// ═══════════════════════════════════════════════════════════════
//  CINETPAY — Mobile Money (Orange, Moov, MTN, Wave, Free)
// ═══════════════════════════════════════════════════════════════
async function initCinetPay({ txId, amount, currency, phone, email, description, returnUrl, notifyUrl }) {
  const apiKey  = process.env.CINETPAY_API_KEY;
  const siteId  = process.env.CINETPAY_SITE_ID;
  if (!apiKey || !siteId) throw new Error('CinetPay non configuré (variables manquantes)');

  const body = {
    apikey:           apiKey,
    site_id:          siteId,
    transaction_id:   txId,
    amount:           Math.round(amount),
    currency,
    description,
    return_url:       returnUrl,
    notify_url:       notifyUrl,
    channels:         'ALL',
    lang:             'fr',
    metadata:         txId,
    // Numéro de téléphone pour Mobile Money direct (optionnel)
    ...(phone ? { phone_number: phone } : {})
  };

  const r = await fetch('https://api-checkout.cinetpay.com/v2/payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await r.json();

  if (data.code !== '201') {
    throw new Error(`CinetPay : ${data.message || JSON.stringify(data)}`);
  }
  return { redirect_url: data.data.payment_url };
}

// ═══════════════════════════════════════════════════════════════
//  STRIPE — Cartes bancaires internationales
// ═══════════════════════════════════════════════════════════════
async function initStripe({ txId, amount, currency, email, description, articleId, mode, uid, returnUrl }) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) throw new Error('Stripe non configuré (STRIPE_SECRET_KEY manquant)');

  // Stripe Checkout Session via l'API REST (sans installer le SDK)
  const params = new URLSearchParams({
    'payment_method_types[]':             'card',
    'line_items[0][price_data][currency]': currency.toLowerCase(),
    'line_items[0][price_data][product_data][name]': description,
    'line_items[0][price_data][unit_amount]': Math.round(amount * 1),
    'line_items[0][quantity]':             '1',
    'mode':                                mode === 'sub' ? 'subscription' : 'payment',
    'success_url':                         `${returnUrl}?tx=${txId}&stripe_success=1`,
    'cancel_url':                          `${returnUrl}?tx=${txId}&stripe_cancel=1`,
    'customer_email':                      email || '',
    'metadata[transaction_id]':            txId,
    'metadata[article_id]':               articleId,
    'metadata[uid]':                       uid,
    'metadata[mode]':                      mode,
  });

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${stripeKey}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });
  const data = await r.json();
  if (data.error) throw new Error(`Stripe : ${data.error.message}`);

  return { redirect_url: data.url };
}

// ═══════════════════════════════════════════════════════════════
//  PAYDUNYA — Orange BF, Coris Money, Visa QR (Burkina Faso)
// ═══════════════════════════════════════════════════════════════
async function initPayDunya({ txId, amount, currency, phone, email, description, returnUrl, notifyUrl }) {
  const masterKey  = process.env.PAYDUNYA_MASTER_KEY;
  const privateKey = process.env.PAYDUNYA_PRIVATE_KEY;
  const token      = process.env.PAYDUNYA_TOKEN;
  const mode       = process.env.PAYDUNYA_MODE || 'test'; // 'test' ou 'live'
  if (!masterKey || !privateKey || !token) throw new Error('PayDunya non configuré');

  const baseUrl = mode === 'live'
    ? 'https://app.paydunya.com/api/v1'
    : 'https://app.paydunya.com/sandbox-api/v1';

  const body = {
    invoice: {
      items: { item_0: { name: description, quantity: 1, unit_price: amount, total_price: amount, description } },
      total_amount: amount,
      description
    },
    store: { name: 'NACTUS' },
    actions: { cancel_url: returnUrl, return_url: `${returnUrl}?tx=${txId}`, callback_url: notifyUrl },
    custom_data: { transaction_id: txId }
  };

  const r = await fetch(`${baseUrl}/checkout-invoice/create`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'PAYDUNYA-MASTER-KEY':  masterKey,
      'PAYDUNYA-PRIVATE-KEY': privateKey,
      'PAYDUNYA-TOKEN':       token
    },
    body: JSON.stringify(body)
  });
  const data = await r.json();
  if (data.response_code !== '00') throw new Error(`PayDunya : ${data.response_text || JSON.stringify(data)}`);

  return { redirect_url: data.response_text };
}

// ═══════════════════════════════════════════════════════════════
//  Firebase Admin (écriture sécurisée côté serveur)
// ═══════════════════════════════════════════════════════════════
async function saveTransaction(txId, data) {
  const projectId   = process.env.FIREBASE_PROJECT_ID   || 'videome-b7157';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey  = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (!clientEmail || !privateKey) {
    console.warn('[saveTransaction] Firebase Admin non configuré — transaction non enregistrée côté serveur');
    return;
  }
  try {
    // JWT manuel pour Firebase Admin sans installer le SDK
    const token = await getFirebaseAdminToken(clientEmail, privateKey);
    await fetch(
      `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/transactions/${txId}`,
      {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fields: Object.fromEntries(
            Object.entries(data).map(([k, v]) => [k, { stringValue: String(v) }])
          )
        })
      }
    );
  } catch(e) {
    console.error('[saveTransaction]', e.message);
  }
}

async function getFirebaseAdminToken(clientEmail, privateKey) {
  const now = Math.floor(Date.now() / 1000);
  const header  = btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = btoa(JSON.stringify({
    iss: clientEmail, sub: clientEmail,
    aud: 'https://oauth2.googleapis.com/token',
    iat: now, exp: now + 3600,
    scope: 'https://www.googleapis.com/auth/datastore'
  }));
  const sigInput = `${header}.${payload}`;

  // Signature RS256 via Web Crypto
  const keyData = privateKey
    .replace('-----BEGIN PRIVATE KEY-----', '')
    .replace('-----END PRIVATE KEY-----', '')
    .replace(/\s/g, '');
  const keyBuf  = Uint8Array.from(atob(keyData), c => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8', keyBuf.buffer,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false, ['sign']
  );
  const sigBuf = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', cryptoKey, new TextEncoder().encode(sigInput));
  const sig    = btoa(String.fromCharCode(...new Uint8Array(sigBuf)));
  const jwt    = `${sigInput}.${sig}`;

  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });
  const d = await r.json();
  if (!d.access_token) throw new Error('Impossible d\'obtenir le token Firebase Admin');
  return d.access_token;
}
