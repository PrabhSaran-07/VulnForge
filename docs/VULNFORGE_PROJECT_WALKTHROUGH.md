# VULNFORGE Project Walkthrough

This guide is a practical faculty demonstration of the current VULNFORGE application. It describes implemented behavior and clearly separates local simulations from future runtime capabilities. No passwords, flags, keys, or environment-variable values are included.

## 1. Introduction and objectives

VULNFORGE is a cybersecurity learning platform built around a challenge lifecycle: learners review an objective, start an attempt, submit a server-verified solution, and then study the defensive lesson. The platform tracks progress and gives administrators tools to manage existing challenge learning content.

The current demonstration focuses on authentication and access-control concepts. Those labs are synthetic local simulations, not vulnerable services or targets. The platform does not run intentionally vulnerable containers.

## 2. Technology stack and architecture

- **Frontend:** React, TypeScript, React Router, and Vite.
- **Backend:** Node.js, Express, TypeScript, Zod request validation, and server-managed sessions.
- **Persistence:** PostgreSQL accessed through Prisma.
- **Security controls:** bcrypt password hashing, role middleware, rate-limited flag submissions, server-side HMAC flag verification, and structured security events.

Typical request flow:

1. The browser sends a credentialed request to the API.
2. Session middleware resolves the signed-in user.
3. Route middleware applies authentication and, where required, administrator-role checks.
4. Zod validates request data.
5. A route selects only the safe fields needed for its response and reads or writes records through Prisma.
6. The browser receives a purpose-specific response.

Challenge flags and HMAC verifier material remain server-side and are separate from educational answer content.

## 3. Student registration and login

1. Open the landing page and choose **Get Started** or **Login**.
2. Register a student account using the form. Public registration creates a `STUDENT`; it cannot assign an administrator role.
3. Sign in with the account identifier and password.
4. The backend creates an HTTP-only session cookie. On refresh, the frontend checks the current session through `GET /api/auth/me`.
5. Use **Log Out** to end the session.

Administrator accounts are provisioned through trusted backend administration, not the public registration form.

## 4. Student dashboard and navigation

After login, the protected workspace provides links to Dashboard, Challenges, Categories, My Progress, Leaderboard, Analytics, and Profile. Administrators also see links to the Admin workspace, Lab Answer Bank, and Blue-Team events.

The dashboard and progress views reflect stored challenge attempts, solves, hints, and quiz results. Category listings come from currently available published challenges. Planned modules are visibly marked **Coming Soon**.

## 5. Challenge categories and solving workflow

The current authored catalogue contains three Authentication Security challenges and three Access Control challenges:

- **AUTH-01:** Weak Authentication Scenario
- **AUTH-02:** Authentication-Check Flaw
- **AUTH-03:** Password-Reset Design Weakness
- **AC-01:** Object-Level Access Control
- **AC-02:** Role and Permission Enforcement
- **AC-03:** Privilege Boundary Failure

For an available challenge:

1. Open its detail page and review the description, learning objectives, context, and prerequisites.
2. Start or resume an attempt.
3. Use the ordered hints if needed. The interface explains any point penalty before confirmation.
4. Submit the solution through the existing flag-verification endpoint. The server verifies it using private verifier material and returns success or failure feedback; it does not return the expected private flag.
5. A correct submission records a solve and awards the server-calculated points after applicable hint penalties.
6. After the solve is recorded, open the educational answer and solution to review the concept, impact, remediation, and takeaways.

The educational answer is not the CTF flag. Students cannot retrieve the answer before solving.

## 6. Hints, answers, and step-by-step explanations

Hints are revealed in order and tracked per learner. A penalty is confirmed before a paid hint is revealed, and a hint is charged at most once.

Post-solve learning content includes:

- The expected educational answer, kept distinct from the private flag/verifier.
- A sequence of educational solution steps.
- Root cause, technical explanation, impact, and conditions.
- Secure implementation, remediation guidance, and detection ideas.
- Key takeaways and, where configured, a multiple-choice knowledge check.

The student detail endpoint does not include explanation fields. The explanation endpoint checks the learner's recorded solve before returning those fields.

