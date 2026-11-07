# VULNFORGE Complete Lab Answer Key

## 1. Introduction

This study guide covers the six implemented, authored Authentication Security and Access Control challenges in VULNFORGE and the two quiz questions configured for each challenge. Each lab uses fixed synthetic scenarios; AUTH and AC simulations do not contact external services or change real platform accounts.

The challenge solution described below is the educational answer, not the CTF flag. Private flags and verifier material are maintained separately by the server and are intentionally excluded from this document. Modules 8–12 have no implemented challenge questions or answer keys and remain Coming Soon.

## 2. Authentication Security Lab

### AUTH-01 — Weak Authentication Scenario

**Original problem statement:** Compare weak synthetic sign-in design with a server-side design that hashes passwords, avoids account-specific errors, and limits repeated failures.

**Correct educational answer:** Store a unique adaptive password hash made by a vetted password-hashing library. Verify candidate passwords on the server. Return a consistent failure response for unknown accounts and incorrect passwords, and use layered throttling and monitoring. Never store or compare recoverable plaintext passwords.

**Cybersecurity concept:** Secure credential storage, password verification, account enumeration, and online guessing controls.

**Why the weakness occurs:** A design that directly compares or stores a plaintext password exposes reusable credentials if its data is disclosed. Different errors for an unknown account and an incorrect password provide an account-existence signal. A password policy alone does not remedy unsafe storage or response behavior.

**Security impact:** A disclosure of plaintext credentials can enable account takeover on this or other services where passwords were reused. Account-specific responses can help an observer identify valid accounts, while missing throttling makes repeated guesses easier.

**Detailed explanation and step-by-step solution:**

1. Use only the displayed synthetic account in the local simulator; do not test real credentials.
2. Compare the weak and secure decisions for the synthetic account and an incorrect value.
3. Observe that the weak sample distinguishes an unknown account from a wrong password, while the secure sample uses a generic failure.
4. On the storage side, identify that a secure implementation retains an adaptive password hash, not the original password. A submitted candidate is verified against that hash on the server.
5. Treat rate limiting, backoff, and monitoring as complementary safeguards against repeated guessing, not substitutes for password hashing.
6. Conclude that the safe design combines adaptive hashing, generic failures, and appropriate abuse detection.

**Recommended remediation:** Use a vetted adaptive password hashing algorithm (for example, bcrypt or Argon2id) with suitable parameters and unique salts; support long passphrases; avoid account-specific login errors; rate-limit and monitor authentication attempts; and review reset and recovery flows.

**Learning takeaways:**

- Passwords should not be stored in plaintext or reversibly encrypted.
- Authentication needs a server-side password-hash verification step.
- Generic failure messages reduce account-enumeration signals.
- Rate limiting and monitoring complement, but do not replace, safe credential storage.

### AUTH-02 — Authentication-Check Flaw

**Original problem statement:** Inspect controlled sample decisions that trust a client-supplied identity claim or confuse authentication with authorization.

**Correct educational answer:** Establish authentication from server-managed session state. Then independently authorize the requested action using the trusted role and resource policy. A client-supplied `isAuthenticated` value or displayed frontend state is not proof of identity or permission.

**Cybersecurity concept:** Authentication versus authorization, trust boundaries, session validation, least privilege, and account enumeration.

**Why the weakness occurs:** The vulnerable example trusts a client-controlled authentication assertion and allows a signed-in student to perform an administrator-only action. Authentication establishes an identity; it does not automatically grant every permission. Different responses for known and unknown accounts also reveal account existence.

**Security impact:** Missing checks can allow unauthorized access to or modification of protected information. Account-enumeration signals can help attackers target known accounts.

**Detailed explanation and step-by-step solution:**

1. Compare only the fixed local simulator scenarios.
2. For the spoofed-client scenario, reject the client assertion when there is no server-validated session.
3. For the valid student-session scenario, recognize that the identity is authenticated but the administrator-only action remains unauthorized.
4. Compare the fixed known-account and unknown-account cases; the secure response should not disclose whether the account exists.
5. Validate the session on every protected request and derive the principal and role from trusted server state.
6. Enforce an explicit server-side permission check for each protected operation and deny by default.

