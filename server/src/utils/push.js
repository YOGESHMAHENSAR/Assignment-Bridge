import ApiError from './ApiError.js';

const isAllowedPushHost = (hostname) =>
  hostname === 'fcm.googleapis.com' ||
  hostname === 'push.services.mozilla.com' ||
  hostname.endsWith('.push.services.mozilla.com') ||
  hostname === 'web.push.apple.com' ||
  /^wns\d+(?:-[a-z0-9-]+)?\.notify\.windows\.com$/i.test(hostname);

export const normalizePushEndpoint = (value) => {
  if (typeof value !== 'string' || value.length > 2048) {
    throw new ApiError(400, 'Invalid push subscription endpoint');
  }
  let endpoint;
  try {
    endpoint = new URL(value);
  } catch {
    throw new ApiError(400, 'Invalid push subscription endpoint');
  }
  if (
    endpoint.protocol !== 'https:' ||
    endpoint.username ||
    endpoint.password ||
    !isAllowedPushHost(endpoint.hostname.toLowerCase())
  ) {
    throw new ApiError(400, 'Unsupported push notification endpoint');
  }
  return endpoint.toString();
};

export const normalizePushSubscription = (input) => {
  if (!input || typeof input !== 'object') throw new ApiError(400, 'Invalid push subscription');
  const endpoint = normalizePushEndpoint(input.endpoint);

  const p256dh = input.keys?.p256dh;
  const auth = input.keys?.auth;
  if (
    typeof p256dh !== 'string' || !p256dh || p256dh.length > 200 ||
    typeof auth !== 'string' || !auth || auth.length > 100
  ) {
    throw new ApiError(400, 'Invalid push subscription keys');
  }

  return {
    endpoint,
    expirationTime: Number.isFinite(input.expirationTime) ? input.expirationTime : null,
    keys: { p256dh, auth },
  };
};
