import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import { Prisma } from '@prisma/client';
process.env.NODE_ENV = 'test';
const prisma = (await import('./lib/prisma.js')).default;
const userIds = new Set();
const categoryIds = new Set();
const challengeIds = new Set();
const attemptIds = new Set();
function expectPrismaErrorCode(code) {
    return (error) => {
        assert.ok(error instanceof Prisma.PrismaClientKnownRequestError);
        assert.equal(error.code, code);
        return true;
    };
}
async function createUser() {
    const suffix = randomUUID();
    const user = await prisma.user.create({
        data: {
            username: `schema${suffix.slice(0, 12)}`,
            email: `schema-${suffix}@example.com`,
            passwordHash: 'test-only-hash',
        },
    });
    userIds.add(user.id);
    return user;
}
async function createCategory() {
    const suffix = randomUUID();
    const category = await prisma.category.create({
        data: {
            slug: `schema-${suffix}`,
            name: 'Schema test category',
        },
    });
    categoryIds.add(category.id);
    return category;
}
async function createChallenge(categoryId, slug = `schema-${randomUUID()}`, points = 100) {
    const challenge = await prisma.challenge.create({
        data: {
            slug,
            title: 'Schema test challenge',
            description: 'Used to verify database constraints.',
            categoryId,
            difficulty: 'BEGINNER',
            points,
        },
    });
    challengeIds.add(challenge.id);
    return challenge;
}
afterEach(async () => {
    if (challengeIds.size > 0) {
        await prisma.flagSubmission.deleteMany({ where: { challengeId: { in: [...challengeIds] } } });
        await prisma.challengeSolve.deleteMany({ where: { challengeId: { in: [...challengeIds] } } });
    }
    if (attemptIds.size > 0) {
        await prisma.flagSubmission.deleteMany({ where: { attemptId: { in: [...attemptIds] } } });
        await prisma.challengeAttempt.deleteMany({ where: { id: { in: [...attemptIds] } } });
        attemptIds.clear();
    }
    if (challengeIds.size > 0) {
        await prisma.challengeSecret.deleteMany({ where: { challengeId: { in: [...challengeIds] } } });
        await prisma.challenge.deleteMany({ where: { id: { in: [...challengeIds] } } });
        challengeIds.clear();
    }
    if (categoryIds.size > 0) {
        await prisma.category.deleteMany({ where: { id: { in: [...categoryIds] } } });
        categoryIds.clear();
    }
    if (userIds.size > 0) {
        await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
        userIds.clear();
    }
});
test('database rejects non-positive challenge points', async () => {
    const category = await createCategory();
    const challengeData = {
        slug: `schema-${randomUUID()}`,
        title: 'Invalid points challenge',
        description: 'This record must not be stored.',
        categoryId: category.id,
        difficulty: 'BEGINNER',
    };
    await assert.rejects(prisma.challenge.create({ data: { ...challengeData, points: 0 } }), expectPrismaErrorCode('P2039'));
    await assert.rejects(prisma.challenge.create({ data: { ...challengeData, slug: `schema-${randomUUID()}`, points: -1 } }), expectPrismaErrorCode('P2039'));
});
test('database prevents duplicate category slugs', async () => {
    const category = await createCategory();
    await assert.rejects(prisma.category.create({
        data: {
            slug: category.slug,
            name: 'Duplicate category',
        },
    }), expectPrismaErrorCode('P2002'));
});
test('database binds a flag submission to the attempt owner and challenge', async () => {
    const owner = await createUser();
    const otherUser = await createUser();
    const category = await createCategory();
    const challenge = await createChallenge(category.id);
    const attempt = await prisma.challengeAttempt.create({
        data: {
            userId: owner.id,
            challengeId: challenge.id,
        },
    });
    attemptIds.add(attempt.id);
    await assert.rejects(prisma.flagSubmission.create({
        data: {
            userId: otherUser.id,
            challengeId: challenge.id,
            attemptId: attempt.id,
            result: 'INCORRECT',
        },
    }), expectPrismaErrorCode('P2003'));
});
test('database allows only one solve record per user and challenge', async () => {
    const user = await createUser();
    const category = await createCategory();
    const challenge = await createChallenge(category.id);
    await prisma.challengeSolve.create({
        data: {
            userId: user.id,
            challengeId: challenge.id,
            pointsAwarded: challenge.points,
        },
    });
    await assert.rejects(prisma.challengeSolve.create({
        data: {
            userId: user.id,
            challengeId: challenge.id,
            pointsAwarded: challenge.points,
        },
    }), expectPrismaErrorCode('P2002'));
});
