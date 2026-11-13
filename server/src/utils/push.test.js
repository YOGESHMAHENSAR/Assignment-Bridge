import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizePushSubscription } from './push.js';

const validSubscription = {
  endpoint: 'https://fcm.googleapis.com/fcm/send/subscription-token',
  keys: { p256dh: 'public-key', auth: 'auth-token' },
};

test('accepts a secure Web Push subscription endpoint and keys', () => {
  assert.deepEqual(normalizePushSubscription(validSubscription), {
    ...validSubscription,
    expirationTime: null,
  });
});

test('rejects insecure or unsupported push endpoints and missing keys', () => {
  assert.throws(() => normalizePushSubscription({ ...validSubscription, endpoint: 'http://fcm.googleapis.com/push' }));
  assert.throws(() => normalizePushSubscription({ ...validSubscription, endpoint: 'https://localhost/push' }));
  assert.throws(() => normalizePushSubscription({ endpoint: validSubscription.endpoint, keys: {} }));
});
