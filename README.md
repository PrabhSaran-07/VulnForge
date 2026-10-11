# VULNFORGE

**Build. Break. Defend.**

VULNFORGE is an educational cybersecurity platform in development. Its goal is to help learners understand common web security weaknesses by eventually letting them investigate controlled challenges, submit flags, track progress, and study remediation guidance.

The current repository provides the landing page and an authentication foundation. Challenge environments, flag submission, scoring, and the other learning-platform features described in the roadmap are not implemented yet.

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
- Login, registration, and profile pages.
- PostgreSQL-backed user records managed with Prisma.
- Student and administrator roles, authenticated-session middleware, and a role-check middleware.
- A backend health endpoint at `GET /api/health`.
- Docker Compose configuration for PostgreSQL, the backend, and the frontend.
- Focused backend authentication tests using Node's test runner and Supertest.

Authentication uses server-managed sessions. Passwords are hashed with bcryptjs before storage. Registration always creates a `STUDENT`; an administrator can only be provisioned through trusted backend code.

### Not implemented yet

The repository does not yet provide working challenge/lab environments, flag submissions, scoring, progress tracking, leaderboards, learning pathways, remediation content, or challenge-administration UI. These remain product goals, not current features. Landing-page sections and messaging about future capabilities do not mean those capabilities are implemented.

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
│   ├── src/              # React app, routes, and styles
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
| `CORS_ORIGIN` | Allowed browser origin for credentialed backend requests; defaults to `http://localhost:5173`. |
| `FRONTEND_URL` | Validated backend setting, defaulting to `http://localhost:5173`; it is not currently used by route logic. |
| `SESSION_SECRET` | Secret used to sign session cookies. Set a unique local value of at least 32 characters; do not use the example placeholder or a development default for deployment. |
| `VULNFORGE_TEST_ADMIN_PASSWORD` | Required only by the development admin provisioner. Must be 8-128 characters with at least one letter and one number. |
| `VULNFORGE_TEST_STUDENT_PASSWORD` | Optional test-only value used by the auth test to verify the existing test-student account. It does not create or reset that account. |
| `VITE_API_URL` | Frontend API base URL; Compose sets it to `http://localhost:4000`, and the frontend uses that as its default. |

The root `.env` is ignored by Git. Keep it untracked and never commit it. Do not put passwords, tokens, or other private values in source files, the README, screenshots, shell history, or logs. The root Prisma CLI configuration and the test-account seed/test scripts explicitly load the root `.env`. **The backend server does not load the root `.env` when started with the scripts below**: its dotenv call looks in the backend process's working directory. The backend defaults match the local ports and origins shown above, but any backend setting you need to override (especially `SESSION_SECRET`) must be provided in the backend process environment through your terminal or IDE launch configuration.

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

The root `db:status` command connects to PostgreSQL to report migration status. Backend startup also attempts a database connection and logs whether it succeeded, but continues to listen if the connection fails. `GET /api/health` only reports that the HTTP backend responds; it is not a database connectivity check.

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
| `POST /api/auth/register` | Accepts `{ "username": "...", "email": "...", "password": "..." }`. Returns `201` with a safe `user` object and creates a `STUDENT`. Usernames must be 3-50 characters; passwords must be 8-128 characters and contain a letter and a number. Duplicate usernames/emails return `409`. Registration does not assign a role from request data. |
| `POST /api/auth/login` | Accepts `{ "identifier": "email-or-username", "password": "..." }`. Returns `200` with a safe user object and establishes a server-side session; invalid credentials return `401`. |
| `GET /api/auth/me` | Requires a valid session. Returns `{ "user": { "id", "username", "email", "role", "createdAt", "updatedAt" } }`; without a valid session returns `401`. |
| `POST /api/auth/logout` | Requires a valid session, destroys it, and clears the session cookie. Returns `200`; subsequent authenticated requests return `401`. |
| `GET /api/auth/admin-check` | Example role-protected route. Returns `200` for an authenticated `ADMIN`, `403` for an authenticated `STUDENT`, and `401` without authentication. |

