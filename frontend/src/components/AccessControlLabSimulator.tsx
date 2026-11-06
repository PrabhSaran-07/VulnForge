import { useEffect, useState } from 'react';
import { ApiError, localApiRequest } from '../api';

type DecisionResult = {
  resource?: string;
  syntheticRole?: string;
  action?: string;
  vulnerable: { authorized: boolean; message: string };
  secure: { authorized: boolean; message: string };
  stateChanged?: boolean;
};

const scenariosBySlug = {
  'ac-01-object-level-access-control': {
    title: 'OBJECT-LEVEL AUTHORIZATION SIMULATION',
    endpoint: '/api/access-lab/object-access',
    choices: [
      ['learner-document', 'Your synthetic document'],
      ['other-learner-document', 'Another learner’s synthetic document'],
    ],
    requestKey: 'resourceId',
  },
  'ac-02-role-permission-enforcement': {
    title: 'ROLE AND PERMISSION SIMULATION',
    endpoint: '/api/access-lab/role-permission',
    choices: [
      ['student-view-course', 'STUDENT views a course'],
      ['student-manage-users', 'STUDENT manages users'],
      ['admin-manage-users', 'ADMIN manages users'],
    ],
    requestKey: 'scenario',
  },
  'ac-03-privilege-boundary-failure': {
    title: 'PRIVILEGE BOUNDARY SIMULATION',
    endpoint: '/api/access-lab/privilege-boundary',
    choices: [
      ['student-self-assign-admin', 'STUDENT requests ADMIN for self'],
      ['student-run-admin-action', 'STUDENT requests an ADMIN-only action'],
      ['admin-run-admin-action', 'ADMIN requests an ADMIN-only action'],
    ],
    requestKey: 'scenario',
  },
} as const;

type AccessControlSlug = keyof typeof scenariosBySlug;

function DecisionCard({ title, decision }: {
  title: string;
  decision: DecisionResult['vulnerable'];
}) {
  return (
    <article>
      <h3>{title}</h3>
      <p>{decision.message}</p>
      <strong>{decision.authorized ? 'Access granted' : 'Access denied'}</strong>
    </article>
  );
}

export default function AccessControlLabSimulator({ slug }: { slug: string }) {
  const [available, setAvailable] = useState<'checking' | 'yes' | 'no' | 'error'>('checking');
  const [availabilityError, setAvailabilityError] = useState('');
  const [selection, setSelection] = useState('');
  const [result, setResult] = useState<DecisionResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const configuration = Object.entries(scenariosBySlug)
    .find(([scenarioSlug]) => scenarioSlug === slug)?.[1];
  const firstChoice = configuration?.choices[0][0] ?? '';

  useEffect(() => {
    let active = true;
    localApiRequest<{ available: boolean }>('/api/access-lab/status')
      .then(({ available: isAvailable }) => {
        if (active) {
          setAvailable(isAvailable ? 'yes' : 'no');
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 404) {
          setAvailable('no');
          return;
        }
        setAvailabilityError(requestError instanceof Error
          ? requestError.message
          : 'Unable to check local simulation availability.');
        setAvailable('error');
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setSelection(firstChoice);
    setResult(null);
    setError('');
  }, [firstChoice]);

  const compareDecisions = async () => {
    if (!configuration) {
      setError('This challenge does not have a supported local simulation.');
      return;
    }
    setPending(true);
    setError('');
    try {
      const requestBody = { [configuration.requestKey]: selection };
      setResult(await localApiRequest<DecisionResult>(
        configuration.endpoint,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        },
      ));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to run the local comparison.');
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="learning-card auth-lab-panel">
      <p className="auth-lab-label">LOCAL ACCESS CONTROL SECURITY SIMULATION</p>
      <h2>Controlled exercise</h2>
      <p>This fixed simulation uses synthetic identities and actions only. It cannot change VulnForge users, roles, permissions, or sessions.</p>
      {available === 'checking' && <p role="status">Checking local simulation availability...</p>}
      {available === 'no' && (
        <p className="auth-lab-notice" role="status">
          The local simulation is unavailable. In development, set NODE_ENV=development and VULNFORGE_ENABLE_LOCAL_ACCESS_LAB=true in the backend environment, then restart the backend.
        </p>
      )}
      {available === 'error' && <p className="form-error" role="alert">{availabilityError}</p>}
      {!configuration && <p className="form-error" role="alert">This challenge does not have a supported local simulation.</p>}
      {available === 'yes' && configuration && (
        <div className="auth-lab-simulation">
          <label className="auth-lab-select">
            {configuration.title}
            <select value={selection} onChange={(event) => setSelection(event.target.value)}>
              {configuration.choices.map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </label>
          <button
            className="button button-primary"
            type="button"
            onClick={() => void compareDecisions()}
            disabled={pending || !selection}
          >
            {pending ? 'Comparing...' : 'Compare server decisions'}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          {result && (
            <>
              {(result.resource || result.syntheticRole || result.action) && (
                <p role="status">
                  {[result.resource, result.syntheticRole, result.action].filter(Boolean).join(' · ')}
                </p>
              )}
              <div className="auth-lab-results" aria-live="polite">
                <DecisionCard title="Vulnerable simulation" decision={result.vulnerable} />
                <DecisionCard title="Secure server-side check" decision={result.secure} />
              </div>
              {result.stateChanged === false && <p className="auth-lab-footnote">No privilege or account state was changed.</p>}
            </>
          )}
        </div>
      )}
      <p className="auth-lab-footnote">Available only to authenticated learners through a loopback development API. Decisions are enforced and returned by the backend.</p>
    </section>
  );
}
