import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import { authLabChallenges } from './lib/auth-lab-content.js';
import {
  AuthLabSimulator,
  isAuthLabContentVisible,
  isAuthLabEnabled,
  isLoopbackAddress,
} from './lib/auth-lab.js';
import { hashPassword } from './lib/auth.js';
import { createFlagVerifierHash } from './lib/challenge-submissions.js';

process.env.NODE_ENV = 'test';
const flagVerifierTestKey = Buffer.from('vulnforge-module-six-test-verifier-key');
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
  const password = 'Module6TestPass123';
  const user = await prisma.user.create({
    data: {
      username: `authlab${suffix.slice(0, 10)}`,
      email: `auth-lab-${suffix}@example.com`,
      passwordHash: await hashPassword(password),
    },
  });
  userIds.add(user.id);
  const agent = request.agent(app);
  await agent.post('/api/auth/login')
    .send({ identifier: user.email, password })
    .expect(200);
  return agent;
}

afterEach(async () => {
  if (ownedChallengeIds.size > 0) {
    const challengeIdList = [...ownedChallengeIds];
    await prisma.challengeSecret.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challenge.deleteMany({ where: { id: { in: challengeIdList } } });
    ownedChallengeIds.clear();
  }
  if (ownedCategoryIds.size > 0) {
    await prisma.category.deleteMany({ where: { id: { in: [...ownedCategoryIds] } } });
    ownedCategoryIds.clear();
  }
  if (userIds.size > 0) {
    await prisma.user.deleteMany({ where: { id: { in: [...userIds] } } });
    userIds.clear();
  }
});

test('local auth lab gating is explicit and limited to loopback development', () => {
  assert.equal(isAuthLabEnabled('development', false), false);
  assert.equal(isAuthLabEnabled('development', true), true);
  assert.equal(isAuthLabEnabled('production', true), false);
  assert.equal(isAuthLabEnabled('test', false), true);
  assert.equal(isAuthLabContentVisible('development', '127.0.0.1'), true);
  assert.equal(isAuthLabContentVisible('production', '127.0.0.1'), false);
  assert.equal(isAuthLabContentVisible('development', '192.0.2.10'), false);
  assert.equal(isLoopbackAddress('127.0.0.1'), true);
  assert.equal(isLoopbackAddress('::1'), true);
  assert.equal(isLoopbackAddress('192.0.2.10'), false);
});

test('AUTH challenges define three complete educational challenge records', () => {
  assert.deepEqual(authLabChallenges.map((challenge) => challenge.slug), [
    'auth-01-weak-authentication',
    'auth-02-authentication-check',
    'auth-03-password-reset',
  ]);
  assert.match(authLabChallenges[0].context, /demo\.learner \/ weak1/);
  for (const challenge of authLabChallenges) {
    assert.ok(challenge.description);
    assert.ok(challenge.context.includes('local') || challenge.context.includes('Local'));
    assert.ok(challenge.learningObjectives.length >= 3);
    assert.ok(challenge.hints.length >= 2);
    assert.ok(challenge.explanation.rootCause);
    assert.ok(challenge.explanation.impact);
    assert.ok(challenge.explanation.conditions);
    assert.ok(challenge.explanation.secureImplementation);
    assert.ok(challenge.explanation.remediationGuidance);
    assert.ok(challenge.explanation.detectionIdeas);
    assert.ok(challenge.questions.length >= 2);
    for (const question of challenge.questions) {
      assert.equal(question.options.filter((option) => option.isCorrect).length, 1);
    }
  }
});

