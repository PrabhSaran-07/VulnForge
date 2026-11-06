import assert from 'node:assert/strict';
import test from 'node:test';
import { sanitizeSecurityEventMetadata } from './security-events.js';

test('security-event metadata keeps only explicitly approved non-secret fields', () => {
  assert.deepEqual(
    sanitizeSecurityEventMetadata({
      route: '/api/auth/login',
      reason: 'invalid_credentials',
      password: 'synthetic-password',
      flag: 'VULNFORGE{synthetic}',
      cookie: 'session-value',
    }),
    { route: '/api/auth/login', reason: 'invalid_credentials' },
  );
});

test('security-event metadata bounds strings and strips control characters', () => {
  const value = `safe\n${'x'.repeat(200)}`;
  const sanitized = sanitizeSecurityEventMetadata({ route: value });
  assert.equal(sanitized?.route, `safe${'x'.repeat(156)}`);
});
