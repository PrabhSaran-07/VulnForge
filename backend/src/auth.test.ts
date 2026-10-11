import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { afterEach, describe, test } from 'node:test';
import request from 'supertest';
import { hashPassword, verifyPassword } from './lib/auth.js';

dotenv.config({ path: '../.env' });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://vulnforge:vulnforge_password@localhost:5433/vulnforge?schema=public';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_session_secret_1234567890123456';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
process.env.FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;
const createdUserIds = new Set<string>();
const fixtureId = () => randomUUID().replaceAll('-', '').slice(0, 12);

async function registerUser(credentials: { username: string; email: string; password: string; role?: string }) {
  const response = await request(app)
    .post('/api/auth/register')
    .send(credentials)
    .expect(201);

  createdUserIds.add(response.body.user.id);
  return response;
}

afterEach(async () => {
  if (createdUserIds.size > 0) {
    await prisma.user.deleteMany({
      where: { id: { in: [...createdUserIds] } },
    });
    createdUserIds.clear();
  }
});

describe('Authentication API', () => {
  test('registers a user without returning a password hash', async () => {
    const suffix = fixtureId();
    const response = await registerUser({
      username: `student${suffix}`,
      email: `student${suffix}@example.com`,
      password: 'StrongPass123',
    });

    assert.equal(response.body.user.username, `student${suffix}`);
    assert.equal(response.body.user.email, `student${suffix}@example.com`);
    assert.equal(response.body.user.role, 'STUDENT');
    assert.equal(response.body.user.passwordHash, undefined);
    assert.equal(response.body.user.password, undefined);
    assert.equal(response.body.user.id.length > 0, true);
  });

  test('public registration cannot assign the ADMIN role', async () => {
    const suffix = fixtureId();
    const response = await registerUser({
      username: `publicrole${suffix}`,
      email: `publicrole${suffix}@example.com`,
      password: 'StrongPass123',
      role: 'ADMIN',
    });

    assert.equal(response.body.user.role, 'STUDENT');
    await request(app).get('/api/auth/admin-check').expect(401);
  });

  test('rejects duplicate usernames and emails', async () => {
    const suffix = fixtureId();
    const username = `duplicate${suffix}`;
    const email = `dup${suffix}@example.com`;
    await registerUser({
      username,
      email,
      password: 'StrongPass123',
    });

    const usernameResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username,
        email: `other${suffix}@example.com`,
        password: 'StrongPass123',
      })
      .expect(409);

    assert.equal(usernameResponse.body.message, 'Username is already in use.');

    const emailResponse = await request(app)
      .post('/api/auth/register')
      .send({
        username: `newuser${suffix}`,
        email,
        password: 'StrongPass123',
      })
      .expect(409);

    assert.equal(emailResponse.body.message, 'Email is already in use.');
  });

  test('logs in and exposes authenticated user data on /me', async () => {
    const agent = request.agent(app);
    const suffix = fixtureId();
    const registration = await registerUser({
      username: `auth${suffix}`,
      email: `auth${suffix}@example.com`,
      password: 'StrongPass123',
    });
    assert.equal(registration.body.user.role, 'STUDENT');

    const loginResponse = await agent
      .post('/api/auth/login')
      .send({
        identifier: `auth${suffix}@example.com`,
        password: 'StrongPass123',
      })
      .expect(200);

    assert.equal(loginResponse.body.user.email, `auth${suffix}@example.com`);

    const meResponse = await agent.get('/api/auth/me').expect(200);
    assert.equal(meResponse.body.user.email, `auth${suffix}@example.com`);
    assert.equal(meResponse.body.user.role, 'STUDENT');
    await agent.get('/api/auth/admin-check').expect(403);
  });

  test('logout clears the authenticated session', async () => {
    const agent = request.agent(app);
    const suffix = fixtureId();
    await registerUser({
      username: `logout${suffix}`,
      email: `logout${suffix}@example.com`,
      password: 'StrongPass123',
    });

    await agent
      .post('/api/auth/login')
      .send({
        identifier: `logout${suffix}@example.com`,
        password: 'StrongPass123',
      })
      .expect(200);

    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });

  test('admin-check allows an ADMIN account and logout invalidates its session', async () => {
    const suffix = fixtureId();
    const password = 'AdminFixture123';
    const admin = await prisma.user.create({
      data: {
        username: `midadmin${suffix}`,
        email: `midadmin${suffix}@example.com`,
        passwordHash: await hashPassword(password),
        role: 'ADMIN',
      },
      select: { id: true },
    });
    createdUserIds.add(admin.id);

    const agent = request.agent(app);
    const loginResponse = await agent
      .post('/api/auth/login')
      .send({ identifier: `midadmin${suffix}@example.com`, password })
      .expect(200);

    assert.equal(loginResponse.body.user.role, 'ADMIN');
    assert.equal(loginResponse.body.user.passwordHash, undefined);
    await agent.get('/api/auth/admin-check').expect(200);
    await agent.post('/api/auth/logout').expect(200);
    await agent.get('/api/auth/me').expect(401);
  });

  test('verifies provisioned student and admin accounts when their passwords are configured', {
    skip: !process.env.VULNFORGE_TEST_STUDENT_PASSWORD || !process.env.VULNFORGE_TEST_ADMIN_PASSWORD,
  }, async () => {
    const accounts = [
      {
        username: 'teststudent',
        email: 'student@vulnforge.local',
        password: process.env.VULNFORGE_TEST_STUDENT_PASSWORD!,
        role: 'STUDENT',
      },
      {
        username: 'testadmin',
        email: 'admin@vulnforge.local',
        password: process.env.VULNFORGE_TEST_ADMIN_PASSWORD!,
        role: 'ADMIN',
      },
    ] as const;

    for (const account of accounts) {
      const storedUser = await prisma.user.findUnique({
        where: { email: account.email },
        select: {
          id: true,
          username: true,
          email: true,
          role: true,
          passwordHash: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      assert.ok(storedUser, `${account.username} should exist in PostgreSQL`);
      assert.equal(storedUser.username, account.username);
      assert.equal(storedUser.role, account.role);
      assert.notEqual(storedUser.passwordHash, account.password);
      assert.equal(await verifyPassword(account.password, storedUser.passwordHash), true);

      const agent = request.agent(app);
      const loginResponse = await agent
        .post('/api/auth/login')
        .send({ identifier: account.email, password: account.password })
        .expect(200);

      assert.equal(loginResponse.body.user.role, account.role);
      assert.equal(loginResponse.body.user.passwordHash, undefined);
      assert.equal(loginResponse.body.user.password, undefined);

      const meResponse = await agent.get('/api/auth/me').expect(200);
      assert.equal(meResponse.body.user.role, account.role);
      assert.equal(meResponse.body.user.passwordHash, undefined);

      await agent.get('/api/auth/admin-check').expect(account.role === 'ADMIN' ? 200 : 403);
      await agent.post('/api/auth/logout').expect(200);
      await agent.get('/api/auth/me').expect(401);
    }
  });
});
