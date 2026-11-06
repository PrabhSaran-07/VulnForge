import { createHmac, timingSafeEqual } from 'node:crypto';
function readVerifierKeyring(value) {
    if (!value) {
        return { available: false };
    }
    let parsed;
    try {
        parsed = JSON.parse(value);
    }
    catch {
        return { available: false };
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { available: false };
    }
    const entries = Object.entries(parsed);
    if (entries.length === 0) {
        return { available: false };
    }
    const keys = new Map();
    for (const [version, encodedKey] of entries) {
        if (!/^[A-Za-z0-9._-]{1,50}$/.test(version) || typeof encodedKey !== 'string') {
            return { available: false };
        }
        const key = Buffer.from(encodedKey, 'base64');
        if (key.length < 32 || key.toString('base64') !== encodedKey) {
            return { available: false };
        }
        keys.set(version, key);
    }
    return { available: true, keys };
}
export function createFlagVerifierHash(flag, key) {
    return createHmac('sha256', key).update(flag, 'utf8').digest('hex');
}
export function verifySubmittedFlag(flag, verifierHash, verifierKeyVersion, configuredKeyring = process.env.VULNFORGE_FLAG_HMAC_KEYS) {
    const keyring = readVerifierKeyring(configuredKeyring);
    if (!keyring.available) {
        return null;
    }
    const key = keyring.keys.get(verifierKeyVersion);
    if (!key || !/^[a-fA-F0-9]{64}$/.test(verifierHash)) {
        return null;
    }
    const expected = Buffer.from(verifierHash, 'hex');
    const actual = createHmac('sha256', key).update(flag, 'utf8').digest();
    if (expected.length !== actual.length) {
        return null;
    }
    return timingSafeEqual(actual, expected);
}
export async function persistSubmission(transaction, input) {
    const submission = await transaction.flagSubmission.create({
        data: {
            userId: input.userId,
            challengeId: input.challengeId,
            attemptId: input.attemptId,
            result: input.correct ? 'CORRECT' : 'INCORRECT',
            submittedAt: input.submittedAt,
        },
        select: {
            id: true,
            result: true,
            submittedAt: true,
        },
    });
    if (!input.correct) {
        return {
            submission,
            pointsAwarded: 0,
            alreadySolved: false,
        };
    }
    const existingSolve = await transaction.challengeSolve.findUnique({
        where: {
            userId_challengeId: {
                userId: input.userId,
                challengeId: input.challengeId,
            },
        },
        select: { id: true },
    });
    const alreadySolved = existingSolve !== null;
    let pointsAwarded = 0;
    if (!alreadySolved) {
        const hintPenalties = await transaction.challengeHintUsage.aggregate({
            where: {
                userId: input.userId,
                challengeId: input.challengeId,
            },
            _sum: { penaltyPoints: true },
        });
        pointsAwarded = Math.max(0, input.points - (hintPenalties._sum.penaltyPoints ?? 0));
    if (!alreadySolved) {
        const hintPenalties = await transaction.challengeHintUsage.aggregate({
            where: {
                userId: input.userId,
                challengeId: input.challengeId,
            },
            _sum: { penaltyPoints: true },
        });
        pointsAwarded = Math.max(0, input.points - (hintPenalties._sum.penaltyPoints ?? 0));
        if (!alreadySolved) {
            await transaction.challengeSolve.create({
                data: {
                    userId: input.userId,
                    challengeId: input.challengeId,
                    pointsAwarded,
                    pointsAwarded: input.points,
                    solvedAt: input.submittedAt,
                },
            });
        }
        const attemptUpdate = await transaction.challengeAttempt.updateMany({
            where: {
                id: input.attemptId,
                userId: input.userId,
                challengeId: input.challengeId,
                pointsAwarded,
                pointsAwarded: input.points,
                solvedAt: input.submittedAt,
            },
        });
        if (attemptUpdate.count !== 1) {
            throw new Error('Challenge attempt changed state before it could be solved.');
        }
        return {
            submission,
            pointsAwarded,
            pointsAwarded: alreadySolved ? 0 : input.points,
            alreadySolved,
        };
    }
    const attemptUpdate = await transaction.challengeAttempt.updateMany({
        where: {
            id: input.attemptId,
            userId: input.userId,
            challengeId: input.challengeId,
            status: 'ACTIVE',
        },
        data: {
            status: 'SOLVED',
            solvedAt: input.submittedAt,
        },
    });
    if (attemptUpdate.count !== 1) {
        throw new Error('Challenge attempt changed state before it could be solved.');
    }
    return {
        submission,
        pointsAwarded,
        pointsAwarded: alreadySolved ? 0 : input.points,
        alreadySolved,
    };
}
