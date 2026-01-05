import FcmToken from '@/models/FcmToken';

type FcmPayload = {
  title: string;
  body: string;
  data?: Record<string, string>;
};

let isConfigured = false;
let adminModule: typeof import('firebase-admin') | null = null;

function getServiceAccount() {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.error('No se pudo parsear FIREBASE_SERVICE_ACCOUNT_JSON', err);
    return null;
  }
}

async function ensureConfigured() {
  if (isConfigured) return true;
  if (!adminModule) {
    try {
      adminModule = await import('firebase-admin');
    } catch (err) {
      console.warn('FCM deshabilitado: falta firebase-admin', err);
      return false;
    }
  }
  if (adminModule.apps.length) {
    isConfigured = true;
    return true;
  }
  const serviceAccount = getServiceAccount();
  if (!serviceAccount) return false;
  adminModule.initializeApp({
    credential: adminModule.credential.cert(serviceAccount)
  });
  isConfigured = true;
  return true;
}

export async function isFcmAvailable() {
  return ensureConfigured();
}

export async function sendFcmToTokens(tokens: string[], payload: FcmPayload) {
  if (!tokens.length) return;
  const ready = await ensureConfigured();
  if (!ready || !adminModule) return;
  const response = await adminModule.messaging().sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body
    },
    data: payload.data || {}
  });

  const invalidTokens: string[] = [];
  response.responses.forEach((item, idx) => {
    if (item.success) return;
    const code = item.error?.code || '';
    if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-argument') {
      invalidTokens.push(tokens[idx]);
    }
  });

  if (invalidTokens.length) {
    await FcmToken.deleteMany({ token: { $in: invalidTokens } });
  }
}