**Recommended remediation:** Centralize server-side session and authorization helpers; never trust identity or role values from request bodies or frontend state; enforce resource ownership and role permission checks on every action; use consistent login failures; and test anonymous, lower-privileged, and authorized cases.

**Learning takeaways:**

- Authentication answers “who is the caller?”; authorization answers “what may they do?”
- Browser state is controlled by the client and is not an access-control boundary.
- A valid session may still lack permission for an action or resource.
- Account lookup failures should avoid disclosing account existence.

### AUTH-03 — Password-Reset Design Weakness

**Original problem statement:** Exercise a private local reset flow that keeps its synthetic token server-side and demonstrates expiry, validation, one-time use, and synthetic session invalidation.

**Correct educational answer:** Generate a high-entropy, unpredictable reset token; store only a verifier (such as a cryptographic hash) server-side; expire it promptly; validate it safely; and atomically consume it once. Validate the new password and invalidate existing sessions after a successful reset.

**Cybersecurity concept:** Account recovery, bearer-token entropy, token verifier storage, expiry, replay prevention, and session revocation.

**Why the weakness occurs:** Reset flows are vulnerable when tokens are predictable, long-lived, exposed, accepted repeatedly, not tied to a pending reset, or not consumed after use. A password reset that leaves old sessions active may also leave an attacker with continued access.

**Security impact:** A guessed, stolen, expired-but-accepted, or replayable token can allow an unauthorized password change. Failure to revoke existing sessions can preserve access after the legitimate account owner changes their password.

**Detailed explanation and step-by-step solution:**

1. Start a reset in the local synthetic flow and observe its sanitized status; the flow intentionally does not return the token.
2. Compare the fixed tampered, expired, and replay cases. Each must be rejected.
3. Complete the valid synthetic path with a policy-compliant new password and confirm the displayed state indicates one-time token use and synthetic-session invalidation.
4. For a real implementation, generate tokens with a cryptographically secure random source and retain only a verifier server-side.
5. Expire the token promptly and atomically consume it as part of the successful password update to prevent concurrent reuse.
6. Invalidate existing sessions, avoid logging tokens, rate-limit requests, and use generic reset-request responses.
7. Keep this exercise scoped to the simulator: it does not send email or alter a VULNFORGE account.

**Recommended remediation:** Use cryptographically random, short-lived, single-use tokens; store only token verifiers; consume them atomically; rate-limit reset requests; validate the new password; avoid exposing tokens through logs or analytics; notify the user through an approved channel; and revoke existing sessions.

**Learning takeaways:**

- A reset token is a bearer secret and must be protected accordingly.
- Expiry and single-use semantics limit replay and exposure windows.
- Token consumption and the password update must be safely coordinated.
- Session revocation is part of a complete credential reset.

## 3. Access Control Security Lab

### AC-01 — Object-Level Access Control

**Original problem statement:** Compare identifier-only access with a server-side ownership check using synthetic documents.

**Correct educational answer:** Authenticate the caller, then authorize access to each specific object using its server-stored owner or policy. Deny a cross-owner request. A valid or guessed object identifier is only a selector; it is not proof of ownership.

**Cybersecurity concept:** Object-level authorization, insecure direct object reference (IDOR), and broken object-level authorization (BOLA).

**Why the weakness occurs:** A handler may load or modify an object based on a user-controlled identifier without comparing its stored owner or checking an applicable policy. Authentication alone does not establish access to every object.

**Security impact:** A caller may read or alter another user's records, potentially exposing private information or changing data without permission.

**Detailed explanation and step-by-step solution:**

1. Compare the two fixed synthetic documents: one owned by the learner and one owned by another synthetic user.
2. Observe that the vulnerable decision treats the identifier as sufficient and does not check the owner.
3. Observe that the secure decision derives the actor from trusted server state and denies the cross-owner request.
4. Implement an ownership-scoped lookup or compare the stored owner with the authenticated principal before returning or changing the object.
5. Apply the check to every read and write operation; hiding identifiers in the UI is not a security control.
6. Test the same operation as multiple synthetic users, including explicit denied cross-owner cases.

**Recommended remediation:** Derive the actor from the server-managed session; scope database queries by authenticated ownership where practical; otherwise authorize the stored object owner before access; deny by default; and test every object operation across users.

