import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { afterEach, test } from 'node:test';
import request from 'supertest';
import { hashPassword } from './lib/auth.js';

process.env.NODE_ENV = 'test';
const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;

const userIds = new Set<string>();
const categoryIds = new Set<string>();
const challengeIds = new Set<string>();

async function createAccount(role: 'STUDENT' | 'ADMIN') {
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
    },
  });
  challengeIds.add(challenge.id);
  await prisma.challengeSecret.create({
    data: { challengeId: challenge.id, verifierHash: 'a'.repeat(64), verifierKeyVersion: 'test-v1' },
  });

  await studentAgent.get('/api/admin/overview').expect(403);
  await studentAgent.patch(`/api/admin/users/${student.id}/status`).send({ isActive: false }).expect(403);
  await admin.get('/api/admin/overview').expect(200);

  const users = await admin.get(`/api/admin/users?search=${encodeURIComponent(student.username)}&limit=5`).expect(200);
  assert.equal(users.body.users.length, 1);
  assert.equal('passwordHash' in users.body.users[0], false);
  assert.equal('email' in users.body.users[0], false);

  const listedChallenges = await admin.get(`/api/admin/challenges?search=${challenge.slug}`).expect(200);
  assert.equal(listedChallenges.body.challenges.length, 1);
  assert.equal(JSON.stringify(listedChallenges.body).includes('verifierHash'), false);

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
  assert.ok(userEvents.body.events.some((event: { target?: { username?: string } }) =>
    event.target?.username === student.username));
  assert.ok(userEvents.body.countsBySeverity.some((count: { severity: string }) => count.severity === 'HIGH'));

  const challengeEvents = await admin.get('/api/admin/events?eventType=admin_challenge_metadata_changed&limit=10').expect(200);
  assert.ok(challengeEvents.body.events.some((event: { metadata?: { challengeSlug?: string } }) =>
    event.metadata?.challengeSlug === challenge.slug));
  assert.equal(JSON.stringify(userEvents.body).includes('passwordHash'), false);
  assert.equal(JSON.stringify(userEvents.body).includes('verifierHash'), false);
  assert.equal(JSON.stringify(userEvents.body).includes('VULNFORGE{'), false);
});
