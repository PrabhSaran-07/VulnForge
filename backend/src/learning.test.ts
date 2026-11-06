import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import { hashPassword } from './lib/auth.js';
import { createFlagVerifierHash } from './lib/challenge-submissions.js';

process.env.NODE_ENV = 'test';
const flagVerifierTestKey = Buffer.from('vulnforge-module-five-test-verifier-key');
process.env.VULNFORGE_FLAG_HMAC_KEYS = JSON.stringify({
  v1: flagVerifierTestKey.toString('base64'),
});
const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;

const userIds = new Set<string>();
const categoryIds = new Set<string>();
const challengeIds = new Set<string>();
const uniqueSlug = () => `learning-${randomUUID()}`;

async function createStudent() {
  const suffix = randomUUID();
  const password = 'Module5TestPass123';
  const user = await prisma.user.create({
    data: {
      username: `learn${suffix.slice(0, 10)}`,
      email: `learning-${suffix}@example.com`,
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

async function createChallenge(options: { withSecret?: boolean } = {}) {
  const category = await prisma.category.create({
    data: {
      slug: uniqueSlug(),
      name: 'Learning test category',
      description: 'Learning API test fixtures.',
    },
  });
  categoryIds.add(category.id);

  const challenge = await prisma.challenge.create({
    data: {
      slug: uniqueSlug(),
      title: 'Learning API challenge',
      description: 'A public description without the answer.',
      categoryId: category.id,
      difficulty: 'BEGINNER',
      points: 100,
      status: 'PUBLISHED',
      learningObjectives: ['Identify the trust boundary', 'Apply a defensive control'],
      context: 'Context visible before starting.',
      prerequisites: ['Review request validation'],
      explanation: {
        create: {
          rootCause: 'private-root-cause-content',
          technicalExplanation: 'Technical behavior after solving.',
          impact: 'Potential impact after solving.',
          conditions: 'Required conditions after solving.',
          secureImplementation: 'Secure implementation after solving.',
          remediationGuidance: 'Practical remediation after solving.',
          detectionIdeas: 'Defensive detection after solving.',
        },
      },
    },
  });
  challengeIds.add(challenge.id);

  const flag = `VULNFORGE{${randomUUID()}}`;
  if (options.withSecret) {
    await prisma.challengeSecret.create({
      data: {
        challengeId: challenge.id,
        verifierHash: createFlagVerifierHash(flag, flagVerifierTestKey),
        verifierKeyVersion: 'v1',
      },
    });
  }
  return { challenge, flag };
}

async function markSolved(userId: string, challengeId: string) {
  await prisma.challengeSolve.create({
    data: { userId, challengeId, pointsAwarded: 100 },
  });
}

async function createQuiz(challengeId: string) {
  const firstQuestion = await prisma.challengeQuizQuestion.create({
    data: {
      challengeId,
      order: 1,
      prompt: 'Which control should enforce access to the record?',
      options: {
        create: [
          { text: 'A server-side authorization check', isCorrect: true, explanation: 'Authorize on the server for every protected operation.' },
          { text: 'A hidden frontend button', isCorrect: false, explanation: 'A client-side control can be bypassed.' },
        ],
      },
    },
    include: { options: true },
  });
  const secondQuestion = await prisma.challengeQuizQuestion.create({
    data: {
      challengeId,
      order: 2,
      prompt: 'Where should untrusted input be validated?',
      options: {
        create: [
          { text: 'Only in the browser', isCorrect: false, explanation: 'Browser validation is not a security boundary.' },
          { text: 'At the server boundary', isCorrect: true, explanation: 'The server must validate data it relies on.' },
        ],
      },
    },
    include: { options: true },
  });
  return { firstQuestion, secondQuestion };
}

afterEach(async () => {
  if (challengeIds.size > 0) {
    const challengeIdList = [...challengeIds];
    await prisma.flagSubmission.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challengeQuizResponse.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challengeQuizAttempt.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challengeHintUsage.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challengeSolve.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challengeAttempt.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challengeSecret.deleteMany({ where: { challengeId: { in: challengeIdList } } });
    await prisma.challenge.deleteMany({ where: { id: { in: challengeIdList } } });
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

test('learning endpoints require authentication and keep explanations and answer keys locked', async () => {
  const { challenge, flag } = await createChallenge({ withSecret: true });
  const quiz = await createQuiz(challenge.id);
  const unauthenticatedPaths = [
    ['/get', `/api/challenges/${challenge.slug}/hints`],
    ['/post', `/api/challenges/${challenge.slug}/hints`],
    ['/get', `/api/challenges/${challenge.slug}/explanation`],
    ['/get', `/api/challenges/${challenge.slug}/quiz`],
    ['/post', `/api/challenges/${challenge.slug}/quiz/attempts`],
    ['/get', `/api/challenges/${challenge.slug}/quiz/results`],
    ['/get', '/api/learning/progress'],
  ] as const;
  for (const [method, path] of unauthenticatedPaths) {
    const response = method === '/get'
      ? await request(app).get(path)
      : await request(app).post(path).send({});
    assert.equal(response.status, 401, `${method} ${path} must require authentication`);
  }

  const { agent, user } = await createStudent();
  const details = await agent.get(`/api/challenges/${challenge.slug}`).expect(200);
  assert.deepEqual(details.body.challenge.learningObjectives, [
    'Identify the trust boundary',
    'Apply a defensive control',
  ]);
  assert.equal(details.body.challenge.context, 'Context visible before starting.');
  assert.deepEqual(details.body.challenge.prerequisites, ['Review request validation']);
  const publicJson = JSON.stringify(details.body);
  assert.equal(publicJson.includes('private-root-cause-content'), false);
  assert.equal(publicJson.includes(flag), false);
  assert.equal(publicJson.includes('verifierHash'), false);

  await agent.get(`/api/challenges/${challenge.slug}/explanation`).expect(403);
  await agent.get(`/api/challenges/${challenge.slug}/quiz`).expect(403);
  await agent.get(`/api/challenges/${challenge.slug}/quiz/results`).expect(403);

  const publicHints = await agent.get(`/api/challenges/${challenge.slug}/hints`).expect(200);
  assert.deepEqual(publicHints.body.hints, []);
  assert.equal(JSON.stringify(publicHints.body).includes('Hint content'), false);

  await markSolved(user.id, challenge.id);
  const quizResponse = await agent.get(`/api/challenges/${challenge.slug}/quiz`).expect(200);
  assert.deepEqual(
    quizResponse.body.questions.map((question: { id: string }) => question.id),
    [quiz.firstQuestion.id, quiz.secondQuestion.id],
  );
  const quizJson = JSON.stringify(quizResponse.body);
  assert.equal(quizJson.includes('isCorrect'), false);
  assert.equal(quizJson.includes('explanation'), false);
  assert.equal(quizJson.includes('Authorize on the server for every protected operation.'), false);

  const explanation = await agent.get(`/api/challenges/${challenge.slug}/explanation`).expect(200);
  assert.equal(explanation.body.explanation.rootCause, 'private-root-cause-content');
  assert.equal(explanation.body.explanation.detectionIdeas, 'Defensive detection after solving.');
});

test('hints unlock in order, confirm penalties, and charge each hint once under concurrency', async () => {
  const { user, agent } = await createStudent();
  const otherStudent = await createStudent();
  const { challenge, flag } = await createChallenge({ withSecret: true });
  const hints = await prisma.challengeHint.createManyAndReturn({
    data: [
      { challengeId: challenge.id, order: 1, content: 'First hint content.', pointsPenalty: 15 },
      { challengeId: challenge.id, order: 2, content: 'Second hint content.', pointsPenalty: 0 },
      { challengeId: challenge.id, order: 3, content: 'Third hint content.', pointsPenalty: 20 },
    ],
    select: { id: true, order: true },
  });
  const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`)
    .send({})
    .expect(201);
  const hintPath = `/api/challenges/${challenge.slug}/hints`;

  const initiallyAvailable = await agent.get(hintPath).expect(200);
  assert.deepEqual(initiallyAvailable.body.nextHint, { order: 1, penaltyPoints: 15 });
  assert.equal(JSON.stringify(initiallyAvailable.body).includes('Second hint content.'), false);
  const otherStudentHints = await otherStudent.agent.get(hintPath).expect(200);
  assert.deepEqual(otherStudentHints.body.hints, []);
  assert.deepEqual(otherStudentHints.body.nextHint, { order: 1, penaltyPoints: 15 });

  await agent.post(hintPath).send({ order: 2 }).expect(409);
  await agent.post(hintPath).send({ order: 1 }).expect(409).then((response) => {
    assert.equal(response.body.penaltyPoints, 15);
    assert.equal(response.body.error, 'Penalty confirmation required');
  });
  assert.equal(await prisma.challengeHintUsage.count({ where: { userId: user.id, challengeId: challenge.id } }), 0);

  const simultaneousReveals = await Promise.all([
    agent.post(hintPath).send({ order: 1, confirmPenalty: true }),
    agent.post(hintPath).send({ order: 1, confirmPenalty: true }),
  ]);
  assert.deepEqual(simultaneousReveals.map((response) => response.status).sort(), [200, 201]);
  assert.equal(await prisma.challengeHintUsage.count({ where: { userId: user.id, hintId: hints[0].id } }), 1);
  assert.equal(simultaneousReveals[0].body.hint.content, 'First hint content.');
  assert.equal(simultaneousReveals[1].body.hint.content, 'First hint content.');

  await agent.post(hintPath).send({ order: 3, confirmPenalty: true }).expect(409);
  const secondHint = await agent.post(hintPath).send({ order: 2 }).expect(201);
  assert.equal(secondHint.body.hint.content, 'Second hint content.');
  await agent.post(hintPath).send({ order: 2 }).expect(200);

  await agent.post(hintPath).send({ order: 3 }).expect(409).then((response) => {
    assert.equal(response.body.penaltyPoints, 20);
  });
  await agent.post(hintPath).send({ order: 3, confirmPenalty: true }).expect(201);
  assert.equal(await prisma.challengeHintUsage.count({ where: { userId: user.id, challengeId: challenge.id } }), 3);

  const submission = await agent.post(
    `/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`,
  ).send({ flag }).expect(200);
  assert.deepEqual(submission.body, {
    correct: true,
    pointsAwarded: 65,
    alreadySolved: false,
  });
  const solve = await prisma.challengeSolve.findUniqueOrThrow({
    where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
  });
  assert.equal(solve.pointsAwarded, 65);

  const revealed = await agent.get(hintPath).expect(200);
  assert.equal(revealed.body.hints.length, 3);
  assert.equal(revealed.body.totalPenaltyPoints, 35);
  assert.equal(revealed.body.nextHint, null);
});

test('hint penalties cannot make a solve award negative points', async () => {
  const { user, agent } = await createStudent();
  const { challenge, flag } = await createChallenge({ withSecret: true });
  const hint = await prisma.challengeHint.create({
    data: {
      challengeId: challenge.id,
      order: 1,
      content: 'A deliberately expensive hint.',
      pointsPenalty: 150,
    },
  });
  const attempt = await agent.post(`/api/challenges/${challenge.slug}/attempts`)
    .send({})
    .expect(201);
  await agent.post(`/api/challenges/${challenge.slug}/hints`).send({
    order: 1,
    confirmPenalty: true,
  }).expect(201);

  const submission = await agent.post(
    `/api/challenges/${challenge.slug}/attempts/${attempt.body.attempt.id}/submissions`,
  ).send({ flag }).expect(200);
  assert.equal(submission.body.pointsAwarded, 0);
  const solve = await prisma.challengeSolve.findUniqueOrThrow({
    where: { userId_challengeId: { userId: user.id, challengeId: challenge.id } },
  });
  assert.equal(solve.pointsAwarded, 0);
});

test('quiz submission validates answers, scores on the server, and stores immutable owned results', async () => {
  const { user, agent } = await createStudent();
  const secondStudent = await createStudent();
  const { challenge } = await createChallenge();
  const { firstQuestion, secondQuestion } = await createQuiz(challenge.id);
  await markSolved(user.id, challenge.id);
  const quizPath = `/api/challenges/${challenge.slug}/quiz`;
  const submitPath = `${quizPath}/attempts`;
  const correctFirst = firstQuestion.options.find((option) => option.isCorrect)!;
  const wrongFirst = firstQuestion.options.find((option) => !option.isCorrect)!;
  const correctSecond = secondQuestion.options.find((option) => option.isCorrect)!;
  const wrongSecond = secondQuestion.options.find((option) => !option.isCorrect)!;

  await agent.post(submitPath).send({ answers: [] }).expect(400);
  await agent.post(submitPath).send({ answers: [
    { questionId: firstQuestion.id, optionId: correctFirst.id },
    { questionId: firstQuestion.id, optionId: wrongFirst.id },
  ] }).expect(400);
  await agent.post(submitPath).send({
    answers: [
      { questionId: firstQuestion.id, optionId: correctFirst.id },
      { questionId: secondQuestion.id, optionId: wrongSecond.id },
    ],
    score: 2,
  }).expect(400);
  await agent.post(submitPath).send({ answers: [
    { questionId: firstQuestion.id, optionId: correctSecond.id },
    { questionId: secondQuestion.id, optionId: wrongSecond.id },
  ] }).expect(400);

  const firstSubmission = await agent.post(submitPath).send({
    answers: [
      { questionId: firstQuestion.id, optionId: correctFirst.id },
      { questionId: secondQuestion.id, optionId: wrongSecond.id },
    ],
  }).expect(201);
  assert.equal(firstSubmission.body.attempt.score, 1);
  assert.equal(firstSubmission.body.attempt.totalQuestions, 2);
  assert.equal(firstSubmission.body.attempt.percentage, 50);
  assert.equal(firstSubmission.body.responses[0].isCorrect, true);
  assert.equal(firstSubmission.body.responses[1].isCorrect, false);
  assert.equal(firstSubmission.body.responses[0].options[0].explanation, 'Authorize on the server for every protected operation.');

  const secondSubmission = await agent.post(submitPath).send({
    answers: [
      { questionId: firstQuestion.id, optionId: correctFirst.id },
      { questionId: secondQuestion.id, optionId: correctSecond.id },
    ],
  }).expect(201);
  assert.equal(secondSubmission.body.attempt.score, 2);
  assert.notEqual(firstSubmission.body.attempt.id, secondSubmission.body.attempt.id);

  const results = await agent.get(`${quizPath}/results`).expect(200);
  assert.equal(results.body.attempts.length, 2);
  const storedFirst = results.body.attempts.find(
    (attempt: { id: string }) => attempt.id === firstSubmission.body.attempt.id,
  );
  assert.equal(storedFirst.score, 1);
  assert.equal(storedFirst.responses.length, 2);
  assert.equal(JSON.stringify(storedFirst).includes('isCorrect'), true);

  await request(app).put(`${submitPath}/${firstSubmission.body.attempt.id}`).send({
    score: 2,
  }).expect(404);
  const unchanged = await prisma.challengeQuizAttempt.findUniqueOrThrow({
    where: { id: firstSubmission.body.attempt.id },
  });
  assert.equal(unchanged.score, 1);

  await markSolved(secondStudent.user.id, challenge.id);
  const otherResults = await secondStudent.agent.get(`${quizPath}/results`).expect(200);
  assert.deepEqual(otherResults.body.attempts, []);
  const ownProgress = await agent.get('/api/learning/progress').expect(200);
  assert.equal(ownProgress.body.points, 100);
  assert.equal(ownProgress.body.solvedChallenges, 1);
  assert.equal(ownProgress.body.recentQuizAttempts.length, 2);
  const otherProgress = await secondStudent.agent.get('/api/learning/progress').expect(200);
  assert.equal(otherProgress.body.points, 100);
  assert.equal(otherProgress.body.solvedChallenges, 1);
  assert.equal(otherProgress.body.recentQuizAttempts.length, 0);

  await assert.rejects(
    prisma.challengeQuizQuestion.delete({ where: { id: firstQuestion.id } }),
  );
  await assert.rejects(
    prisma.challengeQuizOption.delete({ where: { id: correctFirst.id } }),
  );
  assert.equal(await prisma.challengeQuizResponse.count({ where: { challengeId: challenge.id } }), 4);
  await prisma.challenge.delete({ where: { id: challenge.id } });
  assert.equal(await prisma.challenge.findUnique({ where: { id: challenge.id } }), null);
  assert.equal(await prisma.challengeQuizResponse.count({ where: { challengeId: challenge.id } }), 0);
  challengeIds.delete(challenge.id);
});
