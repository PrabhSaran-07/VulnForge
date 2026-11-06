export type ChallengeInstanceState = 'STARTING' | 'RUNNING' | 'STOPPING' | 'STOPPED' | 'EXPIRED' | 'FAILED';
export type ChallengeLifecycleAction = 'start' | 'stop' | 'expire' | 'fail';

export type ChallengeInstance = {
  id: string;
  ownerUserId: string;
  runtimeId: string;
  state: ChallengeInstanceState;
  createdAt: Date;
  expiresAt: Date;
};

export type RuntimeDefinition = {
  id: string;
  enabled: false;
  memoryLimitMb: number;
  cpuLimitMilli: number;
  maxLifetimeSeconds: number;
  networkAccess: false;
  privileged: false;
};

export const runtimeDefinitions: readonly RuntimeDefinition[] = [
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

export function getRuntimeDefinition(runtimeId: string): RuntimeDefinition | undefined {
  return runtimeDefinitions.find((runtime) => runtime.id === runtimeId);
}

export function isRuntimeStartAllowed(runtimeId: string): boolean {
  return getRuntimeDefinition(runtimeId)?.enabled ?? false;
}

export function isRuntimeLifetimeAllowed(runtimeId: string, lifetimeSeconds: number): boolean {
  const runtime = getRuntimeDefinition(runtimeId);
  return runtime !== undefined
    && Number.isInteger(lifetimeSeconds)
    && lifetimeSeconds > 0
    && lifetimeSeconds <= runtime.maxLifetimeSeconds;
}

export function createChallengeInstance(
  id: string,
  ownerUserId: string,
  runtimeId: string,
  lifetimeSeconds: number,
  now = new Date(),
): ChallengeInstance {
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

export function canAccessChallengeInstance(instance: ChallengeInstance, userId: string): boolean {
  return instance.ownerUserId === userId;
}

export function transitionChallengeInstance(
  instance: ChallengeInstance,
  action: ChallengeLifecycleAction,
  actorUserId: string | null,
  now = new Date(),
): ChallengeInstance {
  if (action === 'expire' ? actorUserId !== null : actorUserId !== instance.ownerUserId) {
    throw new Error('Challenge instance ownership check failed.');
  }
  if (action === 'expire' && instance.expiresAt > now) {
    throw new Error('Challenge instance has not expired.');
  }
  if (action === 'start' && !isRuntimeStartAllowed(instance.runtimeId)) {
    throw new Error('Challenge runtime is not enabled.');
  }

  const transitions: Record<ChallengeLifecycleAction, ChallengeInstanceState> = {
    start: 'RUNNING',
    stop: 'STOPPED',
    expire: 'EXPIRED',
    fail: 'FAILED',
  };
  const allowed: Record<ChallengeLifecycleAction, ChallengeInstanceState[]> = {
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
