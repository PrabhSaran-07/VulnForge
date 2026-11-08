# VulnForge

**Build. Break. Defend.**

VulnForge is an interactive cybersecurity learning platform where learners practice through CTF-style challenges, study defensive and offensive concepts, and track their progress in a controlled environment.

🌐 **Live Application:** [vulnforge-frontend.vercel.app](https://vulnforge-frontend.vercel.app/)

---

## 🚀 Key Features

- **Authentication & RBAC:** Secure user registration, session-based authentication, and role-based access control (Learner and Administrator).
- **CTF Challenges & Flag Submissions:** Server-side HMAC flag verification, automated scoring, and attempt tracking.
- **Security Labs:** Hands-on labs covering Authentication Security and Access Control (IDOR, Broken Object-Level Authorization, Privilege Escalation).
- **Learning & Defense:** Hint penalty system, interactive quizzes with instant feedback, and solve-gated educational explanations.
- **Admin Workspace & Answer Bank:** Challenge management, platform analytics, real-time security events monitoring, and a comprehensive Lab Answer Bank.
- **Interactive Documentation:** In-app platform documentation and walkthroughs accessible to learners and instructors.
- **Leaderboard & Progress Tracking:** Real-time learner rankings, solved challenges history, and category completion metrics.

---

## 🛠️ Technology Stack

- **Frontend:** React 19, TypeScript, React Router 7, Vite, Tailwind CSS (Hosted on [Vercel](https://vulnforge-frontend.vercel.app/))
- **Backend:** Node.js, Express, TypeScript (Hosted on [Render](https://vulnforge-api.onrender.com))
- **Database:** PostgreSQL with Prisma ORM (Hosted on [Neon](https://neon.tech))
- **Security:** Argon2id / bcrypt password hashing, session cookies, HMAC-SHA256 flag verification, rate limiting, and Helmet CSP.

---

## 📂 Project Structure

```text
VulnForge/
├── backend/          # Express REST API, auth middleware, and lab services
├── frontend/         # React SPA, UI components, and state management
├── prisma/           # Prisma schema, migrations, and seed scripts
├── docs/             # Complete answer keys and project walkthroughs
└── render.yaml       # Render web service blueprint configuration
```

---

## ⚡ Quick Start (Local Development)

### Prerequisites

- Node.js 20+ and npm
- Docker Desktop (or a local PostgreSQL instance)
- Git

### 1. Clone & Configure Environment

```bash
git clone https://github.com/PrabhSaran-07/VulnForge.git
cd VulnForge
cp .env.example .env
```

Review `.env` and set your local environment variables.

### 2. Install Dependencies & Start Database

```bash
npm install
npm --prefix backend install
npm --prefix frontend install

# Start local PostgreSQL container (optional if using external Postgres)
docker compose up -d postgres
```

### 3. Initialize Database & Run Migrations

```bash
npm run db:generate
npm run db:migrate
```

### 4. Start Development Servers

Run the backend and frontend in separate terminals:

```bash
# Terminal 1 - Backend (port 4000)
npm run dev:backend

# Terminal 2 - Frontend (port 5173)
npm run dev:frontend
```

Access the application locally at `http://localhost:5173`.

---

## 🌐 Production Architecture

The production environment is deployed using a decoupled, zero-CORS-exposure architecture:

1. **Frontend (Vercel):** Serves the Vite React single-page application at [vulnforge-frontend.vercel.app](https://vulnforge-frontend.vercel.app/). Vercel edge rewrites transparently forward `/api/*` traffic to the backend, maintaining same-origin session cookies (`httpOnly`, `Secure`, `SameSite=Lax`).
2. **Backend (Render):** Express API running on Node.js at `https://vulnforge-api.onrender.com`. On startup, it bootstraps challenge data, ensures category visibility, and synchronizes flag verifier hashes.
3. **Database (Neon Serverless PostgreSQL):** Managed cloud PostgreSQL instance connecting via connection pooling.

---

## ⚠️ Disclaimer

VulnForge is designed exclusively for educational purposes and authorized cybersecurity skill development. Synthetic vulnerability scenarios and simulations run in controlled boundaries and must not be used on unauthorized systems.