## 7. Authentication Security Lab

The AUTH challenges explain password handling, authentication decisions, account-enumeration signals, and reset-token lifecycle design. Their local simulator uses fixed or synthetic scenarios and has no connection to real login services or platform accounts.

Demonstration points:

- Contrast a weak synthetic sign-in decision with adaptive password hashing, generic failures, throttling, and monitoring.
- Distinguish a client-supplied identity claim from a server-validated session, and distinguish authentication from authorization.
- Compare valid, tampered, expired, and replayed synthetic reset actions. The simulator does not return a reset token, send email, or reset a real account.

These simulations are restricted to explicit local development and loopback access. They are not production authentication examples or public targets.

## 8. Access Control Security Lab

The AC challenges use fixed synthetic actors and resources to explain:

- Object ownership checks and object-level authorization.
- Role-to-permission enforcement at the server boundary.
- Least privilege and safe handling of privilege changes.

The simulator compares vulnerable and defensive decisions. It does not read or modify real documents, platform roles, or user permissions.

## 9. Admin dashboard and challenge content management

An authenticated administrator can open the Admin workspace to review platform counts, users, challenges, challenge performance, student progress summaries, and recent flag-submission outcomes. The dedicated **Lab Answer Bank** groups the published AUTH and AC challenges, supports search by challenge ID/title/question and category filtering, shows answer completeness, and displays the quiz answer key.

For an existing challenge, the administrator can edit:

- Learning objectives.
- Expected educational answer and solution steps.
- Root cause, technical explanation, impact, conditions, secure implementation, remediation, and detection guidance.
- Key takeaways and ordered hints.

The backend validates the content, requires `ADMIN` through the existing role middleware, excludes flag/verifier data from all content responses, and records an audit event. Hint content cannot be changed after a learner has revealed a hint, preserving the meaning of recorded usage. The editor manages existing challenge records; it does not create challenge records or manage categories.

## 10. Security events and Blue-Team dashboard

Administrators can open **Blue-Team events** to review structured event records, severity counts, and basic recent detection signals. Filters include event type, severity, and date range.

Event records are designed to exclude passwords, cookies, session identifiers, tokens, flags, request bodies, and HMAC material. The dashboard is a local operational foundation, not a full SIEM, compliance, or incident-response system.

## 11. Leaderboard and analytics

The leaderboard derives scores and solve counts from server-side solve records. Equal point and solve totals share a competition rank; ordering is deterministic. Public leaderboard entries are limited to active student accounts.

Learner analytics summarize that learner's challenge activity, hints, quiz performance, and category coverage. Administrator analytics provide aggregate challenge activity and student progress; one learner's private progress is not exposed to other students.

## 12. Modules marked Coming Soon

Modules 8–12 remain **Coming Soon**:

| Module | Topic |
| --- | --- |
| 8 | Injection Security |
| 9 | Session and Token Security |
| 10 | File Upload Security |
| 11 | API Security |
| 12 | Configuration Security |

The current frontend entries are static planned-module metadata only. They do not create challenge records, flags, attempts, scores, or executable labs.

## 13. Runtime isolation limitations

Module 16 is a disabled runtime contract and lifecycle foundation only. VULNFORGE currently has no challenge executor, sandbox, container lifecycle, or verified cross-user isolation. No vulnerable target should be launched or publicly exposed.

Before any runtime is enabled, the project needs an independently reviewed executor with strict owner isolation, non-privileged execution, private networking, egress controls, resource limits, cleanup, and abuse monitoring. The current platform must be demonstrated using the local synthetic AUTH/AC simulators instead.

## 14. Database structure and important APIs

Important Prisma records include:

- `User` and server-managed session storage for account identity and authentication.
- `Category` and `Challenge` for available challenge metadata, objectives, status, and relationships.
- `ChallengeSecret` for private verifier hashes and key versions; it is not selected by student or content-management responses.
- `ChallengeAttempt`, `FlagSubmission`, and `ChallengeSolve` for the verified attempt and scoring lifecycle.
- `ChallengeHint` and `ChallengeHintUsage` for ordered hints and per-user reveal/penalty history.
- `ChallengeExplanation` for educational answers, solution steps, explanations, remediation, and takeaways.
- Quiz question, option, attempt, and response records for post-solve knowledge checks.
- `SecurityEvent` for structured operational events.

