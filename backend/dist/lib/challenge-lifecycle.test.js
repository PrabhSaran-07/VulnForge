import assert from 'node:assert/strict';
import test from 'node:test';
import { canAccessChallengeInstance, createChallengeInstance, isRuntimeStartAllowed, isRuntimeLifetimeAllowed, transitionChallengeInstance, } from './challenge-lifecycle.js';
const instance = {
    id: 'instance-1',
    ownerUserId: 'learner-1',
    runtimeId: 'isolated-challenge-runtime',
    state: 'RUNNING',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2026-01-01T00:15:00Z'),
};
test('challenge runtime remains unavailable until an isolated executor is verified', () => {
    assert.equal(isRuntimeStartAllowed(instance.runtimeId), false);
    assert.equal(isRuntimeStartAllowed('user-supplied-image'), false);
    assert.throws(() => createChallengeInstance('instance-2', 'learner-1', instance.runtimeId, 60), /not enabled/);
    assert.equal(isRuntimeLifetimeAllowed(instance.runtimeId, 60), true);
    assert.equal(isRuntimeLifetimeAllowed(instance.runtimeId, 901), false);
    assert.equal(isRuntimeLifetimeAllowed('user-supplied-image', 60), false);
});
test('challenge instances are accessible only to their owning user', () => {
    assert.equal(canAccessChallengeInstance(instance, 'learner-1'), true);
    assert.equal(canAccessChallengeInstance(instance, 'learner-2'), false);
});
test('only the owner can stop an active instance', () => {
    assert.throws(() => transitionChallengeInstance(instance, 'stop', 'learner-2'), /ownership check/);
    assert.equal(transitionChallengeInstance(instance, 'stop', 'learner-1').state, 'STOPPED');
});
test('a disabled runtime cannot be marked running, even by its owner', () => {
    const starting = { ...instance, state: 'STARTING' };
    assert.throws(() => transitionChallengeInstance(starting, 'start', 'learner-2'), /ownership check/);
    assert.throws(() => transitionChallengeInstance(starting, 'start', 'learner-1'), /not enabled/);
});
test('expiry is system-controlled and requires the expiry time to have passed', () => {
    assert.throws(() => transitionChallengeInstance(instance, 'expire', null, new Date('2025-12-31T23:59:59Z')), /has not expired/);
    const expired = transitionChallengeInstance(instance, 'expire', null, new Date('2026-01-01T00:16:00Z'));
    assert.equal(expired.state, 'EXPIRED');
});
