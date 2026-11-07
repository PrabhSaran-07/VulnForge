import type { AuthLabChallengeContent } from './auth-lab-content.js';

export const accessControlLabChallenges: AuthLabChallengeContent[] = [
  {
    slug: 'ac-01-object-level-access-control',
    title: 'AC-01: Object-Level Access Control',
    difficulty: 'BEGINNER',
    points: 100,
    description: 'Compare identifier-only access with a server-side ownership check using synthetic documents.',
    learningObjectives: [
      'Explain object-level authorization and why authentication does not establish ownership.',
      'Recognize IDOR/BOLA as missing authorization checks on individual objects.',
      'Enforce ownership using the authenticated principal on the server.',
    ],
    context: 'Scope: the simulator uses two fixed synthetic documents and an authenticated learner mapped to a synthetic owner. It returns access decisions only; it does not read or change real records.',
    prerequisites: ['Use the provided synthetic resource choices; ownership is derived on the server.'],
    hints: [
      { order: 1, content: 'A resource identifier selects an object; it does not prove that the caller owns it.', pointsPenalty: 0 },
      { order: 2, content: 'Compare the authenticated synthetic owner against the server-stored owner for each object.', pointsPenalty: 5 },
    ],
    explanation: {
      expectedAnswer: 'Object access must be authorized against the authenticated principal and the server-stored ownership or policy for that specific object. A valid identifier alone does not grant access.',
      solutionSteps: [
        'Compare the fixed synthetic document owned by the learner with the one owned by the other synthetic user.',
        'Observe that the vulnerable decision accepts an object identifier without checking its owner.',
        'Observe that the secure decision derives the actor from trusted server state and denies the cross-owner request.',
        'Describe an implementation that scopes the database lookup to the authenticated owner or checks the stored owner before returning or changing the object.',
        'Apply the same authorization rule to both reads and writes; do not rely on hidden identifiers or frontend controls.',
      ],
      keyTakeaways: [
        'Authentication does not establish ownership of every object.',
        'Perform object-level authorization on every read and write.',
        'Derive the actor from trusted session state and deny by default.',
      ],
      rootCause: 'The vulnerable decision treats possession of a valid object identifier as sufficient authorization and never compares the object owner with the authenticated principal.',
      technicalExplanation: 'Object-level authorization must run on every access. Resolve the principal from the server-managed session, load the object through an ownership-scoped query or compare its stored owner, and deny by default.',
      impact: 'Missing ownership checks can expose or alter another user’s records, producing insecure direct object reference or broken object-level authorization (IDOR/BOLA) issues.',
      conditions: 'The flaw exists when a user-controlled identifier selects an object and the handler omits a server-side relationship or policy check.',
      secureImplementation: 'Derive the actor from the authenticated session and fetch only objects owned by that actor, or explicitly authorize the stored object owner before returning data.',
      remediationGuidance: 'Apply authorization to every read and write operation, use ownership-scoped queries where practical, avoid trusting client-supplied owner IDs, and test cross-user access.',
      detectionIdeas: 'Audit object access decisions, monitor repeated denied cross-owner requests, and test each object endpoint with multiple synthetic principals.',
    },
    questions: [
      {
        prompt: 'A signed-in learner requests a document owned by another user. What should the service do?',
        options: [
          { text: 'Deny access after checking the stored owner against the authenticated principal.', isCorrect: true, explanation: 'Authentication identifies the caller; object-level authorization decides whether that caller may access this document.' },
          { text: 'Return it because the document identifier is valid.', isCorrect: false, explanation: 'A valid identifier is not proof of ownership or permission.' },
        ],
      },
      {
        prompt: 'Where should the ownership decision be enforced?',
        options: [
          { text: 'On the server for every object operation.', isCorrect: true, explanation: 'Client-side checks can be bypassed and cannot protect a server-side resource.' },
          { text: 'Only by hiding other users’ identifiers in the interface.', isCorrect: false, explanation: 'Identifiers are not authorization controls and may be discovered or changed.' },
        ],
      },
    ],
  },
  {
    slug: 'ac-02-role-permission-enforcement',
    title: 'AC-02: Role and Permission Enforcement',
    difficulty: 'INTERMEDIATE',
    points: 125,
    description: 'Compare a permissive synthetic action decision with server-side role-to-permission enforcement.',
    learningObjectives: [
      'Distinguish authentication from authorization.',
      'Understand how roles map to permissions for protected operations.',
      'Explain why frontend-only role restrictions cannot enforce access control.',
    ],
    context: 'Scope: fixed STUDENT and ADMIN actors and actions exist only in the local simulator. The selected case is a fixture, not a role assertion, and cannot change a VulnForge account.',
    prerequisites: ['Complete AC-01 or review the distinction between identity and permission.'],
    hints: [
      { order: 1, content: 'A valid session establishes who is acting, not whether that actor may perform every operation.', pointsPenalty: 0 },
      { order: 2, content: 'Use a server-side permission policy for each protected operation; a hidden button is not a control.', pointsPenalty: 5 },
    ],
    explanation: {
      expectedAnswer: 'Authenticate the request, load the actor role from trusted server-side state, and enforce an explicit deny-by-default permission policy for each protected operation.',
      solutionSteps: [
        'Compare the fixed STUDENT and ADMIN simulator cases for the same protected action.',
        'Note that the vulnerable path grants the action based only on the presence of an authenticated actor.',
        'Note that the secure path checks the trusted role-to-permission policy and denies the student-only case.',
        'Explain that client-side role displays and hidden controls are presentation only and must not enforce permissions.',
        'Test each protected route and data operation with both permitted and denied roles.',
      ],
      keyTakeaways: [
        'A valid session is not permission to perform every action.',
        'Use trusted server-side roles or permissions and deny unlisted actions.',
        'Test both positive and negative role cases at the server boundary.',
      ],
      rootCause: 'The vulnerable sample grants a protected operation to any authenticated actor instead of checking the permission associated with the actor’s server-side role.',
      technicalExplanation: 'Authenticate the request first, derive the role from trusted server state, and authorize the requested action using a deny-by-default role or permission policy.',
      impact: 'Missing role and permission checks can let ordinary users view or change administrative data and actions.',
      conditions: 'The weakness occurs when a route relies on frontend visibility, accepts a client role claim, or checks only that a session exists.',
      secureImplementation: 'Enforce an explicit server-side permission check at each protected route and data operation, using the role loaded from the authenticated account.',
      remediationGuidance: 'Centralize policy checks, keep client-side role state presentational only, deny unlisted actions, and test allowed and denied roles for every operation.',
      detectionIdeas: 'Record authorization denials, alert on repeated student-to-admin operation attempts, and include role-boundary tests in route and service suites.',
    },
    questions: [
      {
        prompt: 'A STUDENT has a valid session and requests an ADMIN-only operation. What must happen?',
        options: [
          { text: 'The server checks the trusted role permission and denies the action.', isCorrect: true, explanation: 'Authentication does not grant authorization; the server must evaluate the required permission.' },
          { text: 'The server allows it because the frontend displayed the action.', isCorrect: false, explanation: 'Frontend controls are user-interface behavior, not a security boundary.' },
        ],
      },
      {
        prompt: 'Where should the role used for authorization come from?',
        options: [
          { text: 'Trusted server-side account/session state.', isCorrect: true, explanation: 'A client can change submitted role values, so protected operations must use server-validated identity state.' },
          { text: 'A role field supplied in the request body.', isCorrect: false, explanation: 'Client-provided role claims are untrusted and must not grant permissions.' },
        ],
      },
    ],
  },
  {
    slug: 'ac-03-privilege-boundary-failure',
    title: 'AC-03: Privilege Boundary Failure',
    difficulty: 'INTERMEDIATE',
    points: 150,
    description: 'Review how a fixed synthetic privilege request is handled when the server does or does not enforce least privilege.',
    learningObjectives: [
      'Describe privilege boundaries and least-privilege design.',
      'Recognize privilege escalation caused by trusting requested role changes.',
      'Enforce privileged actions using server-side authorization.',
    ],
    context: 'Scope: the simulator compares fixed synthetic actions only. It never writes a role, permission, or session value in VulnForge.',
    prerequisites: ['Review role-based authorization and deny-by-default behavior.'],
    hints: [
      { order: 1, content: 'A request to become privileged is input, not proof that the actor is allowed to grant that privilege.', pointsPenalty: 0 },
      { order: 2, content: 'Enforce the actor’s server-side permission before applying any privilege-changing action.', pointsPenalty: 10 },
    ],
    explanation: {
      expectedAnswer: 'Treat a requested role change as untrusted input. Deny self-promotion unless a separately authorized server-side role-management policy permits that exact transition, and audit approved changes.',
      solutionSteps: [
        'Choose the fixed synthetic student self-promotion scenario in the local simulator.',
        'Compare the vulnerable decision, which trusts the requested role, with the secure decision, which requires an authorized transition.',
        'Identify the privilege boundary: the caller must not be able to grant themselves permissions by changing request data.',
        'Describe a narrow server-side role-management service that validates the actor, target, allowed transition, and least-privilege policy.',
        'Record and monitor authorized role changes while testing that unauthorized transitions remain denied.',
      ],
      keyTakeaways: [
        'A requested privilege is not authorization to grant that privilege.',
        'Use least privilege and server-side checks for every privilege transition.',
        'Audit role changes and explicitly test self-promotion and boundary cases.',
      ],
      rootCause: 'The vulnerable decision accepts a requested privilege change without checking whether the acting principal is authorized to grant it.',
      technicalExplanation: 'Privilege-changing actions must validate the actor’s current trusted permissions, the target, and the requested transition on the server. Client-selected roles must never update trusted identity state.',
      impact: 'An unauthorized privilege transition can expose sensitive operations and allow further changes outside the actor’s intended boundary.',
      conditions: 'The flaw appears when a handler trusts a submitted role, uses frontend-only restrictions, or fails to re-check authorization at the privilege boundary.',
      secureImplementation: 'Deny self-promotion by default, require a server-validated permission for explicit role administration, validate allowed transitions, and audit the result.',
      remediationGuidance: 'Keep privilege assignment in narrowly scoped server-side services, apply least privilege, require authorization on every transition, and test that unauthorized actors cannot mutate roles.',
      detectionIdeas: 'Audit role changes with actor and target identifiers, alert on self-promotion or unusual privilege transitions, and test denied boundary cases.',
    },
    questions: [
      {
        prompt: 'A STUDENT requests that their own synthetic role become ADMIN. What is the secure result?',
        options: [
          { text: 'Deny it unless a separately authorized server-side role-management policy permits the transition.', isCorrect: true, explanation: 'Requested privilege is untrusted input; the server must authorize the actor and transition.' },
          { text: 'Apply it because the request names a valid role.', isCorrect: false, explanation: 'A valid role name does not authorize the requester to assign it.' },
        ],
      },
      {
        prompt: 'What principle limits the impact of a privilege-boundary failure?',
        options: [
          { text: 'Least privilege, enforced by server-side checks for each action.', isCorrect: true, explanation: 'Minimal permissions and explicit checks reduce the scope of unauthorized actions.' },
          { text: 'Trust the role shown in the browser after the action.', isCorrect: false, explanation: 'Browser state is client-controlled and does not establish server authorization.' },
        ],
      },
    ],
  },
];
