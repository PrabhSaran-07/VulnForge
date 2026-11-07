export const runtimeDefinitions = [
    {
        id: 'isolated-challenge-runtime',
        enabled: false,
        memoryLimitMb: 128,
        cpuLimitMilli: 500,
        maxLifetimeSeconds: 900,
        networkAccess: false,
        privileged: false,
    },
];
export function getRuntimeDefinition(runtimeId) {
    return runtimeDefinitions.find((runtime) => runtime.id === runtimeId);
}
export function isRuntimeStartAllowed(runtimeId) {
    return getRuntimeDefinition(runtimeId)?.enabled ?? false;
}
export function isRuntimeLifetimeAllowed(runtimeId, lifetimeSeconds) {
    const runtime = getRuntimeDefinition(runtimeId);
    return runtime !== undefined
        && Number.isInteger(lifetimeSeconds)
        && lifetimeSeconds > 0
        && lifetimeSeconds <= runtime.maxLifetimeSeconds;
}
export function createChallengeInstance(id, ownerUserId, runtimeId, lifetimeSeconds, now = new Date()) {
    if (!isRuntimeStartAllowed(runtimeId)) {
        throw new Error('Challenge runtime is not enabled.');
    }
    if (!isRuntimeLifetimeAllowed(runtimeId, lifetimeSeconds)) {
        throw new Error('Challenge runtime lifetime is not allowed.');
    }
    return {
        id,
        ownerUserId,
        runtimeId,
        state: 'STARTING',
        createdAt: now,
        expiresAt: new Date(now.getTime() + lifetimeSeconds * 1000),
    };
}
export function canAccessChallengeInstance(instance, userId) {
    return instance.ownerUserId === userId;
}
export function transitionChallengeInstance(instance, action, actorUserId, now = new Date()) {
    if (action === 'expire' ? actorUserId !== null : actorUserId !== instance.ownerUserId) {
        throw new Error('Challenge instance ownership check failed.');
    }
    if (action === 'expire' && instance.expiresAt > now) {
        throw new Error('Challenge instance has not expired.');
    }
    if (action === 'start' && !isRuntimeStartAllowed(instance.runtimeId)) {
        throw new Error('Challenge runtime is not enabled.');
    }
    const transitions = {
        start: 'RUNNING',
        stop: 'STOPPED',
        expire: 'EXPIRED',
        fail: 'FAILED',
    };
    const allowed = {
        start: ['STARTING', 'STOPPED'],
        stop: ['STARTING', 'RUNNING', 'STOPPING'],
        expire: ['STARTING', 'RUNNING', 'STOPPING'],
        fail: ['STARTING', 'RUNNING', 'STOPPING'],
    };
    if (!allowed[action].includes(instance.state)) {
        throw new Error(`Cannot ${action} a challenge instance in ${instance.state} state.`);
    }
    return { ...instance, state: transitions[action] };
}
