export type PlannedChallenge = {
  slug: string;
  code: string;
  title: string;
  description: string;
  objectives: string[];
};

export type PlannedModule = {
  slug: string;
  number: number;
  name: string;
  description: string;
  challenges: PlannedChallenge[];
};

export const plannedModules: PlannedModule[] = [
  {
    slug: 'module-8-injection-security',
    number: 8,
    name: 'Injection Security Lab',
    description: 'Learn how unsafe input handling can alter query and API behavior.',
    challenges: [
      { slug: 'inj-01-search-query-injection', code: 'INJ-01', title: 'Search/query injection', description: 'Explore how untrusted search terms can cross query boundaries.', objectives: ['Identify unsafe query construction', 'Use parameterized queries'] },
      { slug: 'inj-02-query-construction-flaw', code: 'INJ-02', title: 'Query-construction flaw', description: 'Study how query composition can mishandle untrusted values.', objectives: ['Recognize query composition risks', 'Apply safe query APIs'] },
      { slug: 'inj-03-api-parameter-injection', code: 'INJ-03', title: 'Injection through API parameter', description: 'Understand how API parameters should be validated and safely used.', objectives: ['Validate API inputs', 'Keep data separate from query structure'] },
    ],
  },
  {
    slug: 'module-9-session-token-security',
    number: 9,
    name: 'Session & Token Security Lab',
    description: 'Explore session lifecycle, token validation and invalidation.',
    challenges: [
      { slug: 'session-01-session-handling', code: 'SESSION-01', title: 'Session handling weakness', description: 'Review secure session lifecycle practices.', objectives: ['Protect session identifiers', 'Rotate sessions at authentication boundaries'] },
      { slug: 'session-02-token-validation', code: 'SESSION-02', title: 'Token validation weakness', description: 'Understand the checks required to validate security tokens.', objectives: ['Validate token integrity and claims', 'Reject invalid token states'] },
      { slug: 'session-03-session-expiry', code: 'SESSION-03', title: 'Session expiry/invalidation problem', description: 'Learn why expiration and logout invalidation must be enforced.', objectives: ['Enforce server-side expiration', 'Invalidate sessions on logout and security events'] },
    ],
  },
  {
    slug: 'module-10-file-upload-security',
    number: 10,
    name: 'File Upload Security Lab',
    description: 'Learn safe validation, storage and handling of uploaded files.',
    challenges: [
      { slug: 'upload-01-extension-validation', code: 'UPLOAD-01', title: 'Unsafe extension validation', description: 'Understand why filename extensions alone are insufficient.', objectives: ['Use allowlists', 'Treat filenames as untrusted input'] },
      { slug: 'upload-02-mime-content-validation', code: 'UPLOAD-02', title: 'MIME/content validation weakness', description: 'Compare declared file types with safely inspected content.', objectives: ['Validate content independently', 'Avoid trusting client-provided MIME types'] },
      { slug: 'upload-03-storage-path-handling', code: 'UPLOAD-03', title: 'Unsafe storage/path handling', description: 'Review safe naming, storage boundaries and path handling.', objectives: ['Generate server-side names', 'Keep uploads outside executable/public paths'] },
    ],
  },
  {
    slug: 'module-11-api-security',
    number: 11,
    name: 'API Security Lab',
    description: 'Review authorization, data minimization, rate limits and input validation.',
    challenges: [
      { slug: 'api-01-object-authorization', code: 'API-01', title: 'Broken object-level authorization', description: 'Understand authorization checks for each requested object.', objectives: ['Enforce ownership on the server', 'Test cross-user access denial'] },
      { slug: 'api-02-missing-authorization', code: 'API-02', title: 'Missing authorization', description: 'Learn to protect every sensitive API operation.', objectives: ['Apply server-side access checks', 'Test unauthenticated and unauthorized requests'] },
      { slug: 'api-03-excessive-data-exposure', code: 'API-03', title: 'Excessive data exposure', description: 'Return only the fields required by each API response.', objectives: ['Use explicit response projections', 'Minimize sensitive data exposure'] },
      { slug: 'api-04-weak-rate-limiting', code: 'API-04', title: 'Weak rate limiting', description: 'Understand proportional limits for sensitive API operations.', objectives: ['Apply endpoint-appropriate limits', 'Monitor repeated abusive requests'] },
      { slug: 'api-05-input-validation', code: 'API-05', title: 'Improper input validation', description: 'Validate API input shape, bounds and semantics on the server.', objectives: ['Reject malformed input', 'Use allowlisted schemas'] },
    ],
  },
  {
    slug: 'module-12-configuration-security',
    number: 12,
    name: 'Configuration Security Lab',
    description: 'Explore safe error handling, security headers, CORS and information exposure.',
    challenges: [
      { slug: 'config-01-debug-error-disclosure', code: 'CONFIG-01', title: 'Debug/error information disclosure', description: 'Learn how production errors should avoid exposing internals.', objectives: ['Return generic client errors', 'Keep diagnostic detail in protected logs'] },
      { slug: 'config-02-security-headers', code: 'CONFIG-02', title: 'Security header misconfiguration', description: 'Review browser security headers and deployment defaults.', objectives: ['Configure headers deliberately', 'Verify policy behavior'] },
      { slug: 'config-03-cors-configuration', code: 'CONFIG-03', title: 'CORS configuration flaw', description: 'Understand origin allowlists and credentialed cross-origin requests.', objectives: ['Restrict trusted origins', 'Avoid permissive credentialed CORS'] },
      { slug: 'config-04-information-disclosure', code: 'CONFIG-04', title: 'Accidental information disclosure', description: 'Reduce sensitive details exposed by static files and responses.', objectives: ['Review public artifacts', 'Keep secrets outside client bundles'] },
    ],
  },
];

export function getPlannedModuleBySlug(slug: string | null | undefined) {
  return plannedModules.find((module) => module.slug === slug);
}

export function getPlannedChallengeBySlug(slug: string | undefined) {
  return plannedModules.flatMap((module) =>
    module.challenges.map((challenge) => ({ ...challenge, module })),
  ).find((challenge) => challenge.slug === slug);
}
