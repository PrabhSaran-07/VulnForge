import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { hasValidFlagVerifierKeyring } from './challenge-submissions.js';

describe('flag verifier keyring configuration', () => {
  test('accepts a versioned key of at least 32 bytes', () => {
    const key = Buffer.alloc(32, 1).toString('base64');
    assert.equal(hasValidFlagVerifierKeyring(JSON.stringify({ v1: key })), true);
  });

  test('rejects malformed, empty, and undersized keyrings', () => {
    const shortKey = Buffer.alloc(31, 1).toString('base64');
    assert.equal(hasValidFlagVerifierKeyring(undefined), false);
    assert.equal(hasValidFlagVerifierKeyring('{invalid'), false);
    assert.equal(hasValidFlagVerifierKeyring('{}'), false);
    assert.equal(hasValidFlagVerifierKeyring(JSON.stringify({ v1: shortKey })), false);
  });

  test('rejects invalid key versions and non-canonical base64', () => {
    const key = Buffer.alloc(32, 1).toString('base64');
    assert.equal(hasValidFlagVerifierKeyring(JSON.stringify({ 'bad version': key })), false);
    assert.equal(hasValidFlagVerifierKeyring(JSON.stringify({ v1: `${key}=` })), false);
  });
});
