# VULNFORGE Implementation Plan

## Current status

| Area | Status | Scope |
| --- | --- | --- |
| Modules 1–3 | Implemented | Landing page, authentication, protected learner workspace, profile, and navigation. |
| Module 4 | Implemented | Published challenge catalogue, attempt lifecycle, private server-side flag verification, solves, and scoring. |
| Module 5 | Implemented | Ordered hints and penalties, solve-gated educational answers and explanations, quizzes, and learner progress. |
| Modules 6–7 | Implemented as local simulations | Three synthetic AUTH challenges and three synthetic access-control challenges; the simulators do not target real services or change platform accounts. |
| Modules 8–12 | Coming Soon | Static frontend placeholders only; no challenge records, flags, attempts, or lab execution. |
| Module 13 | Foundation implemented | Structured security events and basic aggregate detection; not a full monitoring or compliance pipeline. |
| Module 14 | Implemented for existing content | Role-protected admin workspace, user controls, publication controls, and educational-content editing; no general challenge or category authoring. |
| Module 15 | Foundation implemented | Solve-derived leaderboard and ranking; operational deployment is not verified. |
| Module 16 | Disabled foundation only | Runtime policy and lifecycle contract; no executor, sandbox, or isolation verification. |
| Module 17 | Foundation implemented | Learner and administrator analytics derived from stored activity. |
| Modules 18–19 | Partial foundations | Backend regression tests and architecture/demo documentation; no full deployment validation or security certification. |

## Remaining work

1. Apply the additive educational-content migration in each deployment before starting the updated backend. For a fully seeded local AUTH/AC group, run its existing development seed command after migration to fill only missing educational solution fields. Those commands can provision a wholly absent group and deliberately stop if only part of that group's challenges exist; configured flag values and verifier keys remain local and are never part of the learning content.
2. Review educational answers with the challenge authors whenever new challenges are published. Use the admin editor for existing records, and keep verifier/flag provisioning in trusted backend tooling.
3. Keep Modules 8–12 as Coming Soon until each module has reviewed challenge content, tests, and an implementation appropriate to its learning objective.
4. Treat Module 16 as a hard prerequisite before running any vulnerable workload. Design and independently verify a private, non-privileged, egress-restricted, resource-limited executor with owner isolation, lifecycle cleanup, and abuse monitoring. Do not enable container execution before that work and its security review are complete.
5. Before deployment, complete environment-specific migration rollout, TLS/session configuration, trusted-proxy review, shared rate-limit storage, centralized alerting, browser/end-to-end checks, backup/recovery planning, and a deployment threat model.

The local application and its simulations are educational foundations, not evidence of production readiness or runtime isolation.
