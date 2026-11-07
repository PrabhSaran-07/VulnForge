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

## Project Status

- Implemented: authentication, challenge and flag-submission workflow, learning features, AUTH and Access Control labs, administrator content management, leaderboard, progress, security events, and analytics.
- Modules 8–12 are Coming Soon; their challenges and answers are not implemented.
- Runtime isolation and challenge execution are not implemented. The project is not production-ready.

## Disclaimer

VulnForge is intended for controlled cybersecurity education and authorized testing only. Use it only in environments you own or are explicitly authorized to test.
