import { createRequire } from 'node:module';
import env from '../config/env.js';
import PushSubscription from '../models/PushSubscription.js';
import { emitToUser } from './realtime.js';

const require = createRequire(import.meta.url);
const webpush = require('web-push');
let configured = false;

export const configureWebPush = () => {
  if (!env.webPushEnabled) return false;
  webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);
  configured = true;
  return true;
};

export async function notifyUser(userId, notification) {
  emitToUser(userId, 'notification:new', notification);
  if (!configured) return;

  const subscriptions = await PushSubscription.find({ user: userId }).lean();
  await Promise.all(
    subscriptions.map(async (subscription) => {
      const target = {
        endpoint: subscription.endpoint,
        expirationTime: subscription.expirationTime,
        keys: subscription.keys,
      };
      try {
        await webpush.sendNotification(target, JSON.stringify(notification), { TTL: 60 });
      } catch (error) {
        if (error.statusCode === 404 || error.statusCode === 410) {
          await PushSubscription.deleteOne({ _id: subscription._id });
          return;
        }
        console.error('Web Push delivery failed', error.statusCode || error.message);
      }
    })
  );
}
