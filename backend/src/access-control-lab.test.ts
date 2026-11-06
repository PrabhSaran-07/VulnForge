import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import { accessControlLabChallenges } from './lib/access-control-lab-content.js';
import {
  AccessControlLabSimulator,
} from './lib/access-control-lab.js';
import {
  ACCESS_CONTROL_LAB_CHALLENGE_SLUGS,
  isAccessControlLabEnabled,
  isLoopbackAddress,
} from './lib/auth-lab.js';
import { hashPassword } from './lib/auth.js';
import { createFlagVerifierHash } from './lib/challenge-submissions.js';

process.env.NODE_ENV = 'test';
const flagVerifierTestKey = Buffer.from('vulnforge-module-seven-test-verifier-key');
process.env.VULNFORGE_FLAG_HMAC_KEYS = JSON.stringify({
  v1: flagVerifierTestKey.toString('base64'),
});
const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;

const userIds = new Set<string>();
const ownedChallengeIds = new Set<string>();
const ownedCategoryIds = new Set<string>();

async function createStudent() {
  const suffix = randomUUID();
  const password = 'Module7TestPass123';
  const user = await prisma.user.create({
    data: {
      username: `accesslab${suffix.slice(0, 10)}`,
      email: `access-lab-${suffix}@example.com`,
      passwordHash: await hashPassword(password),
    },
  });
  userIds.add(user.id);
  const agent = request.agent(app);
  await agent.post('/api/auth/login')
    .send({ identifier: user.email, password })
    .expect(200);
  return { agent, userId: user.id };
}

async function ensureChallengeContent() {
  const testFlags = new Map<string, string>();
  let category = await prisma.category.findUnique({
    where: { slug: 'access-control' },
    select: { id: true },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        slug: 'access-control',
        name: 'Access Control',
        description: 'Test-only local category.',
      },
      select: { id: true },
    });
    ownedCategoryIds.add(category.id);
  }

  for (const content of accessControlLabChallenges) {
    const existing = await prisma.challenge.findUnique({
      where: { slug: content.slug },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    const testFlag = `VULNFORGE{module7-${randomUUID()}}`;
    testFlags.set(content.slug, testFlag);
    const challenge = await prisma.challenge.create({
      data: {
        slug: content.slug,
        title: content.title,
        description: content.description,
        categoryId: category.id,
        difficulty: content.difficulty,
        points: content.points,
        status: 'PUBLISHED',
        learningObjectives: content.learningObjectives,
        context: content.context,
        prerequisites: content.prerequisites,
        hints: { create: content.hints },
        explanation: { create: content.explanation },
        quizQuestions: {
          create: content.questions.map((question, index) => ({
            order: index + 1,
            prompt: question.prompt,
            options: { create: question.options },
          })),
        },
      },
      select: { id: true },
    });
    ownedChallengeIds.add(challenge.id);
    await prisma.challengeSecret.create({
      data: {
        challengeId: challenge.id,
        verifierHash: createFlagVerifierHash(testFlag, flagVerifierTestKey),
        verifierKeyVersion: 'v1',
      },
    });
  }
  return testFlags;
}

afterEach(async () => {
  const userIdList = [...userIds];
  if (userIdList.length > 0) {
    await prisma.challengeQuizAttempt.deleteMany({ where: { userId: { in: userIdList } } });
    await prisma.flagSubmission.deleteMany({ where: { userId: { in: userIdList } } });
    await prisma.challengeSolve.deleteMany({ where: { userId: { in: userIdList } } });
    await prisma.challengeAttempt.deleteMany({ where: { userId: { in: userIdList } } });
    await prisma.user.deleteMany({ where: { id: { in: userIdList } } });
    userIds.clear();
  }
  if (ownedChallengeIds.size > 0) {
    const challengeIds = [...ownedChallengeIds];
    await prisma.challengeSecret.deleteMany({ where: { challengeId: { in: challengeIds } } });
    await prisma.challenge.deleteMany({ where: { id: { in: challengeIds } } });
    ownedChallengeIds.clear();
  }
  if (ownedCategoryIds.size > 0) {
    await prisma.category.deleteMany({ where: { id: { in: [...ownedCategoryIds] } } });
    ownedCategoryIds.clear();
  }
});

test('access-control lab is local-only and explicitly gated outside tests', () => {
  assert.equal(isAccessControlLabEnabled('development', false), false);
  assert.equal(isAccessControlLabEnabled('development', true), true);
  assert.equal(isAccessControlLabEnabled('production', true), false);
  assert.equal(isAccessControlLabEnabled('test', false), true);
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('192.0.2.10'), false);
});

