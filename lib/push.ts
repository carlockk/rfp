import webpush from 'web-push';
import PushSubscription from '@/models/PushSubscription';
import mongoose from 'mongoose';

type PushPayload = {
  title?: string;
  body?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, unknown>;
  tag?: string;
  actions?: Array<{ action: string; title: string }>;
  vibrate?: number[];
  renotify?: boolean;
};

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || process.env.NEXT_PUBLIC_APP_NAME || 'mailto:soporte@example.com';

let isConfigured = false;

function ensureConfigured() {
  if (isConfigured) return true;
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    return false;
  }
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  isConfigured = true;
  return true;
}

export function isPushAvailable() {
  return ensureConfigured();
}

async function removeSubscriptionById(id: mongoose.Types.ObjectId) {
  try {
    await PushSubscription.deleteOne({ _id: id });
  } catch (err) {
    console.error('No se pudo eliminar la subscripción inválida', err);
  }
}

export async function sendPushNotification(
  subscription: { _id: mongoose.Types.ObjectId; endpoint: string; keys: { p256dh: string; auth: string } },
  payload: PushPayload
) {
  if (!ensureConfigured()) return;
  try {
    await webpush.sendNotification(
      {
        endpoint: subscription.endpoint,
        keys: subscription.keys
      },
      JSON.stringify(payload)
    );
  } catch (err: any) {
    const statusCode = err?.statusCode || err?.body?.statusCode;
    if (statusCode === 404 || statusCode === 410) {
      await removeSubscriptionById(subscription._id);
    } else {
      console.error('Error enviando push notification', err);
    }
  }
}

export async function broadcastPush(
  subscriptions: Array<{ _id: mongoose.Types.ObjectId; endpoint: string; keys: { p256dh: string; auth: string } }>,
  payload: PushPayload
) {
  if (!ensureConfigured() || !subscriptions.length) return;
  await Promise.all(subscriptions.map((item) => sendPushNotification(item, payload)));
}
