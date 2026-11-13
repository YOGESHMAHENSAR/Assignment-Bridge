import PushSubscription from '../models/PushSubscription.js';
import env from '../config/env.js';
import ApiError from '../utils/ApiError.js';
import asyncHandler from '../utils/asyncHandler.js';
import { normalizePushEndpoint, normalizePushSubscription } from '../utils/push.js';

export const getVapidPublicKey = (_req, res) => {
  res.json({ enabled: env.webPushEnabled, publicKey: env.webPushEnabled ? env.vapid.publicKey : null });
};

export const subscribe = asyncHandler(async (req, res) => {
  if (!env.webPushEnabled) throw new ApiError(503, 'Web Push is not configured on the server');
  const subscription = normalizePushSubscription(req.body);
  await PushSubscription.findOneAndUpdate(
    { endpoint: subscription.endpoint },
    { ...subscription, user: req.user._id },
    { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
  );
  res.status(201).json({ subscribed: true });
});

export const unsubscribe = asyncHandler(async (req, res) => {
  const endpoint = normalizePushEndpoint(req.body.endpoint);
  await PushSubscription.deleteOne({ user: req.user._id, endpoint });
  res.json({ subscribed: false });
});
