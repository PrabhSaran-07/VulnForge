import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import { hashPassword } from './lib/auth.js';
import { accessControlLabChallenges } from './lib/access-control-lab-content.js';
import { authLabChallenges } from './lib/auth-lab-content.js';
process.env.NODE_ENV = 'test';
const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;
const userIds = new Set();
const categoryIds = new Set();
const challengeIds = new Set();
test('all six authored labs have complete educational answers and exactly one explained quiz answer per question', () => {
    const challenges = [...authLabChallenges, ...accessControlLabChallenges];
    assert.equal(challenges.length, 6);
    assert.equal(challenges.reduce((count, challenge) => count + challenge.questions.length, 0), 12);
    for (const challenge of challenges) {
        assert.ok(challenge.explanation.expectedAnswer.trim(), `${challenge.slug} needs an educational answer`);
        assert.ok(challenge.explanation.solutionSteps.length, `${challenge.slug} needs solution steps`);
        assert.ok(challenge.explanation.keyTakeaways.length, `${challenge.slug} needs takeaways`);
        for (const field of [
            'rootCause',
            'technicalExplanation',
            'impact',
            'conditions',
            'secureImplementation',
            'remediationGuidance',
            'detectionIdeas',
        ]) {
            assert.ok(challenge.explanation[field].trim(), `${challenge.slug} needs ${field}`);
        }
        for (const question of challenge.questions) {
            const correctOptions = question.options.filter((option) => option.isCorrect);
            assert.equal(correctOptions.length, 1, `${challenge.slug}: ${question.prompt}`);
            assert.ok(correctOptions[0].explanation.trim(), `${challenge.slug}: correct answer needs an explanation`);
        }
    }
});
async function createAccount(role) {
    const suffix = randomUUID();
    const password = 'AdminWorkflowPass123';
    const user = await prisma.user.create({
        data: {
            username: `${role.toLowerCase()}-${suffix.slice(0, 12)}`,
            email: `${role.toLowerCase()}-${suffix}@example.test`,
            passwordHash: await hashPassword(password),
            role,
        },
        select: { id: true, username: true, email: true },
    });
    userIds.add(user.id);
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ identifier: user.email, password }).expect(200);
    return { user, agent };
}
afterEach(async () => {
    if (userIds.size) {
        await prisma.securityEvent.deleteMany({
            where: { OR: [{ actorUserId: { in: [...userIds] } }, { targetUserId: { in: [...userIds] } }] },
        });
    }
    if (challengeIds.size) {
        await prisma.challengeSecret.deleteMany({ where: { challengeId: { in: [...challengeIds] } } });
        await prisma.challenge.deleteMany({ where: { id: { in: [...challengeIds] } } });
    }
    if (categoryIds.size) {
        await prisma.category.deleteMany({ where: { id: { in: [...categoryIds] } } });
    }
    if (userIds.size) {
        await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
    }
    userIds.clear();
    categoryIds.clear();
    challengeIds.clear();
});
test('administrator operations are validated, safe-projected, audited, and filterable', async () => {
    const { agent: admin } = await createAccount('ADMIN');
    const { user: student, agent: studentAgent } = await createAccount('STUDENT');
    const category = await prisma.category.create({
        data: { slug: `admin-test-${randomUUID()}`, name: 'Admin workflow fixture' },
    });
    categoryIds.add(category.id);
    const challenge = await prisma.challenge.create({
        data: {
            slug: `admin-test-${randomUUID()}`,
            title: 'Admin workflow fixture',
            description: 'Synthetic challenge for admin workflow tests.',
            categoryId: category.id,
            difficulty: 'BEGINNER',
            points: 10,
            status: 'DRAFT',
            explanation: {
                create: {
                    rootCause: 'Fixture root cause.',
                    technicalExplanation: 'Fixture technical explanation.',
                    impact: 'Fixture impact.',
                    conditions: 'Fixture conditions.',
                    secureImplementation: 'Fixture secure implementation.',
                    remediationGuidance: 'Fixture remediation.',
                    detectionIdeas: 'Fixture detection.',
                },
            },
            hints: {
                create: [{ order: 1, content: 'Fixture hint.', pointsPenalty: 0 }],
            },
        },
    });
    challengeIds.add(challenge.id);
    await prisma.challengeSecret.create({
        data: { challengeId: challenge.id, verifierHash: 'a'.repeat(64), verifierKeyVersion: 'test-v1' },
    });
    await studentAgent.get('/api/admin/overview').expect(403);
    await studentAgent.patch(`/api/admin/users/${student.id}/status`).send({ isActive: false }).expect(403);
    await studentAgent.get(`/api/admin/challenges/${challenge.id}/content`).expect(403);
    await studentAgent.put(`/api/admin/challenges/${challenge.id}/content`).send({}).expect(403);
    await studentAgent.get('/api/admin/lab-answer-bank').expect(403);
    await admin.get('/api/admin/overview').expect(200);
    const answerBank = await admin.get('/api/admin/lab-answer-bank').expect(200);
    assert.deepEqual(answerBank.body.futureModules, { status: 'COMING_SOON', modules: [8, 9, 10, 11, 12] });
    const implementedSlugs = new Set([
        'auth-01-weak-authentication',
        'auth-02-authentication-check',
        'auth-03-password-reset',
        'ac-01-object-level-access-control',
        'ac-02-role-permission-enforcement',
        'ac-03-privilege-boundary-failure',
    ]);
    assert.ok(answerBank.body.challenges.every((entry) => implementedSlugs.has(entry.slug)));
    if (answerBank.body.challenges.length > 0) {
        assert.ok(answerBank.body.challenges.every((entry) => entry.answerStatus === 'COMPLETE'
            && entry.questions.every((question) => question.answerStatus === 'COMPLETE')));
    }
    const bankJson = JSON.stringify(answerBank.body);
    for (const secretField of ['verifierHash', 'verifierKeyVersion', 'passwordHash', 'VULNFORGE{']) {
        assert.equal(bankJson.includes(secretField), false);
    }
    const searchableEntry = answerBank.body.challenges[0];
    if (searchableEntry) {
        const searchResult = await admin.get(`/api/admin/lab-answer-bank?search=${encodeURIComponent(searchableEntry.slug)}`).expect(200);
        assert.ok(searchResult.body.challenges.some((entry) => entry.id === searchableEntry.id));
        const questionSearch = await admin.get(`/api/admin/lab-answer-bank?search=${encodeURIComponent(searchableEntry.questions[0].prompt)}`).expect(200);
        assert.ok(questionSearch.body.challenges.some((entry) => entry.id === searchableEntry.id));
        const categoryResult = await admin.get(`/api/admin/lab-answer-bank?category=${searchableEntry.category.slug}`).expect(200);
        assert.ok(categoryResult.body.challenges.every((entry) => entry.category.slug === searchableEntry.category.slug));
        for (const entry of answerBank.body.challenges) {
            for (const question of entry.questions) {
                assert.ok(question.answerStatus === 'COMPLETE' || question.answerStatus === 'NEEDS_ANSWER');
                assert.equal(question.correctAnswers.some((answer) => 'isCorrect' in answer), false);
            }
        }
    }
    await admin.get('/api/admin/lab-answer-bank?category=modules-8').expect(400);
    const users = await admin.get(`/api/admin/users?search=${encodeURIComponent(student.username)}&limit=5`).expect(200);
    assert.equal(users.body.users.length, 1);
    assert.equal('passwordHash' in users.body.users[0], false);
    assert.equal('email' in users.body.users[0], false);
    const listedChallenges = await admin.get(`/api/admin/challenges?search=${challenge.slug}`).expect(200);
    assert.equal(listedChallenges.body.challenges.length, 1);
    assert.equal(JSON.stringify(listedChallenges.body).includes('verifierHash'), false);
    const content = await admin.get(`/api/admin/challenges/${challenge.id}/content`).expect(200);
    assert.equal(content.body.challenge.explanation.expectedAnswer, '');
    assert.deepEqual(content.body.challenge.hints, [
        { order: 1, content: 'Fixture hint.', pointsPenalty: 0 },
    ]);
    assert.equal(JSON.stringify(content.body).includes('verifierHash'), false);
    const savedContent = {
        learningObjectives: ['Check authorization on the server'],
        expectedAnswer: 'Use the authenticated actor and a server-side permission policy.',
        solutionSteps: ['Identify the actor.', 'Check its permission for the operation.'],
        keyTakeaways: ['Fail closed.', 'Test denied role cases.'],
        rootCause: 'The fixture omitted the authorization check.',
        technicalExplanation: 'Authentication does not grant every permission.',
        impact: 'Protected data may be exposed or changed.',
        conditions: 'The route trusts a session without checking the action.',
        secureImplementation: 'Use a server-side deny-by-default policy.',
        remediationGuidance: 'Check the required permission on every protected operation.',
        detectionIdeas: 'Log denials and test role boundaries.',
        hints: [{ order: 1, content: 'Inspect the trusted actor and required permission.', pointsPenalty: 0 }],
    };
    await admin.put(`/api/admin/challenges/${challenge.id}/content`).send(savedContent).expect(200);
    const updatedContent = await admin.get(`/api/admin/challenges/${challenge.id}/content`).expect(200);
    assert.deepEqual(updatedContent.body.challenge.learningObjectives, savedContent.learningObjectives);
    assert.equal(updatedContent.body.challenge.explanation.expectedAnswer, savedContent.expectedAnswer);
    assert.deepEqual(updatedContent.body.challenge.explanation.solutionSteps, savedContent.solutionSteps);
    assert.deepEqual(updatedContent.body.challenge.explanation.keyTakeaways, savedContent.keyTakeaways);
    assert.deepEqual(updatedContent.body.challenge.hints, savedContent.hints);
    assert.equal(JSON.stringify(updatedContent.body).includes('verifierHash'), false);
    await admin.put(`/api/admin/challenges/${challenge.id}/content`)
        .send({ ...savedContent, hints: [{ order: 1, content: 'first', pointsPenalty: 0 }, { order: 1, content: 'duplicate', pointsPenalty: 0 }] })
        .expect(400);
    const savedHint = await prisma.challengeHint.findUniqueOrThrow({
        where: { challengeId_order: { challengeId: challenge.id, order: 1 } },
        select: { id: true },
    });
    await prisma.challengeHintUsage.create({
        data: {
            userId: student.id,
            challengeId: challenge.id,
            hintId: savedHint.id,
            penaltyPoints: 0,
        },
    });
    await admin.put(`/api/admin/challenges/${challenge.id}/content`)
        .send({ ...savedContent, hints: [{ order: 1, content: 'Changed after reveal.', pointsPenalty: 0 }] })
        .expect(409);
    const metadata = await admin.patch(`/api/admin/challenges/${challenge.id}`).send({
        title: 'Admin workflow fixture updated',
        description: 'Updated using the validated admin metadata endpoint.',
        learningObjectives: ['Verify safe management operations'],
    }).expect(200);
    assert.equal(metadata.body.challenge.title, 'Admin workflow fixture updated');
    assert.equal(JSON.stringify(metadata.body).includes('verifierHash'), false);
    await admin.patch(`/api/admin/challenges/${challenge.id}/status`).send({ status: 'PUBLISHED' }).expect(200);
    await admin.patch(`/api/admin/challenges/${challenge.id}/status`).send({ status: 'ARCHIVED' }).expect(200);
    await admin.patch(`/api/admin/challenges/${challenge.id}/status`).send({ status: 'PUBLISHED', extra: true }).expect(400);
    await admin.patch(`/api/admin/users/${student.id}/status`).send({ isActive: false }).expect(200);
    await studentAgent.get('/api/auth/me').expect(401);
    await admin.patch(`/api/admin/users/${student.id}/status`).send({ isActive: true }).expect(200);
    const userEvents = await admin.get('/api/admin/events?eventType=admin_user_status_changed&severity=HIGH&limit=10').expect(200);
    assert.ok(userEvents.body.events.some((event) => event.target?.username === student.username));
    assert.ok(userEvents.body.countsBySeverity.some((count) => count.severity === 'HIGH'));
    const challengeEvents = await admin.get('/api/admin/events?eventType=admin_challenge_metadata_changed&limit=10').expect(200);
    assert.ok(challengeEvents.body.events.some((event) => event.metadata?.challengeSlug === challenge.slug));
    assert.equal(JSON.stringify(userEvents.body).includes('passwordHash'), false);
    assert.equal(JSON.stringify(userEvents.body).includes('verifierHash'), false);
    assert.equal(JSON.stringify(userEvents.body).includes('VULNFORGE{'), false);
    const contentEvents = await admin.get('/api/admin/events?eventType=admin_challenge_content_changed&limit=10').expect(200);
    assert.ok(contentEvents.body.events.some((event) => event.metadata?.challengeSlug === challenge.slug));
});
