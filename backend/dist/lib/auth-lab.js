import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import { hashPassword, isStrongPassword, verifyPassword } from './auth.js';
export const AUTH_LAB_CHALLENGE_SLUGS = [
    'auth-01-weak-authentication',
    'auth-02-authentication-check',
    'auth-03-password-reset',
];
export const ACCESS_CONTROL_LAB_CHALLENGE_SLUGS = [
    'ac-01-object-level-access-control',
    'ac-02-role-permission-enforcement',
    'ac-03-privilege-boundary-failure',
];
export const LOCAL_SECURITY_LAB_CHALLENGE_SLUGS = [
    ...AUTH_LAB_CHALLENGE_SLUGS,
    ...ACCESS_CONTROL_LAB_CHALLENGE_SLUGS,
];
const demoUsername = 'demo.learner';
const demoPassword = 'weak1';
const resetLifetimeMs = 15 * 60 * 1000;
const maximumSecureFailures = 5;
export class AuthLabError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.status = status;
        this.name = 'AuthLabError';
    }
}
export function isAuthLabEnabled(nodeEnv, explicitlyEnabled) {
    return nodeEnv === 'test' || (nodeEnv === 'development' && explicitlyEnabled);
}
export const isAccessControlLabEnabled = isAuthLabEnabled;
export function isAuthLabContentVisible(nodeEnv, address) {
    return nodeEnv === 'test'
        || (nodeEnv === 'development' && isLoopbackAddress(address));
}
export function isLoopbackAddress(address) {
    return address === '::1'
        || address === '127.0.0.1'
        || address?.startsWith('127.') === true
        || address === '::ffff:127.0.0.1';
}
function hashResetToken(token) {
    return createHash('sha256').update(token, 'utf8').digest('hex');
}
function matchesResetToken(token, tokenHash) {
    const providedHash = Buffer.from(hashResetToken(token), 'hex');
    const expectedHash = Buffer.from(tokenHash, 'hex');
    return providedHash.length === expectedHash.length
        && timingSafeEqual(providedHash, expectedHash);
}
export class AuthLabSimulator {
    weakAuthStates = new Map();
    resetStates = new Map();
    demoPasswordHash = null;
    async compareWeakAuthentication(learnerId, username, password) {
        const state = this.weakAuthStates.get(learnerId) ?? { secureFailures: 0 };
        const knownUser = username === demoUsername;
        const insecureAuthenticated = knownUser && password === demoPassword;
        const secureLocked = state.secureFailures >= maximumSecureFailures;
        this.demoPasswordHash ??= hashPassword(demoPassword);
        const passwordMatches = await verifyPassword(password, await this.demoPasswordHash);
        const secureAuthenticated = !secureLocked && knownUser && passwordMatches;
        if (!secureAuthenticated && !secureLocked) {
            state.secureFailures += 1;
        }
        if (secureAuthenticated) {
            state.secureFailures = 0;
        }
        this.weakAuthStates.set(learnerId, state);
        return {
            vulnerable: {
                authenticated: insecureAuthenticated,
                message: knownUser
                    ? insecureAuthenticated ? 'Synthetic sign-in accepted.' : 'The synthetic password is incorrect.'
                    : 'The synthetic account does not exist.',
            },
            secure: {
                authenticated: secureAuthenticated,
                message: secureAuthenticated ? 'Synthetic sign-in accepted.' : 'Invalid demo credentials.',
                locked: secureLocked,
            },
        };
    }
    compareAuthenticationCheck(scenario) {
        const accountLookupScenario = scenario === 'known-account' || scenario === 'unknown-account';
        const vulnerable = {
            authenticated: false,
            authorized: false,
            response: 'Authentication required.',
        };
        const secure = { ...vulnerable };
        if (scenario === 'spoofed-client-authentication') {
            vulnerable.authenticated = true;
            vulnerable.authorized = true;
            vulnerable.response = 'Access granted using the client-supplied authentication claim.';
        }
        else if (scenario === 'valid-student-session') {
            vulnerable.authenticated = true;
            secure.authenticated = true;
            vulnerable.response = 'Authenticated; restricted action granted without a role check.';
            secure.response = 'Authenticated as STUDENT; administrator action denied.';
        }
        else if (accountLookupScenario) {
            vulnerable.response = scenario === 'known-account'
                ? 'Account exists; password is incorrect.'
                : 'Account does not exist.';
            secure.response = 'Invalid credentials.';
        }
        return {
            vulnerable,
            secure,
            accountEnumeration: accountLookupScenario
                ? 'The vulnerable sample responses reveal whether a synthetic account exists; the secure response is identical for both cases.'
                : null,
        };
    }
    getResetState(learnerId) {
        const state = this.resetStates.get(learnerId);
        const tokenStatus = !state
            ? 'not-requested'
            : state.used
                ? 'used'
                : state.expiresAt <= Date.now()
                    ? 'expired'
                    : 'pending';
        return {
            tokenStatus,
            sessionInvalidated: Boolean(state && state.sessionVersion > state.sessionVersionAtIssue),
            passwordChanged: Boolean(state?.passwordHash),
        };
    }
    requestPasswordReset(learnerId) {
        const token = randomBytes(32).toString('base64url');
        const sessionVersion = this.resetStates.get(learnerId)?.sessionVersion ?? 0;
        this.resetStates.set(learnerId, {
            token,
            tokenHash: hashResetToken(token),
            expiresAt: Date.now() + resetLifetimeMs,
            used: false,
            passwordHash: null,
            sessionVersion,
            sessionVersionAtIssue: sessionVersion,
        });
        return {
            message: 'If the synthetic account exists, a private local reset flow is ready.',
            expiresInSeconds: resetLifetimeMs / 1000,
            ...this.getResetState(learnerId),
        };
    }
    async confirmPasswordReset(learnerId, scenario, newPassword) {
        const state = this.resetStates.get(learnerId);
        if (!state) {
            throw new AuthLabError('Request a synthetic reset before confirming it.', 409);
        }
        if (state.used) {
            throw new AuthLabError('This synthetic reset has already been used.', 409);
        }
        if (scenario === 'replay') {
            throw new AuthLabError('A reset must be completed before its replay can be rejected.', 409);
        }
        if (scenario === 'expired') {
            state.expiresAt = Date.now() - 1;
        }
        const presentedToken = scenario === 'tampered' ? `${state.token}x` : state.token;
        if (!matchesResetToken(presentedToken, state.tokenHash)) {
            throw new AuthLabError('The synthetic reset request is invalid.', 400);
        }
        if (state.expiresAt <= Date.now()) {
            throw new AuthLabError('The synthetic reset request has expired.', 400);
        }
        if (!newPassword || newPassword.length < 12 || !isStrongPassword(newPassword)) {
            throw new AuthLabError('Use at least 12 characters with a letter and a number.', 400);
        }
        state.passwordHash = await hashPassword(newPassword);
        state.used = true;
        state.sessionVersion += 1;
        return {
            message: 'Synthetic password updated; synthetic sessions were invalidated.',
            ...this.getResetState(learnerId),
        };
    }
}
export const authLabSimulator = new AuthLabSimulator();
