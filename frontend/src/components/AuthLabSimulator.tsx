import { type FormEvent, useEffect, useState } from 'react';
import { ApiError, localApiRequest } from '../api';

type WeakAuthResult = {
  vulnerable: { authenticated: boolean; message: string };
  secure: { authenticated: boolean; message: string; locked: boolean };
};

type AuthenticationCheckResult = {
  vulnerable: { authenticated: boolean; authorized: boolean; response: string };
  secure: { authenticated: boolean; authorized: boolean; response: string };
  accountEnumeration: string | null;
};

type ResetState = {
  tokenStatus: 'not-requested' | 'pending' | 'expired' | 'used';
  sessionInvalidated: boolean;
  passwordChanged: boolean;
};

const authCheckScenarios = [
  ['spoofed-client-authentication', 'Client claims to be signed in'],
  ['valid-student-session', 'Student requests an administrator action'],
  ['known-account', 'Known synthetic account with wrong password'],
  ['unknown-account', 'Unknown synthetic account'],
  ['anonymous', 'Anonymous request'],
] as const;

const authLabRequestOptions = (body: object): RequestInit => ({
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

function SimulationNotice({ message, error = false }: { message: string; error?: boolean }) {
  return <p className={error ? 'form-error' : 'auth-lab-notice'} role={error ? 'alert' : 'status'}>{message}</p>;
}

function WeakAuthenticationSimulation() {
  const [username, setUsername] = useState('demo.learner');
  const [password, setPassword] = useState('weak1');
  const [result, setResult] = useState<WeakAuthResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const compare = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPending(true);
    setError('');
    try {
      setResult(await localApiRequest<WeakAuthResult>(
        '/api/auth-lab/weak-authentication',
        authLabRequestOptions({ username, password }),
      ));
    } catch (requestError) {
      setError(requestError instanceof ApiError || requestError instanceof Error
        ? requestError.message
        : 'Unable to run the local comparison.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-lab-simulation">
      <p>Local synthetic account only: <code>demo.learner</code> / <code>weak1</code>. These values cannot sign in to VulnForge.</p>
      <form className="auth-lab-form" onSubmit={(event) => void compare(event)}>
        <label>
          Synthetic username
          <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={50} autoComplete="off" required />
        </label>
        <label>
          Synthetic password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} maxLength={128} autoComplete="off" required />
        </label>
        <button className="button button-primary" type="submit" disabled={pending}>
          {pending ? 'Comparing...' : 'Compare both designs'}
        </button>
      </form>
      {error && <SimulationNotice message={error} error />}
      {result && (
        <div className="auth-lab-results" aria-live="polite">
          <article>
            <h3>Vulnerable simulation</h3>
            <p>{result.vulnerable.message}</p>
            <strong>{result.vulnerable.authenticated ? 'Synthetic sign-in accepted' : 'Synthetic sign-in denied'}</strong>
          </article>
          <article>
            <h3>Secure counterpart</h3>
            <p>{result.secure.message}</p>
            <strong>{result.secure.authenticated ? 'Synthetic sign-in accepted' : 'Synthetic sign-in denied'}</strong>
            {result.secure.locked && <p>Local secure-simulation failure limit reached.</p>}
          </article>
        </div>
      )}
      <p className="auth-lab-footnote">The vulnerable comparison is a fixed in-memory exercise, separately rate-limited and disconnected from platform authentication.</p>
    </div>
  );
}

function AuthenticationCheckSimulation() {
  const [scenario, setScenario] = useState<(typeof authCheckScenarios)[number][0]>('spoofed-client-authentication');
  const [result, setResult] = useState<AuthenticationCheckResult | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  const runScenario = async () => {
    setPending(true);
    setError('');
    try {
      setResult(await localApiRequest<AuthenticationCheckResult>(
        '/api/auth-lab/authentication-check',
        authLabRequestOptions({ scenario }),
      ));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to run the local scenario.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="auth-lab-simulation">
      <label className="auth-lab-select">
        Fixed synthetic scenario
        <select value={scenario} onChange={(event) => setScenario(event.target.value as typeof scenario)}>
          {authCheckScenarios.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <button className="button button-primary" type="button" onClick={() => void runScenario()} disabled={pending}>
        {pending ? 'Evaluating...' : 'Compare server decisions'}
      </button>
      {error && <SimulationNotice message={error} error />}
      {result && (
        <>
          <div className="auth-lab-results" aria-live="polite">
            <article><h3>Vulnerable check</h3><p>{result.vulnerable.response}</p><small>Authenticated: {result.vulnerable.authenticated ? 'yes' : 'no'} · Authorized: {result.vulnerable.authorized ? 'yes' : 'no'}</small></article>
            <article><h3>Secure check</h3><p>{result.secure.response}</p><small>Authenticated: {result.secure.authenticated ? 'yes' : 'no'} · Authorized: {result.secure.authorized ? 'yes' : 'no'}</small></article>
          </div>
          {result.accountEnumeration && <SimulationNotice message={result.accountEnumeration} />}
        </>
      )}
      <p className="auth-lab-footnote">Only preset sample cases are accepted; the simulation has no username lookup or external request capability.</p>
    </div>
  );
}

function PasswordResetSimulation() {
  const [state, setState] = useState<ResetState | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [pending, setPending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const refreshState = async () => {
    setState(await localApiRequest<ResetState>('/api/auth-lab/password-reset'));
  };

  useEffect(() => {
    let active = true;
    localApiRequest<ResetState>('/api/auth-lab/password-reset')
      .then((data) => {
        if (active) {
          setState(data);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load reset simulation state.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  const runResetAction = async (path: string, body: object) => {
    setPending(true);
    setError('');
    setNotice('');
    try {
      const result = await localApiRequest<{ message?: string }>(path, authLabRequestOptions(body));
      setNotice(result.message ?? 'The local reset simulation completed.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to complete the reset simulation.');
    } finally {
      try {
        await refreshState();
      } catch (requestError) {
        setError(requestError instanceof Error ? requestError.message : 'Unable to refresh reset simulation state.');
      }
      setPending(false);
    }
  };

  const hasPendingReset = state?.tokenStatus === 'pending';

  return (
    <div className="auth-lab-simulation">
      {loading ? <p role="status">Loading local reset simulation...</p> : (
        <p>Reset state: <strong>{state?.tokenStatus ?? 'unavailable'}</strong>. No token or reset link is displayed or sent to the browser.</p>
      )}
      <button className="button button-secondary" type="button" onClick={() => void runResetAction('/api/auth-lab/password-reset/request', {})} disabled={pending}>
        {pending ? 'Working...' : 'Request synthetic reset'}
      </button>
      {hasPendingReset && (
        <>
          <label>
            New synthetic password (12+ characters, letters and numbers)
            <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} maxLength={128} autoComplete="new-password" />
          </label>
          <div className="auth-lab-actions">
            <button className="button button-primary" type="button" onClick={() => void runResetAction('/api/auth-lab/password-reset/confirm', { scenario: 'valid', newPassword })} disabled={pending || !newPassword}>
              Complete secure reset
            </button>
            <button className="button button-secondary" type="button" onClick={() => void runResetAction('/api/auth-lab/password-reset/confirm', { scenario: 'tampered' })} disabled={pending}>
              Reject a modified token
            </button>
            <button className="button button-secondary" type="button" onClick={() => void runResetAction('/api/auth-lab/password-reset/confirm', { scenario: 'expired' })} disabled={pending}>
              Reject an expired token
            </button>
          </div>
        </>
      )}
      {state?.tokenStatus === 'used' && (
        <button className="button button-secondary" type="button" onClick={() => void runResetAction('/api/auth-lab/password-reset/confirm', { scenario: 'replay' })} disabled={pending}>
          Verify one-time use by replaying
        </button>
      )}
      {error && <SimulationNotice message={error} error />}
      {notice && <SimulationNotice message={notice} />}
      {state?.sessionInvalidated && <p className="auth-lab-footnote">The simulation invalidated only its synthetic account state; your VulnForge session was not changed.</p>}
    </div>
  );
}

export default function AuthLabSimulator({ slug }: { slug: string }) {
  const [availability, setAvailability] = useState<'checking' | 'available' | 'unavailable' | 'error'>('checking');
  const [availabilityError, setAvailabilityError] = useState('');
  const challengeNumber = slug.slice(5, 7);

  useEffect(() => {
    let active = true;
    localApiRequest<{ available: boolean }>('/api/auth-lab/status')
      .then(({ available }) => {
        if (active) {
          setAvailability(available ? 'available' : 'unavailable');
        }
      })
      .catch((requestError: unknown) => {
        if (!active) {
          return;
        }
        if (requestError instanceof ApiError && requestError.status === 404) {
          setAvailability('unavailable');
          return;
        }
        setAvailability('error');
        setAvailabilityError(requestError instanceof Error
          ? requestError.message
          : 'Unable to check local simulation availability.');
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <section className="learning-card auth-lab-panel">
      <p className="auth-lab-label">LOCAL AUTHENTICATION SECURITY SIMULATION</p>
      <h2>Controlled exercise</h2>
      <p>This exercise runs only against a loopback development API. It uses synthetic data and does not change your VulnForge account.</p>
      {availability === 'checking' && <p role="status">Checking local simulation availability...</p>}
      {availability === 'unavailable' && (
        <SimulationNotice message="The local simulation is unavailable. In development, set NODE_ENV=development and VULNFORGE_ENABLE_LOCAL_AUTH_LAB=true in the backend environment, then restart the backend." />
      )}
      {availability === 'error' && <SimulationNotice message={availabilityError} error />}
      {availability === 'available' && challengeNumber === '01' && <WeakAuthenticationSimulation />}
      {availability === 'available' && challengeNumber === '02' && <AuthenticationCheckSimulation />}
      {availability === 'available' && challengeNumber === '03' && <PasswordResetSimulation />}
    </section>
  );
}
