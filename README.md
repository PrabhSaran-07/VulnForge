# VulnForge

**Build. Break. Defend.**

VulnForge is a cybersecurity learning platform where learners practice through CTF-style challenges, study security concepts, and track their progress in a controlled environment.



## Key Features

- User registration, session-based authentication, and role-based access.
- CTF challenge attempts, server-side flag verification, and scoring.
- Learning modules with hints, quizzes, and solve-gated explanations.
- Authentication and Access Control Security Labs with synthetic scenarios.
- Leaderboard and learner progress tracking.
- Admin workspace and administrator-only Lab Answer Bank.
- Blue-Team security events and analytics.
- Upcoming security labs clearly marked as Coming Soon.

## Technology Stack

- **Frontend:** React, TypeScript, React Router, Vite, Tailwind CSS.
- **Backend:** Node.js, Express, TypeScript.
- **Database:** PostgreSQL with Prisma ORM.
- **Development tools:** npm, Docker Compose, Prisma CLI, Node.js test runner, Supertest.

## Project Structure

```text
backend/    Express API, authentication, challenge and learning services
frontend/   React application and user interface
prisma/     Database schema and migrations
docs/       Project walkthrough and implementation plan
```

## Installation and Setup

### Prerequisites

- Node.js 22 and npm.
- Docker Desktop with Docker Compose, or a PostgreSQL database.
- Git.

### Environment configuration

From the repository root, create a local environment file from the provided template:

```powershell
Copy-Item .env.example .env
```

Review `.env.example` and set the required local values in `.env`. Do not commit or share this file.

### Database setup and migrations

Install dependencies and start the PostgreSQL service:

```powershell
npm install
npm --prefix backend install
npm --prefix frontend install
docker compose up -d postgres
```

Generate the Prisma client and apply the database migrations:

```powershell
npm run db:generate
npm run db:migrate
npm run db:status
```

### Start the application

In separate terminals from the repository root, start the backend and frontend:

```powershell
npm run dev:backend
```

```powershell
npm run dev:frontend
```

Open the frontend at `http://localhost:5173`. The backend listens at `http://localhost:4000`.

## Production Deployment

The recommended arrangement is a Vercel frontend, a single long-running Node.js backend service, and hosted PostgreSQL (for example, Neon). The backend currently uses in-memory `express-rate-limit` stores, so do not scale it horizontally or deploy it as a serverless function: independent instances would have independent rate-limit counters. A shared rate-limit store is needed before scaling. PostgreSQL-backed sessions remain durable across backend restarts.

The Vercel project includes a same-origin `/api/*` proxy. This keeps browser requests and the `httpOnly`, `Secure`, `SameSite=Lax` session cookie on the frontend origin; the proxy forwards requests to the backend using the server-only `BACKEND_URL`. Do not replace it with a browser-visible backend URL or a `VITE_` secret.

### 1. Create the production database

Create a PostgreSQL database on Neon (or another managed PostgreSQL provider). Use its **pooled** connection string for the backend runtime and its **direct** connection string for migrations. Set both as secrets in the backend service; the Prisma config uses `DIRECT_URL` for CLI operations and `DATABASE_URL` otherwise. Do not copy either URL into the frontend project.

Apply the committed migrations with `npm run db:deploy` from the repository root, using the production `DIRECT_URL` in the trusted shell environment. This runs `prisma migrate deploy` and does not create, reset, or replace existing migrations. Do not run `prisma migrate dev` against production.

### 2. Deploy the backend

In Render, create a **Blueprint** from the GitHub repository and select the branch containing `render.yaml`; the blueprint defines the production build and start commands. Keep one backend instance so the existing in-memory request limits remain consistent; a restart resets those counters. Never enable the development-only authentication/access-control labs in production.

Set these backend environment variables in Render:

| Variable | Value |
| --- | --- |
| `NODE_ENV` | `production` |
| `DATABASE_URL` | Neon pooled PostgreSQL URL |
| `DIRECT_URL` | Neon direct PostgreSQL URL used for migrations |
| `SESSION_SECRET` | A unique random value of at least 32 characters; Render can generate it |
| `CORS_ORIGIN` | Exact deployed frontend origin, with no trailing slash or path |
| `VULNFORGE_FLAG_HMAC_KEYS` | JSON map of key versions to base64-encoded random keys (at least 32 bytes each), matching the keys used to provision challenge verifiers |
| `VULNFORGE_ENABLE_LOCAL_AUTH_LAB` | `false` |
| `VULNFORGE_ENABLE_LOCAL_ACCESS_LAB` | `false` |

Render supplies `PORT`. Do not set test passwords or local lab flag values in production.

### 3. Deploy the frontend

In Vercel, import the same GitHub repository as a separate project and set its **Root Directory** to `frontend`. Select the deployment branch (do not push directly to `main`). `frontend/vercel.json` configures `npm install`, `npm run build`, the `dist` output, and client-side routing. Add the backend's HTTPS origin as the Vercel **server-side** environment variable `BACKEND_URL` (the origin shown on the Render service page, with no path). Do not prefix it with `VITE_`.

For the first deployment, deploy the frontend to obtain its production origin, put that exact origin in Render's `CORS_ORIGIN`, and redeploy the backend. Then set `BACKEND_URL` in Vercel and redeploy the frontend. The optional `VITE_API_URL` in `frontend/.env.example` is only a local-development override; production traffic uses the same-origin proxy.

### 4. Production database/application setup

After migrations are applied, register an initial account through the app and promote it to `ADMIN` through a carefully reviewed, one-off database operation using a trusted PostgreSQL console; the repository only provides a development test-admin seeder and must not use it to create a production administrator. Create or import production challenges and store each challenge's flag verifier using a key version present in `VULNFORGE_FLAG_HMAC_KEYS`. The local AUTH and Access Control lab seed scripts are intentionally development-only.

Check `https://<frontend-origin>/api/health` after both services deploy. Then verify registration, login, `/api/auth/me`, protected challenge listing, a valid/invalid flag submission, and leaderboard scoring using a test account and a provisioned challenge. Verify Vercel function logs and backend logs without copying secrets into tickets or chat. There is no live deployment or managed database until the repository is connected to the hosting providers and the required account/database configuration is supplied.

## Project Status

- Implemented: authentication, challenge and flag-submission workflow, learning features, AUTH and Access Control labs, administrator content management, leaderboard, progress, security events, and analytics.
- Modules 8–12 are Coming Soon; their challenges and answers are not implemented.
- Runtime isolation and challenge execution are not implemented. The project is not production-ready.

## Disclaimer

VulnForge is intended for controlled cybersecurity education and authorized testing only. Use it only in environments you own or are explicitly authorized to test.
