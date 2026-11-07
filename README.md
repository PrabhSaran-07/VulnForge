# VULNFORGE

**Build. Break. Defend.**

VULNFORGE is an educational cybersecurity platform that helps learners investigate published challenges, submit flags, track progress, and study remediation guidance.

The current repository provides the landing page, authentication, protected student workspace, the Module 4 challenge and flag-submission engine, Module 5 learning features, and local-only Module 6 authentication and Module 7 access-control simulations. Existing published AUTH/AC challenges include educational answers and post-solve explanations managed through the administrator workspace. Modules 8–12 are frontend-only Coming Soon entries. Modules 13–15 and 17 have local data-backed foundations; Module 16 is a disabled runtime contract only. No vulnerable container execution or public deployment is provided.

## Contents

- [Project status and features](#project-status-and-features)
- [Technology stack](#technology-stack)
- [Repository structure](#repository-structure)
- [Prerequisites](#prerequisites)
- [Environment configuration](#environment-configuration)
- [Database setup](#database-setup)
- [Install and run](#install-and-run)
- [Authentication and test accounts](#authentication-and-test-accounts)
- [Module 6 authentication security lab](#module-6-authentication-security-lab)
- [Module 7 access control security lab](#module-7-access-control-security-lab)
- [Modules 8–19 status](#modules-8-19-status)
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
- Module 4 challenge catalogue, attempt lifecycle, server-side flag verification, solve records, and scoring.
- Module 5 ordered hints with per-user reveal records, confirmed penalties, and server-side adjusted solve awards.
- Post-solve educational answers, step-by-step solutions, vulnerability explanations, remediation, key takeaways, multiple-choice knowledge checks, immutable quiz-attempt results, and authenticated learning progress. Student APIs gate answers and explanations on a recorded solve; the private CTF verifier remains separate.
- Module 6 AUTH-01, AUTH-02, and AUTH-03 content authored through the existing challenge, secret, hint, explanation, and quiz models; no new database models or migrations.
- Authenticated local simulation endpoints for weak authentication, flawed authentication checks, and reset-token lifecycle concepts. They use synthetic data, require explicit local enablement and a loopback connection, and are not mounted in production.
- Module 7 AC-01, AC-02, and AC-03 content and simulations use the same challenge, HMAC-secret, hint, explanation, and quiz infrastructure; no new database models or migrations.
- Modules 8–12 appear as frontend-only planned labs and never create challenge records, scores, attempts, or flags.
- Modules 13–14 add structured security-event records, role-protected administration APIs, student-account activation controls, challenge publication controls, and administrator editing of objectives, solutions, explanations, and hints for existing challenges.
- Module 15 calculates a paginated leaderboard from server-side solve records with stable tie ranks and derived badges.
- Module 17 adds student learning metrics and administrator challenge/event analytics based on stored records.
- Module 16 defines an owner-aware, resource-limited lifecycle contract with runtime execution explicitly disabled.
- Focused backend authentication, challenge, schema, and learning API tests using Node's test runner and Supertest.

Authentication uses server-managed sessions. Passwords are hashed with bcryptjs before storage. Registration always creates a `STUDENT`; an administrator can only be provisioned through trusted backend code.

### Remaining limitations

The repository does not provide an isolated challenge runtime executor, challenge creation/category authoring, real container lifecycle, learning pathways, deployment, or a full audit/compliance pipeline. The administrator learning-content editor manages existing challenge records only. Landing-page sections and messaging about future capabilities do not mean those capabilities are implemented.

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
│   │   ├── lib/          # Prisma client, auth helpers, and local lab content/simulations
│   │   ├── middleware/   # Authentication and role checks
│   │   ├── routes/       # Health, authentication, challenge, learning, and local lab APIs
│   │   ├── scripts/      # Development test-admin and local lab provisioning
│   │   ├── auth.test.ts  # Backend authentication tests
│   │   ├── auth-lab.test.ts # Local authentication-lab tests
│   │   └── learning.test.ts # Backend learning API tests
│   ├── Dockerfile
│   └── package.json
├── database/             # Reserved; no separate database service code
├── docker/               # Reserved
├── docs/                 # Project walkthrough and implementation plan
├── frontend/
│   ├── src/              # React app, protected routes, local lab controls, API client, and styles
│   ├── public/
│   ├── Dockerfile
│   └── package.json
├── prisma/
│   ├── migrations/       # Versioned database migrations
│   └── schema.prisma     # User, challenge, and learning models
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
| `VULNFORGE_FLAG_HMAC_KEYS` | JSON object mapping verifier key versions to base64-encoded random keys of at least 32 bytes, used only by the backend to verify challenge flags (for example, `{"v1":"<base64-key>"}`). Required to seed AUTH challenges. Keep old versions configured until corresponding verifier hashes have been rotated. Never use a flag itself as a key. |
| `VULNFORGE_ENABLE_LOCAL_AUTH_LAB` | Must be `true` with `NODE_ENV=development` to enable local AUTH simulations; production mode always disables them, and loopback requests are still required. |
| `VULNFORGE_AUTH_LAB_FLAGS` | Required only by the local auth-lab seed. JSON object containing distinct private `AUTH-01`, `AUTH-02`, and `AUTH-03` flag values; keep only in ignored `.env`. |
| `VULNFORGE_ENABLE_LOCAL_ACCESS_LAB` | Must be `true` with `NODE_ENV=development` to mount the local AC simulation API; production mode always disables it, and loopback requests are still required. |
| `VULNFORGE_ACCESS_LAB_FLAGS` | Required only by the access-lab seed. JSON object containing distinct private `AC-01`, `AC-02`, and `AC-03` flag values; keep only in ignored `.env`. |
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

## Module 6 authentication security lab

Module 6 adds three AUTH challenges to the existing challenge catalogue and detail workflow:

| Challenge | Focus |
| --- | --- |
| AUTH-01 — Weak Authentication Scenario | Synthetic credentials, password-storage comparison, generic failures, password policy, and repeated-failure controls. |
| AUTH-02 — Authentication-Check Flaw | Server-validated identity, authentication versus authorization, and fixed examples of account-enumeration response differences. |
| AUTH-03 — Password-Reset Design Weakness | Synthetic reset-token generation and validation, expiry, one-time use, new-password confirmation, and simulated session invalidation. |

Each challenge uses the existing `Category`, `Challenge`, `ChallengeSecret`, ordered `ChallengeHint`, `ChallengeExplanation`, and quiz models. Flags remain HMAC-verified by the Module 4 submission path; explanations, answer keys, and quiz results use the Module 5 APIs. The seed is additive and idempotent when all three challenge slugs already exist. **No Prisma model or migration was added.**

The vulnerable behaviors are deterministic, synthetic comparisons—not a vulnerable login service. They use no real platform accounts or credentials, make no outbound requests, send no email, and do not alter VulnForge sessions. Reset tokens are generated and validated only in backend memory and are never returned to the browser. Simulation state is volatile and is cleared by a backend restart.

The simulation API is available only when `NODE_ENV=development` and `VULNFORGE_ENABLE_LOCAL_AUTH_LAB=true` (tests enable it automatically). It also rejects non-loopback connections. In development, authenticated loopback learners can still browse seeded AUTH challenge content when the simulation API is disabled; the detail page displays an explicit unavailable message instead of hiding the category. Production and non-loopback catalogue requests do not receive the AUTH challenges. The frontend renders simulation controls only in a development build and refuses a non-loopback API base URL. Never enable the lab on a public deployment.

### Local setup

1. In the ignored root `.env`, set `VULNFORGE_ENABLE_LOCAL_AUTH_LAB=true`. Keep `NODE_ENV=development`.
2. Configure `VULNFORGE_FLAG_HMAC_KEYS` with the same private backend keyring used by the Module 4 verifier.
3. Set `VULNFORGE_AUTH_LAB_FLAGS` to a JSON object with distinct `AUTH-01`, `AUTH-02`, and `AUTH-03` properties, each containing a locally chosen `VULNFORGE{...}` value. Keep these values in `.env`; do not commit or expose them.
4. Apply the existing migrations and seed the content. The seed requires all four local settings above and leaves existing complete challenge sets unchanged:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm --prefix backend run seed
   npm run db:status
   ```

5. Start the backend and frontend with `npm run dev:backend` and `npm run dev:frontend`, sign in with a student account, and open `/challenges`. The three AUTH challenges use normal attempts, flag submissions, hints, post-solve explanations, quizzes, and progress.

### Verification status

Final local verification: all 72 backend tests passed; backend and frontend production builds passed; Prisma formatting and validation passed; and all three existing migrations are current. PostgreSQL contains the Authentication Security category and all three published AUTH challenges with objectives, ordered hints, explanations, quizzes, and HMAC-backed secret records. Running the seed twice was idempotent. The production frontend bundle scan found no AUTH challenge labels, flag literals, HMAC setting name, or reset-token markers. No frontend automated test or browser-test runner is configured.

An authenticated synthetic learner completed the database-backed API workflow for all three challenges: catalogue and detail retrieval, ordered hints and penalties, flag submission, solved explanations, stored quiz results, and progress. In the actual local frontend, the category and three challenges appeared; each detail page rendered its simulator; AUTH-01 and AUTH-02 comparisons worked; and AUTH-03 covered reset request, tampered and expired rejection, successful reset, synthetic-session invalidation, and replay rejection without displaying a token. The disabled-simulation notice was also verified while challenge content remained visible. Progress showed three solved challenges, six hints, and three quiz attempts. Production and loopback gating are covered by automated checks; a separate production-mode server and non-loopback HTTP request were not launched.

If the seed is rerun after all three challenge slugs already exist, it leaves their content and secrets unchanged. If only some slugs exist, it stops without changing records. To change locally authored content, use reviewed database tooling; the seed does not overwrite existing learner records or challenges.

### Simulation API

All paths require the existing authenticated learner session and loopback network access:

| Method and path | Behavior |
| --- | --- |
| `GET /api/auth-lab/status` | Confirms local simulation availability without returning secret or simulation state. |
| `POST /api/auth-lab/weak-authentication` | Compares the fixed synthetic account against vulnerable and secure authentication designs. Accepts only a bounded synthetic username/password pair. |
| `POST /api/auth-lab/authentication-check` | Runs one fixed scenario from an allowlist; it cannot search for accounts or contact another service. |
| `GET /api/auth-lab/password-reset` | Returns sanitized synthetic reset state without a token. |
| `POST /api/auth-lab/password-reset/request` | Starts a local reset flow; returns a generic message, never a link or token. |
| `POST /api/auth-lab/password-reset/confirm` | Tests valid, modified, expired, or replayed synthetic reset actions. A completed action requires a new synthetic password. |

The API uses rate limiting and per-learner in-memory state. It is not a production password-reset implementation; the real Module 2 authentication routes, session store, and middleware are unchanged.

## Module 7 access control security lab

Module 7 adds three Access Control challenges to the existing challenge and learning workflow:

| Challenge | Focus |
| --- | --- |
| AC-01 — Object-Level Access Control (IDOR/BOLA) | Compare identifier-only access to a synthetic document with server-side ownership validation. |
| AC-02 — Role and Permission Enforcement | Compare an overly broad authenticated-user decision with a server-side STUDENT/ADMIN permission policy. |
| AC-03 — Privilege Boundary Failure | Compare trusting a synthetic privilege request with server-side least-privilege enforcement. |

Learning objectives cover object-level authorization, authentication versus authorization, server-enforced permissions, and privilege boundaries. The seed stores objectives, ordered hints and penalties, structured explanations, quiz questions/options, and HMAC-backed private flags through existing Module 4/5 models. It is additive and idempotent when all three slugs already exist; partial existing sets cause it to stop without changes. **No Prisma schema changes or migration were required.**

All simulator cases use fixed synthetic resources and role/action fixtures. Client requests can select only an allowlisted case; actor identity for object ownership comes from the authenticated session, and no caller-provided owner or role is accepted. Simulation results do not access real application objects or modify VulnForge users, roles, permissions, or sessions. The APIs require an authenticated session, are mounted only in explicitly enabled development mode (or test mode), reject non-loopback requests, and are rate-limited. Production catalogue and detail routes exclude the AC challenges. The frontend displays controls only in development and shows an explicit unavailable state if the API is disabled.

### Local setup and verification

1. Keep `NODE_ENV=development` and configure the existing backend-only `VULNFORGE_FLAG_HMAC_KEYS` keyring.
2. Set `VULNFORGE_ENABLE_LOCAL_ACCESS_LAB=true`.
3. Configure `VULNFORGE_ACCESS_LAB_FLAGS` as a JSON object with three distinct `VULNFORGE{...}` values under keys `AC-01`, `AC-02`, and `AC-03`. Keep these synthetic development flags private in the ignored `.env`; do not commit them or expose them to the frontend.
4. Seed without resetting the database or applying a new migration:

   ```powershell
   npm --prefix backend run seed:access-lab
   npm run db:status
   ```

5. Start the backend and frontend, sign in with a local synthetic learner, open `/categories`, then choose Access Control. Run each comparison, start an attempt, reveal hints in order, submit the locally configured flag, review the explanation, submit the quiz, and inspect `/progress`.

The local database was seeded and the seed was rerun to verify idempotency. A real PostgreSQL-backed synthetic learner completed all three AC challenge flows through the local backend: hints/penalties, configured flags, explanations, stored quiz results, progress, and simulator authorization outcomes. Browser checks confirmed Access Control visibility, all three catalogue entries/details, and vulnerable-versus-secure results for each simulator. Unauthenticated simulator access returned 401; attempts to submit client owner/role claims were rejected, and the real learner role remained STUDENT. No secret values were printed. Automated production gating and loopback helper tests passed; a separate production server/non-loopback HTTP request was not launched. Frontend automated tests are not configured. Final checks passed: 77/77 backend tests, backend and frontend builds, Prisma format/validation, all three existing migrations current, and `git diff --check`.

### Local simulator API

Every endpoint requires authentication and loopback network access:

| Method and path | Behavior |
| --- | --- |
| `GET /api/access-lab/status` | Reports whether the mounted local simulator is available. |
| `POST /api/access-lab/object-access` | Accepts a fixed `resourceId` choice and compares vulnerable and owner-checked decisions. |
| `POST /api/access-lab/role-permission` | Accepts an allowlisted synthetic role/action scenario; it does not accept a client role. |
| `POST /api/access-lab/privilege-boundary` | Evaluates a fixed synthetic privilege request without changing account state. |

## Modules 8–19 status

### Modules 8–12 — frontend-only Coming Soon

The Categories and Challenges pages list Injection, Session & Token, File Upload, API, and Configuration Security modules and their planned challenge cards. Each card and detail page is explicitly marked **COMING SOON** and cannot start an attempt. These entries are static frontend metadata only: no challenge, flag, score, or progress rows are created for them.

| Module | Planned challenges |
| --- | --- |
| 8 — Injection Security | INJ-01 through INJ-03 |
| 9 — Session & Token Security | SESSION-01 through SESSION-03 |
| 10 — File Upload Security | UPLOAD-01 through UPLOAD-03 |
| 11 — API Security | API-01 through API-05 |
| 12 — Configuration Security | CONFIG-01 through CONFIG-04 |

### Module 13 — logging and detection

The API assigns each request an `X-Request-Id`. Security-relevant events are persisted as structured records with timestamps, severity, optional actor/target references, request IDs, and intentionally small metadata fields. Current events include authentication outcomes, protected-route denials, rate limiting, challenge starts/stops, flag outcomes/solves, admin changes, and startup security-configuration state. No passwords, cookies, session identifiers, tokens, flags, request bodies, or HMAC material are recorded by these call sites.

`GET /api/admin/events` is administrator-only and supports `eventType`, `severity`, `from`, `to`, `page`, and `limit`. It includes severity counts and simple 15-minute aggregate detection signals for repeated login failures, denied access, incorrect flags, and rate limits. The server purges events older than 90 days on startup and daily. Database-backed event storage requires applying the additive migration before starting the updated backend. Event persistence failures are reported as structured server logs; they do not turn an otherwise successful learner operation into a failure.

### Module 14 — administration

All `/api/admin/*` routes use `requireAuth` and `requireRole(['ADMIN'])`; frontend visibility is not an authorization control. Current APIs:

| Method and path | Behavior |
| --- | --- |
| `GET /api/admin/overview` | Counts users, active users, challenges, submissions, solves, and 24-hour events. |
| `GET /api/admin/users` | Safe user fields, username search, and pagination. |
| `PATCH /api/admin/users/:id/status` | Enables/disables student accounts; roles and admin accounts cannot be changed here. Disabled sessions are rejected server-side. |
| `GET /api/admin/challenges` | Paginated challenge list; private secrets are excluded. |
| `PATCH /api/admin/challenges/:id` | Validated title/description/difficulty/points/objective edits; points cannot change after a solve exists. |
| `GET /api/admin/challenges/:id/content` | Administrator-only educational answers, solution steps, explanation, objectives, and hints; secret/verifier fields are excluded. |
| `PUT /api/admin/challenges/:id/content` | Validates and saves educational content. Hint changes are rejected after any learner has revealed a hint. Changes are audited. |
| `PATCH /api/admin/challenges/:id/status` | Publishes or archives a challenge. |
| `GET /api/admin/submissions` | Recent flag outcome metadata; submitted flags are never stored or returned. |
| `GET /api/admin/analytics` | Challenge performance, event trends, and aggregate student progress. |

These are management primitives for existing challenges, not a complete challenge-creation or category-management interface. No user deletion, score editing, role escalation, or Docker operation is exposed.

### Module 15 — leaderboard

`GET /api/leaderboard?page=1&limit=20` derives points and solve counts from `ChallengeSolve` only. Equal point/solve totals share a competition rank; username and user ID provide deterministic display order. Only active student usernames are public. First-solve and category-completion badges are derived from recorded solves and currently published challenges; no client-supplied points or duplicate reward path exists.

### Module 16 — isolation status

`backend/src/lib/challenge-lifecycle.ts` defines fixed resource limits, disabled runtime allowlisting, owner checks, and start/stop/expiry/failure state transitions. The runtime entry remains disabled, and no container is created, no Docker socket is used, and no network endpoint starts a challenge target. This is a safe foundation, **not verified isolation or a runnable sandbox**. A future executor must be separately deployed, private-network-only, non-privileged, egress-restricted, resource-limited, and tested for cross-user isolation before any vulnerable target is run.

### Module 17 — analytics

`GET /api/learning/analytics` returns the signed-in learner's started/solved challenge counts, hint reveals, quiz average, and category coverage. Individual analytics are not available to other students. Administrator challenge summaries use stored attempt/solve/hint data and omit passwords and secrets. Quiz average is the arithmetic mean of each recorded quiz score percentage; challenge averages are stored attempt count divided by unique solve count, and are null when there are no solves.

### Module 18 — security validation

Backend regression coverage runs through the existing Node test runner. The lifecycle policy has focused unit tests for allowlisting, ownership, state transitions, and expiry. The test suite also checks student denial on administrator APIs. This coverage does not substitute for database-backed migration checks, deployment threat modeling, or sandbox isolation testing.

### Module 19 — architecture and local demo

**Core data relationships:** `User` owns attempts, submissions, solves, hint usages, quiz attempts, and optional security-event actor/target references. `Category` contains `Challenge`; each challenge may have one private `ChallengeSecret`, ordered hints, an explanation, quiz questions/options, attempts, submissions, solves, and quiz attempts. `ChallengeQuizResponse` points to its quiz attempt, question, and selected option. `SecurityEvent` is append-oriented, indexed by time/type/severity, and retains nullable user references with `SET NULL`.

**Learner data flow:** browser → authenticated API/session middleware → input validation → challenge/learning service → Prisma/PostgreSQL → safe response projection. Flag verification uses the private server-side HMAC keyring; the browser receives neither flags nor verifier material.

**Admin workflow:** authenticated request → current database-backed user lookup → server-side ADMIN role middleware → validated management operation → security-event audit record. User role changes and destructive deletion are not part of this workspace.

**Demo path:** Landing → Register → Login → Dashboard → Challenge catalogue → complete an existing local AUTH/AC challenge → submit its locally configured flag → review points and explanation → submit quiz → inspect Progress and Leaderboard → sign in with a separately provisioned admin and review Admin workspace/Security events. Modules 8–12 remain Coming Soon; no public vulnerable target should be demonstrated.

For deployment, require TLS, a production database and session secret, a migration rollout, centralized log/alert operations, shared rate-limit storage for multiple backend instances, trusted proxy configuration, and a separately verified private sandbox executor before running any vulnerable target. No deployment or isolated runtime verification is claimed.

## Scripts and tests

Run commands from the repository root unless a command uses `npm --prefix`.

| Command | Purpose |
| --- | --- |
| `npm run dev:backend` | Start the backend in watch mode with `tsx`. |
| `npm run dev:frontend` | Start the Vite development server. |
| `npm run build:backend` | Compile the backend TypeScript project. |
| `npm run build:frontend` | Type-check and build the frontend with Vite. |
| `npm test` | Run both frontend and backend production build checks; it does not run unit tests. |
| `npm --prefix backend run test:auth` | Run all backend authentication, challenge, schema, and learning tests. Database-backed cases require the configured PostgreSQL database. The provisioned-account case is skipped unless both test-password environment variables are set. |
| `npm run db:generate` | Generate Prisma Client from `prisma/schema.prisma`. |
| `npm run db:migrate` | Apply development migrations using Prisma. |
| `npm run db:status` | Check migration status against the configured database. |
| `npm --prefix backend run seed:test-admin` | Idempotently provision the development administrator from the configured password. |
| `npm --prefix backend run seed` | Add the three AUTH challenges in explicitly enabled development mode using local flag values and the configured verifier keyring. |
| `npm --prefix backend run seed:auth-lab` | Alias for the local authentication-lab seed. |
| `npm --prefix backend run seed:access-lab` | Add the three AC challenges in explicitly enabled development mode using private local flags and the configured verifier keyring. |
| `npm --prefix backend run test` | Run all backend auth, challenge, learning, Module 6, and Module 7 tests. |
| `docker compose up --build` | Build and start all Compose services. |
| `docker compose stop postgres` | Stop only the PostgreSQL service and retain its named volume. |

There is no separate frontend unit-test script or standalone type-check script; the frontend build runs `tsc`. The backend auth tests use Node's built-in test runner through `tsx --test`.

The frontend build checks TypeScript and compiles the application; no frontend unit-test or browser-test runner is configured. The local browser workflow above used the real backend and PostgreSQL rather than mocked API responses. The automated test suite uses Express's in-memory session store; the PostgreSQL store behavior is tested directly. The full suite does not simulate restarting the backend process.

The authentication suite checks registration, input validation, duplicate and concurrent duplicate registration, password hashing, email/username login, session-ID rotation, `/me`, logout invalidation, cookie attributes, role authorization, sensitive-field exclusion, rate limiting, and PostgreSQL session persistence/expiry across separate store instances. The Module 6 tests cover local-only gates, fixed scenario behavior, reset expiry, one-time use, validation, and absence of reset-token data in responses. Automated HTTP tests use Express's in-memory session store; the PostgreSQL store behavior is tested directly, and the full suite does not simulate restarting the backend process. A synthetic learner was registered and signed in through the actual local backend for the Module 6 browser workflow. There is no frontend unit-test suite, and rapid duplicate-submit prevention has not been conclusively browser-verified.

## Troubleshooting

- **Database connection fails:** Confirm the Compose `postgres` service is running (`docker compose ps`) and host port `5433` is available. The host connection uses `localhost:5433`; containers use `postgres:5432`. Check `DATABASE_URL` and run `npm run db:status`. Backend startup fails closed when its database connection cannot be established; `GET /api/health` only checks the HTTP process.
- **Port already in use:** The defaults are PostgreSQL host port `5433`, backend port `4000`, and Vite port `5173`. Stop the conflicting service or adjust the local service configuration and corresponding URLs consistently.
- **Prisma client or migration errors:** Install root dependencies, run `npm run db:generate`, and verify `DATABASE_URL` points to the existing database before `npm run db:migrate`. Inspect with `npm run db:status`; do not reset or delete the database as a first fix.
- **Missing or invalid session secret:** Set `SESSION_SECRET` to a unique value at least 32 characters long in the root `.env`. The application refuses to start without it or if it matches an example placeholder. Restart the backend after changing it; changing it invalidates cookies signed with the prior value.
- **Frontend cannot reach the API or browser reports CORS errors:** Ensure the backend is listening on port `4000`; verify that the allowed `CORS_ORIGIN` matches the browser origin (normally `http://localhost:5173`) and that frontend requests include credentials. In Compose, the frontend's `VITE_API_URL` is `http://localhost:4000`.
- **Test-account seeding fails:** Set `VULNFORGE_TEST_ADMIN_PASSWORD` locally and verify it is 8-128 characters with a letter and a number. If the account already exists with a different password, role, or conflicting identity, the script intentionally stops without modifying it.

## Security notes

Current controls include bcrypt password hashing (12 rounds), validation of registration/login data, rate limits on registration and login, HTTP-only session cookies, credentialed CORS restricted to a configured origin, security headers via Helmet, and server-side authentication and role middleware. Public registration explicitly creates only `STUDENT` accounts. The test-admin script is a trusted development-only provisioning mechanism. Administrator APIs are gated server-side and expose only projected user/challenge/submission fields; student disabling does not modify roles and immediately invalidates subsequent authenticated requests.

The Compose PostgreSQL credentials are development defaults, not production credentials. Outside automated tests, sessions are stored in PostgreSQL using the same `DATABASE_URL` as the application. `connect-pg-simple` creates the session table when missing and periodically removes expired sessions; session rows use the session cookie expiration, which is eight hours. Automated HTTP tests use Express's in-memory store. The session cookie is HTTP-only, same-site `lax`, and secure in production. Registration is limited to 10 requests per 15 minutes per client and login to 20 requests per 15 minutes; test mode uses a higher allowance for the suite. Before deployment, configure a strong secret, production database credentials, HTTPS, and appropriate operational controls. The existing middleware and headers do not by themselves establish that the whole application is production-hardened.

Flag submissions are limited to 10 per authenticated user and 100 per client IP per 15 minutes (test mode uses 5 per user and 100 per IP). These limiters currently use `express-rate-limit`'s process-local in-memory store; counters are not shared across backend instances and reset when a process restarts. Production deployments with multiple instances should configure a shared rate-limit store and trusted proxy settings appropriate to the deployment. Flag verifiers are HMAC-SHA-256 digests; configure `VULNFORGE_FLAG_HMAC_KEYS` with versioned random key material on the backend, retain old versions while hashes reference them, and never expose the configuration to the frontend.

Any intentionally vulnerable educational labs must be isolated from the main platform and must not be exposed publicly without appropriate sandboxing, network isolation, and access controls.

The Module 6 exercises are simulations, not sandboxes: they are available only in explicitly enabled development mode and from loopback requests. Do not deploy them publicly or use their synthetic design examples as production authentication code. The simulated reset flow has no email delivery, durable tokens, or real-account effects.

The Module 7 exercises are also local simulations, not sandboxes. Their vulnerable comparisons never call real object, role, or privilege services. Keep the access simulator explicitly disabled outside local development; never treat its insecure decision as production authorization logic.

Security-event metadata is restricted to approved operational fields and excludes request bodies and secret material. Event records are visible only through administrator middleware and are deleted after 90 days. The local lifecycle contract is intentionally disabled and is not evidence that vulnerable workloads are isolated.

## Roadmap

- **Completed Module 1 foundation:** React landing page and PostgreSQL/Prisma setup with the initial User/Role migration.
- **Implemented Module 2 — Authentication & User Management (final operational verification pending):** Student registration; email-or-username login; session restoration and logout; protected profile; student/admin authorization; development admin provisioner; authentication and PostgreSQL session-store tests. Automated auth tests and both application builds pass. Full backend-process-restart persistence and browser verification of rapid duplicate-submit prevention remain outstanding; see [Scripts and tests](#scripts-and-tests).
- **Implemented Module 3 MVP — Student Dashboard & Navigation:** Protected dashboard and shared workspace layout; session restoration through `/api/auth/me`; responsive navigation; account/profile and logout; shared credentialed API helper with 401/403 error messages.
- **Implemented Module 4 — Challenge Engine:** Authenticated catalogue and details, attempt lifecycle, rate-limited server-side HMAC flag verification, unique solve records, and server-calculated points. No vulnerable runtime/container execution is included.
- **Implemented Module 5 — Hints, Explanations & Learning Checks:** Sequential hint reveals and penalties; post-solve expected educational answers, step-by-step solutions, structured explanations and takeaways; secure multiple-choice quiz submission and stored results; dashboard and progress views. The educational solution is separate from the private flag verifier and is returned only after a recorded solve. Penalties reduce the solve award and are applied once when the server records the solve. Database-backed regression verification remains environment-dependent.
- **Completed Module 6 — Authentication Security Lab:** Three seeded challenge records with HMAC-backed flags, ordered hints, explanations, quizzes, and authenticated learner progress; local-only AUTH-01/02/03 simulations guarded by explicit development configuration and loopback checks. The database-backed learner workflow and local browser simulations were verified. No schema migration was required.
- **Completed Module 7 — Access Control Security Lab:** Three seeded AC challenge records with HMAC-backed flags, ordered hints, explanations, quizzes, and authenticated learner progress; local-only object ownership, role/permission, and privilege-boundary comparisons use fixed synthetic cases and are guarded by development configuration, session authentication, loopback checks, and rate limits. PostgreSQL-backed learner workflow and browser simulations were verified. No schema migration was required.
- **Implemented Module 14 — Administration:** role-protected user/challenge management, validated educational-content editing for existing challenges, hint management with usage-history protection, and audited content changes. This is not general challenge authoring; database-backed regression verification remains environment-dependent.
- **Implemented foundations for Modules 13, 15, and 17:** security events and basic aggregate detections, solve-derived leaderboard, and learning/admin metrics. Local application features are present; deployment and operational readiness are not verified.
- **Module 16 foundation only:** disabled runtime policy and ownership/state-transition helpers; no executor, sandbox, or isolation verification.
- **Coming Soon placeholders:** Modules 8–12 appear in the frontend only. Their challenge content and lab execution are not implemented.
- **Still unimplemented:** isolated challenge runtime execution, challenge-authoring API/UI, learning pathways, deployment, and a full audit/compliance pipeline.

See [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md) for the concise remaining-work sequence and [docs/VULNFORGE_PROJECT_WALKTHROUGH.md](docs/VULNFORGE_PROJECT_WALKTHROUGH.md) for the faculty demonstration guide.

Folders reserved for future work are not evidence that those features are implemented.

## Contributing

The repository does not currently define a contribution guide or formal branch/PR policy. Before proposing a change, run the relevant available build and backend auth test commands from [Scripts and tests](#scripts-and-tests), and describe the scope and verification in the pull request or review request. Keep credentials and local environment files out of commits.
