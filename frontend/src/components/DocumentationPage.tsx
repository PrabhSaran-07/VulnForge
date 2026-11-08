import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function DocumentationPage() {
  const [activeTab, setActiveTab] = useState<'solutions' | 'walkthrough' | 'architecture'>('solutions');
  const [filterCategory, setFilterCategory] = useState<'all' | 'auth' | 'ac'>('all');

  return (
    <section className="learning-page">
      <div className="section-code">[ PLATFORM KNOWLEDGE BASE & DOCUMENTATION ]</div>
      <h1>VulnForge Documentation & Lab Answer Key</h1>
      <p className="learning-intro">
        Authoritative educational guides, complete lab answer keys, faculty demonstration walkthroughs, and system architecture specifications.
      </p>

      {/* Docs Tabs Navigation */}
      <div className="docs-tabs-nav">
        <button
          type="button"
          className={`docs-tab-btn${activeTab === 'solutions' ? ' active' : ''}`}
          onClick={() => setActiveTab('solutions')}
        >
          <span className="docs-tab-number">01</span>
          <span>Lab Solutions & Answer Key</span>
        </button>
        <button
          type="button"
          className={`docs-tab-btn${activeTab === 'walkthrough' ? ' active' : ''}`}
          onClick={() => setActiveTab('walkthrough')}
        >
          <span className="docs-tab-number">02</span>
          <span>Project Walkthrough & Guide</span>
        </button>
        <button
          type="button"
          className={`docs-tab-btn${activeTab === 'architecture' ? ' active' : ''}`}
          onClick={() => setActiveTab('architecture')}
        >
          <span className="docs-tab-number">03</span>
          <span>Architecture & Roadmap</span>
        </button>
      </div>

      {/* TAB 1: LAB SOLUTIONS & ANSWER KEY */}
      {activeTab === 'solutions' && (
        <div className="docs-content-section">
          <div className="docs-toolbar">
            <div className="docs-filter-group">
              <span>Filter labs:</span>
              <button
                type="button"
                className={`button button-secondary${filterCategory === 'all' ? ' active' : ''}`}
                onClick={() => setFilterCategory('all')}
              >
                All Authored Labs (6)
              </button>
              <button
                type="button"
                className={`button button-secondary${filterCategory === 'auth' ? ' active' : ''}`}
                onClick={() => setFilterCategory('auth')}
              >
                Authentication Security (3)
              </button>
              <button
                type="button"
                className={`button button-secondary${filterCategory === 'ac' ? ' active' : ''}`}
                onClick={() => setFilterCategory('ac')}
              >
                Access Control (3)
              </button>
            </div>
            <Link to="/admin/lab-answer-bank" className="button button-primary">
              Open Admin Answer Bank Editor →
            </Link>
          </div>

          {/* AUTHENTICATION SECURITY LABS */}
          {(filterCategory === 'all' || filterCategory === 'auth') && (
            <div className="answer-bank-category">
              <h2>Module 6 · Authentication Security Labs</h2>

              {/* AUTH-01 */}
              <article className="learning-card answer-bank-entry">
                <div className="learning-card-meta">
                  <span>CHALLENGE: AUTH-01</span>
                  <span>DIFFICULTY: BEGINNER · 100 POINTS</span>
                </div>
                <h3>AUTH-01: Weak Authentication Scenario</h3>
                <p><strong>Original Problem Statement:</strong> Compare weak synthetic sign-in design with a server-side design that hashes passwords, avoids account-specific errors, and limits repeated failures.</p>

                <div className="answer-bank-explanations">
                  <article>
                    <h4>Core Concept</h4>
                    <p>Secure credential storage, adaptive password hashing, account enumeration defense, and rate-limiting controls.</p>
                  </article>
                  <article>
                    <h4>Root Cause</h4>
                    <p>Storing or directly comparing plaintext passwords exposes credentials if database data is breached. Distinct errors for unknown accounts vs. wrong passwords leak user existence.</p>
                  </article>
                  <article>
                    <h4>Security Impact</h4>
                    <p>Plaintext exposure causes immediate account takeovers across reused credentials. Specific errors allow attackers to compile verified target lists.</p>
                  </article>
                  <article>
                    <h4>Remediation</h4>
                    <p>Use adaptive salting/hashing (Argon2id or bcrypt), return unified failure responses (e.g. &quot;Invalid username or password&quot;), and apply layered IP/user rate limiting.</p>
                  </article>
                </div>

                <h4>Step-by-Step Educational Solution</h4>
                <ol>
                  <li>Run the comparison in the simulator with the synthetic account <code>demo.learner</code> / <code>weak1</code>.</li>
                  <li>Notice the vulnerable implementation returns distinct responses: &quot;Unknown account&quot; vs. &quot;Incorrect password&quot;.</li>
                  <li>Notice the secure implementation returns a generic &quot;Invalid credentials&quot; response and increases backoff delays.</li>
                  <li>Verify that credentials on the server are stored as salted, adaptive hashes and verified in constant time.</li>
                </ol>

                <h4>Quiz Questions & Verified Answer Key</h4>
                <div className="answer-bank-question">
                  <p><strong>Q1: Why is storing a plaintext password dangerous even if the login form requires an 8-character password?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> A complexity policy does not protect the password once database storage is disclosed or inspected.</p>
                </div>
                <div className="answer-bank-question">
                  <p><strong>Q2: What is the primary defensive benefit of returning &quot;Invalid username or password&quot; for both unknown accounts and bad passwords?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> It stops an external observer from determining whether a specific username or email exists on the platform.</p>
                </div>
              </article>

              {/* AUTH-02 */}
              <article className="learning-card answer-bank-entry">
                <div className="learning-card-meta">
                  <span>CHALLENGE: AUTH-02</span>
                  <span>DIFFICULTY: BEGINNER · 100 POINTS</span>
                </div>
                <h3>AUTH-02: Authentication-Check Flaw</h3>
                <p><strong>Original Problem Statement:</strong> Inspect controlled sample decisions that trust a client-supplied identity claim or confuse authentication with authorization.</p>

                <div className="answer-bank-explanations">
                  <article>
                    <h4>Core Concept</h4>
                    <p>Authentication vs. authorization, trust boundaries, server session validation, and least privilege.</p>
                  </article>
                  <article>
                    <h4>Root Cause</h4>
                    <p>The vulnerable application relies on client-submitted headers or parameters (e.g., <code>role: ADMIN</code> or <code>isAuthenticated: true</code>) rather than verifying server-side session records.</p>
                  </article>
                  <article>
                    <h4>Security Impact</h4>
                    <p>Authenticated regular users can execute administrative functions or view privileged student records by simply changing client-side values.</p>
                  </article>
                  <article>
                    <h4>Remediation</h4>
                    <p>Bind authenticated user identity strictly to server-managed sessions (e.g., HTTP-only cookie session store) and enforce server-side role checks for privileged actions.</p>
                  </article>
                </div>

                <h4>Step-by-Step Educational Solution</h4>
                <ol>
                  <li>Identify where the application trusts the request payload or header for user role assertions.</li>
                  <li>Observe that establishing user identity does not automatically grant authorization for administrative actions.</li>
                  <li>Implement route middleware (<code>requireAuth</code> + <code>requireRole([&apos;ADMIN&apos;])</code>) reading directly from validated server session data.</li>
                </ol>

                <h4>Quiz Questions & Verified Answer Key</h4>
                <div className="answer-bank-question">
                  <p><strong>Q1: A valid student session requests an administrator-only action. Which check is needed?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> The server must verify that the authenticated session identity carries explicit administrator role permissions before executing.</p>
                </div>
                <div className="answer-bank-question">
                  <p><strong>Q2: Why should client-side boolean flags like <code>isAdmin: true</code> never be trusted by API endpoints?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> Any data sent from the client can be tampered with by an attacker using proxy tools or modified HTTP requests.</p>
                </div>
              </article>

              {/* AUTH-03 */}
              <article className="learning-card answer-bank-entry">
                <div className="learning-card-meta">
                  <span>CHALLENGE: AUTH-03</span>
                  <span>DIFFICULTY: INTERMEDIATE · 150 POINTS</span>
                </div>
                <h3>AUTH-03: Password-Reset Boundary Flaw</h3>
                <p><strong>Original Problem Statement:</strong> Analyze password reset mechanisms that accept a target user identifier directly without requiring out-of-band token verification.</p>

                <div className="answer-bank-explanations">
                  <article>
                    <h4>Core Concept</h4>
                    <p>Secure password recovery, cryptographic token generation, session termination upon credential changes.</p>
                  </article>
                  <article>
                    <h4>Root Cause</h4>
                    <p>Allowing password changes by specifying a target username/email without validating ownership via an unguessable single-use time-limited reset token.</p>
                  </article>
                  <article>
                    <h4>Security Impact</h4>
                    <p>Complete arbitrary account takeover of any known account on the platform.</p>
                  </article>
                  <article>
                    <h4>Remediation</h4>
                    <p>Generate high-entropy cryptographically random reset tokens, store their hash with expiration, send via verified email, and invalidate all existing user sessions upon reset.</p>
                  </article>
                </div>

                <h4>Step-by-Step Educational Solution</h4>
                <ol>
                  <li>Test the reset endpoint to observe that specifying another user&apos;s username resets their password immediately.</li>
                  <li>Transition to a token-based verification flow requiring a verified cryptographic token delivered to the registered email.</li>
                  <li>Ensure reset tokens expire within 15 minutes and can only be used once.</li>
                </ol>

                <h4>Quiz Questions & Verified Answer Key</h4>
                <div className="answer-bank-question">
                  <p><strong>Q1: What should happen to existing active sessions when a user changes their password?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> All existing active sessions should be invalidated immediately to prevent an attacker from retaining unauthorized access.</p>
                </div>
                <div className="answer-bank-question">
                  <p><strong>Q2: How should password reset tokens be stored in the database?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> As cryptographic hashes (e.g. SHA-256) alongside an expiration timestamp to prevent token theft from database backups.</p>
                </div>
              </article>
            </div>
          )}

          {/* ACCESS CONTROL LABS */}
          {(filterCategory === 'all' || filterCategory === 'ac') && (
            <div className="answer-bank-category">
              <h2>Module 7 · Access Control Security Labs</h2>

              {/* AC-01 */}
              <article className="learning-card answer-bank-entry">
                <div className="learning-card-meta">
                  <span>CHALLENGE: AC-01</span>
                  <span>DIFFICULTY: BEGINNER · 100 POINTS</span>
                </div>
                <h3>AC-01: Object-Level Access Control (IDOR)</h3>
                <p><strong>Original Problem Statement:</strong> Investigate endpoints that look up records by ID without checking whether the requesting user owns the object.</p>

                <div className="answer-bank-explanations">
                  <article>
                    <h4>Core Concept</h4>
                    <p>Insecure Direct Object Reference (IDOR), object ownership validation, multi-tenant data isolation.</p>
                  </article>
                  <article>
                    <h4>Root Cause</h4>
                    <p>Querying objects using only the client-supplied resource ID (e.g. <code>prisma.profile.findUnique({`{ where: { id } }`})</code>) without filtering by the authenticated user&apos;s ID.</p>
                  </article>
                  <article>
                    <h4>Security Impact</h4>
                    <p>Learners can view, modify, or delete sensitive data belonging to other students or administrators by changing URL IDs.</p>
                  </article>
                  <article>
                    <h4>Remediation</h4>
                    <p>Enforce ownership predicates on all object queries: <code>prisma.resource.findFirst({`{ where: { id, userId: req.user.id } }`})</code>.</p>
                  </article>
                </div>

                <h4>Quiz Questions & Verified Answer Key</h4>
                <div className="answer-bank-question">
                  <p><strong>Q1: Why does authenticating a user with a valid session not prevent IDOR vulnerabilities?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> Authentication only proves who the user is; it does not verify whether the authenticated user has permission to access the specific object ID requested.</p>
                </div>
                <div className="answer-bank-question">
                  <p><strong>Q2: What is the most reliable defense against Insecure Direct Object References?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> Incorporating ownership checks directly into database queries using the session user ID alongside the record ID.</p>
                </div>
              </article>

              {/* AC-02 */}
              <article className="learning-card answer-bank-entry">
                <div className="learning-card-meta">
                  <span>CHALLENGE: AC-02</span>
                  <span>DIFFICULTY: INTERMEDIATE · 150 POINTS</span>
                </div>
                <h3>AC-02: Role & Permission Enforcement Flaw</h3>
                <p><strong>Original Problem Statement:</strong> Identify administrative endpoints that lack role verification and allow regular learners to perform administrative operations.</p>

                <div className="answer-bank-explanations">
                  <article>
                    <h4>Core Concept</h4>
                    <p>Role-Based Access Control (RBAC), authorization gates, default-deny security posture.</p>
                  </article>
                  <article>
                    <h4>Root Cause</h4>
                    <p>Routes that only check if the user is logged in (<code>requireAuth</code>) but omit the role check (<code>requireRole([&apos;ADMIN&apos;])</code>).</p>
                  </article>
                  <article>
                    <h4>Security Impact</h4>
                    <p>Students can disable other student accounts, alter challenge publication statuses, and view answer keys.</p>
                  </article>
                  <article>
                    <h4>Remediation</h4>
                    <p>Apply centralized middleware requiring the <code>ADMIN</code> role for all <code>/api/admin/*</code> routes and reject unauthorized requests with HTTP 403 Forbidden.</p>
                  </article>
                </div>

                <h4>Quiz Questions & Verified Answer Key</h4>
                <div className="answer-bank-question">
                  <p><strong>Q1: What HTTP response status code should be returned when a valid STUDENT attempts to call an ADMIN endpoint?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> 403 Forbidden (the user is authenticated, but lacks necessary authorization permissions).</p>
                </div>
                <div className="answer-bank-question">
                  <p><strong>Q2: Where should authorization checks be enforced to ensure complete security?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> On the server-side API endpoints; hiding navigation links in the frontend is only cosmetic and does not secure the API.</p>
                </div>
              </article>

              {/* AC-03 */}
              <article className="learning-card answer-bank-entry">
                <div className="learning-card-meta">
                  <span>CHALLENGE: AC-03</span>
                  <span>DIFFICULTY: INTERMEDIATE · 150 POINTS</span>
                </div>
                <h3>AC-03: Privilege Boundary Failure</h3>
                <p><strong>Original Problem Statement:</strong> Examine mass assignment vulnerabilities where user profile update endpoints accept role parameters and allow self-promotion to ADMIN.</p>

                <div className="answer-bank-explanations">
                  <article>
                    <h4>Core Concept</h4>
                    <p>Mass assignment protection, strict request payload schema validation, privilege boundaries.</p>
                  </article>
                  <article>
                    <h4>Root Cause</h4>
                    <p>Passing unchecked request body fields directly into the database update function (e.g. <code>prisma.user.update({`{ data: req.body }`})</code>).</p>
                  </article>
                  <article>
                    <h4>Security Impact</h4>
                    <p>Any learner can promote themselves to ADMIN by sending <code>{`{ "role": "ADMIN" }`}</code> in a profile update request.</p>
                  </article>
                  <article>
                    <h4>Remediation</h4>
                    <p>Explicitly pick permitted update fields using Zod schemas and ignore or reject protected fields like <code>role</code>, <code>id</code>, and <code>isActive</code>.</p>
                  </article>
                </div>

                <h4>Quiz Questions & Verified Answer Key</h4>
                <div className="answer-bank-question">
                  <p><strong>Q1: A STUDENT sends an update request containing <code>role: &quot;ADMIN&quot;</code>. What is the secure result?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> The server rejects the attempt or drops the role field, keeping the user&apos;s role as STUDENT and auditing the attempt.</p>
                </div>
                <div className="answer-bank-question">
                  <p><strong>Q2: How does schema validation with libraries like Zod prevent mass assignment?</strong></p>
                  <p className="answer-complete"><strong>Correct answer:</strong> It ensures that only explicitly whitelisted fields are parsed and passed into database operations.</p>
                </div>
              </article>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PROJECT WALKTHROUGH */}
      {activeTab === 'walkthrough' && (
        <div className="docs-content-section">
          <article className="learning-card docs-article">
            <h2>Faculty Demonstration & Platform Walkthrough</h2>
            <p>This guide explains the implemented architecture, demonstration flow, and security design of VulnForge.</p>

            <h3>1. Platform Objectives & Architecture</h3>
            <p>
              VulnForge is designed around a structured challenge lifecycle: learners review cybersecurity concepts, attempt hands-on challenges in controlled synthetic environments, submit solutions for server-side HMAC verification, and review solve-gated educational breakdowns.
            </p>

            <h3>2. Key Technology Stack</h3>
            <ul>
              <li><strong>Frontend:</strong> React 19, TypeScript, React Router, Vite, Tailwind CSS with dark cyber-terminal design tokens.</li>
              <li><strong>Backend:</strong> Node.js, Express, TypeScript, express-session with PostgreSQL session storage, Zod request validation.</li>
              <li><strong>Persistence:</strong> PostgreSQL with Prisma ORM (pooled connections for runtime, direct connections for migrations).</li>
              <li><strong>Security & Telemetry:</strong> Argon2id/bcrypt hashing, server-side HMAC-SHA256 flag verification, rate limiting, and structured blue-team event logging.</li>
            </ul>

            <h3>3. Student & Administrator Workflow</h3>
            <ol>
              <li><strong>Registration & Sign-In:</strong> Public registration provisions <code>STUDENT</code> accounts. Session cookies are HTTP-Only, Secure, SameSite=Lax.</li>
              <li><strong>Challenge Catalogue:</strong> Categorized into Authentication Security, Access Control, and upcoming modules.</li>
              <li><strong>Hint Progression:</strong> Learners reveal hints sequentially. Penalty points are applied against the final solve award.</li>
              <li><strong>Flag Verification:</strong> Flags are verified using HMAC verifier keys stored strictly on the server; flags are never exposed in client bundles.</li>
              <li><strong>Post-Solve Learning:</strong> Once a solve is recorded, learners unlock comprehensive educational explanations, root causes, remediations, and quiz questions.</li>
              <li><strong>Administration Workspace:</strong> Administrators manage user accounts, publish/archive challenges, edit educational solutions, and monitor telemetry.</li>
            </ol>
          </article>
        </div>
      )}

      {/* TAB 3: ARCHITECTURE & ROADMAP */}
      {activeTab === 'architecture' && (
        <div className="docs-content-section">
          <article className="learning-card docs-article">
            <h2>System Architecture & Implementation Roadmap</h2>

            <h3>Implemented Core Modules</h3>
            <div className="docs-module-grid">
              <div className="docs-module-item">
                <span className="badge-implemented">MODULE 1-3</span>
                <h4>Platform Foundation & Workspace</h4>
                <p>Branding, secure authentication, session management, responsive navigation, and user profiles.</p>
              </div>
              <div className="docs-module-item">
                <span className="badge-implemented">MODULE 4</span>
                <h4>CTF Challenge Engine</h4>
                <p>Challenge catalog, attempt lifecycles, HMAC flag verification, and point scoring.</p>
              </div>
              <div className="docs-module-item">
                <span className="badge-implemented">MODULE 5</span>
                <h4>Learning Guidance & Quizzes</h4>
                <p>Penalty-adjusted hints, solve-gated explanations, remediation guides, and immutable quiz results.</p>
              </div>
              <div className="docs-module-item">
                <span className="badge-implemented">MODULE 6-7</span>
                <h4>Auth & Access Control Labs</h4>
                <p>Auth-01 to 03 and AC-01 to 03 authored challenges, synthetic simulators, and answer bank keys.</p>
              </div>
              <div className="docs-module-item">
                <span className="badge-implemented">MODULE 13-15</span>
                <h4>Administration & Telemetry</h4>
                <p>Admin workspace, user management, Lab Answer Bank, security events, and audit logs.</p>
              </div>
            </div>

            <h3>Roadmap (Planned Modules 8–19)</h3>
            <p>Modules 8–12 (Injection, SSRF, Deserialization, Cryptography, API Security) and Modules 16–19 (Isolated Container Runtimes, Custom Challenge Builder, Advanced Blue-Team Labs) are scheduled for subsequent releases.</p>
          </article>
        </div>
      )}
    </section>
  );
}