test('all local AUTH challenges appear in the catalogue and detail without exposing flag secrets', async () => {
  const agent = await createStudent();
  let category = await prisma.category.findUnique({
    where: { slug: 'authentication-security' },
    select: { id: true },
  });
  if (!category) {
    category = await prisma.category.create({
      data: {
        slug: 'authentication-security',
        name: 'Authentication Security',
        description: 'Test-only local category.',
      },
      select: { id: true },
    });
    ownedCategoryIds.add(category.id);
  }

  for (const content of authLabChallenges) {
    const existing = await prisma.challenge.findUnique({
      where: { slug: content.slug },
      select: { id: true },
    });
    if (existing) {
      continue;
    }

    const testFlag = `VULNFORGE{module6-${randomUUID()}}`;
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

  const categories = await agent.get('/api/categories').expect(200);
  assert.ok(categories.body.categories.some(
    (category: { slug: string }) => category.slug === 'authentication-security',
  ));
  const expectedSlugs = authLabChallenges.map((challenge) => challenge.slug);
  const catalogue = await agent.get('/api/challenges?category=authentication-security').expect(200);
  assert.deepEqual(
    catalogue.body.challenges.map((item: { slug: string }) => item.slug).sort(),
    [...expectedSlugs].sort(),
  );
  assert.equal(JSON.stringify(catalogue.body).includes('verifierHash'), false);
  assert.equal(JSON.stringify(catalogue.body).includes('VULNFORGE{'), false);
  for (const content of authLabChallenges) {
    const detail = await agent.get(`/api/challenges/${content.slug}`).expect(200);
    assert.equal(detail.body.challenge.title, content.title);
    assert.equal(detail.body.challenge.category.slug, 'authentication-security');
    assert.equal(JSON.stringify(detail.body).includes('verifierHash'), false);
    assert.equal(JSON.stringify(detail.body).includes('VULNFORGE{'), false);
  }
});

test('secure synthetic sign-in applies failure lockout while the vulnerable comparison does not', async () => {
  const simulator = new AuthLabSimulator();
  for (let failure = 0; failure < 5; failure += 1) {
    const result = await simulator.compareWeakAuthentication('lockout-test', 'demo.learner', 'wrong');
    assert.equal(result.secure.locked, false);
  }
  const locked = await simulator.compareWeakAuthentication('lockout-test', 'demo.learner', 'weak1');
  assert.equal(locked.vulnerable.authenticated, true);
  assert.equal(locked.secure.authenticated, false);
  assert.equal(locked.secure.locked, true);
});

test('authentication simulations require an authenticated learner and validate inputs', async () => {
  await request(app).post('/api/auth-lab/weak-authentication')
    .send({ username: 'demo.learner', password: 'weak-demo-24' })
    .expect(401);
  await request(app).get('/api/auth-lab/password-reset').expect(401);
  await request(app).get('/api/auth-lab/status').expect(401);

  const agent = await createStudent();
  await agent.get('/api/auth-lab/status').expect(200).expect(({ body }) => {
    assert.equal(body.available, true);
  });
  await agent.post('/api/auth-lab/weak-authentication')
    .send({ username: 'demo.learner', password: 'weak-demo-24', realAccount: true })
    .expect(400);

  const wrongPassword = await agent.post('/api/auth-lab/weak-authentication')
    .send({ username: 'demo.learner', password: 'wrong-synthetic-password' })
    .expect(200);
  assert.equal(wrongPassword.body.vulnerable.message, 'The synthetic password is incorrect.');
  assert.equal(wrongPassword.body.secure.message, 'Invalid demo credentials.');

  const unknownAccount = await agent.post('/api/auth-lab/weak-authentication')
    .send({ username: 'not-a-demo-user', password: 'wrong-synthetic-password' })
    .expect(200);
  assert.equal(unknownAccount.body.vulnerable.message, 'The synthetic account does not exist.');
  assert.equal(unknownAccount.body.secure.message, 'Invalid demo credentials.');
  assert.equal(JSON.stringify(unknownAccount.body).includes('passwordHash'), false);

  const success = await agent.post('/api/auth-lab/weak-authentication')
    .send({ username: 'demo.learner', password: 'weak1' })
    .expect(200);
  assert.equal(success.body.vulnerable.authenticated, true);
  assert.equal(success.body.secure.authenticated, true);
});

test('authentication-check simulation demonstrates server validation and enumeration safely', async () => {
  const agent = await createStudent();
  const spoofed = await agent.post('/api/auth-lab/authentication-check')
    .send({ scenario: 'spoofed-client-authentication' })
    .expect(200);
  assert.equal(spoofed.body.vulnerable.authorized, true);
  assert.equal(spoofed.body.secure.authorized, false);

  const known = await agent.post('/api/auth-lab/authentication-check')
    .send({ scenario: 'known-account' })
    .expect(200);
  const unknown = await agent.post('/api/auth-lab/authentication-check')
    .send({ scenario: 'unknown-account' })
    .expect(200);
  assert.notEqual(known.body.vulnerable.response, unknown.body.vulnerable.response);
  assert.equal(known.body.secure.response, unknown.body.secure.response);
  assert.equal(JSON.stringify(known.body).includes('real'), false);

  await agent.post('/api/auth-lab/authentication-check')
    .send({ scenario: 'https://example.invalid', username: 'real-user' })
    .expect(400);
});

test('password-reset simulation validates, expires, consumes, and never returns its token', async () => {
  const agent = await createStudent();
  const requested = await agent.post('/api/auth-lab/password-reset/request').send({}).expect(201);
  assert.equal(requested.body.tokenStatus, 'pending');
  assert.equal('token' in requested.body, false);
  assert.equal('tokenHash' in requested.body, false);

  const tampered = await agent.post('/api/auth-lab/password-reset/confirm')
    .send({ scenario: 'tampered' })
    .expect(400);
  assert.equal(JSON.stringify(tampered.body).includes('tokenHash'), false);
  await agent.post('/api/auth-lab/password-reset/confirm')
    .send({ scenario: 'valid', newPassword: 'short1' })
    .expect(400);

  const completed = await agent.post('/api/auth-lab/password-reset/confirm')
    .send({ scenario: 'valid', newPassword: 'SyntheticResetPass123' })
    .expect(200);
  assert.equal(completed.body.tokenStatus, 'used');
  assert.equal(completed.body.sessionInvalidated, true);
  assert.equal(completed.body.passwordChanged, true);
  assert.equal('token' in completed.body, false);

  await agent.post('/api/auth-lab/password-reset/confirm')
    .send({ scenario: 'replay' })
    .expect(409);
  const finalState = await agent.get('/api/auth-lab/password-reset').expect(200);
  assert.equal(finalState.body.tokenStatus, 'used');

  const secondAgent = await createStudent();
  await secondAgent.post('/api/auth-lab/password-reset/request').send({}).expect(201);
  await secondAgent.post('/api/auth-lab/password-reset/confirm')
    .send({ scenario: 'expired' })
    .expect(400);
  const expiredState = await secondAgent.get('/api/auth-lab/password-reset').expect(200);
  assert.equal(expiredState.body.tokenStatus, 'expired');
});
