import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import session from 'express-session';
import { afterEach, describe, test } from 'node:test';
import request from 'supertest';
import connectPgSimple from 'connect-pg-simple';
import { hashPassword, isStrongPassword, isValidEmail, normalizeEmail, normalizeUsername, verifyPassword } from './lib/auth.js';
dotenv.config({ path: '../.env' });
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://vulnforge:vulnforge_password@localhost:5433/vulnforge?schema=public';
process.env.SESSION_SECRET = process.env.SESSION_SECRET || 'test_session_secret_1234567890123456';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:5173';
const { default: app } = await import('./app.js');
const prisma = (await import('./lib/prisma.js')).default;
const createdUserIds = new Set();
const fixtureId = () => randomUUID().replaceAll('-', '').slice(0, 12);
async function registerUser(credentials) {
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
// ─── Unit-level helpers (no DB required) ─────────────────────────────────────
describe('Auth library helpers', () => {
    test('normalizeEmail lowercases and trims', () => {
        assert.equal(normalizeEmail('  User@EXAMPLE.COM  '), 'user@example.com');
    });
    test('normalizeUsername lowercases and trims', () => {
        assert.equal(normalizeUsername('  Alice  '), 'alice');
        assert.equal(normalizeUsername('BOB'), 'bob');
    });
    test('isValidEmail accepts valid addresses and rejects invalid ones', () => {
        assert.equal(isValidEmail('user@example.com'), true);
        assert.equal(isValidEmail('user+tag@sub.domain.org'), true);
        assert.equal(isValidEmail('notanemail'), false);
        assert.equal(isValidEmail('@missing.user'), false);
        assert.equal(isValidEmail('missing@domain'), false);
        assert.equal(isValidEmail(''), false);
    });
    test('isStrongPassword accepts strong passwords and rejects weak ones', () => {
        assert.equal(isStrongPassword('StrongPass1'), true);
        assert.equal(isStrongPassword('letmein'), false); // too short
        assert.equal(isStrongPassword('onlyletters'), false); // no digit
        assert.equal(isStrongPassword('12345678'), false); // no letter
        assert.equal(isStrongPassword('short1'), false); // too short
    });
    test('hashPassword produces a hash that verifyPassword validates', async () => {
        const pw = 'MyTestPass99';
        const hash = await hashPassword(pw);
        assert.notEqual(hash, pw, 'hash must not equal the plaintext password');
        assert.ok(hash.startsWith('$2'), 'hash should be a bcrypt hash');
        assert.equal(await verifyPassword(pw, hash), true);
        assert.equal(await verifyPassword('wrongpassword', hash), false);
    });
    test('hashPassword produces different hashes for the same password (salt)', async () => {
        const pw = 'SamePass123';
        const h1 = await hashPassword(pw);
        const h2 = await hashPassword(pw);
        assert.notEqual(h1, h2, 'two hashes for the same password should differ due to salting');
    });
});
describe('Authentication runtime configuration', () => {
    test('Prisma loads the project DATABASE_URL before constructing its PostgreSQL adapter', () => {
        const childEnv = { ...process.env };
        delete childEnv.DATABASE_URL;
        const result = spawnSync(process.execPath, [
            '--import',
            'tsx',
            '--input-type=module',
            '--eval',
            [
                "const { default: prisma } = await import('./src/lib/prisma.ts');",
                'try { await prisma.user.count(); process.stdout.write("connected"); }',
                'catch { process.exitCode = 1; }',
                'finally { await prisma.$disconnect(); }',
            ].join(' '),
        ], {
            cwd: fileURLToPath(new URL('..', import.meta.url)),
            env: childEnv,
            encoding: 'utf8',
        });
        assert.equal(result.status, 0, 'Prisma should connect using DATABASE_URL loaded from the project .env file');
        assert.equal(result.stdout, 'connected');
    });
});
// ─── Integration tests (require a live PostgreSQL database) ──────────────────
describe('Authentication API', () => {
    // ── Registration ────────────────────────────────────────────────────────────
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
        assert.equal(response.body.user.passwordHash, undefined, 'passwordHash must not be in response');
        assert.equal(response.body.user.password, undefined, 'password must not be in response');
        assert.ok(response.body.user.id && response.body.user.id.length > 0, 'id must be present');
        assert.ok(response.body.user.createdAt, 'createdAt must be present');
        assert.ok(response.body.user.updatedAt, 'updatedAt must be present');
        const storedUser = await prisma.user.findUnique({
            where: { id: response.body.user.id },
            select: { passwordHash: true },
        });
        assert.ok(storedUser);
        assert.notEqual(storedUser.passwordHash, 'StrongPass123', 'password must not be stored as plaintext');
        assert.equal(await verifyPassword('StrongPass123', storedUser.passwordHash), true);
    });
    test('registration does not authenticate the user', async () => {
        const suffix = fixtureId();
        const agent = request.agent(app);
        const response = await agent
            .post('/api/auth/register')
            .send({
            username: `registeronly${suffix}`,
            email: `registeronly${suffix}@example.com`,
            password: 'StrongPass123',
        })
            .expect(201);
        createdUserIds.add(response.body.user.id);
        await agent.get('/api/auth/me').expect(401);
    });
    test('rejects registration with missing username', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ email: `missing${suffix}@example.com`, password: 'StrongPass123' })
            .expect(400);
        assert.ok(response.body.error, 'error field must be present');
    });
    test('rejects registration with missing email', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `user${suffix}`, password: 'StrongPass123' })
            .expect(400);
        assert.ok(response.body.error, 'error field must be present');
    });
    test('rejects registration with missing password', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `user${suffix}`, email: `user${suffix}@example.com` })
            .expect(400);
        assert.ok(response.body.error, 'error field must be present');
    });
    test('rejects registration with an invalid email address', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `user${suffix}`, email: 'not-an-email', password: 'StrongPass123' })
            .expect(400);
        assert.ok(response.body.error, 'error field must be present');
    });
    test('rejects a weak password (no digit)', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `user${suffix}`, email: `user${suffix}@example.com`, password: 'onlyletters' })
            .expect(400);
        assert.ok(response.body.error);
    });
    test('rejects a weak password (too short)', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `user${suffix}`, email: `user${suffix}@example.com`, password: 'Sh0rt' })
            .expect(400);
        assert.ok(response.body.error);
    });
    test('rejects a username shorter than 3 characters', async () => {
        const suffix = fixtureId();
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: 'ab', email: `user${suffix}@example.com`, password: 'StrongPass123' })
            .expect(400);
        assert.ok(response.body.error);
    });
    test('public registration cannot assign the ADMIN role', async () => {
        const suffix = fixtureId();
        const response = await registerUser({
            username: `publicrole${suffix}`,
            email: `publicrole${suffix}@example.com`,
            password: 'StrongPass123',
            role: 'ADMIN',
        });
        assert.equal(response.body.user.role, 'STUDENT', 'Role must always be STUDENT for public registrations');
        // The new user has no session, so admin-check must return 401.
        await request(app).get('/api/auth/admin-check').expect(401);
    });
    test('rejects duplicate email registration', async () => {
        const suffix = fixtureId();
        const email = `dup${suffix}@example.com`;
        await registerUser({ username: `user1${suffix}`, email, password: 'StrongPass123' });
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `user2${suffix}`, email, password: 'StrongPass123' })
            .expect(409);
        assert.equal(response.body.message, 'Email is already in use.');
    });
    test('rejects duplicate username registration', async () => {
        const suffix = fixtureId();
        const username = `duplicate${suffix}`;
        await registerUser({ username, email: `first${suffix}@example.com`, password: 'StrongPass123' });
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username, email: `second${suffix}@example.com`, password: 'StrongPass123' })
            .expect(409);
        assert.equal(response.body.message, 'Username is already in use.');
    });
    test('concurrent duplicate registration returns a safe conflict instead of a server error', async () => {
        const suffix = fixtureId();
        const email = `race${suffix}@example.com`;
        const responses = await Promise.all([
            request(app).post('/api/auth/register').send({
                username: `raceone${suffix}`,
                email,
                password: 'StrongPass123',
            }),
            request(app).post('/api/auth/register').send({
                username: `racetwo${suffix}`,
                email,
                password: 'StrongPass123',
            }),
        ]);
        const created = responses.filter((response) => response.status === 201);
        const conflicts = responses.filter((response) => response.status === 409);
        assert.equal(created.length, 1);
        assert.equal(conflicts.length, 1);
        createdUserIds.add(created[0].body.user.id);
        assert.equal(conflicts[0].body.error, 'Conflict');
        assert.match(conflicts[0].body.message, /email|username/i);
        assert.equal(JSON.stringify(conflicts[0].body).includes('P2002'), false);
    });
    test('case-insensitive duplicate username detection', async () => {
        const suffix = fixtureId();
        await registerUser({ username: `CaseUser${suffix}`, email: `case1${suffix}@example.com`, password: 'StrongPass123' });
        // Usernames are normalized to lowercase; registering the same username with
        // different casing should conflict.
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `caseuser${suffix}`, email: `case2${suffix}@example.com`, password: 'StrongPass123' })
            .expect(409);
        assert.equal(response.body.message, 'Username is already in use.');
    });
    test('case-insensitive duplicate email detection', async () => {
        const suffix = fixtureId();
        await registerUser({ username: `emailcase1${suffix}`, email: `EmailCase${suffix}@EXAMPLE.COM`, password: 'StrongPass123' });
        const response = await request(app)
            .post('/api/auth/register')
            .send({ username: `emailcase2${suffix}`, email: `emailcase${suffix}@example.com`, password: 'StrongPass123' })
            .expect(409);
        assert.equal(response.body.message, 'Email is already in use.');
    });
    // ── Login ───────────────────────────────────────────────────────────────────
    test('login by email and exposes authenticated user on /me', async () => {
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
            .send({ identifier: `auth${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        assert.equal(loginResponse.body.user.email, `auth${suffix}@example.com`);
        assert.equal(loginResponse.body.user.passwordHash, undefined, 'passwordHash must not be in login response');
        const cookies = loginResponse.headers['set-cookie'];
        const cookieHeader = (Array.isArray(cookies) ? cookies : [cookies])
            .find((cookie) => cookie?.startsWith('vulnforge.sid='));
        assert.ok(cookieHeader);
        assert.match(cookieHeader, /HttpOnly/i);
        assert.match(cookieHeader, /SameSite=Lax/i);
        const expiresAt = cookieHeader.match(/Expires=([^;]+)/i)?.[1];
        assert.ok(expiresAt);
        const expiresInMs = new Date(expiresAt).getTime() - Date.now();
        assert.ok(expiresInMs > 7 * 60 * 60 * 1000 && expiresInMs <= 8 * 60 * 60 * 1000);
        const meResponse = await agent.get('/api/auth/me').expect(200);
        assert.equal(meResponse.body.user.email, `auth${suffix}@example.com`);
        assert.equal(meResponse.body.user.role, 'STUDENT');
        assert.equal(meResponse.body.user.passwordHash, undefined, 'passwordHash must not be in /me response');
        // STUDENT must not pass the admin check
        await agent.get('/api/auth/admin-check').expect(403);
    });
    test('login by username', async () => {
        const agent = request.agent(app);
        const suffix = fixtureId();
        await registerUser({
            username: `usernamelogin${suffix}`,
            email: `usernamelogin${suffix}@example.com`,
            password: 'StrongPass123',
        });
        const loginResponse = await agent
            .post('/api/auth/login')
            .send({ identifier: `usernamelogin${suffix}`, password: 'StrongPass123' })
            .expect(200);
        assert.equal(loginResponse.body.user.username, `usernamelogin${suffix}`);
        await agent.get('/api/auth/me').expect(200);
    });
    test('successful login regenerates an existing session identifier', async () => {
        const suffix = fixtureId();
        await registerUser({
            username: `regen${suffix}`,
            email: `regen${suffix}@example.com`,
            password: 'StrongPass123',
        });
        const agent = request.agent(app);
        const extractSessionId = (setCookie) => {
            const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
            const cookie = cookies.find((value) => value?.startsWith('vulnforge.sid='));
            assert.ok(cookie, 'login must issue a session cookie');
            const value = decodeURIComponent(cookie.split(';', 1)[0].slice('vulnforge.sid='.length));
            assert.ok(value.startsWith('s:'), 'session cookie must contain a signed session identifier');
            return value.slice(2).split('.')[0];
        };
        const firstLogin = await agent
            .post('/api/auth/login')
            .send({ identifier: `regen${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        const firstSessionId = extractSessionId(firstLogin.headers['set-cookie']);
        const secondLogin = await agent
            .post('/api/auth/login')
            .send({ identifier: `regen${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        const secondSessionId = extractSessionId(secondLogin.headers['set-cookie']);
        assert.notEqual(secondSessionId, firstSessionId, 'each successful login must rotate the session ID');
        await agent.get('/api/auth/me').expect(200);
    });
    test('PostgreSQL session store persists sessions between instances and rejects expired sessions', async () => {
        const poolA = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        const poolB = new pg.Pool({ connectionString: process.env.DATABASE_URL });
        const PgStore = connectPgSimple(session);
        const storeA = new PgStore({
            pool: poolA,
            tableName: 'session',
            createTableIfMissing: true,
            pruneSessionInterval: false,
        });
        const storeB = new PgStore({
            pool: poolB,
            tableName: 'session',
            createTableIfMissing: true,
            pruneSessionInterval: false,
        });
        const liveSessionId = `auth-test-live-${randomUUID()}`;
        const expiredSessionId = `auth-test-expired-${randomUUID()}`;
        const setSession = (store, sid, data) => new Promise((resolve, reject) => {
            store.set(sid, data, (error) => error ? reject(error) : resolve());
        });
        const getSession = (store, sid) => new Promise((resolve, reject) => {
            store.get(sid, (error, data) => error ? reject(error) : resolve(data));
        });
        const destroySession = (store, sid) => new Promise((resolve, reject) => {
            store.destroy(sid, (error) => error ? reject(error) : resolve());
        });
        try {
            await setSession(storeA, liveSessionId, {
                cookie: {
                    originalMaxAge: 8 * 60 * 60 * 1000,
                    expires: new Date(Date.now() + 8 * 60 * 60 * 1000),
                    secure: false,
                    httpOnly: true,
                    sameSite: 'lax',
                },
            });
            const restoredSession = await getSession(storeB, liveSessionId);
            assert.equal(restoredSession?.cookie.originalMaxAge, 8 * 60 * 60 * 1000);
            await setSession(storeA, expiredSessionId, {
                cookie: {
                    originalMaxAge: 8 * 60 * 60 * 1000,
                    expires: new Date(Date.now() - 1000),
                    secure: false,
                    httpOnly: true,
                    sameSite: 'lax',
                },
            });
            assert.equal(await getSession(storeB, expiredSessionId), undefined);
        }
        finally {
            await destroySession(storeB, liveSessionId);
            await destroySession(storeB, expiredSessionId);
            await storeA.close();
            await storeB.close();
            await poolA.end();
            await poolB.end();
        }
    });
    test('rejects login with wrong password', async () => {
        const suffix = fixtureId();
        await registerUser({
            username: `wrongpw${suffix}`,
            email: `wrongpw${suffix}@example.com`,
            password: 'StrongPass123',
        });
        const response = await request(app)
            .post('/api/auth/login')
            .send({ identifier: `wrongpw${suffix}@example.com`, password: 'WrongPass456' })
            .expect(401);
        assert.equal(response.body.error, 'Unauthorized');
    });
    test('rejects login with non-existent account', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ identifier: 'nobody@example.com', password: 'StrongPass123' })
            .expect(401);
        // Same error message as wrong password — no account existence disclosure.
        assert.equal(response.body.error, 'Unauthorized');
    });
    test('rejects login with empty identifier', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({ identifier: '', password: 'StrongPass123' })
            .expect(400);
        assert.ok(response.body.error);
    });
    // ── /me without authentication ───────────────────────────────────────────────
    test('unauthenticated /me returns 401', async () => {
        await request(app).get('/api/auth/me').expect(401);
    });
    // ── Logout ──────────────────────────────────────────────────────────────────
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
            .send({ identifier: `logout${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        // Confirm session is active before logout.
        await agent.get('/api/auth/me').expect(200);
        const logoutResponse = await agent.post('/api/auth/logout').expect(200);
        const clearedCookie = logoutResponse.headers['set-cookie'];
        const clearedCookies = Array.isArray(clearedCookie) ? clearedCookie : [clearedCookie];
        assert.ok(clearedCookies.some((cookie) => cookie?.startsWith('vulnforge.sid=;')), 'logout must clear the session cookie');
        // After logout the session should be invalid.
        await agent.get('/api/auth/me').expect(401);
    });
    test('protected endpoints are inaccessible after logout', async () => {
        const agent = request.agent(app);
        const suffix = fixtureId();
        await registerUser({
            username: `postlogout${suffix}`,
            email: `postlogout${suffix}@example.com`,
            password: 'StrongPass123',
        });
        await agent
            .post('/api/auth/login')
            .send({ identifier: `postlogout${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        await agent.post('/api/auth/logout').expect(200);
        // Invalidated session must not grant access to protected routes.
        await agent.get('/api/auth/me').expect(401);
        await agent.get('/api/auth/admin-check').expect(401);
    });
    test('unauthenticated logout attempt returns 401', async () => {
        await request(app).post('/api/auth/logout').expect(401);
    });
    // ── Access control and role authorization ────────────────────────────────────
    test('unauthenticated request to protected endpoint returns 401', async () => {
        await request(app).get('/api/auth/admin-check').expect(401);
    });
    test('STUDENT cannot access ADMIN-only route (returns 403)', async () => {
        const agent = request.agent(app);
        const suffix = fixtureId();
        await registerUser({
            username: `student403${suffix}`,
            email: `student403${suffix}@example.com`,
            password: 'StrongPass123',
        });
        await agent
            .post('/api/auth/login')
            .send({ identifier: `student403${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        const response = await agent.get('/api/auth/admin-check').expect(403);
        assert.equal(response.body.error, 'Forbidden');
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
        assert.equal(loginResponse.body.user.passwordHash, undefined, 'passwordHash must not be in login response');
        // ADMIN can access the admin-check endpoint.
        await agent.get('/api/auth/admin-check').expect(200);
        // After logout the ADMIN session must be invalidated.
        await agent.post('/api/auth/logout').expect(200);
        await agent.get('/api/auth/me').expect(401);
        await agent.get('/api/auth/admin-check').expect(401);
    });
    // ── Sensitive field exclusion ─────────────────────────────────────────────────
    test('passwordHash is never exposed in register, login, or /me responses', async () => {
        const agent = request.agent(app);
        const suffix = fixtureId();
        const registerResponse = await registerUser({
            username: `nohashleak${suffix}`,
            email: `nohashleak${suffix}@example.com`,
            password: 'StrongPass123',
        });
        assert.equal(registerResponse.body.user.passwordHash, undefined, 'passwordHash in register response');
        assert.equal(registerResponse.body.user.password, undefined, 'password in register response');
        const loginResponse = await agent
            .post('/api/auth/login')
            .send({ identifier: `nohashleak${suffix}@example.com`, password: 'StrongPass123' })
            .expect(200);
        assert.equal(loginResponse.body.user.passwordHash, undefined, 'passwordHash in login response');
        assert.equal(loginResponse.body.user.password, undefined, 'password in login response');
        const meResponse = await agent.get('/api/auth/me').expect(200);
        assert.equal(meResponse.body.user.passwordHash, undefined, 'passwordHash in /me response');
        assert.equal(meResponse.body.user.password, undefined, 'password in /me response');
    });
    // ── Provisioned test-account integration (skipped when passwords are not set) ─
    test('verifies provisioned student and admin accounts when their passwords are configured', {
        skip: !process.env.VULNFORGE_TEST_STUDENT_PASSWORD || !process.env.VULNFORGE_TEST_ADMIN_PASSWORD,
    }, async () => {
        const accounts = [
            {
                username: 'teststudent',
                email: 'student@vulnforge.local',
                password: process.env.VULNFORGE_TEST_STUDENT_PASSWORD,
                role: 'STUDENT',
            },
            {
                username: 'testadmin',
                email: 'admin@vulnforge.local',
                password: process.env.VULNFORGE_TEST_ADMIN_PASSWORD,
                role: 'ADMIN',
            },
        ];
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
            assert.notEqual(storedUser.passwordHash, account.password, 'password must be stored as hash, not plaintext');
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
    test('registration rate limit rejects requests after the test-mode allowance', async () => {
        let rateLimited = false;
        for (let attempt = 0; attempt < 101; attempt += 1) {
            const response = await request(app)
                .post('/api/auth/register')
                .send({ username: '', email: 'invalid', password: '' });
            if (response.status === 429) {
                rateLimited = true;
                assert.equal(response.body.error, 'Too many requests');
                break;
            }
            assert.equal(response.status, 400, `request ${attempt + 1} should reach registration validation`);
        }
        assert.equal(rateLimited, true, 'the configured registration request limit must be enforced');
    });
    test('login rate limit rejects requests after the test-mode allowance', async () => {
        let rateLimited = false;
        for (let attempt = 0; attempt < 101; attempt += 1) {
            const response = await request(app)
                .post('/api/auth/login')
                .send({ identifier: '', password: '' });
            if (response.status === 429) {
                rateLimited = true;
                assert.equal(response.body.error, 'Too many requests');
                break;
            }
            assert.equal(response.status, 400, `request ${attempt + 1} should reach login validation`);
        }
        assert.equal(rateLimited, true, 'the configured login request limit must be enforced');
    });
});