Registration only creates a user; it does not create the server-side login session. Log in after registration. Passwords are stored as bcrypt hashes, and the API does not return password hashes. The frontend sends credentialed requests so the browser can use the session cookie.

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
| `npm --prefix backend run test:auth` | Run backend auth API tests. The provisioned-account integration case is skipped unless both test-password environment variables are set. |
| `npm run db:generate` | Generate Prisma Client from `prisma/schema.prisma`. |
| `npm run db:migrate` | Apply development migrations using Prisma. |
| `npm run db:status` | Check migration status against the configured database. |
| `npm --prefix backend run seed:test-admin` | Idempotently provision the development administrator from the configured password. |
| `docker compose up --build` | Build and start all Compose services. |
| `docker compose stop postgres` | Stop only the PostgreSQL service and retain its named volume. |

There is no separate frontend unit-test script or standalone type-check script; the frontend build runs `tsc`. The backend auth tests use Node's built-in test runner through `tsx --test`.

## Troubleshooting

- **Database connection fails:** Confirm the Compose `postgres` service is running (`docker compose ps`) and host port `5433` is available. The host connection uses `localhost:5433`; containers use `postgres:5432`. Check `DATABASE_URL` and run `npm run db:status`. Backend health can respond even if the database connection failed.
- **Port already in use:** The defaults are PostgreSQL host port `5433`, backend port `4000`, and Vite port `5173`. Stop the conflicting service or adjust the local service configuration and corresponding URLs consistently.
- **Prisma client or migration errors:** Install root dependencies, run `npm run db:generate`, and verify `DATABASE_URL` points to the existing database before `npm run db:migrate`. Inspect with `npm run db:status`; do not reset or delete the database as a first fix.
- **Missing or invalid session secret:** Set `SESSION_SECRET` to a unique value at least 32 characters long in the backend process environment (not only in the root `.env`). Restart the backend after changing it; changing it invalidates cookies signed with the prior value.
- **Frontend cannot reach the API or browser reports CORS errors:** Ensure the backend is listening on port `4000`; verify that the allowed `CORS_ORIGIN` matches the browser origin (normally `http://localhost:5173`) and that frontend requests include credentials. In Compose, the frontend's `VITE_API_URL` is `http://localhost:4000`.
- **Test-account seeding fails:** Set `VULNFORGE_TEST_ADMIN_PASSWORD` locally and verify it is 8-128 characters with a letter and a number. If the account already exists with a different password, role, or conflicting identity, the script intentionally stops without modifying it.

## Security notes

Current controls include bcrypt password hashing (12 rounds), validation of registration/login data, rate limits on registration and login, HTTP-only session cookies, credentialed CORS restricted to a configured origin, security headers via Helmet, and server-side authentication and role middleware. Public registration explicitly creates only `STUDENT` accounts. The test-admin script is a trusted development-only provisioning mechanism.

The Compose PostgreSQL credentials are development defaults, not production credentials. The application currently uses Express's default in-memory session store; it is not suitable for production persistence or multiple backend instances. Before deployment, configure a strong secret, a production-grade persistent session store, production database credentials, HTTPS, and appropriate operational controls. The existing middleware and headers do not by themselves establish that the whole application is production-hardened.

Any intentionally vulnerable educational labs must be isolated from the main platform and must not be exposed publicly without appropriate sandboxing, network isolation, and access controls.

## Roadmap

- **Completed foundation:** React landing page; PostgreSQL/Prisma setup and initial User/Role migration; student registration; session-based login/logout/current-user flow; protected profile route; role middleware and a minimal administrator check; development admin provisioner and backend auth tests.
- **In progress:** No additional module is identified as in progress in the current repository.
- **Planned:** Controlled vulnerability challenges/labs, flag submission, scoring and progress tracking, learning pathways, remediation guidance, leaderboards/analytics, and challenge administration.

Folders reserved for future work are not evidence that those features are implemented.

## Contributing

The repository does not currently define a contribution guide or formal branch/PR policy. Before proposing a change, run the relevant available build and backend auth test commands from [Scripts and tests](#scripts-and-tests), and describe the scope and verification in the pull request or review request. Keep credentials and local environment files out of commits.