**Learning takeaways:**

- Authentication does not establish ownership of every object.
- Object authorization must be enforced on the server for every operation.
- Identifiers are not authorization tokens.
- Ownership checks should be tested for both reads and writes.

### AC-02 — Role and Permission Enforcement

**Original problem statement:** Compare a permissive synthetic action decision with server-side role-to-permission enforcement.

**Correct educational answer:** Authenticate the request, load the actor's role or permissions from trusted server-side state, and enforce an explicit deny-by-default policy for the requested operation. A valid student session does not authorize an administrator-only action.

**Cybersecurity concept:** Role-based access control (RBAC), authorization policy enforcement, and deny-by-default design.

**Why the weakness occurs:** A route may allow any authenticated session without checking the operation's required permission, trust a client-supplied role, or rely on a hidden frontend control. These approaches confuse identity with permission.

**Security impact:** Ordinary users may access or change administrative data or operations, crossing intended privilege boundaries.

**Detailed explanation and step-by-step solution:**

1. Compare the fixed STUDENT and ADMIN actors for the same protected action.
2. Identify that the vulnerable path grants access merely because an actor is authenticated.
3. Confirm that the secure path checks the trusted role-to-permission policy and denies the student-only case.
4. Derive role information from the validated session/account, not a request field.
5. Enforce the policy at every protected route and data operation, even if the UI hides the action.
6. Test both authorized and denied roles for each protected operation.

**Recommended remediation:** Centralize policy checks; derive permissions from trusted server state; deny unlisted actions; apply checks at the server boundary; and add regression tests for each role/action pair.

**Learning takeaways:**

- A session proves identity, not blanket permission.
- Frontend visibility is presentation, not enforcement.
- Server-side policies should explicitly allow required permissions and deny by default.
- Negative authorization tests are as important as successful-access tests.

### AC-03 — Privilege Boundary Failure

**Original problem statement:** Review how a fixed synthetic privilege request is handled when the server does or does not enforce least privilege.

**Correct educational answer:** Treat a requested role change as untrusted input. Deny self-promotion unless a separately authorized server-side role-management policy permits that exact transition. Validate the actor, target, and allowed transition, then audit approved changes.

**Cybersecurity concept:** Privilege escalation, least privilege, trust boundaries, and authorization of administrative changes.

**Why the weakness occurs:** A handler may trust a submitted role value, let the caller assign their own role, or fail to re-check permission at the privilege-changing boundary. A syntactically valid role name does not authorize the transition.

**Security impact:** An unauthorized privilege change may unlock protected operations and expand access beyond the user's intended permissions.

**Detailed explanation and step-by-step solution:**

1. Choose the fixed synthetic student self-promotion scenario.
2. Compare the vulnerable decision, which trusts the requested role, with the secure decision, which requires an authorized transition.
3. Identify the boundary: the caller must not grant themselves permissions by changing request data.
4. Use a narrowly scoped server-side role-management service that validates the actor's current permission, target, and allowed transition.
5. Deny self-promotion by default; permit only explicitly authorized administration.
6. Audit successful changes and test denied self-promotion and other unauthorized transitions.

**Recommended remediation:** Apply least privilege; keep role assignment in a restricted server-side service; validate each transition and target; prevent self-promotion unless specifically authorized; record actor/target audit events; and test boundary cases.

**Learning takeaways:**

- A request for privilege is not authorization to grant it.
- Least privilege limits the damage of other access-control failures.
- Privilege changes need explicit server-side authorization and audit trails.
- Self-promotion and role-transition denial cases should be tested.

## 4. Quiz answer key for administrators

The following are the actual quiz prompts and correct options authored for the six challenges. Each challenge has two questions, for twelve total.

### AUTH-01

1. **Question:** What should the application store for a user password?  
   **Correct answer:** A unique adaptive password hash produced by a vetted library.  
   **Explanation:** Adaptive password hashing makes offline guessing more expensive and avoids storing the original password.
2. **Question:** Which failure response best reduces account enumeration?  
   **Correct answer:** Use a consistent response for an unknown account and an incorrect password.  
   **Explanation:** Consistent messages avoid disclosing whether a username is registered.

### AUTH-02