Important routes:

| Route | Purpose |
| --- | --- |
| `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`, `POST /api/auth/logout` | Student account and session workflow. |
| `GET /api/categories`, `GET /api/challenges`, `GET /api/challenges/:slug` | Authenticated catalogue and safe challenge details. |
| `POST /api/challenges/:slug/attempts`, `POST /api/challenges/:slug/attempts/:attemptId/submissions` | Start/resume and submit through server-side verification. |
| `GET/POST /api/challenges/:slug/hints` | View revealed hint state and reveal the next hint. |
| `GET /api/challenges/:slug/explanation`, `GET /api/challenges/:slug/quiz` | Solve-gated educational explanation and quiz. |
| `GET /api/leaderboard`, `GET /api/learning/analytics`, `GET /api/learning/progress` | Leaderboard and learner progress. |
| `GET /api/admin/challenges/:id/content`, `PUT /api/admin/challenges/:id/content` | Administrator-only educational content management. |
| `/api/admin/overview`, `/api/admin/users`, `/api/admin/challenges`, `/api/admin/events`, `/api/admin/analytics` | Administrator workspace and Blue-Team data. |
| `/api/auth-lab/*`, `/api/access-lab/*` | Local-only synthetic security lab simulations. |

Student routes select only public challenge metadata and never return the `ChallengeSecret` record. The explanation route checks the authenticated user's solve record before returning educational solution content.

## 15. Local setup and execution

Prerequisites: Node.js 22, npm, and Docker Compose or a local PostgreSQL 16 instance.

1. From the repository root, copy `.env.example` to `.env` and configure local-only values privately. Do not place credentials, flags, or verifier keys in source code or documentation.
2. Install dependencies:

   ```powershell
   npm install
   npm --prefix backend install
   npm --prefix frontend install
   ```

3. Start the local database if using Compose, then generate the Prisma client and apply migrations:

   ```powershell
   docker compose up -d postgres
   npm run db:generate
   npm run db:migrate
   npm run db:status
   ```

4. To provision the local AUTH/AC challenge records, configure the lab enablement and private verifier inputs only in the ignored local environment file, then run the existing seed commands in development mode:

   ```powershell
   npm --prefix backend run seed:auth-lab
   npm --prefix backend run seed:access-lab
   ```

   The seed tools never print or place private flags in browser assets. Do not copy secret values into a presentation.

5. Start the backend and frontend in separate terminals:

   ```powershell
   npm run dev:backend
   npm run dev:frontend
   ```

6. Open the local frontend and register a student account. Provision any administrator account through the trusted local admin-provisioning process; there is no public admin registration flow.

The local AUTH/AC simulations are mounted only for explicitly enabled development mode and loopback requests. Do not start vulnerable targets or enable container execution.

## 16. Suggested faculty demonstration sequence

1. Introduce the platform architecture and explain that no vulnerable target runtime is active.
2. Register a student and sign in; show the protected dashboard and category navigation.
3. Open an AUTH challenge, read its objective and prerequisites, start an attempt, and reveal a hint to show ordered penalties.
4. Use the local simulator to compare the synthetic weak and secure decisions. Do not display or disclose a private flag.
5. Submit the locally configured answer privately through the flag field; show success feedback and the recorded solve.
6. Review the now-unlocked expected educational answer, solution steps, remediation, takeaways, and quiz.
7. Open an AC challenge and demonstrate the synthetic ownership or role-permission comparison.
8. Show learner progress, leaderboard ranking, and analytics.
9. Sign in with a separately provisioned administrator account. Edit educational content on an existing challenge, then show that the backend records the administrative change.
10. Open the Blue-Team events page and review safe event metadata.
11. Finish by showing Modules 8–12 marked Coming Soon and explaining that Module 16 isolation remains unimplemented. State explicitly that no vulnerable containers were run.