test('simulator enforces synthetic ownership, permissions, and privilege boundaries', () => {
  const simulator = new AccessControlLabSimulator();
  const owned = simulator.compareObjectAccess('student-one', 'learner-document');
  const other = simulator.compareObjectAccess('student-one', 'other-learner-document');
  assert.equal(owned.vulnerable.authorized, true);
  assert.equal(owned.secure.authorized, true);
  assert.equal(other.vulnerable.authorized, true);
  assert.equal(other.secure.authorized, false);

  assert.equal(simulator.compareRolePermission('student-manage-users').vulnerable.authorized, true);
  assert.equal(simulator.compareRolePermission('student-manage-users').secure.authorized, false);
  assert.equal(simulator.compareRolePermission('admin-manage-users').secure.authorized, true);

  const escalation = simulator.comparePrivilegeBoundary('student-self-assign-admin');
  assert.equal(escalation.vulnerable.authorized, true);
  assert.equal(escalation.secure.authorized, false);
  assert.equal(escalation.stateChanged, false);
  assert.equal(simulator.comparePrivilegeBoundary('admin-run-admin-action').secure.authorized, true);
});

test('simulator endpoints require authentication, reject client identity claims, and preserve real roles', async () => {
  await request(app).get('/api/access-lab/status').expect(401);
  await request(app).post('/api/access-lab/object-access')
    .send({ resourceId: 'other-learner-document' })
    .expect(401);

  const { agent, userId } = await createStudent();
  await agent.get('/api/access-lab/status').expect(200).expect(({ body }) => {
    assert.deepEqual(body, { available: true });
  });
  await agent.post('/api/access-lab/object-access')
    .send({ resourceId: 'other-learner-document', ownerId: userId })
    .expect(400);
  await agent.post('/api/access-lab/role-permission')
    .send({ scenario: 'student-manage-users', role: 'ADMIN' })
    .expect(400);
  await agent.post('/api/access-lab/privilege-boundary')
    .send({ scenario: 'student-self-assign-admin', role: 'ADMIN', userId })
    .expect(400);

  const deniedObject = await agent.post('/api/access-lab/object-access')
    .send({ resourceId: 'other-learner-document' })
    .expect(200);
  assert.equal(deniedObject.body.vulnerable.authorized, true);
  assert.equal(deniedObject.body.secure.authorized, false);

  const deniedRole = await agent.post('/api/access-lab/role-permission')
    .send({ scenario: 'student-manage-users' })
    .expect(200);
  assert.equal(deniedRole.body.syntheticRole, 'STUDENT');
  assert.equal(deniedRole.body.vulnerable.authorized, true);
  assert.equal(deniedRole.body.secure.authorized, false);

  const deniedPrivilege = await agent.post('/api/access-lab/privilege-boundary')
    .send({ scenario: 'student-self-assign-admin' })
    .expect(200);
  assert.equal(deniedPrivilege.body.secure.authorized, false);
  assert.equal(deniedPrivilege.body.stateChanged, false);

  const realUser = await prisma.user.findUniqueOrThrow({
    where: { id: userId },
    select: { role: true },
  });
  assert.equal(realUser.role, 'STUDENT');
});