1. **Question:** A request body says `isAuthenticated=true`, but no server session is present. What is the safe decision?  
   **Correct answer:** Deny access because client-supplied identity state is untrusted.  
   **Explanation:** Protected handlers must validate server-managed authentication state.
2. **Question:** A valid student session requests an administrator-only action. Which check is needed?  
   **Correct answer:** A server-side authorization check for the required role and resource.  
   **Explanation:** Authentication alone does not grant authorization.

### AUTH-03

1. **Question:** How should a reset token be handled?  
   **Correct answer:** Generate it with cryptographic randomness, store a verifier, expire it, and consume it once.  
   **Explanation:** This limits token prediction, storage exposure, and replay.
2. **Question:** What should happen after a successful password reset?  
   **Correct answer:** Invalidate the reset token and existing sessions.  
   **Explanation:** One-time use prevents replay and session invalidation removes access based on prior credentials.

### AC-01

1. **Question:** A signed-in learner requests a document owned by another user. What should the service do?  
   **Correct answer:** Deny access after checking the stored owner against the authenticated principal.  
   **Explanation:** Authentication identifies the caller; object-level authorization decides whether that caller may access this document.
2. **Question:** Where should the ownership decision be enforced?  
   **Correct answer:** On the server for every object operation.  
   **Explanation:** Client-side checks can be bypassed and cannot protect a server-side resource.

### AC-02

1. **Question:** A STUDENT has a valid session and requests an ADMIN-only operation. What must happen?  
   **Correct answer:** The server checks the trusted role permission and denies the action.  
   **Explanation:** Authentication does not grant authorization; the server must evaluate the required permission.
2. **Question:** Where should the role used for authorization come from?  
   **Correct answer:** Trusted server-side account/session state.  
   **Explanation:** A client can change submitted role values, so protected operations must use server-validated identity state.

### AC-03

1. **Question:** A STUDENT requests that their own synthetic role become ADMIN. What is the secure result?  
   **Correct answer:** Deny it unless a separately authorized server-side role-management policy permits the transition.  
   **Explanation:** Requested privilege is untrusted input; the server must authorize the actor and transition.
2. **Question:** What principle limits the impact of a privilege-boundary failure?  
   **Correct answer:** Least privilege, enforced by server-side checks for each action.  
   **Explanation:** Minimal permissions and explicit checks reduce the scope of unauthorized actions.

## 5. Important cybersecurity concepts

- **Adaptive password hashing:** One-way, deliberately costly password verification reduces the value of a stolen password database.
- **Account enumeration:** Response differences can reveal whether an account exists; generic failures reduce that signal.
- **Authentication and authorization:** Authentication establishes identity; authorization decides whether that identity can perform a requested action on a resource.
- **Session trust boundary:** Protected operations must validate server-managed session state, not browser assertions.
- **Object-level authorization:** Every resource access needs an ownership or policy check; an identifier alone grants nothing.
- **Least privilege:** Grant only the permissions needed and use explicit policies for sensitive operations.
- **Recovery-token lifecycle:** High entropy, verifier-only storage, expiry, one-time use, atomic consumption, and session revocation limit reset abuse.
- **Auditability:** Sensitive changes such as role transitions should have reliable actor/target records and monitoring.

## 6. Remediation summary

1. Store passwords only as vetted adaptive hashes; use generic failures and layered throttling.
2. Validate server-managed sessions and enforce role, permission, and object-ownership checks for every protected operation.
3. Use short-lived, unpredictable, single-use reset tokens; store only verifiers; consume atomically; and revoke prior sessions.
4. Deny by default, minimize privilege, and keep administrative role changes narrowly authorized and audited.
5. Test unauthorized, cross-owner, anonymous, and lower-privilege cases, not only successful flows.
6. Keep the VULNFORGE simulator exercises isolated to their synthetic local scope; they are not vulnerable production targets.

## 7. Final learning takeaways

- Trust boundaries must be enforced on the server.
- Valid identity is not blanket permission.
- A user-controlled identifier or role claim cannot establish ownership or authority.
- Password and reset-token data require purpose-built secure storage and lifecycle controls.
- Defensive controls work together: validation, authorization, least privilege, rate limiting, logging, and tests address different failure modes.
- Learn from the synthetic vulnerable decision, but implement and operate only the secure design.
