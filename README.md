# VULNFORGE

**Build. Break. Defend.**

VULNFORGE is an educational cybersecurity platform in development. Its goal is to help learners understand common web security weaknesses by eventually letting them investigate controlled challenges, submit flags, track progress, and study remediation guidance.

The current repository provides the landing page, authentication, and a protected student dashboard/navigation MVP. Challenge environments, flag submission, scoring, and dynamic progress features described in the roadmap are not implemented yet.

## Contents

- [Project status and features](#project-status-and-features)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Environment configuration](#environment-configuration)
- [Database setup](#database-setup)
- [Install and run](#install-and-run)
- [Authentication and test accounts](#authentication-and-test-accounts)
- [Scripts and tests](#scripts-and-tests)
- [Troubleshooting](#troubleshooting)
- [Security notes](#security-notes)
- [Roadmap](#roadmap)
- [Contributing](#contributing)

## Project status and features

### Implemented

- Responsive React landing page with VULNFORGE branding and product messaging.
- Login and registration pages, plus a profile view in the authenticated workspace.
- PostgreSQL-backed user records managed with Prisma.
- Module 2 authentication: validated student registration, email-or-username login, current-user restoration, logout, and protected routes.
- Module 3 dashboard MVP: protected `/dashboard`, responsive desktop/mobile navigation, authenticated username welcome, account/profile navigation, and working logout.
- Dashboard navigation entry points for Challenges, Categories, and My Progress; unavailable features are explicitly labeled rather than represented with invented data.
- Shared frontend API request helper that includes credentials and provides consistent HTTP error messages, including 401 and 403.
- Student and administrator roles, authenticated-session middleware, and role-check middleware.
- PostgreSQL-backed sessions with an eight-hour cookie lifetime and periodic expired-session cleanup.
- A backend health endpoint at `GET /api/health`.
- Docker Compose configuration for PostgreSQL, the backend, and the frontend.
- Focused backend authentication tests using Node's test runner and Supertest.

Authentication uses server-managed sessions. Passwords are hashed with bcryptjs before storage. Registration always creates a `STUDENT`; an administrator can only be provisioned through trusted backend code.

### Not implemented yet

The repository does not yet provide working challenge/lab environments, flag submissions, scoring, dynamic progress tracking, leaderboards, learning pathways, remediation content, or challenge-administration UI. Dashboard summary values are labeled unavailable until backed by real data. These remain product goals, not current features. Landing-page sections and messaging about future capabilities do not mean those capabilities are implemented.

## Technology stack

Versions below are the versions/ranges declared in the package manifests and lockfiles; caret ranges may resolve to later compatible releases.

| Area | Technology |
| --- | --- |
| Runtime | Node.js 22 (used by both Dockerfiles); npm |
| Frontend | React 19.1, React Router 7, TypeScript 6, Vite 8, Tailwind CSS 4 |
| Backend | Express 4, TypeScript 5.7, `tsx` |
| Database | PostgreSQL 16 (Docker image `postgres:16-alpine`) |
| ORM and database driver | Prisma 7.10, Prisma PostgreSQL adapter, `pg` |
| Authentication and validation | `express-session`, `bcryptjs`, `express-rate-limit`, Zod |
| Backend tests | Node.js built-in test runner, Supertest 7 |
| Containers | Docker and Docker Compose |

## Repository structure

```text
.
├── backend/
│   ├── src/
│   │   ├── config/       # Backend environment parsing and validation
│   │   ├── lib/          # Prisma client and auth helpers
│   │   ├── middleware/   # Authentication and role checks
│   │   ├── routes/       # Health and authentication API routes
│   │   ├── scripts/      # Development test-admin provisioning
│   │   └── auth.test.ts  # Backend auth tests
│   ├── Dockerfile
│   └── package.json
├── database/             # Reserved; no separate database service code
├── docker/               # Reserved
├── docs/                 # Reserved
├── frontend/
│   ├── src/              # React app, protected routes, shared API client, and styles
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── prisma/
│   ├── migrations/       # Versioned database migrations
│   └── schema.prisma     # User model and role enum
├── .env.example          # Environment-variable template; contains placeholders only
├── docker-compose.yml
├── package.json          # Root Prisma, Docker, and build scripts
└── prisma7.config.ts     # Prisma CLI configuration
```

## Prerequisites

- Node.js 22 and npm. The Dockerfiles use Node 22; Prisma 7 and the current Vite toolchain also require a supported modern Node release.
- Docker Desktop with Docker Compose, **or** a locally managed PostgreSQL 16 server.
- Git to clone the project.

## Environment configuration

From the repository root, copy `.env.example` to `.env` and edit the local file. In PowerShell:

```powershell
Copy-Item .env.example .env
```

On macOS or Linux, use `cp .env.example .env`.

| Variable | Purpose |
| --- | --- |
| `NODE_ENV` | Backend runtime mode (`development`, `test`, or `production`). |
| `PORT` | Backend HTTP port; defaults to `4000`. |
| `DATABASE_URL` | PostgreSQL connection string. The local Compose mapping is host port `5433`, database `vulnforge`. |
| `CORS_ORIGIN` | One explicit allowed browser origin for credentialed backend requests; defaults to `http://localhost:5173`. Wildcard origins are not accepted. |
| `SESSION_SECRET` | Required secret used to sign session cookies. Set a unique value of at least 32 characters in the ignored local `.env`; the example value is a placeholder and is rejected by the backend. |
| `VULNFORGE_TEST_ADMIN_PASSWORD` | Required only by the development admin provisioner. Must be 8-128 characters with at least one letter and one number. |
| `VULNFORGE_TEST_STUDENT_PASSWORD` | Optional test-only value used by the auth test to verify the existing test-student account. It does not create or reset that account. |
| `VITE_API_URL` | Frontend API base URL; Compose sets it to `http://localhost:4000`, and the frontend uses that as its default. |

The root `.env` is ignored by Git. Keep it untracked and never commit it. Do not put passwords, tokens, or other private values in source files, the README, screenshots, shell history, or logs. The backend loads the root `.env` file when started from the repository's backend scripts; Docker Compose also reads it for required backend environment values. Set `CORS_ORIGIN` to the exact frontend origin and `SESSION_SECRET` to a unique value of at least 32 characters. Never use the example placeholder as a runtime value.

## Database setup

The Compose service is named `postgres`. It runs PostgreSQL 16, creates database `vulnforge`, maps host port `5433` to container port `5432`, and persists data in the named `postgres_data` volume. Compose defines fixed development-only database credentials in `docker-compose.yml`; consult that file when configuring another local PostgreSQL client, and do not reuse those credentials outside local development.

From the repository root, install dependencies before database commands:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
```

Start PostgreSQL:

```powershell
docker compose up -d postgres
```

Generate the Prisma Client, apply the checked-in migrations, and inspect migration status:

```powershell
npm run db:generate
npm run db:migrate
npm run db:status
```

The root `db:status` command connects to PostgreSQL to report migration status. Backend startup requires a successful database connection and exits without listening if the connection fails. `GET /api/health` reports that the HTTP backend responds; it is not a database connectivity check.

Stop only the database service without deleting its persisted volume:

```powershell
docker compose stop postgres
```

Do not reset the database as a routine setup or troubleshooting step.

## Install and run

1. Copy `.env.example` to `.env` and confirm its local `DATABASE_URL` points to PostgreSQL on `localhost:5433`. The root `.env` supplies Prisma commands and provisioning/tests; see [Environment configuration](#environment-configuration) for the separate backend-process environment behavior.
2. Install the root, backend, and frontend dependencies as shown in [Database setup](#database-setup).
3. Start PostgreSQL and run `npm run db:generate` followed by `npm run db:migrate`.
4. In one terminal, start the backend:

   ```powershell
   npm run dev:backend
   ```

   It listens at `http://localhost:4000` by default. Confirm the API responds by opening `http://localhost:4000/api/health`. A successful response includes `"status":"ok"`.
5. In a second terminal, start the frontend:

   ```powershell
   npm run dev:frontend
   ```

   Open `http://localhost:5173`. The frontend provides `/`, `/login`, `/register`, and the authenticated `/profile` route.

Alternatively, the Compose definition starts all three services:

```powershell
docker compose up --build
```

Apply the Prisma migration from the host first. Compose configures PostgreSQL and the app containers, but it does not run migrations automatically. The database is reachable from the host at `localhost:5433`; containers connect to the service name `postgres` on port `5432`.

## Authentication and test accounts

### Implemented API

All authentication routes are under `/api/auth`. Requests and responses use JSON, except that the successful login also sets the `vulnforge.sid` session cookie.

| Method and path | Behavior |
| --- | --- |
| `POST /api/auth/register` | Accepts `{ "username": "...", "email": "...", "password": "..." }`. Returns `201` with a safe `user` object and creates a `STUDENT`. Usernames must be 3-50 characters; email must be valid and no longer than 255 characters; passwords must be 8-128 characters and contain a letter and a number. Duplicate usernames/emails return `409`. Registration does not assign a role from request data or sign the user in. |
| `POST /api/auth/login` | Accepts `{ "identifier": "email-or-username", "password": "..." }`. Returns `200` with a safe user object and establishes a server-side session after regenerating the session ID; invalid credentials return `401`. |
| `GET /api/auth/me` | Requires a valid session. Returns `{ "user": { "id", "username", "email", "role", "createdAt", "updatedAt" } }`; without a valid session returns `401`. |
| `POST /api/auth/logout` | Requires a valid session, destroys it, and clears the session cookie. Returns `200` only after session destruction succeeds; subsequent authenticated requests return `401`. |
| `GET /api/auth/admin-check` | Example role-protected route. Returns `200` for an authenticated `ADMIN`, `403` for an authenticated `STUDENT`, and `401` without authentication. |

Registration only creates a user; it does not create the server-side login session. After registration, the frontend confirms account creation and directs the user to log in. Authentication is restored by checking `/api/auth/me`; only a confirmed server session marks the frontend user as authenticated. Passwords are stored as bcrypt hashes, and the API does not return password hashes. The frontend sends credentialed requests so the browser can use the session cookie.

Public registration creates `STUDENT` accounts only. `ADMIN` authorization is enforced by backend role middleware and an administrator must be provisioned through trusted backend code; hiding or showing frontend UI is not an authorization control.

Outside automated tests, Express uses `connect-pg-simple` with the same `DATABASE_URL` used for application data. The PostgreSQL session table is created if missing; session rows carry the cookie expiry and expired rows are pruned hourly. The signed `vulnforge.sid` cookie is HTTP-only, `SameSite=Lax`, and expires after eight hours. In production it is marked `Secure`, so production deployment must use HTTPS. The secret is supplied by `SESSION_SECRET`; startup rejects missing, short, and example-placeholder secrets. Logout destroys the server-side session before clearing the cookie with compatible attributes.

### Development test accounts

The intended local accounts are:

| Username | Email | Role | Creation |
| --- | --- | --- | --- |
| `teststudent` | `student@vulnforge.local` | `STUDENT` | Register through `/register`; public registration cannot select a role. |
| `testadmin` | `admin@vulnforge.local` | `ADMIN` | Provision with the trusted backend script below. |

Passwords are intentionally not published. In a development environment where these accounts have already been created, their passwords are available only in that developer's ignored local `.env` variables. For a fresh database, register the student and choose a password; store it locally in `VULNFORGE_TEST_STUDENT_PASSWORD` if you want the integration test to verify that account.

Set `VULNFORGE_TEST_ADMIN_PASSWORD` in `.env` to a unique 8-128 character password containing at least one letter and one number. From the repository root, run:

```powershell
docker compose up -d postgres
npm run db:migrate
npm --prefix backend run seed:test-admin
```

The script creates `testadmin` with the `ADMIN` role using the same bcrypt helper as authentication. It is safe to rerun: it leaves an existing exact account unchanged only if the role and configured password already match, and reports conflicts without changing an account. It never prints the password or hash. Keep both test passwords in the ignored `.env`; never hardcode them or put them in commits or logs.

Log in at `http://localhost:5173/login` using the email and locally configured password. The profile page displays the current role. The `GET /api/auth/me` response also includes the role. The automated auth test exercises login, session verification, logout, hash verification, and the actual student/admin role checks when both test-password variables are set.

## Scripts and tests

Run commands from the repository root unless a command uses `npm --prefix`.

| Command | Purpose |
| --- | --- |
| `npm run dev:backend` | Start the backend in watch mode with `tsx`. |
| `npm run dev:frontend` | Start the Vite development server. |
| `npm run build:backend` | Compile the backend TypeScript project. |
| `npm run build:frontend` | Type-check and build the frontend with Vite. |
| `npm test` | Run both frontend and backend production build checks; it does not run unit tests. |
| `npm --prefix backend run test:auth` | Run backend auth tests. The API/integration and PostgreSQL session-store cases require the configured PostgreSQL database. The provisioned-account case is skipped unless both test-password environment variables are set. |
| `npm run db:generate` | Generate Prisma Client from `prisma/schema.prisma`. |
| `npm run db:migrate` | Apply development migrations using Prisma. |
| `npm run db:status` | Check migration status against the configured database. |
| `npm --prefix backend run seed:test-admin` | Idempotently provision the development administrator from the configured password. |
| `docker compose up --build` | Build and start all Compose services. |
| `docker compose stop postgres` | Stop only the PostgreSQL service and retain its named volume. |

There is no separate frontend unit-test script or standalone type-check script; the frontend build runs `tsc`. The backend auth tests use Node's built-in test runner through `tsx --test`.

The frontend build checks TypeScript and compiles the dashboard; no frontend unit-test or browser-test runner is configured. For manual verification, sign in at `/login`, confirm `/dashboard` shows the signed-in username, refresh to check session restoration, visit Profile/Challenges/Categories/My Progress, then log out. Repeat at a narrow viewport to inspect the horizontally scrollable mobile navigation. Browser verification is not claimed by the automated build.

The authentication suite checks registration, input validation, duplicate and concurrent duplicate registration, password hashing, email/username login, session-ID rotation, `/me`, logout invalidation, cookie attributes, role authorization, sensitive-field exclusion, rate limiting, and PostgreSQL session persistence/expiry across separate store instances. Automated HTTP tests use Express's in-memory session store; the PostgreSQL store behavior is tested directly. The full suite does not simulate restarting the backend process. Frontend authentication flows have been manually exercised in a browser with mocked API responses; there is no frontend unit-test suite, and rapid duplicate-submit prevention has not been conclusively browser-verified.

## Troubleshooting

- **Database connection fails:** Confirm the Compose `postgres` service is running (`docker compose ps`) and host port `5433` is available. The host connection uses `localhost:5433`; containers use `postgres:5432`. Check `DATABASE_URL` and run `npm run db:status`. Backend startup fails closed when its database connection cannot be established; `GET /api/health` only checks the HTTP process.
- **Port already in use:** The defaults are PostgreSQL host port `5433`, backend port `4000`, and Vite port `5173`. Stop the conflicting service or adjust the local service configuration and corresponding URLs consistently.
- **Prisma client or migration errors:** Install root dependencies, run `npm run db:generate`, and verify `DATABASE_URL` points to the existing database before `npm run db:migrate`. Inspect with `npm run db:status`; do not reset or delete the database as a first fix.
- **Missing or invalid session secret:** Set `SESSION_SECRET` to a unique value at least 32 characters long in the root `.env`. The application refuses to start without it or if it matches an example placeholder. Restart the backend after changing it; changing it invalidates cookies signed with the prior value.
- **Frontend cannot reach the API or browser reports CORS errors:** Ensure the backend is listening on port `4000`; verify that the allowed `CORS_ORIGIN` matches the browser origin (normally `http://localhost:5173`) and that frontend requests include credentials. In Compose, the frontend's `VITE_API_URL` is `http://localhost:4000`.
- **Test-account seeding fails:** Set `VULNFORGE_TEST_ADMIN_PASSWORD` locally and verify it is 8-128 characters with a letter and a number. If the account already exists with a different password, role, or conflicting identity, the script intentionally stops without modifying it.

## Security notes

Current controls include bcrypt password hashing (12 rounds), validation of registration/login data, rate limits on registration and login, HTTP-only session cookies, credentialed CORS restricted to a configured origin, security headers via Helmet, and server-side authentication and role middleware. Public registration explicitly creates only `STUDENT` accounts. The test-admin script is a trusted development-only provisioning mechanism.

The Compose PostgreSQL credentials are development defaults, not production credentials. Outside automated tests, sessions are stored in PostgreSQL using the same `DATABASE_URL` as the application. `connect-pg-simple` creates the session table when missing and periodically removes expired sessions; session rows use the session cookie expiration, which is eight hours. Automated HTTP tests use Express's in-memory store. The session cookie is HTTP-only, same-site `lax`, and secure in production. Registration is limited to 10 requests per 15 minutes per client and login to 20 requests per 15 minutes; test mode uses a higher allowance for the suite. Before deployment, configure a strong secret, production database credentials, HTTPS, and appropriate operational controls. The existing middleware and headers do not by themselves establish that the whole application is production-hardened.

Any intentionally vulnerable educational labs must be isolated from the main platform and must not be exposed publicly without appropriate sandboxing, network isolation, and access controls.

## Roadmap

- **Completed Module 1 foundation:** React landing page and PostgreSQL/Prisma setup with the initial User/Role migration.
- **Implemented Module 2 — Authentication & User Management (final operational verification pending):** Student registration; email-or-username login; session restoration and logout; protected profile; student/admin authorization; development admin provisioner; authentication and PostgreSQL session-store tests. Automated auth tests and both application builds pass. Full backend-process-restart persistence and browser verification of rapid duplicate-submit prevention remain outstanding; see [Scripts and tests](#scripts-and-tests).
- **Implemented Module 3 MVP — Student Dashboard & Navigation:** Protected dashboard and shared workspace layout; session restoration through `/api/auth/me`; responsive desktop/mobile navigation; account/profile and logout; challenges, categories, and progress placeholder pages; shared credentialed API helper with 401/403 error messages. Statistics remain unavailable until real challenge/progress data exists. Frontend build and diff checks have passed; browser verification remains a manual check.
- **In progress:** No additional module is identified as in progress in the current repository.
- **Planned:** Controlled vulnerability challenges/labs, flag submission, scoring and progress tracking, learning pathways, remediation guidance, leaderboards/analytics, and challenge administration.

Folders reserved for future work are not evidence that those features are implemented.

## Contributing

The repository does not currently define a contribution guide or formal branch/PR policy. Before proposing a change, run the relevant available build and backend auth test commands from [Scripts and tests](#scripts-and-tests), and describe the scope and verification in the pull request or review request. Keep credentials and local environment files out of commits.
