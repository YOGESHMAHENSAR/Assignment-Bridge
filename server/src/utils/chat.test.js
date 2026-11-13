import assert from 'node:assert/strict';
import test from 'node:test';
import { isChatOpen, normalizeMessage } from './chat.js';

test('chat is writable only while work or review is active', () => {
  assert.equal(isChatOpen('accepted'), true);
  assert.equal(isChatOpen('submitted'), true);
  assert.equal(isChatOpen('revision'), true);
  assert.equal(isChatOpen('open'), false);
  assert.equal(isChatOpen('approved'), false);
  assert.equal(isChatOpen('cancelled'), false);
});

test('message content is trimmed and constrained', () => {
  assert.equal(normalizeMessage('  Hello  '), 'Hello');
  assert.throws(() => normalizeMessage('   '), /cannot be empty/);
  assert.throws(() => normalizeMessage('a'.repeat(2001)), /2000 characters/);
});
