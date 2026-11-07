import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import { hashPassword } from './lib/auth.js';
import { createFlagVerifierHash, persistSubmission } from './lib/challenge-submissions.js';
process.env.NODE_ENV = 'test';
const flagVerifierTestKey = Buffer.from('vulnforge-module-four-test-verifier-key');
process.env.VULNFORGE_FLAG_HMAC_KEYS = JSON.stringify({
    v1: flagVerifierTestKey.toString('base64'),
});
const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;
const userIds = new Set();
const categoryIds = new Set();
const challengeIds = new Set();
const uniqueSlug = (prefix) => `${prefix}-${randomUUID()}`;
async function createStudent() {
    const suffix = randomUUID();
    const password = 'Module4TestPass123';
    const user = await prisma.user.create({
        data: {
            username: `challenge${suffix.slice(0, 10)}`,
            email: `challenge-${suffix}@example.com`,
            passwordHash: await hashPassword(password),
        },
    });
    userIds.add(user.id);
    const agent = request.agent(app);
    await agent.post('/api/auth/login')
        .send({ identifier: user.email, password })
        .expect(200);
    return { user, agent };
}
async function createCategory(name = 'Challenge API category') {
    const category = await prisma.category.create({
        data: {
            slug: uniqueSlug('category'),
            name,
            description: 'Category fixture for challenge API tests.',
        },
    });
    categoryIds.add(category.id);
    return category;
}
async function createChallenge(categoryId, options = {}) {
    const challenge = await prisma.challenge.create({
        data: {
            slug: uniqueSlug('challenge'),
            title: options.title ?? 'API test challenge',
            description: 'A detailed challenge description.',
            learningObjectives: ['Understand safe handling', 'Practice validation'],
            categoryId,
            difficulty: options.difficulty ?? 'BEGINNER',
            points: 100,
            status: options.status ?? 'PUBLISHED',
            availableFrom: options.availableFrom,
            availableUntil: options.availableUntil,
        },
    });
    challengeIds.add(challenge.id);
    if (options.withSecret) {
        await prisma.challengeSecret.create({
            data: {
                challengeId: challenge.id,
                verifierHash: options.verifierHash
                    ?? (options.flag
                        ? createFlagVerifierHash(options.flag, flagVerifierTestKey)
                        : 'must-never-appear-in-api-responses'),
                verifierKeyVersion: options.verifierKeyVersion ?? 'v1',
            },
        });
    }
    return challenge;
}
afterEach(async () => {
    if (challengeIds.size > 0) {
        const ids = [...challengeIds];
        await prisma.flagSubmission.deleteMany({ where: { challengeId: { in: ids } } });
        await prisma.challengeSolve.deleteMany({ where: { challengeId: { in: ids } } });
        await prisma.challengeAttempt.deleteMany({ where: { challengeId: { in: ids } } });
        await prisma.challengeSecret.deleteMany({ where: { challengeId: { in: ids } } });
        await prisma.challenge.deleteMany({ where: { id: { in: ids } } });
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
test('challenge catalogue, details, and attempt routes require authentication', async () => {
    const paths = [
        ['/get', '/api/categories'],
        ['/get', '/api/challenges'],
        ['/get', '/api/challenges/valid-challenge'],
        ['/post', '/api/challenges/valid-challenge/attempts'],
        ['/post', `/api/challenges/valid-challenge/attempts/${randomUUID()}/stop`],
        ['/post', `/api/challenges/valid-challenge/attempts/${randomUUID()}/submissions`],
    ];
    for (const [method, path] of paths) {
        const response = method === '/get'
            ? await request(app).get(path)
            : await request(app).post(path).send({});
        assert.equal(response.status, 401, `${method} ${path} should require authentication`);
        assert.equal(response.body.error, 'Unauthorized');
    }
    await request(app).get('/api/health').expect(200);
    await request(app).get('/api/not-a-challenge-route').expect(404);
});
test('flag submission records an incorrect flag without solving or stopping its active attempt', async () => {
    const { agent, user } = await createStudent();
    const category = await createCategory();
    const expectedFlag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, {
        withSecret: true,
        flag: expectedFlag,
    });
    const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    const submittedFlag = `VULNFORGE{wrong-${randomUUID()}}`;
    const response = await agent.post(`/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`).send({ flag: submittedFlag }).expect(200);
    assert.deepEqual(response.body, { correct: false, message: 'Incorrect flag.' });
    assert.equal(JSON.stringify(response.body).includes(expectedFlag), false);
    assert.equal(JSON.stringify(response.body).includes('verifierHash'), false);
    const [submission, stillActive, solveCount] = await Promise.all([
        prisma.flagSubmission.findFirst({
            where: { userId: user.id, attemptId: attempt.body.attempt.id },
        }),
        prisma.challengeAttempt.findUnique({
            where: { id: attempt.body.attempt.id },
            select: { status: true, stoppedAt: true, solvedAt: true },
        }),
        prisma.challengeSolve.count({ where: { userId: user.id, challengeId: challenge.id } }),
    ]);
    assert.ok(submission);
    assert.equal(submission.result, 'INCORRECT');
    assert.equal(submission.userId, user.id);
    assert.equal(submission.challengeId, challenge.id);
    assert.ok(submission.submittedAt instanceof Date);
    assert.deepEqual(stillActive, { status: 'ACTIVE', stoppedAt: null, solvedAt: null });
    assert.equal(solveCount, 0);
});
test('correct flag creates one solve, records the submission and awards database points', async () => {
    const { agent, user } = await createStudent();
    const category = await createCategory();
    const expectedFlag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, {
        withSecret: true,
        flag: expectedFlag,
    });
    const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    const response = await agent.post(`/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`).send({ flag: expectedFlag }).expect(200);
    assert.deepEqual(response.body, {
        correct: true,
        pointsAwarded: challenge.points,
        alreadySolved: false,
    });
    const [submission, solve, solvedAttempt] = await Promise.all([
        prisma.flagSubmission.findFirst({
            where: { userId: user.id, attemptId: attempt.body.attempt.id },
        }),
        prisma.challengeSolve.findUnique({
            where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
        }),
        prisma.challengeAttempt.findUnique({
            where: { id: attempt.body.attempt.id },
            select: { status: true, solvedAt: true, stoppedAt: true },
        }),
    ]);
    assert.ok(submission);
    assert.equal(submission.result, 'CORRECT');
    assert.ok(solve);
    assert.equal(solve.pointsAwarded, challenge.points);
    assert.deepEqual(solvedAttempt?.status, 'SOLVED');
    assert.ok(solvedAttempt?.solvedAt);
    assert.equal(solvedAttempt?.stoppedAt, null);
    assert.equal(JSON.stringify(response.body).includes(expectedFlag), false);
    assert.equal(JSON.stringify(response.body).includes('verifierHash'), false);
});
test('flag submissions reject stopped, mismatched, invalid and another user attempts', async () => {
    const owner = await createStudent();
    const otherUser = await createStudent();
    const category = await createCategory();
    const firstFlag = `VULNFORGE{first-${randomUUID()}}`;
    const secondFlag = `VULNFORGE{second-${randomUUID()}}`;
    const firstChallenge = await createChallenge(category.id, {
        withSecret: true,
        flag: firstFlag,
    });
    const secondChallenge = await createChallenge(category.id, {
        withSecret: true,
        flag: secondFlag,
    });
    const attempt = await owner.agent.post(`/api/challenges/${firstChallenge.slug}/attempts`)
        .send({})
        .expect(201);
    const attemptId = attempt.body.attempt.id;
    const submissionPath = `/api/challenges/${firstChallenge.slug}/attempts/${attemptId}/submissions`;
    await otherUser.agent.post(submissionPath).send({ flag: firstFlag }).expect(404);
    await owner.agent.post(`/api/challenges/${secondChallenge.slug}/attempts/${attemptId}/submissions`).send({ flag: secondFlag }).expect(404);
    await owner.agent.post(`/api/challenges/${firstChallenge.slug}/attempts/${randomUUID()}/submissions`).send({ flag: firstFlag }).expect(404);
    await owner.agent.post(`/api/challenges/${firstChallenge.slug}/attempts/${attemptId}/stop`)
        .send({})
        .expect(200);
    await owner.agent.post(submissionPath).send({ flag: firstFlag }).expect(409);
    const submissionCount = await prisma.flagSubmission.count({ where: { attemptId } });
    assert.equal(submissionCount, 0);
});
test('flag submissions reject attempts after a challenge expires or is unpublished', async () => {
    const { agent, user } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const expiredChallenge = await createChallenge(category.id, {
        withSecret: true,
        flag,
    });
    const expiredAttempt = await agent.post(`/api/challenges/${expiredChallenge.slug}/attempts`).send({}).expect(201);
    await prisma.challenge.update({
        where: { id: expiredChallenge.id },
        data: { availableUntil: new Date(Date.now() - 60_000) },
    });
    await agent.post(`/api/challenges/${expiredChallenge.slug}/attempts/${expiredAttempt.body.attempt.id}/submissions`).send({ flag }).expect(404);
    const unpublishedChallenge = await createChallenge(category.id, {
        withSecret: true,
        flag,
    });
    const unpublishedAttempt = await agent.post(`/api/challenges/${unpublishedChallenge.slug}/attempts`).send({}).expect(201);
    await prisma.challenge.update({
        where: { id: unpublishedChallenge.id },
        data: { status: 'ARCHIVED' },
    });
    await agent.post(`/api/challenges/${unpublishedChallenge.slug}/attempts/${unpublishedAttempt.body.attempt.id}/submissions`).send({ flag }).expect(404);
    const [submissionCount, solveCount, activeAttempts] = await Promise.all([
        prisma.flagSubmission.count({
            where: { userId: user.id, challengeId: { in: [expiredChallenge.id, unpublishedChallenge.id] } },
        }),
        prisma.challengeSolve.count({
            where: { userId: user.id, challengeId: { in: [expiredChallenge.id, unpublishedChallenge.id] } },
        }),
        prisma.challengeAttempt.count({
            where: {
                userId: user.id,
                challengeId: { in: [expiredChallenge.id, unpublishedChallenge.id] },
                status: 'ACTIVE',
            },
        }),
    ]);
    assert.equal(submissionCount, 0);
    assert.equal(solveCount, 0);
    assert.equal(activeAttempts, 2);
});
test('flag submissions reject invalid, oversized and extra input fields', async () => {
    const { agent } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, { withSecret: true, flag });
    const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    const path = `/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`;
    await agent.post(path).send({ flag: '' }).expect(400);
    await agent.post(path).send({ flag: 'x'.repeat(257) }).expect(400);
    await agent.post(path).send({ flag: 'é'.repeat(129) }).expect(400);
    await agent.post(path).send({ flag, userId: randomUUID() }).expect(400);
    await agent.post(path).send({ flag, points: 999999 }).expect(400);
    assert.equal(await prisma.flagSubmission.count({ where: { attemptId: attempt.body.attempt.id } }), 0);
});
test('missing, malformed and unsupported verifier configuration fail closed', async () => {
    const { agent } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, { withSecret: true, flag });
    const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    const path = `/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`;
    const originalKeyring = process.env.VULNFORGE_FLAG_HMAC_KEYS;
    try {
        delete process.env.VULNFORGE_FLAG_HMAC_KEYS;
        const missing = await agent.post(path).send({ flag }).expect(503);
        assert.equal(JSON.stringify(missing.body).includes('verifier'), false);
        process.env.VULNFORGE_FLAG_HMAC_KEYS = '{invalid';
        await agent.post(path).send({ flag }).expect(503);
        process.env.VULNFORGE_FLAG_HMAC_KEYS = JSON.stringify({
            v1: Buffer.from('too-short').toString('base64'),
        });
        await agent.post(path).send({ flag }).expect(503);
        process.env.VULNFORGE_FLAG_HMAC_KEYS = JSON.stringify({
            otherVersion: flagVerifierTestKey.toString('base64'),
        });
        await agent.post(path).send({ flag }).expect(503);
    }
    finally {
        if (originalKeyring === undefined) {
            delete process.env.VULNFORGE_FLAG_HMAC_KEYS;
        }
        else {
            process.env.VULNFORGE_FLAG_HMAC_KEYS = originalKeyring;
        }
    }
    assert.equal(await prisma.flagSubmission.count({ where: { attemptId: attempt.body.attempt.id } }), 0);
});
test('invalid persisted verifier hashes fail closed without exposing verifier data', async () => {
    const { agent } = await createStudent();
    const category = await createCategory();
    const challenge = await createChallenge(category.id, {
        withSecret: true,
        flag: 'not-used',
        verifierHash: 'not-a-sha256-hex-digest',
    });
    const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    const response = await agent.post(`/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`).send({ flag: 'any-valid-submission' }).expect(503);
    assert.equal(JSON.stringify(response.body).includes('not-a-sha256-hex-digest'), false);
    assert.equal(await prisma.flagSubmission.count({ where: { attemptId: attempt.body.attempt.id } }), 0);
});
test('a later correct attempt does not award points twice or overwrite the original solve', async () => {
    const { agent, user } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, { withSecret: true, flag });
    const firstAttempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    await agent.post(`/api/challenges/${challenge.slug}/attempts/${firstAttempt.body.attempt.id}/submissions`).send({ flag }).expect(200);
    const originalSolve = await prisma.challengeSolve.findUniqueOrThrow({
        where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
    });
    await prisma.challenge.update({
        where: { id: challenge.id },
        data: { points: challenge.points + 75 },
    });
    const secondAttempt = await prisma.challengeAttempt.create({
        data: { userId: user.id, challengeId: challenge.id },
    });
    const response = await agent.post(`/api/challenges/${challenge.slug}/attempts/${secondAttempt.id}/submissions`).send({ flag }).expect(200);
    assert.deepEqual(response.body, {
        correct: true,
        pointsAwarded: 0,
        alreadySolved: true,
    });
    const [solve, submissionCount] = await Promise.all([
        prisma.challengeSolve.findUniqueOrThrow({
            where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
        }),
        prisma.flagSubmission.count({ where: { userId: user.id, challengeId: challenge.id } }),
    ]);
    assert.equal(solve.id, originalSolve.id);
    assert.equal(solve.pointsAwarded, challenge.points);
    assert.equal(submissionCount, 2);
});
test('concurrent correct submissions create one solve and award points exactly once', async () => {
    const { agent, user } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, { withSecret: true, flag });
    const attempts = await Promise.all([
        prisma.challengeAttempt.create({ data: { userId: user.id, challengeId: challenge.id } }),
        prisma.challengeAttempt.create({ data: { userId: user.id, challengeId: challenge.id } }),
    ]);
    const responses = await Promise.all(attempts.map((attempt) => agent.post(`/api/challenges/${challenge.slug}/attempts/${attempt.id}/submissions`).send({ flag })));
    assert.deepEqual(responses.map((response) => response.status), [200, 200]);
    assert.deepEqual(responses.map((response) => response.body.pointsAwarded).sort((a, b) => a - b), [0, challenge.points]);
    assert.equal(await prisma.challengeSolve.count({ where: { userId: user.id, challengeId: challenge.id } }), 1);
    assert.equal(await prisma.flagSubmission.count({ where: { userId: user.id, challengeId: challenge.id } }), 2);
    assert.equal(await prisma.challengeSolve.aggregate({
        where: { userId: user.id, challengeId: challenge.id },
        _sum: { pointsAwarded: true },
    }).then((aggregate) => aggregate._sum.pointsAwarded), challenge.points);
});
test('submission rate limiting enforces an authenticated-user limit', async () => {
    const { agent } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, { withSecret: true, flag });
    const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    const path = `/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`;
    for (let submission = 0; submission < 5; submission += 1) {
        await agent.post(path).send({ flag: `incorrect-${submission}` }).expect(200);
    }
    const limited = await agent.post(path).send({ flag: 'sixth-incorrect' }).expect(429);
    assert.equal(limited.body.error, 'Too many requests');
    assert.equal(limited.headers['ratelimit-limit'], '5');
});
test('transaction rollback removes the submission and solve and leaves the attempt active', async () => {
    const { user } = await createStudent();
    const category = await createCategory();
    const flag = `VULNFORGE{${randomUUID()}}`;
    const challenge = await createChallenge(category.id, { withSecret: true, flag });
    const attempt = await prisma.challengeAttempt.create({
        data: { userId: user.id, challengeId: challenge.id },
    });
    await assert.rejects(prisma.$transaction(async (transaction) => {
        await persistSubmission(transaction, {
            userId: user.id,
            challengeId: challenge.id,
            attemptId: attempt.id,
            points: challenge.points,
            correct: true,
            submittedAt: new Date(),
        });
        throw new Error('Simulated failure before transaction commit.');
    }));
    const [submissionCount, solveCount, persistedAttempt] = await Promise.all([
        prisma.flagSubmission.count({ where: { attemptId: attempt.id } }),
        prisma.challengeSolve.count({ where: { userId: user.id, challengeId: challenge.id } }),
        prisma.challengeAttempt.findUnique({
            where: { id: attempt.id },
            select: { status: true, solvedAt: true },
        }),
    ]);
    assert.equal(submissionCount, 0);
    assert.equal(solveCount, 0);
    assert.deepEqual(persistedAttempt, { status: 'ACTIVE', solvedAt: null });
});
test('category counts and challenge filters include only available published challenges', async () => {
    const { user, agent } = await createStudent();
    const firstCategory = await createCategory('First API category');
    const secondCategory = await createCategory('Second API category');
    const solvedChallenge = await createChallenge(firstCategory.id, {
        title: 'Solved beginner',
        withSecret: true,
    });
    const advancedChallenge = await createChallenge(firstCategory.id, {
        title: 'Unsolved advanced',
        difficulty: 'ADVANCED',
    });
    const otherCategoryChallenge = await createChallenge(secondCategory.id, {
        title: 'Unsolved other category',
    });
    await createChallenge(firstCategory.id, { status: 'DRAFT' });
    await createChallenge(firstCategory.id, { status: 'ARCHIVED' });
    await createChallenge(firstCategory.id, { availableFrom: new Date(Date.now() + 60_000) });
    await createChallenge(firstCategory.id, { availableUntil: new Date(Date.now() - 60_000) });
    await prisma.challengeSolve.create({
        data: {
            userId: user.id,
            challengeId: solvedChallenge.id,
            pointsAwarded: solvedChallenge.points,
        },
    });
    const categoriesResponse = await agent.get('/api/categories').expect(200);
    assert.deepEqual(categoriesResponse.body.categories
        .filter((category) => [firstCategory.slug, secondCategory.slug].includes(category.slug))
        .map((category) => ({
        slug: category.slug,
        challengeCount: category.challengeCount,
    })).sort((a, b) => a.slug.localeCompare(b.slug)), [
        { slug: firstCategory.slug, challengeCount: 2 },
        { slug: secondCategory.slug, challengeCount: 1 },
    ].sort((a, b) => a.slug.localeCompare(b.slug)));
    assert.equal(JSON.stringify(categoriesResponse.body).includes('must-never-appear-in-api-responses'), false);
    const allChallenges = await agent.get('/api/challenges').expect(200);
    assert.deepEqual(allChallenges.body.challenges
        .filter((challenge) => [
        solvedChallenge.slug,
        advancedChallenge.slug,
        otherCategoryChallenge.slug,
    ].includes(challenge.slug))
        .map((challenge) => challenge.slug)
        .sort(), [solvedChallenge.slug, advancedChallenge.slug, otherCategoryChallenge.slug].sort());
    assert.equal(allChallenges.body.challenges.find((challenge) => challenge.slug === solvedChallenge.slug).solved, true);
    const categoryFilter = await agent.get(`/api/challenges?category=${firstCategory.slug}`).expect(200);
    assert.deepEqual(categoryFilter.body.challenges
        .map((challenge) => challenge.slug)
        .filter((slug) => [solvedChallenge.slug, advancedChallenge.slug].includes(slug))
        .sort(), [solvedChallenge.slug, advancedChallenge.slug].sort());
    const difficultyFilter = await agent.get('/api/challenges?difficulty=ADVANCED').expect(200);
    assert.deepEqual(difficultyFilter.body.challenges.map((challenge) => challenge.slug), [advancedChallenge.slug]);
    const solvedFilter = await agent.get('/api/challenges?solved=true').expect(200);
    assert.deepEqual(solvedFilter.body.challenges
        .map((challenge) => challenge.slug)
        .filter((slug) => slug === solvedChallenge.slug), [solvedChallenge.slug]);
    const unsolvedFilter = await agent.get('/api/challenges?solved=false').expect(200);
    assert.deepEqual(unsolvedFilter.body.challenges
        .map((challenge) => challenge.slug)
        .filter((slug) => [advancedChallenge.slug, otherCategoryChallenge.slug].includes(slug))
        .sort(), [advancedChallenge.slug, otherCategoryChallenge.slug].sort());
    const pageFilter = await agent.get('/api/challenges?page=2&limit=1').expect(200);
    assert.equal(pageFilter.body.challenges.length, 1);
    assert.equal(pageFilter.body.pagination.page, 2);
    assert.equal(pageFilter.body.pagination.limit, 1);
});
test('Coming Soon module slugs cannot be opened, started, or used for flag submissions', {
    timeout: 20_000,
}, async () => {
    const { agent } = await createStudent();
    const submissionAgents = await Promise.all([
        createStudent(),
        createStudent(),
        createStudent(),
        createStudent(),
    ]);
    const plannedSlugs = [
        'inj-01-search-query-injection', 'inj-02-query-construction-flaw', 'inj-03-api-parameter-injection',
        'session-01-session-handling', 'session-02-token-validation', 'session-03-session-expiry',
        'upload-01-extension-validation', 'upload-02-mime-content-validation', 'upload-03-storage-path-handling',
        'api-01-object-authorization', 'api-02-missing-authorization', 'api-03-excessive-data-exposure',
        'api-04-weak-rate-limiting', 'api-05-input-validation',
        'config-01-debug-error-disclosure', 'config-02-security-headers',
        'config-03-cors-configuration', 'config-04-information-disclosure',
    ];
    for (const [index, slug] of plannedSlugs.entries()) {
        await agent.get(`/api/challenges/${slug}`).expect(404);
        await agent.post(`/api/challenges/${slug}/attempts`).send({}).expect(404);
        await submissionAgents[index % submissionAgents.length].agent
            .post(`/api/challenges/${slug}/attempts/${randomUUID()}/submissions`)
            .send({ flag: 'VULNFORGE{unavailable}' }).expect(404);
    }
});
test('challenge details return safe metadata and hide unpublished or unavailable challenges', async () => {
    const { agent } = await createStudent();
    const category = await createCategory();
    const challenge = await createChallenge(category.id, { withSecret: true });
    const draft = await createChallenge(category.id, { status: 'DRAFT' });
    const notYetAvailable = await createChallenge(category.id, {
        availableFrom: new Date(Date.now() + 60_000),
    });
    const expired = await createChallenge(category.id, {
        availableUntil: new Date(Date.now() - 60_000),
    });
    const response = await agent.get(`/api/challenges/${challenge.slug}`).expect(200);
    assert.equal(response.body.challenge.slug, challenge.slug);
    assert.equal(response.body.challenge.description, challenge.description);
    assert.deepEqual(response.body.challenge.learningObjectives, challenge.learningObjectives);
    assert.equal(response.body.challenge.category.slug, category.slug);
    assert.ok(response.body.challenge.lifecycleInstructions.start);
    assert.equal(JSON.stringify(response.body).includes('must-never-appear-in-api-responses'), false);
    assert.equal(JSON.stringify(response.body).includes('verifierHash'), false);
    assert.equal(JSON.stringify(response.body).includes('verifierKeyVersion'), false);
    for (const unavailable of [draft, notYetAvailable, expired]) {
        await agent.get(`/api/challenges/${unavailable.slug}`).expect(404);
    }
    await agent.get('/api/challenges/unknown-challenge').expect(404);
    await agent.get('/api/challenges/Invalid_Slug').expect(400);
});
test('challenge listing rejects invalid filters and pagination', async () => {
    const { agent } = await createStudent();
    const invalidQueries = [
        'difficulty=IMPOSSIBLE',
        'solved=yes',
        'page=0',
        'page=1.5',
        'limit=101',
        'unknown=value',
        'category=Invalid_Slug',
    ];
    for (const query of invalidQueries) {
        const response = await agent.get(`/api/challenges?${query}`).expect(400);
        assert.equal(response.body.error, 'Invalid request');
    }
});
test('attempt creation is idempotent while active; stopping is terminal', async () => {
    const { agent } = await createStudent();
    const category = await createCategory();
    const challenge = await createChallenge(category.id);
    const first = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(201);
    assert.equal(first.body.attempt.status, 'ACTIVE');
    assert.ok(first.body.attempt.startedAt);
    assert.equal(first.body.attempt.solvedAt, null);
    assert.equal(first.body.attempt.stoppedAt, null);
    const repeated = await agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}).expect(200);
    assert.equal(repeated.body.attempt.id, first.body.attempt.id);
    await agent.post(`/api/challenges/${challenge.slug}/attempts`)
        .send({ userId: randomUUID() })
        .expect(400);
    const stopped = await agent.post(`/api/challenges/${challenge.slug}/attempts/${first.body.attempt.id}/stop`).send({}).expect(200);
    assert.equal(stopped.body.attempt.status, 'STOPPED');
    assert.ok(stopped.body.attempt.stoppedAt);
    assert.equal(stopped.body.attempt.solvedAt, null);
    await agent.post(`/api/challenges/${challenge.slug}/attempts/${first.body.attempt.id}/stop`).send({}).expect(409);
    const concurrentStarts = await Promise.all([
        agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}),
        agent.post(`/api/challenges/${challenge.slug}/attempts`).send({}),
    ]);
    assert.deepEqual(concurrentStarts.map((response) => response.status).sort(), [200, 201]);
    assert.equal(concurrentStarts[0].body.attempt.id, concurrentStarts[1].body.attempt.id);
    assert.notEqual(concurrentStarts[0].body.attempt.id, first.body.attempt.id);
    await agent.post(`/api/challenges/${challenge.slug}/attempts/not-a-uuid/stop`)
        .send({})
        .expect(400);
});
test('attempt creation rejects unavailable challenges and users cannot stop another user attempt', async () => {
    const owner = await createStudent();
    const anotherStudent = await createStudent();
    const category = await createCategory();
    const challenge = await createChallenge(category.id);
    const hidden = await createChallenge(category.id, { status: 'DRAFT' });
    const attempt = await owner.agent.post(`/api/challenges/${challenge.slug}/attempts`)
        .send({})
        .expect(201);
    await anotherStudent.agent.post(`/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/stop`).send({}).expect(404);
    const stillActive = await prisma.challengeAttempt.findUnique({
        where: { id: attempt.body.attempt.id },
        select: { status: true, stoppedAt: true },
    });
    assert.deepEqual(stillActive, { status: 'ACTIVE', stoppedAt: null });
    await anotherStudent.agent.post(`/api/challenges/${hidden.slug}/attempts`).send({}).expect(404);
});
