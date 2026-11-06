export type AuthLabChallengeContent = {
  slug: string;
  title: string;
  difficulty: 'BEGINNER' | 'INTERMEDIATE';
  points: number;
  description: string;
  learningObjectives: string[];
  context: string;
  prerequisites: string[];
  hints: Array<{ order: number; content: string; pointsPenalty: number }>;
  explanation: {
    rootCause: string;
    technicalExplanation: string;
    impact: string;
    conditions: string;
    secureImplementation: string;
    remediationGuidance: string;
    detectionIdeas: string;
  };
  questions: Array<{
    prompt: string;
    options: Array<{ text: string; isCorrect: boolean; explanation: string }>;
  }>;
};

export const authLabChallenges: AuthLabChallengeContent[] = [
  {
    slug: 'auth-01-weak-authentication',
    title: 'AUTH-01: Weak Authentication Scenario',
    difficulty: 'BEGINNER',
    points: 100,
    description: 'Compare weak synthetic sign-in design with a server-side design that hashes passwords, avoids account-specific errors, and limits repeated failures.',
    learningObjectives: [
      'Explain authentication and why password handling belongs on the server.',
      'Compare plaintext credential checks with adaptive password hashing.',
      'Identify why password policy, generic failures, and rate limits work together.',
    ],
    context: 'Scope: the local simulator uses only the synthetic account demo.learner / weak1. No platform account or external login is involved. Run the comparison once with the sample credentials and once with a deliberately incorrect value.',
    prerequisites: ['Use only the displayed synthetic account in this local exercise.'],
    hints: [
      { order: 1, content: 'A password policy is only one layer; it does not make a plaintext password safe if storage is exposed.', pointsPenalty: 0 },
      { order: 2, content: 'Compare what each design returns for an unknown synthetic user and for a wrong password. The secure design uses the same failure message and limits repeated failures.', pointsPenalty: 5 },
    ],
    explanation: {
      rootCause: 'The weak design compares a synthetic password directly and distinguishes an unknown account from an incorrect password. That design is intentionally confined to an in-memory local simulator.',
      technicalExplanation: 'A server should store an adaptive password hash and verify candidates with a vetted password-hashing library. Generic failure responses reduce account-enumeration signals; throttling and monitoring slow repeated failures.',
      impact: 'In a real system, plaintext or reversibly stored passwords can expose every affected account after data disclosure. Detailed login errors also help an observer identify accounts.',
      conditions: 'The weakness matters when an implementation stores recoverable passwords, uses inadequate hashing, reveals account-specific failures, or omits appropriate abuse controls.',
      secureImplementation: 'Store a unique adaptive password hash such as bcrypt or Argon2id, verify it server-side, return a generic authentication failure, enforce layered throttling, and monitor suspicious patterns.',
      remediationGuidance: 'Never store plaintext passwords. Use a vetted password-hashing library with appropriate cost parameters, support long passphrases, apply rate limits and risk-based controls, and review credential-reset paths.',
      detectionIdeas: 'Alert on bursts of failed sign-ins, repeated attempts across accounts or addresses, unusual lockout rates, and authentication responses that differ based on account existence.',
    },
    questions: [
      {
        prompt: 'What should the application store for a user password?',
        options: [
          { text: 'A unique adaptive password hash produced by a vetted library.', isCorrect: true, explanation: 'Adaptive password hashing makes offline guessing more expensive and avoids storing the original password.' },
          { text: 'The original password encrypted with a shared reversible key.', isCorrect: false, explanation: 'Authentication does not require recovering a password; reversible storage increases exposure.' },
        ],
      },
      {
        prompt: 'Which failure response best reduces account enumeration?',
        options: [
          { text: 'Use a consistent response for an unknown account and an incorrect password.', isCorrect: true, explanation: 'Consistent messages avoid disclosing whether a username is registered.' },
          { text: 'Tell the requester whether the username or password was wrong.', isCorrect: false, explanation: 'Account-specific messages disclose account existence.' },
        ],
      },
    ],
  },
  {
    slug: 'auth-02-authentication-check',
    title: 'AUTH-02: Authentication-Check Flaw',
    difficulty: 'INTERMEDIATE',
    points: 125,
    description: 'Inspect controlled sample decisions that trust a client-supplied identity claim or confuse authentication with authorization.',
    learningObjectives: [
      'Distinguish authentication from authorization.',
      'Require server-validated authentication state for protected operations.',
      'Explain account enumeration using fixed synthetic sample responses.',
    ],
    context: 'Scope: each selectable case is a fixed local simulation. It does not accept a username, contact a service, or probe an account. Compare the vulnerable and secure decisions for each case.',
    prerequisites: ['Complete AUTH-01 or review the difference between authentication and authorization.'],
    hints: [
      { order: 1, content: 'A value asserted by a client is not proof that the server authenticated that client.', pointsPenalty: 0 },
      { order: 2, content: 'An authenticated student can still lack permission for an administrator-only action. Check identity and role separately.', pointsPenalty: 5 },
    ],
    explanation: {
      rootCause: 'The vulnerable sample treats a client-supplied authentication claim as trusted state and lets an authenticated student perform an administrator-only action.',
      technicalExplanation: 'Authentication establishes a server-verified identity. Authorization separately evaluates that identity and its permissions for each requested action. Client display state cannot substitute for either server-side check.',
      impact: 'Incorrect access decisions can expose or alter protected information. Different responses for known and unknown accounts can also reveal which synthetic identities exist.',
      conditions: 'A flaw occurs when server handlers trust client-controlled identity flags, skip session validation, or fail to apply the authorization policy to the requested resource.',
      secureImplementation: 'Validate the server-managed session on every protected request, derive identity from that session, and apply a server-side role/ownership check to each action. Return consistent authentication failures.',
      remediationGuidance: 'Centralize session validation and authorization helpers, deny by default, test each role and ownership boundary, and avoid using frontend state as an access control.',
      detectionIdeas: 'Log denied access decisions with request and principal context, alert on role-boundary violations, and test that anonymous and lower-privileged synthetic cases remain denied.',
    },
    questions: [
      {
        prompt: 'A request body says isAuthenticated=true, but no server session is present. What is the safe decision?',
        options: [
          { text: 'Deny access because client-supplied identity state is untrusted.', isCorrect: true, explanation: 'Protected handlers must validate server-managed authentication state.' },
          { text: 'Grant access if the frontend showed a signed-in screen.', isCorrect: false, explanation: 'Frontend state is under client control and is not an authorization boundary.' },
        ],
      },
      {
        prompt: 'A valid student session requests an administrator-only action. Which check is needed?',
        options: [
          { text: 'A server-side authorization check for the required role and resource.', isCorrect: true, explanation: 'Authentication alone does not grant authorization.' },
          { text: 'No further check because the session is valid.', isCorrect: false, explanation: 'A valid identity may still lack permission for the operation.' },
        ],
      },
    ],
  },
  {
    slug: 'auth-03-password-reset',
    title: 'AUTH-03: Password-Reset Design Weakness',
    difficulty: 'INTERMEDIATE',
    points: 150,
    description: 'Exercise a private local reset flow that keeps its synthetic token server-side and demonstrates expiry, validation, one-time use, and synthetic session invalidation.',
    learningObjectives: [
      'Describe secure reset-token generation, storage, and expiration.',
      'Explain one-time token validation and safe reset confirmation.',
      'Recognize why password changes should invalidate existing sessions.',
    ],
    context: 'Scope: reset state belongs only to your local synthetic learner record and is held in memory. No email is sent, no token is returned to the browser, and no platform password or session is changed.',
    prerequisites: ['Use the controls below to request a synthetic reset, then compare valid, tampered, expired, and replayed actions.'],
    hints: [
      { order: 1, content: 'A reset link should contain an unpredictable, short-lived secret. Store only a verifier server-side and never log or return the secret.', pointsPenalty: 0 },
      { order: 2, content: 'A successful reset consumes the token exactly once, validates the new password, and invalidates prior sessions.', pointsPenalty: 10 },
    ],
    explanation: {
      rootCause: 'Weak reset designs use predictable or long-lived tokens, fail to consume a token after use, or allow a reset without binding confirmation to an outstanding valid request.',
      technicalExplanation: 'Generate high-entropy tokens with a cryptographic random generator, retain only a token hash, enforce a short expiry, compare safely, and atomically mark a token used when confirming a password change.',
      impact: 'A stolen, guessed, expired, or replayable reset token can allow unauthorized password changes. Existing sessions may remain usable after a legitimate password change.',
      conditions: 'The weakness requires a reset flow with insufficient token entropy, validation, expiration, one-time semantics, confirmation safeguards, or post-change session invalidation.',
      secureImplementation: 'Use a high-entropy one-time token, store only its hash, expire it promptly, use a generic request response, validate a strong new password, consume the token atomically, and invalidate existing sessions.',
      remediationGuidance: 'Avoid putting tokens in logs or analytics, rate-limit reset requests, invalidate outstanding tokens after use, notify the account owner through an approved channel, and review session revocation behavior.',
      detectionIdeas: 'Monitor reset request bursts, invalid/expired/replayed token attempts, password changes followed by unusual session use, and sessions that remain active after a credential reset.',
    },
    questions: [
      {
        prompt: 'How should a reset token be handled?',
        options: [
          { text: 'Generate it with cryptographic randomness, store a verifier, expire it, and consume it once.', isCorrect: true, explanation: 'This limits token prediction, storage exposure, and replay.' },
          { text: 'Use a permanent account identifier and accept it repeatedly.', isCorrect: false, explanation: 'Identifiers are not secret and reusable reset tokens enable replay.' },
        ],
      },
      {
        prompt: 'What should happen after a successful password reset?',
        options: [
          { text: 'Invalidate the reset token and existing sessions.', isCorrect: true, explanation: 'One-time use prevents replay and session invalidation removes access based on prior credentials.' },
          { text: 'Leave every active session unchanged for convenience.', isCorrect: false, explanation: 'Existing sessions may belong to an attacker or be tied to the old credential state.' },
        ],
      },
    ],
  },
];