test('AC challenges use existing content APIs without leaking flags or quiz answers', async () => {
  const testFlags = await ensureChallengeContent();
  const { agent, userId } = await createStudent();
  const category = await agent.get('/api/categories').expect(200);
  assert.ok(category.body.categories.some((item: { slug: string }) => item.slug === 'access-control'));
  const catalogue = await agent.get('/api/challenges?category=access-control').expect(200);
  assert.deepEqual(
    catalogue.body.challenges.map((challenge: { slug: string }) => challenge.slug).sort(),
    [...ACCESS_CONTROL_LAB_CHALLENGE_SLUGS].sort(),
  );
  assert.equal(JSON.stringify(catalogue.body).includes('verifierHash'), false);
  assert.equal(JSON.stringify(catalogue.body).includes('VULNFORGE{'), false);

  for (const challenge of accessControlLabChallenges) {
    const detail = await agent.get(`/api/challenges/${challenge.slug}`).expect(200);
    assert.equal(detail.body.challenge.category.slug, 'access-control');
    assert.equal(JSON.stringify(detail.body).includes('verifierHash'), false);
    assert.equal(JSON.stringify(detail.body).includes('VULNFORGE{'), false);
  }

  const targetSlug = ACCESS_CONTROL_LAB_CHALLENGE_SLUGS[0];
  const target = await prisma.challenge.findUniqueOrThrow({
    where: { slug: targetSlug },
    select: {
      id: true,
      points: true,
      secret: { select: { verifierHash: true, verifierKeyVersion: true } },
      quizQuestions: {
        orderBy: { order: 'asc' },
        select: {
          id: true,
          options: { select: { id: true, isCorrect: true } },
        },
      },
    },
  });
  assert.ok(target.secret);
  const hintData = await agent.get(`/api/challenges/${targetSlug}/hints`).expect(200);
  const hintTwo = (await prisma.challengeHint.findFirstOrThrow({
    where: { challengeId: target.id, order: 2 },
    select: { pointsPenalty: true },
  }));
  assert.equal(hintData.body.nextHint.order, 1);

  const started = await agent.post(`/api/challenges/${targetSlug}/attempts`).send({}).expect(201);
  const attemptId = started.body.attempt.id as string;
  await agent.post(`/api/challenges/${targetSlug}/hints`)
    .send({ order: 2 })
    .expect(409);
  await agent.post(`/api/challenges/${targetSlug}/hints`)
    .send({ order: 1 })
    .expect(201);
  await agent.post(`/api/challenges/${targetSlug}/hints`)
    .send({ order: 2 })
    .expect(409)
    .expect(({ body }) => assert.equal(body.penaltyPoints, hintTwo.pointsPenalty));
  const revealedHint = await agent.post(`/api/challenges/${targetSlug}/hints`)
    .send({ order: 2, confirmPenalty: true })
    .expect(201);
  assert.equal(revealedHint.body.hint.penaltyPoints, hintTwo.pointsPenalty);
  const duplicateHint = await agent.post(`/api/challenges/${targetSlug}/hints`)
    .send({ order: 2, confirmPenalty: true })
    .expect(200);
  assert.equal(duplicateHint.body.alreadyRevealed, true);
  const hints = await agent.get(`/api/challenges/${targetSlug}/hints`).expect(200);
  assert.equal(hints.body.totalPenaltyPoints, hintTwo.pointsPenalty);

  const testFlag = testFlags.get(targetSlug);
  if (testFlag) {
    const solved = await agent.post(`/api/challenges/${targetSlug}/attempts/${attemptId}/submissions`)
      .send({ flag: testFlag })
      .expect(200);
    assert.equal(solved.body.correct, true);
    assert.equal(solved.body.pointsAwarded, target.points - hintTwo.pointsPenalty);
  } else {
    await prisma.challengeSolve.create({
      data: {
        userId,
        challengeId: target.id,
        pointsAwarded: target.points - hintTwo.pointsPenalty,
      },
    });
  }
  const explanation = await agent.get(`/api/challenges/${targetSlug}/explanation`).expect(200);
  assert.ok(explanation.body.explanation.rootCause);

  const quiz = await agent.get(`/api/challenges/${targetSlug}/quiz`).expect(200);
  assert.equal(JSON.stringify(quiz.body).includes('isCorrect'), false);
  const answers = target.quizQuestions.map((question) => ({
    questionId: question.id,
    optionId: question.options.find((option) => option.isCorrect)!.id,
  }));
  const quizResult = await agent.post(`/api/challenges/${targetSlug}/quiz/attempts`)
    .send({ answers })
    .expect(201);
  assert.equal(quizResult.body.attempt.totalQuestions, target.quizQuestions.length);
  const storedResults = await agent.get(`/api/challenges/${targetSlug}/quiz/results`).expect(200);
  assert.equal(storedResults.body.attempts.length, 1);
  assert.equal(JSON.stringify(storedResults.body).includes('VULNFORGE{'), false);
  const progress = await agent.get('/api/learning/progress').expect(200);
  assert.equal(progress.body.solvedChallenges, 1);
  assert.equal(progress.body.hintsRevealed, 2);
  assert.equal(progress.body.recentQuizAttempts.length, 1);
  assert.equal(userIds.has(userId), true);
});

test('access-control simulator applies its per-learner rate limit', async () => {
  const { agent } = await createStudent();
  let lastStatus = 0;
  for (let requestNumber = 0; requestNumber < 101; requestNumber += 1) {
    lastStatus = (await agent.get('/api/access-lab/status')).status;
  }
  assert.equal(lastStatus, 429);
});
