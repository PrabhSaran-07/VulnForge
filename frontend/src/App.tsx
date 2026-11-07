import {
  createContext,
  type FormEvent,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Link, Navigate, Route, Routes, useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { ApiError, apiRequest } from './api';
import AuthLabSimulator from './components/AuthLabSimulator';
import AccessControlLabSimulator from './components/AccessControlLabSimulator';
import { getPlannedChallengeBySlug, getPlannedModuleBySlug, plannedModules } from './module-placeholders';

const authLabChallengeSlugs = new Set([
  'auth-01-weak-authentication',
  'auth-02-authentication-check',
  'auth-03-password-reset',
]);

const accessControlLabChallengeSlugs = new Set([
  'ac-01-object-level-access-control',
  'ac-02-role-permission-enforcement',
  'ac-03-privilege-boundary-failure',
]);

type UserRole = 'STUDENT' | 'ADMIN';

type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

type LoginRequest = {
  identifier: string;
  password: string;
};

type RegisterRequest = {
  username: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  authError: string | null;
  isAuthenticated: boolean;
  refreshUser: () => Promise<boolean>;
  login: (payload: LoginRequest) => Promise<void>;
  register: (payload: RegisterRequest) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }
  return context;
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  const refreshUser = async () => {
    setLoading(true);
    setAuthError(null);

    try {
      const data = await apiRequest<{ user?: AuthUser }>('/api/auth/me');
      if (!data || !data.user) {
        throw new Error('The session response did not include a user.');
      }

      setUser(data.user);
      return true;
    } catch (error) {
      setUser(null);
      if (error instanceof ApiError && error.status === 401) {
        return false;
      }

      setAuthError(error instanceof Error ? error.message : 'Unable to verify your session.');
      return false;
    } finally {
      setLoading(false);
    }
  };

  const login = async (payload: LoginRequest) => {
    await apiRequest('/api/auth/login', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!(await refreshUser())) {
      throw new Error('Login succeeded, but the server session could not be verified. Please try again.');
    }
  };

  const register = async (payload: RegisterRequest) => {
    await apiRequest('/api/auth/register', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  };

  const logout = async () => {
    try {
      await apiRequest('/api/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      if (error instanceof ApiError && error.status === null) {
        throw new Error('Unable to contact the server to confirm logout. Your session may still be active.');
      }
      throw error;
    }

    setUser(null);
    setAuthError(null);
  };

  useEffect(() => {
    void refreshUser();
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      authError,
      isAuthenticated: Boolean(user),
      refreshUser,
      login,
      register,
      logout,
    }),
    [user, loading, authError],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading, authError, refreshUser } = useAuth();
  const location = useLocation();

  if (loading) {
    return <LoadingScreen message="Checking your session..." />;
  }

  if (authError) {
    return (
      <div className="auth-shell">
        <div className="auth-card" role="alert">
          <p className="form-error">{authError}</p>
          <button type="button" className="button button-primary auth-submit" onClick={() => void refreshUser()}>
            Retry session check
          </button>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  return <>{children}</>;
}

function Header() {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setLogoutError('');
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/');
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to confirm logout.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <header className="site-header">
      <Link className="brand" to="/" aria-label="VULNFORGE home">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">VULNFORGE</span>
        <span className="brand-tagline">BUILD. BREAK. DEFEND.</span>
      </Link>

      <div className="header-actions">
        {isAuthenticated ? (
          <>
            <Link className="header-link" to="/dashboard">DASHBOARD</Link>
            <button type="button" className="header-button" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'LOGGING OUT...' : 'LOG OUT'}
            </button>
          </>
        ) : (
          <>
            <Link className="header-link" to="/login">LOGIN</Link>
            <Link className="header-enter" to="/register">GET STARTED</Link>
          </>
        )}
        {logoutError && <span className="header-status" role="alert">{logoutError}</span>}
      </div>
    </header>
  );
}

function SectionCode({ children, tone = 'amber' }: { children: ReactNode; tone?: string }) {
  return <span className={`section-code tone-${tone}`}>{children}</span>;
}

function Icon({ name }: { name: 'overview' | 'surface' | 'journey' | 'zones' | 'enter' }) {
  const paths: Record<string, ReactNode> = {
    overview: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><path d="M12 2v4m10 6h-4M12 22v-4M2 12h4" /></>,
    surface: <><rect x="3" y="4" width="6" height="5" rx="1" /><rect x="15" y="15" width="6" height="5" rx="1" /><rect x="15" y="4" width="6" height="5" rx="1" /><path d="M9 6.5h3a3 3 0 0 1 3 3V15m-3-3-3 3 3 3" /></>,
    journey: <><path d="M4 18h4l3-6 4 3 5-9" /><circle cx="4" cy="18" r="1" /><circle cx="11" cy="12" r="1" /><circle cx="15" cy="15" r="1" /><circle cx="20" cy="6" r="1" /></>,
    zones: <><path d="M12 3 3.5 8v8L12 21l8.5-5V8L12 3Z" /><path d="m3.5 8 8.5 5 8.5-5M12 13v8m-4-13 8 5" /></>,
    enter: <><path d="M5 4h14v16H5zM8 8l2 2-2 2m4 0h4m-8 3 2 2-2 2m4 0h4" /></>,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  );
}

const zones = [
  {
    id: '01',
    sector: 'WEB APPARATUS',
    surface: 'HTTP & API',
    title: 'Web applications & API boundaries',
    description: 'Explore how request handling, input validation, and API assumptions can create security weaknesses.',
    tier: 'FOUNDATIONAL',
  },
  {
    id: '02',
    sector: 'IDENTITY',
    surface: 'AUTH & SESSION',
    title: 'Authentication & session state',
    description: 'Study identity flows, session lifecycle, and the controls that protect account access.',
    tier: 'FOUNDATIONAL',
  },
  {
    id: '03',
    sector: 'INPUT HANDLING',
    surface: 'DATA BOUNDARIES',
    title: 'Injection & input validation',
    description: 'Understand how untrusted data crosses boundaries and how safe handling prevents injection.',
    tier: 'INTERMEDIATE',
  },
  {
    id: '04',
    sector: 'ACCESS CONTROL',
    surface: 'TENANT ISOLATION',
    title: 'Authorization & isolation',
    description: 'Learn how access policies and tenant boundaries should be enforced and verified.',
    tier: 'INTERMEDIATE',
  },
  {
    id: '05',
    sector: 'PLATFORM EDGE',
    surface: 'CONFIGURATION',
    title: 'Network & configuration security',
    description: 'Investigate exposure caused by insecure defaults, deployment choices, and trust relationships.',
    tier: 'ADVANCED',
  },
  {
    id: '06',
    sector: 'DEFENSE',
    surface: 'REMEDIATION',
    title: 'Secure coding & detection',
    description: 'Practice turning root-cause analysis into resilient code, useful logging, and stronger defenses.',
    tier: 'ALL LEVELS',
  },
];

function Hero() {
  return (
    <section className="hero section-frame" id="hero">
      <div className="hero-art" aria-hidden="true">
        <svg viewBox="0 0 1000 430" preserveAspectRatio="xMidYMid slice">
          <defs>
            <pattern id="hero-grid" width="34" height="34" patternUnits="userSpaceOnUse">
              <path d="M34 0H0V34" fill="none" stroke="#a9adb4" strokeOpacity=".12" strokeWidth=".65" />
            </pattern>
            <linearGradient id="hero-fade" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#08090c" stopOpacity=".2" />
              <stop offset="1" stopColor="#08090c" stopOpacity=".95" />
            </linearGradient>
          </defs>
          <rect width="1000" height="430" fill="url(#hero-grid)" />
          <g fill="none" stroke="#ff6b2c" strokeOpacity=".58" strokeWidth="1">
            <path d="M0 106h134l38 38h107l53-53h133l38 38h162" />
            <path d="M1000 86H832l-31 31H690l-49 49H522" />
            <path d="M34 278h193l51-51h121l28 28h132" />
            <path d="M1000 288H803l-44-44H648l-49 49H481" />
            <path d="M84 0v83l26 26v58M913 0v77l-35 35v60" />
            <path d="M181 430v-75l35-35m589 110v-76l-30-30" />
          </g>
          <g fill="#ff6b2c" fillOpacity=".78">
            <circle cx="134" cy="106" r="3" /><circle cx="432" cy="91" r="3" />
            <circle cx="803" cy="117" r="3" /><circle cx="227" cy="278" r="3" />
            <circle cx="759" cy="244" r="3" /><circle cx="84" cy="83" r="3" />
          </g>
          <g fill="#12151b" stroke="#8b9098" strokeOpacity=".4">
            <rect x="354" y="106" width="292" height="204" rx="4" />
            <rect x="379" y="127" width="242" height="42" rx="2" />
            <rect x="379" y="181" width="242" height="42" rx="2" />
            <rect x="379" y="235" width="242" height="42" rx="2" />
          </g>
          <g fill="#7a8089">
            <circle cx="395" cy="148" r="3" /><circle cx="395" cy="202" r="3" /><circle cx="395" cy="256" r="3" />
          </g>
          <g stroke="#7a8089" strokeOpacity=".35" strokeWidth="2">
            <path d="M409 148h98m-98 54h145m-145 54h116" />
          </g>
          <rect width="1000" height="430" fill="url(#hero-fade)" />
        </svg>
      </div>
      <div className="hero-content content-column">
        <div className="system-readout">
          <div className="readout-topline">
            <span>ENVIRONMENT: CONTROLLED // PLATFORM: ONLINE</span>
            <span className="tone-amber">LEARNING SURFACE: PREVIEW</span>
          </div>
          <div className="readout-console" aria-label="Platform status">
            <p><b>$</b> platform.scope <span>→ public learning experience [module_01]</span></p>
            <p><b>$</b> security.focus <span>→ investigate [understand] [remediate]</span></p>
            <p><b>$</b> challenge.runtime <strong>→ planned [future module]</strong></p>
          </div>
        </div>

        <div className="telemetry-pill"><span className="signal-dot" /> SECURITY LEARNING // CONTROLLED BY DESIGN</div>

        <div className="hero-copy">
          <h1>Find what the system doesn’t want you to see.</h1>
          <p>VULNFORGE is a hands-on cybersecurity learning platform where you investigate vulnerabilities, understand why they exist, and learn how to defend the systems behind them.</p>
        </div>

        <div className="hero-actions">
          <Link className="button button-primary" to="/register">GET STARTED <span aria-hidden="true">→</span></Link>
          <Link className="button button-secondary" to="/login">LOGIN TO VULNFORGE</Link>
        </div>

        <div className="radar-panel">
          <div className="radar-sweep" aria-hidden="true" />
          <span className="radar-path"><span aria-hidden="true">⌖</span> LEARNING_MODEL: <strong>TRUST_BOUNDARIES</strong></span>
          <span className="radar-alert"><span className="signal-dot" />[ SAFE, CONTROLLED LEARNING ]</span>
        </div>
      </div>
    </section>
  );
}

function AttackSurface() {
  const nodes = [
    { label: 'ENTRY POINT', index: 'EDGE 01', name: 'USER / CLIENT', detail: 'REQUEST: HTTPS', icon: '↗', tone: 'amber' },
    { label: 'IDENTITY & POLICY', index: 'GATEWAY 02', name: 'ACCESS CHECK', detail: 'TRUST BOUNDARY: VERIFY', icon: '◇', tone: 'amber' },
    { label: 'APPLICATION LAYER', index: 'RUNTIME 03', name: 'SERVICE LOGIC', detail: 'INPUT: UNTRUSTED', icon: '!', tone: 'red' },
    { label: 'DATA LAYER', index: 'STORE 04', name: 'PERSISTENCE', detail: 'ROLE-BASED STATE', icon: '▣', tone: 'amber' },
  ];

  return (
    <section className="surface-section section-frame" id="attack-surface">
      <div className="content-column section-stack">
        <div className="section-heading">
          <SectionCode>[ ATTACK SURFACE ]</SectionCode>
          <h2>Every system has a boundary worth understanding.</h2>
        </div>
        <div className="surface-grid">
          {nodes.map((node) => (
            <article className="surface-node" key={node.index}>
              <div className="node-topline"><span>{node.label}</span><span className={`tone-${node.tone}`}>{node.index}</span></div>
              <div className="node-icon" aria-hidden="true">{node.icon}</div>
              <h3>{node.name}</h3>
              <p>{node.detail}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function LearningJourney() {
  return (
    <section className="journey-section section-frame" id="journey">
      <div className="content-column section-stack">
        <div className="section-heading">
          <SectionCode>[ LEARNING JOURNEY ]</SectionCode>
          <h2>Investigate the assumptions behind the system.</h2>
        </div>
        <article className="journey-act">
          <div className="act-meta"><SectionCode tone="red">[ 01 // TRUST BOUNDARY ]</SectionCode><span className="tone-red">VERIFY IDENTITY</span></div>
          <h2>Security starts with who the actor is.</h2>
          <p>Before a request can be trusted, the service must answer a basic question: who is this user, and what assumptions are being made about identity?</p>
          <div className="diagnostic-panel">
            <div className="diagnostic-topline"><span><i className="signal-dot signal-red" />[ STATE: UNVERIFIED ]</span><span>IDENTITY CHECK</span></div>
            <div className="diagnostic-title"><strong>AUTHENTICATION REQUIRED</strong><span>VERIFY</span></div>
            <pre><code><span>&gt;</span> session.user = <b>unknown</b>{'\n'}<span>&gt;</span> access.check = <b>pending</b>{'\n'}<i>[!] AUTHENTICATION: REQUIRED BEFORE ACTIONS</i></code></pre>
          </div>
        </article>

        <article className="journey-act">
          <div className="act-meta"><SectionCode>[ 02 // VULNERABILITY ]</SectionCode><span className="tone-red">INVARIANT: UNDER REVIEW</span></div>
          <h2>Then the system tells you where it hurts.</h2>
          <p>A security assumption fails. Instead of blind guessing, learners trace what happened and identify the underlying weakness in a controlled, educational context.</p>
          <div className="diagnostic-panel">
            <div className="diagnostic-topline"><span><i className="signal-dot signal-red" />[ STATE: EXPECTED → UNEXPECTED ]</span><span>ILLUSTRATIVE DIAGNOSTIC</span></div>
            <div className="diagnostic-title"><strong>ACCESS POLICY // INCONSISTENT DECISION</strong><span>REVIEW</span></div>
            <pre><code><span>&gt;</span> request.resource = <b>protected_record</b>{'\n'}<span>&gt;</span> policy.subject = <b>unverified</b>{'\n'}<i>[!] AUTHORIZATION CHECK: REQUIRED</i>{'\n'}<em>[!] ROOT CAUSE: TRUSTED INPUT USED AS IDENTITY</em></code></pre>
          </div>
        </article>

        <article className="journey-act">
          <div className="act-meta"><SectionCode>[ 03 // UNDERSTANDING ]</SectionCode><span>ROOT CAUSE ANALYSIS</span></div>
          <h2>Finding the flaw is not the skill. Understanding why it exists is.</h2>
          <p>Exploits are symptoms. Weak assumptions, mismatched component behavior, and missing checks are the causes. Connect the weakness to its impact and the design decision behind it.</p>
          <div className="cause-pipeline">
            <div><span>01 WEAKNESS</span><strong>Untrusted input</strong></div>
            <div><span>02 CAUSE</span><strong>Missing validation</strong></div>
            <div className="cause-impact"><span>03 IMPACT</span><strong>Policy bypass</strong></div>
            <div className="cause-mastery"><span>04 MASTERY</span><strong>Verified boundary</strong></div>
          </div>
        </article>

        <article className="journey-act">
          <div className="act-meta"><SectionCode tone="green">[ 04 // DEFENSIVE PRACTICE ]</SectionCode><span className="tone-green">FOCUS: REMEDIATION</span></div>
          <h2>Now build something stronger.</h2>
          <p>Learn the remediation, understand the defense, and make the weakness disappear. Practice explicit authorization, safe input handling, and verifiable trust boundaries.</p>
          <div className="remediation-panel">
            <div className="remediation-topline"><span>[ UNDERSTOOD → REMEDIATED → VERIFIED ]</span><span>DEFENSIVE EXAMPLE</span></div>
            <div className="remediation-title"><strong>EXPLICIT BOUNDARY ENFORCEMENT</strong><span>REVIEWABLE</span></div>
            <pre><code><i>// Validate identity and policy before data access</i>{'\n'}if (!policy.allows(subject, resource)) {'{'}{'\n'}  return deny("access_not_permitted");{'\n'}{' }'}{'\n'}return read(resource);</code></pre>
            <div className="remediation-foot"><span>CONTROL: SERVER-SIDE AUTHORIZATION</span><span>OUTCOME: ACCESS DENIED BY DEFAULT</span></div>
          </div>
        </article>
      </div>
    </section>
  );
}

function SectorDirectory() {
  return (
    <section className="zones-section section-frame" id="labs">
      <div className="content-column section-stack">
        <div className="zones-heading">
          <div><SectionCode>[ SECTOR DIRECTORY ]</SectionCode><h2>Map of the Forge</h2></div>
          <span>PLANNED LEARNING CATEGORIES</span>
        </div>
        <div className="zones-grid">
          {zones.map((zone) => (
            <article className="zone-card" key={zone.id}>
              <div className="zone-topline"><span>ZONE {zone.id} // {zone.sector}</span><span>{zone.surface}</span></div>
              <h3>{zone.title}</h3>
              <p>{zone.description}</p>
              <div className="zone-foot"><span>TIER: {zone.tier}</span><span>STATUS: PLANNED</span></div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function Closing() {
  return (
    <>
      <section className="clarity-section section-frame">
        <div className="content-column clarity-content">
          <SectionCode>[ EMPIRICAL CLARITY ]</SectionCode>
          <h2>That moment when the system finally makes sense.</h2>
          <p>Not sure where to start? Start here. Learn one vulnerability. Understand one system. Build one skill.</p>
          <p className="clarity-note">VULNFORGE is designed for that moment—when a complex system becomes something you can reason about, question, and improve.</p>
          <div className="clarity-tags"><span>NO PRIOR EXPERIENCE REQUIRED</span><span>LEARN AT YOUR OWN PACE</span></div>
        </div>
      </section>

      <section className="enter-section section-frame" id="enter">
        <div className="content-column enter-content">
          <SectionCode>[ START WITH THE FOUNDATIONS ]</SectionCode>
          <h2>There’s always more to discover.</h2>
          <p className="enter-tagline">Build the skill. Break down the problem. Defend the system.</p>
          <Link className="button button-primary" to="/register">EXPLORE VULNFORGE <span aria-hidden="true">→</span></Link>
          <div className="ethics-note">
            <div className="ethics-meta"><span>STATUS: PUBLIC LEARNING EXPERIENCE</span><span>SECURITY: BUILT FOR SAFE LEARNING</span></div>
            <p>VULNFORGE is a learning platform in development. Practical labs and isolated challenge environments are planned for future modules; this landing page does not provide exploit targets.</p>
            <div className="ethics-links"><a href="#attack-surface">SYSTEM MODEL</a><span>•</span><a href="#journey">LEARNING APPROACH</a><span>•</span><a href="#labs">PLANNED CATEGORIES</a></div>
          </div>
        </div>
      </section>
    </>
  );
}

function BottomNavigation() {
  const items: { label: string; href: string; icon: 'overview' | 'surface' | 'journey' | 'zones' | 'enter' }[] = [
    { label: 'Overview', href: '#hero', icon: 'overview' },
    { label: 'Surface', href: '#attack-surface', icon: 'surface' },
    { label: 'Journey', href: '#journey', icon: 'journey' },
    { label: 'Zones', href: '#labs', icon: 'zones' },
    { label: 'Explore', href: '#enter', icon: 'enter' },
  ];

  return (
    <nav className="bottom-navigation" aria-label="Page sections">
      {items.map((item, index) => (
        <a className={index === 0 ? 'bottom-nav-link current' : 'bottom-nav-link'} key={item.label} href={item.href} aria-current={index === 0 ? 'location' : undefined}>
          <Icon name={item.icon} />
          <span>{item.label}</span>
        </a>
      ))}
    </nav>
  );
}

function LandingPage() {
  return (
    <div className="page-shell">
      <Header />
      <main>
        <Hero />
        <AttackSurface />
        <LearningJourney />
        <SectorDirectory />
        <Closing />
      </main>
      <BottomNavigation />
    </div>
  );
}

function LoadingScreen({ message }: { message: string }) {
  return (
    <div className="auth-shell">
      <div className="auth-card auth-loading">
        <div className="spinner" aria-hidden="true" />
        <p>{message}</p>
      </div>
    </div>
  );
}

function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const locationState = location.state as { from?: string; notice?: string } | null;
  const from = locationState?.from || '/dashboard';
  const { login, register, isAuthenticated, authError, refreshUser } = useAuth();

  const isLogin = mode === 'login';
  const [form, setForm] = useState({
    username: '',
    email: '',
    identifier: '',
    password: '',
    confirmPassword: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isAuthenticated && !isSubmitting) {
      navigate(from, { replace: true });
    }
  }, [from, isAuthenticated, isSubmitting, navigate]);

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (submittingRef.current) {
      return;
    }
    setSubmitError('');

    if (isLogin) {
      if (!form.identifier.trim() || !form.password) {
        setSubmitError('Please enter your email or username and password.');
        return;
      }
      if (form.identifier.trim().length > 120) {
        setSubmitError('Email or username must be 120 characters or fewer.');
        return;
      }
      if (form.password.length < 8 || form.password.length > 128) {
        setSubmitError('Password must be between 8 and 128 characters.');
        return;
      }

      try {
        submittingRef.current = true;
        setIsSubmitting(true);
        await login({ identifier: form.identifier, password: form.password });
        navigate(from, { replace: true });
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Unable to log in right now.');
      } finally {
        submittingRef.current = false;
        setIsSubmitting(false);
      }
      return;
    }

    const username = form.username.trim();
    const email = form.email.trim();
    if (!username || !email || !form.password) {
      setSubmitError('Please complete all fields to create your account.');
      return;
    }

    if (username.length < 3 || username.length > 50) {
      setSubmitError('Username must be between 3 and 50 characters.');
      return;
    }

    if (email.length > 255 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setSubmitError('Please enter a valid email address (up to 255 characters).');
      return;
    }

    if (
      form.password.length < 8
      || form.password.length > 128
      || !/[A-Za-z]/.test(form.password)
      || !/\d/.test(form.password)
    ) {
      setSubmitError('Password must be 8-128 characters and include at least one letter and one number.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setSubmitError('Passwords do not match.');
      return;
    }

    try {
      submittingRef.current = true;
      setIsSubmitting(true);
      await register({ username: form.username, email: form.email, password: form.password });
      navigate('/login', {
        replace: true,
        state: { notice: 'Account created successfully. Please log in.' },
      });
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Unable to create the account right now.');
    } finally {
      submittingRef.current = false;
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <div className="auth-card">
        <div className="auth-header">
          <SectionCode>[ {isLogin ? 'LOGIN' : 'REGISTER'} ]</SectionCode>
          <h1>{isLogin ? 'Welcome back to VULNFORGE' : 'Create your VULNFORGE account'}</h1>
        </div>

        {isLogin && locationState?.notice && <p role="status">{locationState.notice}</p>}
        {authError && (
          <div className="form-error" role="alert">
            {authError}{' '}
            <button type="button" onClick={() => void refreshUser()}>Retry session check</button>
          </div>
        )}

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          {!isLogin && (
            <label>
              <span>Username</span>
              <input type="text" name="username" value={form.username} onChange={handleChange} placeholder="security_student" autoComplete="username" maxLength={50} />
            </label>
          )}

          {isLogin ? (
            <label>
              <span>Email or username</span>
              <input type="text" name="identifier" value={form.identifier} onChange={handleChange} placeholder="student@example.com or alice" autoComplete="username" />
            </label>
          ) : (
            <label>
              <span>Email</span>
              <input type="email" name="email" value={form.email} onChange={handleChange} placeholder="student@example.com" autoComplete="email" maxLength={255} />
            </label>
          )}

          <label>
            <span>Password</span>
            <input type="password" name="password" value={form.password} onChange={handleChange} placeholder="••••••••" autoComplete={isLogin ? 'current-password' : 'new-password'} maxLength={128} />
          </label>

          {!isLogin && (
            <label>
              <span>Confirm password</span>
              <input type="password" name="confirmPassword" value={form.confirmPassword} onChange={handleChange} placeholder="Repeat your password" autoComplete="new-password" maxLength={128} />
            </label>
          )}

            {submitError && <div className="form-error" role="alert">{submitError}</div>}

          <button type="submit" className="button button-primary auth-submit" disabled={isSubmitting}>
            {isSubmitting ? (isLogin ? 'Signing in...' : 'Creating account...') : isLogin ? 'Log in' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          <span>{isLogin ? 'Need an account?' : 'Already have an account?'}</span>
          <Link to={isLogin ? '/register' : '/login'}>{isLogin ? 'Register' : 'Log in'}</Link>
        </div>
      </div>
    </div>
  );
}

const workspaceLinks = [
  { path: '/dashboard', label: 'Dashboard', short: 'DB' },
  { path: '/challenges', label: 'Challenges', short: 'CH' },
  { path: '/categories', label: 'Categories', short: 'CA' },
  { path: '/progress', label: 'My Progress', short: 'PR' },
  { path: '/leaderboard', label: 'Leaderboard', short: 'LB' },
  { path: '/analytics', label: 'Analytics', short: 'AN' },
  { path: '/profile', label: 'Profile', short: 'AC' },
];

function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();
  const isWorkspaceLinkActive = (path: string) => location.pathname === path
    || (path === '/challenges' && location.pathname.startsWith('/challenges/'));

  const handleLogout = async () => {
    if (isLoggingOut) {
      return;
    }

    setLogoutError('');
    setIsLoggingOut(true);
    try {
      await logout();
      navigate('/login', { replace: true });
    } catch (error) {
      setLogoutError(error instanceof Error ? error.message : 'Unable to confirm logout.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar" aria-label="Student navigation">
        <Link className="workspace-brand" to="/dashboard">
          <span className="brand-mark" aria-hidden="true" />
          <span>VULNFORGE</span>
        </Link>
        <span className="workspace-nav-heading">LEARNING SPACE</span>
        <nav className="workspace-nav">
          {workspaceLinks.map((item) => (
            <Link
              key={item.path}
              className={`workspace-nav-link${isWorkspaceLinkActive(item.path) ? ' active' : ''}`}
              to={item.path}
              aria-current={isWorkspaceLinkActive(item.path) ? 'page' : undefined}
            >
              <span className="workspace-nav-icon" aria-hidden="true">{item.short}</span>
              <span>{item.label}</span>
            </Link>
          ))}
          {user?.role === 'ADMIN' && (
            <>
              <span className="workspace-nav-heading">ADMINISTRATION</span>
              {[
                { path: '/admin', label: 'Admin workspace', short: 'AD' },
                { path: '/security-events', label: 'Blue-Team events', short: 'EV' },
              ].map((item) => (
                <Link
                  key={item.path}
                  className={`workspace-nav-link${isWorkspaceLinkActive(item.path) ? ' active' : ''}`}
                  to={item.path}
                  aria-current={isWorkspaceLinkActive(item.path) ? 'page' : undefined}
                >
                  <span className="workspace-nav-icon" aria-hidden="true">{item.short}</span>
                  <span>{item.label}</span>
                </Link>
              ))}
            </>
          )}
        </nav>
        <div className="workspace-sidebar-note">
          <span className="signal-dot" />
          <span>CONTROLLED LEARNING ENVIRONMENT</span>
        </div>
      </aside>

      <div className="workspace-main">
        <header className="workspace-topbar">
          <div>
            <span className="workspace-eyebrow">VULNFORGE / STUDENT PORTAL</span>
            <p className="workspace-current-user">{user?.username}</p>
          </div>
          <div className="workspace-account">
            <Link className="workspace-account-link" to="/profile" aria-label="View account profile">
              <span className="workspace-avatar" aria-hidden="true">{user?.username.slice(0, 1).toUpperCase()}</span>
              <span>{user?.username}</span>
            </Link>
            <button type="button" className="header-button" onClick={handleLogout} disabled={isLoggingOut}>
              {isLoggingOut ? 'LOGGING OUT...' : 'LOG OUT'}
            </button>
          </div>
        </header>
        {logoutError && <p className="workspace-logout-error form-error" role="alert">{logoutError}</p>}
        <main className="workspace-content">{children}</main>
      </div>

      <nav className="workspace-mobile-nav" aria-label="Student navigation">
        {workspaceLinks.map((item) => (
          <Link
            key={item.path}
            className={`workspace-mobile-link${isWorkspaceLinkActive(item.path) ? ' active' : ''}`}
            to={item.path}
            aria-current={isWorkspaceLinkActive(item.path) ? 'page' : undefined}
          >
            <span aria-hidden="true">{item.short}</span>
            <small>{item.label}</small>
          </Link>
        ))}
      </nav>
    </div>
  );
}

function DashboardPage() {
  const { user } = useAuth();
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [progressError, setProgressError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<LearningProgress>('/api/learning/progress')
      .then((data) => {
        if (active) {
          setProgress(data);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setProgressError(requestError instanceof Error ? requestError.message : 'Unable to load your progress.');
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <>
      <section className="workspace-welcome">
        <SectionCode>[ STUDENT DASHBOARD ]</SectionCode>
        <h1>Welcome, {user?.username}</h1>
        <p>Investigate published challenges, then strengthen your understanding with explanations and knowledge checks.</p>
        <div className="workspace-quick-links">
          <Link className="button button-primary" to="/challenges">EXPLORE CHALLENGES <span aria-hidden="true">→</span></Link>
          <Link className="button button-secondary" to="/progress">VIEW MY PROGRESS</Link>
        </div>
      </section>

      <section className="workspace-stats" aria-label="Learning summary">
        {[
          ['POINTS', progress?.points ?? '—', 'Awarded after hint penalties'],
          ['CHALLENGES SOLVED', progress?.solvedChallenges ?? '—', 'Unique solved challenges'],
          ['CHALLENGES ATTEMPTED', progress?.attemptedChallenges ?? '—', 'Unique challenges attempted'],
          ['HINTS REVEALED', progress?.hintsRevealed ?? '—', 'Hints used across challenges'],
        ].map(([label, value, note]) => (
          <article className="workspace-stat-card" key={label}>
            <span className="workspace-stat-label">{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </section>
      {progressError && <p className="form-error" role="alert">{progressError}</p>}

      <section className="workspace-panel workspace-next">
        <div>
          <SectionCode>[ NEXT STEP ]</SectionCode>
          <h2>Turn a solve into understanding</h2>
          <p>After solving a challenge, review its root cause, secure implementation, remediation guidance, detection ideas, and knowledge check.</p>
        </div>
        <div className="workspace-next-links">
          <Link className="workspace-text-link" to="/challenges">VIEW CHALLENGES <span aria-hidden="true">→</span></Link>
          <Link className="workspace-text-link" to="/progress">VIEW PROGRESS <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  );
}

function ProfilePage() {
  const { user } = useAuth();

  if (!user) {
    return <LoadingScreen message="Loading your profile..." />;
  }

  return (
    <section className="workspace-profile">
        <div className="auth-header">
          <SectionCode>[ PROFILE ]</SectionCode>
          <h1>Your account</h1>
        </div>

        <div className="profile-grid">
          <div>
            <label>Username</label>
            <p>{user.username}</p>
          </div>
          <div>
            <label>Email</label>
            <p>{user.email}</p>
          </div>
          <div>
            <label>Role</label>
            <p>{user.role}</p>
          </div>
          <div>
            <label>Member since</label>
            <p>{new Date(user.createdAt).toLocaleDateString()}</p>
          </div>
        </div>

        <div className="profile-actions">
          <Link className="button button-secondary" to="/dashboard">Back to dashboard</Link>
        </div>
      </section>
  );
}

type ChallengeListItem = {
  id: string;
  slug: string;
  title: string;
  category: { name: string };
  difficulty: string;
  points: number;
  solved: boolean;
};

type ChallengeCategory = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  challengeCount: number;
};

function CategoriesPage() {
  const [categories, setCategories] = useState<ChallengeCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<{ categories: ChallengeCategory[] }>('/api/categories')
      .then((data) => {
        if (active) {
          setCategories(data.categories);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load categories.');
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

  return (
    <section className="learning-page">
      <SectionCode>[ LEARNING CATEGORIES ]</SectionCode>
      <h1>Categories</h1>
      <p className="learning-intro">Browse published challenges by security topic.</p>
      {loading && <p role="status">Loading categories...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && categories.length === 0 && plannedModules.length === 0 && (
        <p className="learning-empty">No categories with available challenges were found.</p>
      )}
      {!loading && categories.length > 0 && (
        <div className="challenge-grid">
          {categories.map((category) => (
            <article className="learning-card challenge-card" key={category.id}>
              <h2>{category.name}</h2>
              <p>{category.description ?? 'Explore published challenges in this topic.'}</p>
              <p>{category.challengeCount} {category.challengeCount === 1 ? 'challenge' : 'challenges'}</p>
              <Link className="workspace-text-link" to={`/challenges?category=${encodeURIComponent(category.slug)}`}>
                VIEW CHALLENGES <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      )}
      {!loading && (
        <section className="planned-modules">
          <SectionCode>[ IN DEVELOPMENT ]</SectionCode>
          <h2>Coming soon</h2>
          <div className="challenge-grid">
            {plannedModules.map((module) => (
              <article className="learning-card challenge-card planned-card" key={module.slug}>
                <div className="learning-card-meta"><span>MODULE {module.number}</span><span className="planned-status">COMING SOON</span></div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <p>{module.challenges.length} planned labs</p>
                <Link className="workspace-text-link" to={`/challenges?category=${encodeURIComponent(module.slug)}`}>
                  VIEW PLANNED LABS <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

function ChallengeCatalogPage() {
  const [searchParams] = useSearchParams();
  const categorySlug = searchParams.get('category');
  const plannedModule = getPlannedModuleBySlug(categorySlug);
  const [challenges, setChallenges] = useState<ChallengeListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (getPlannedModuleBySlug(categorySlug)) {
      setLoading(false);
      setError('');
      return;
    }
    let active = true;
    const query = new URLSearchParams({ limit: '100' });
    if (categorySlug) {
      query.set('category', categorySlug);
    }
    apiRequest<{ challenges: ChallengeListItem[] }>(`/api/challenges?${query}`)
      .then((data) => {
        if (active) {
          setChallenges(data.challenges);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load challenges.');
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
  }, [categorySlug]);

  return (
    <section className="learning-page">
      <SectionCode>[ CHALLENGE CATALOGUE ]</SectionCode>
      <h1>{categorySlug ? 'Category challenges' : 'Challenges'}</h1>
      <p className="learning-intro">Practice in controlled challenges, then review the defensive lessons and knowledge check.</p>
      {categorySlug && <Link className="workspace-text-link" to="/challenges">SHOW ALL CHALLENGES</Link>}
      {loading && <p role="status">Loading available challenges...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && challenges.length === 0 && (
        <p className="learning-empty">{plannedModule
          ? 'These learning modules are planned but not available to start yet.'
          : categorySlug ? 'No published challenges are currently available in this category.' : 'No published challenges are currently available.'}</p>
      )}
      {!loading && challenges.length > 0 && (
        <div className="challenge-grid">
          {challenges.map((challenge) => (
            <article className="learning-card challenge-card" key={challenge.id}>
              <div className="learning-card-meta">
                <span>{challenge.category.name}</span>
                <span>{challenge.difficulty}</span>
              </div>
              <h2>{challenge.title}</h2>
              <p>{challenge.points} points · {challenge.solved ? 'Solved' : 'Not solved'}</p>
              <Link className="workspace-text-link" to={`/challenges/${challenge.slug}`}>
                OPEN CHALLENGE <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      )}
      {!loading && !error && plannedModule && (
        <div className="challenge-grid">
          {plannedModule.challenges.map((challenge) => (
            <article className="learning-card challenge-card planned-card" key={challenge.slug}>
              <div className="learning-card-meta"><span>{challenge.code}</span><span className="planned-status">COMING SOON</span></div>
              <h2>{challenge.title}</h2>
              <p>{challenge.description}</p>
              <h3>Learning objectives</h3>
              <ul>{challenge.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
              <Link className="workspace-text-link" to={`/challenges/${challenge.slug}`}>
                VIEW DETAILS <span aria-hidden="true">→</span>
              </Link>
            </article>
          ))}
        </div>
      )}
      {!loading && !categorySlug && (
        <section className="planned-modules">
          <SectionCode>[ COMING SOON ]</SectionCode>
          <h2>Planned security labs</h2>
          <div className="challenge-grid">
            {plannedModules.map((module) => (
              <article className="learning-card challenge-card planned-card" key={module.slug}>
                <div className="learning-card-meta"><span>MODULE {module.number}</span><span className="planned-status">COMING SOON</span></div>
                <h3>{module.name}</h3>
                <p>{module.description}</p>
                <Link className="workspace-text-link" to={`/challenges?category=${encodeURIComponent(module.slug)}`}>
                  VIEW PLANNED LABS <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

type ChallengeDetails = {
  id: string;
  slug: string;
  title: string;
  description: string;
  learningObjectives: string[];
  context: string | null;
  prerequisites: string[];
  difficulty: string;
  points: number;
  solved: boolean;
  category: { name: string };
};

type HintState = {
  hints: Array<{
    order: number;
    content: string;
    penaltyPoints: number;
    revealedAt: string;
  }>;
  nextHint: { order: number; penaltyPoints: number } | null;
  totalPenaltyPoints: number;
};

type QuizQuestion = {
  id: string;
  order: number;
  prompt: string;
  options: Array<{ id: string; text: string }>;
};

type QuizReview = {
  id: string;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
  responses: Array<{
    question: {
      id: string;
      prompt: string;
      options: Array<{
        id: string;
        text: string;
        isCorrect: boolean;
        explanation: string | null;
      }>;
    };
    selectedOptionId: string;
    isCorrect: boolean;
  }>;
};

type Explanation = {
  expectedAnswer: string;
  solutionSteps: string[];
  keyTakeaways: string[];
  rootCause: string;
  technicalExplanation: string;
  impact: string;
  conditions: string;
  secureImplementation: string;
  remediationGuidance: string;
  detectionIdeas: string;
};

function ChallengeDetailPage() {
  const { slug } = useParams();
  const plannedChallenge = getPlannedChallengeBySlug(slug);
  const [challenge, setChallenge] = useState<ChallengeDetails | null>(null);
  const [hints, setHints] = useState<HintState | null>(null);
  const [explanation, setExplanation] = useState<Explanation | null>(null);
  const [quizQuestions, setQuizQuestions] = useState<QuizQuestion[]>([]);
  const [quizHistory, setQuizHistory] = useState<QuizReview[]>([]);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [flag, setFlag] = useState('');
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [learningLoading, setLearningLoading] = useState(false);
  const [requestPending, setRequestPending] = useState(false);
  const [error, setError] = useState('');
  const [learningError, setLearningError] = useState('');
  const [notice, setNotice] = useState('');
  const [pendingHintOrder, setPendingHintOrder] = useState<number | null>(null);

  const loadHints = async () => {
    if (!slug) {
      return;
    }

    const data = await apiRequest<HintState>(`/api/challenges/${encodeURIComponent(slug)}/hints`);
    setHints(data);
  };

  const loadLearning = async () => {
    if (!slug) {
      return;
    }

    setLearningLoading(true);
    setLearningError('');
    try {
      const [explanationData, quizData, resultsData] = await Promise.all([
        apiRequest<{ explanation: Explanation | null }>(`/api/challenges/${encodeURIComponent(slug)}/explanation`),
        apiRequest<{ questions: QuizQuestion[] }>(`/api/challenges/${encodeURIComponent(slug)}/quiz`),
        apiRequest<{ attempts: QuizReview[] }>(`/api/challenges/${encodeURIComponent(slug)}/quiz/results`),
      ]);
      setExplanation(explanationData.explanation);
      setQuizQuestions(quizData.questions);
      setQuizHistory(resultsData.attempts);
    } catch (requestError) {
      setLearningError(requestError instanceof Error ? requestError.message : 'Unable to load learning content.');
    } finally {
      setLearningLoading(false);
    }
  };

  useEffect(() => {
    if (getPlannedChallengeBySlug(slug)) {
      setLoading(false);
      setError('');
      return;
    }
    if (!slug) {
      setError('A challenge slug is required.');
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);
    setError('');
    Promise.all([
      apiRequest<{ challenge: ChallengeDetails }>(`/api/challenges/${encodeURIComponent(slug)}`),
      apiRequest<HintState>(`/api/challenges/${encodeURIComponent(slug)}/hints`),
    ])
      .then(async ([challengeData, hintData]) => {
        if (!active) {
          return;
        }
        setChallenge(challengeData.challenge);
        setHints(hintData);
        if (challengeData.challenge.solved) {
          await loadLearning();
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load this challenge.');
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
  }, [slug]);

  const startOrResumeAttempt = async () => {
    if (!slug) {
      return;
    }
    setRequestPending(true);
    setError('');
    try {
      const data = await apiRequest<{ attempt: { id: string } }>(
        `/api/challenges/${encodeURIComponent(slug)}/attempts`,
        { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' },
      );
      setAttemptId(data.attempt.id);
      setNotice('Your active attempt is ready.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to start the challenge.');
    } finally {
      setRequestPending(false);
    }
  };

  const stopAttempt = async () => {
    if (!slug || !attemptId) {
      return;
    }
    setRequestPending(true);
    setError('');
    try {
      await apiRequest(`/api/challenges/${encodeURIComponent(slug)}/attempts/${attemptId}/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      });
      setAttemptId(null);
      setNotice('The attempt has been stopped.');
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to stop this attempt.');
    } finally {
      setRequestPending(false);
    }
  };

  const revealHint = async (order: number, confirmPenalty = false) => {
    if (!slug) {
      return;
    }
    setRequestPending(true);
    setError('');
    try {
      await apiRequest(`/api/challenges/${encodeURIComponent(slug)}/hints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order, ...(confirmPenalty ? { confirmPenalty: true } : {}) }),
      });
      setPendingHintOrder(null);
      await loadHints();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reveal this hint.');
    } finally {
      setRequestPending(false);
    }
  };

  const submitFlag = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slug || !attemptId) {
      return;
    }

    setRequestPending(true);
    setError('');
    setNotice('');
    try {
      const data = await apiRequest<{
        correct: boolean;
        message?: string;
        pointsAwarded?: number;
        alreadySolved?: boolean;
      }>(`/api/challenges/${encodeURIComponent(slug)}/attempts/${attemptId}/submissions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ flag }),
      });
      if (data.correct) {
        setChallenge((current) => current ? { ...current, solved: true } : current);
        setAttemptId(null);
        setFlag('');
        setNotice(data.alreadySolved
          ? 'Challenge already solved. No additional points were awarded.'
          : `Challenge solved. ${data.pointsAwarded ?? 0} points awarded after hint penalties.`);
        await loadLearning();
      } else {
        setNotice(data.message ?? 'Incorrect flag.');
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to submit the flag.');
    } finally {
      setRequestPending(false);
    }
  };

  const submitQuiz = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!slug) {
      return;
    }
    if (quizQuestions.some((question) => !answers[question.id])) {
      setLearningError('Choose an answer for each question before submitting.');
      return;
    }

    setRequestPending(true);
    setLearningError('');
    try {
      const data = await apiRequest<{
        attempt: Omit<QuizReview, 'responses'>;
        responses: Array<{
          questionId: string;
          prompt: string;
          selectedOptionId: string;
          isCorrect: boolean;
          options: QuizReview['responses'][number]['question']['options'];
        }>;
      }>(`/api/challenges/${encodeURIComponent(slug)}/quiz/attempts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answers: quizQuestions.map((question) => ({
            questionId: question.id,
            optionId: answers[question.id],
          })),
        }),
      });
      const review: QuizReview = {
        ...data.attempt,
        responses: data.responses.map((response) => ({
          question: {
            id: response.questionId,
            prompt: response.prompt,
            options: response.options,
          },
          selectedOptionId: response.selectedOptionId,
          isCorrect: response.isCorrect,
        })),
      };
      setQuizHistory((current) => [review, ...current]);
    } catch (requestError) {
      setLearningError(requestError instanceof Error ? requestError.message : 'Unable to submit the knowledge check.');
    } finally {
      setRequestPending(false);
    }
  };

  if (loading) {
    return <p role="status">Loading challenge...</p>;
  }
  if (plannedChallenge) {
    return (
      <section className="learning-page">
        <Link className="workspace-text-link" to={`/challenges?category=${encodeURIComponent(plannedChallenge.module.slug)}`}>← BACK TO PLANNED LABS</Link>
        <article className="learning-card">
          <div className="learning-card-meta"><span>{plannedChallenge.module.name}</span><span className="planned-status">COMING SOON</span></div>
          <h1>{plannedChallenge.code}: {plannedChallenge.title}</h1>
          <p>{plannedChallenge.description}</p>
          <h2>Learning objectives</h2>
          <ul>{plannedChallenge.objectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
          <p className="learning-empty">This lab is not available yet. No challenge attempt or progress can be created.</p>
        </article>
      </section>
    );
  }
  if (error && !challenge) {
    return <section className="learning-page"><p className="form-error" role="alert">{error}</p><Link to="/challenges">Back to challenges</Link></section>;
  }
  if (!challenge) {
    return null;
  }

  return (
    <section className="learning-page">
      <Link className="workspace-text-link" to="/challenges">← BACK TO CHALLENGES</Link>
      <header className="challenge-heading learning-card">
        <div className="learning-card-meta"><span>{challenge.category.name}</span><span>{challenge.difficulty}</span></div>
        <h1>{challenge.title}</h1>
        <p>{challenge.description}</p>
        <p className="challenge-points">{challenge.points} challenge points</p>
      </header>

      <section className="learning-card">
        <SectionCode>[ BEFORE YOU BEGIN ]</SectionCode>
        <h2>Learning objectives</h2>
        {challenge.learningObjectives.length
          ? <ul>{challenge.learningObjectives.map((objective) => <li key={objective}>{objective}</li>)}</ul>
          : <p className="learning-empty">No learning objectives have been added.</p>}
        {challenge.context && <><h3>Context</h3><p>{challenge.context}</p></>}
        {challenge.prerequisites.length > 0 && (
          <><h3>Prerequisites</h3><ul>{challenge.prerequisites.map((item) => <li key={item}>{item}</li>)}</ul></>
        )}
      </section>

      {import.meta.env.DEV && authLabChallengeSlugs.has(challenge.slug) && (
        <AuthLabSimulator slug={challenge.slug} />
      )}
      {import.meta.env.DEV && accessControlLabChallengeSlugs.has(challenge.slug) && (
        <AccessControlLabSimulator slug={challenge.slug} />
      )}

      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p className="learning-notice" role="status">{notice}</p>}

      {!challenge.solved && (
        <>
          <section className="learning-card challenge-attempt">
            <SectionCode>[ DURING THE CHALLENGE ]</SectionCode>
            <h2>Flag submission</h2>
            <p>Start or resume an attempt to submit your flag. Your score is checked and recorded by the server.</p>
            {!attemptId ? (
              <button className="button button-primary" type="button" onClick={() => void startOrResumeAttempt()} disabled={requestPending}>
                {requestPending ? 'Starting...' : 'Start or resume attempt'}
              </button>
            ) : (
              <>
                <form className="learning-form" onSubmit={(event) => void submitFlag(event)}>
                  <label htmlFor="challenge-flag">Flag</label>
                  <input id="challenge-flag" name="flag" value={flag} onChange={(event) => setFlag(event.target.value)} maxLength={256} required />
                  <button className="button button-primary" type="submit" disabled={requestPending || !flag}>
                    {requestPending ? 'Submitting...' : 'Submit flag'}
                  </button>
                </form>
                <button className="button button-secondary" type="button" onClick={() => void stopAttempt()} disabled={requestPending}>Stop attempt</button>
              </>
            )}
          </section>

          <section className="learning-card">
            <SectionCode>[ ORDERED HINTS ]</SectionCode>
            <h2>Reveal hints in sequence</h2>
            <p>Hint penalties reduce the server-awarded challenge points when you solve; each hint is charged at most once.</p>
            {hints?.hints.map((hint) => (
              <article className="revealed-hint" key={hint.order}>
                <h3>Hint {hint.order}{hint.penaltyPoints > 0 ? ` · ${hint.penaltyPoints} point penalty` : ''}</h3>
                <p>{hint.content}</p>
              </article>
            ))}
            {hints?.nextHint && (
              <div className="hint-controls">
                {pendingHintOrder === hints.nextHint.order ? (
                  <div className="hint-confirmation" role="alert">
                    <p>Revealing Hint {hints.nextHint.order} will reduce your challenge award by {hints.nextHint.penaltyPoints} points. Continue?</p>
                    <button className="button button-primary" type="button" disabled={requestPending} onClick={() => void revealHint(hints.nextHint!.order, true)}>Confirm and reveal</button>
                    <button className="button button-secondary" type="button" onClick={() => setPendingHintOrder(null)}>Cancel</button>
                  </div>
                ) : (
                  <button
                    className="button button-secondary"
                    type="button"
                    disabled={requestPending || !attemptId}
                    onClick={() => hints.nextHint!.penaltyPoints > 0
                      ? setPendingHintOrder(hints.nextHint!.order)
                      : void revealHint(hints.nextHint!.order)}
                  >
                    {hints.nextHint.penaltyPoints > 0
                      ? `Review ${hints.nextHint.penaltyPoints}-point penalty for next hint`
                      : `Reveal hint ${hints.nextHint.order}`}
                  </button>
                )}
              </div>
            )}
            {hints?.nextHint === null && hints?.hints.length === 0 && <p className="learning-empty">No hints are configured for this challenge.</p>}
            {hints && hints.totalPenaltyPoints > 0 && <p className="learning-muted">Penalty currently recorded: {hints.totalPenaltyPoints} points, deducted from the solve award.</p>}
          </section>
        </>
      )}

      {challenge.solved && (
        <section className="learning-card">
          <SectionCode>[ AFTER SOLVING ]</SectionCode>
          <h2>Challenge explanation</h2>
          {learningLoading && <p role="status">Loading explanation and knowledge check...</p>}
          {learningError && <p className="form-error" role="alert">{learningError}</p>}
          {!learningLoading && explanation && (
            <>
              {explanation.expectedAnswer && <article className="solution-answer">
                <h3>Expected educational answer</h3>
                <p>{explanation.expectedAnswer}</p>
              </article>}
              {explanation.solutionSteps.length > 0 && <article className="solution-steps">
                <h3>Step-by-step solution</h3>
                <ol>{explanation.solutionSteps.map((step, index) => <li key={`${index}-${step}`}>{step}</li>)}</ol>
              </article>}
              <div className="explanation-grid">
                <article><h3>Root cause</h3><p>{explanation.rootCause}</p></article>
                <article><h3>Technical explanation</h3><p>{explanation.technicalExplanation}</p></article>
                <article><h3>Impact</h3><p>{explanation.impact}</p></article>
                <article><h3>Conditions</h3><p>{explanation.conditions}</p></article>
                <article><h3>Secure implementation</h3><p>{explanation.secureImplementation}</p></article>
                <article><h3>Remediation guidance</h3><p>{explanation.remediationGuidance}</p></article>
                <article><h3>Detection ideas</h3><p>{explanation.detectionIdeas}</p></article>
              </div>
              {explanation.keyTakeaways.length > 0 && <article className="solution-takeaways">
                <h3>Key takeaways</h3>
                <ul>{explanation.keyTakeaways.map((takeaway) => <li key={takeaway}>{takeaway}</li>)}</ul>
              </article>}
            </>
          )}
          {!learningLoading && !explanation && <p className="learning-empty">No explanation has been added for this challenge yet.</p>}

          <div className="quiz-section">
            <h2>Knowledge check</h2>
            {quizQuestions.length === 0 && <p className="learning-empty">No quiz questions are configured for this challenge.</p>}
            {quizQuestions.length > 0 && (
              <form className="quiz-form" onSubmit={(event) => void submitQuiz(event)}>
                {quizQuestions.map((question) => (
                  <fieldset className="quiz-question" key={question.id}>
                    <legend>{question.order}. {question.prompt}</legend>
                    {question.options.map((option) => (
                      <label className="quiz-option" key={option.id}>
                        <input
                          type="radio"
                          name={`question-${question.id}`}
                          value={option.id}
                          checked={answers[question.id] === option.id}
                          onChange={() => setAnswers((current) => ({ ...current, [question.id]: option.id }))}
                        />
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </fieldset>
                ))}
                <button className="button button-primary" type="submit" disabled={requestPending}>
                  {requestPending ? 'Scoring...' : 'Submit knowledge check'}
                </button>
              </form>
            )}

            {quizHistory.length > 0 && (
              <div className="quiz-results">
                <h3>Your quiz results</h3>
                {quizHistory.map((result) => (
                  <article className="quiz-result" key={result.id}>
                    <p><strong>{result.score}/{result.totalQuestions} correct · {result.percentage}%</strong> · {new Date(result.submittedAt).toLocaleString()}</p>
                    {result.responses.map((response) => (
                      <div className="quiz-feedback" key={response.question.id}>
                        <h4>{response.question.prompt}</h4>
                        <p>{response.isCorrect ? 'Correct' : 'Not quite'}</p>
                        {response.question.options.map((option) => (
                          <p className="quiz-answer-feedback" key={option.id}>
                            <strong>{option.isCorrect ? 'Correct answer' : option.id === response.selectedOptionId ? 'Your answer' : 'Option'}:</strong> {option.text}
                            {option.explanation && <> — {option.explanation}</>}
                          </p>
                        ))}
                      </div>
                    ))}
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
    </section>
  );
}

type LearningProgress = {
  points: number;
  solvedChallenges: number;
  attemptedChallenges: number;
  hintsRevealed: number;
  solved: Array<{
    pointsAwarded: number;
    solvedAt: string;
    challenge: { slug: string; title: string; points: number };
  }>;
  recentQuizAttempts: Array<{
    id: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    submittedAt: string;
    challenge: { slug: string; title: string };
  }>;
};

function ProgressPage() {
  const [progress, setProgress] = useState<LearningProgress | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<LearningProgress>('/api/learning/progress')
      .then((data) => {
        if (active) {
          setProgress(data);
        }
      })
      .catch((requestError: unknown) => {
        if (active) {
          setError(requestError instanceof Error ? requestError.message : 'Unable to load learning progress.');
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

  return (
    <section className="learning-page">
      <SectionCode>[ LEARNING PROGRESS ]</SectionCode>
      <h1>My progress</h1>
      {loading && <p role="status">Loading your learning progress...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {progress && (
        <>
          <div className="progress-stats">
            <article className="learning-card"><span>POINTS EARNED</span><strong>{progress.points}</strong></article>
            <article className="learning-card"><span>CHALLENGES SOLVED</span><strong>{progress.solvedChallenges}</strong></article>
            <article className="learning-card"><span>CHALLENGES ATTEMPTED</span><strong>{progress.attemptedChallenges}</strong></article>
            <article className="learning-card"><span>HINTS REVEALED</span><strong>{progress.hintsRevealed}</strong></article>
          </div>
          <section className="learning-card">
            <h2>Solved challenges</h2>
            {progress.solved.length === 0
              ? <p className="learning-empty">Solve a challenge to see it here.</p>
              : progress.solved.map((solve) => (
                <p className="progress-row" key={solve.challenge.slug}>
                  <Link to={`/challenges/${solve.challenge.slug}`}>{solve.challenge.title}</Link>
                  <span>{solve.pointsAwarded}/{solve.challenge.points} points · {new Date(solve.solvedAt).toLocaleDateString()}</span>
                </p>
              ))}
          </section>
          <section className="learning-card">
            <h2>Recent knowledge checks</h2>
            {progress.recentQuizAttempts.length === 0
              ? <p className="learning-empty">Complete a knowledge check to see your results here.</p>
              : progress.recentQuizAttempts.map((attempt) => (
                <p className="progress-row" key={attempt.id}>
                  <Link to={`/challenges/${attempt.challenge.slug}`}>{attempt.challenge.title}</Link>
                  <span>{attempt.score}/{attempt.totalQuestions} · {attempt.percentage}% · {new Date(attempt.submittedAt).toLocaleDateString()}</span>
                </p>
              ))}
          </section>
        </>
      )}
    </section>
  );
}

type LeaderboardEntry = {
  rank: number;
  username: string;
  points: number;
  solvedChallenges: number;
  categoryProgress: Array<{ slug: string; name: string; solved: number; total: number; completed: boolean }>;
  badges: string[];
};

function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    apiRequest<{ leaderboard: LeaderboardEntry[]; pagination: { totalPages: number } }>(`/api/leaderboard?page=${page}&limit=20`)
      .then((data) => {
        if (active) {
          setEntries(data.leaderboard);
          setTotalPages(data.pagination.totalPages);
        }
      })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load leaderboard.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [page]);

  return (
    <section className="learning-page">
      <SectionCode>[ GLOBAL STANDINGS ]</SectionCode>
      <h1>Leaderboard</h1>
      <p className="learning-intro">Points and solves are calculated from recorded challenge completions. Ties share rank; username order is stable for display.</p>
      {loading && <p role="status">Loading leaderboard...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && entries.length === 0 && <p className="learning-empty">No recorded challenge solves yet.</p>}
      {entries.map((entry) => (
        <article className="learning-card leaderboard-row" key={`${entry.rank}-${entry.username}`}>
          <strong>#{entry.rank}</strong>
          <div><h2>{entry.username}</h2><p>{entry.solvedChallenges} solved · {entry.points} points</p>
            {entry.badges.length > 0 && <p className="leaderboard-badges">{entry.badges.map((badge) => badge.replace('category-complete:', 'Completed: ')).join(' · ')}</p>}
            <p className="learning-muted">{entry.categoryProgress.map((category) => `${category.name} ${category.solved}/${category.total}`).join(' · ') || 'No published categories'}</p>
          </div>
        </article>
      ))}
      {!loading && totalPages > 1 && <div className="pagination-controls">
        <button className="button button-secondary" type="button" disabled={page <= 1} onClick={() => setPage((current) => current - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button className="button button-secondary" type="button" disabled={page >= totalPages} onClick={() => setPage((current) => current + 1)}>Next</button>
      </div>}
    </section>
  );
}

type StudentAnalytics = {
  challengesStarted: number;
  challengesSolved: number;
  hintsRevealed: number;
  quizAttempts: number;
  quizAveragePercentage: number | null;
  categories: Array<{ slug: string; name: string; solved: number; total: number }>;
};

function AnalyticsPage() {
  const [analytics, setAnalytics] = useState<StudentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiRequest<StudentAnalytics>('/api/learning/analytics')
      .then((data) => { if (active) setAnalytics(data); })
      .catch((requestError: unknown) => { if (active) setError(requestError instanceof Error ? requestError.message : 'Unable to load analytics.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);
  return (
    <section className="learning-page">
      <SectionCode>[ LEARNING ANALYTICS ]</SectionCode>
      <h1>Your learning report</h1>
      <p className="learning-intro">Metrics are calculated from your recorded attempts, solves, hints and quiz submissions.</p>
      {loading && <p role="status">Loading your analytics...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {analytics && (
        <>
          <div className="progress-stats">
            <article className="learning-card"><span>STARTED</span><strong>{analytics.challengesStarted}</strong></article>
            <article className="learning-card"><span>SOLVED</span><strong>{analytics.challengesSolved}</strong></article>
            <article className="learning-card"><span>HINTS REVEALED</span><strong>{analytics.hintsRevealed}</strong></article>
            <article className="learning-card"><span>QUIZ AVERAGE</span><strong>{analytics.quizAveragePercentage === null ? '—' : `${analytics.quizAveragePercentage}%`}</strong></article>
          </div>
          <section className="learning-card">
            <h2>Category coverage</h2>
            {analytics.categories.length === 0 && <p className="learning-empty">No published categories are available.</p>}
            {analytics.categories.map((category) => (
              <p className="progress-row" key={category.slug}><span>{category.name}</span><strong>{category.solved}/{category.total} solved</strong></p>
            ))}
          </section>
        </>
      )}
    </section>
  );
}

type AdminOverview = {
  users: number;
  activeUsers: number;
  challenges: number;
  publishedChallenges: number;
  submissions: number;
  solves: number;
  securityEvents24Hours: number;
};
type AdminUser = { id: string; username: string; role: UserRole; isActive: boolean; createdAt: string };
type AdminChallenge = { id: string; slug: string; title: string; description: string; status: string; difficulty: string; points: number; category: { name: string; slug: string } };
type AdminChallengeContent = {
  id: string;
  slug: string;
  learningObjectives: string[];
  expectedAnswer: string;
  solutionSteps: string[];
  keyTakeaways: string[];
  rootCause: string;
  technicalExplanation: string;
  impact: string;
  conditions: string;
  secureImplementation: string;
  remediationGuidance: string;
  detectionIdeas: string;
  hints: Array<{ order: number; content: string; pointsPenalty: number }>;
};
type AdminSubmission = { id: string; result: string; submittedAt: string; user: { username: string }; challenge: { title: string; slug: string } };

function AdminPage() {
  const { user } = useAuth();
  const [overview, setOverview] = useState<AdminOverview | null>(null);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [challenges, setChallenges] = useState<AdminChallenge[]>([]);
  const [contentDraft, setContentDraft] = useState<AdminChallengeContent | null>(null);
  const [submissions, setSubmissions] = useState<AdminSubmission[]>([]);
  const [analytics, setAnalytics] = useState<Array<{ slug: string; title: string; solves: number; attempts: number; hintReveals: number; averageAttemptsPerSolve: number | null }>>([]);
  const [studentProgress, setStudentProgress] = useState<Array<{ username: string; points: number; solvedChallenges: number }>>([]);
  const [userSearch, setUserSearch] = useState('');
  const [userPage, setUserPage] = useState(1);
  const [userTotalPages, setUserTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadAdminData = async (search = userSearch, page = userPage) => {
    setError('');
    try {
      const userQuery = new URLSearchParams({ limit: '50', page: String(page) });
      if (search) userQuery.set('search', search);
      const [overviewData, userData, challengeData, submissionData, analyticsData] = await Promise.all([
        apiRequest<AdminOverview>('/api/admin/overview'),
        apiRequest<{ users: AdminUser[]; pagination: { totalPages: number } }>(`/api/admin/users?${userQuery}`),
        apiRequest<{ challenges: AdminChallenge[] }>('/api/admin/challenges?limit=50'),
        apiRequest<{ submissions: AdminSubmission[] }>('/api/admin/submissions?limit=20'),
        apiRequest<{ challenges: typeof analytics; studentProgress: typeof studentProgress }>('/api/admin/analytics'),
      ]);
      setOverview(overviewData);
      setUsers(userData.users);
      setUserTotalPages(userData.pagination.totalPages);
      setChallenges(challengeData.challenges);
      setSubmissions(submissionData.submissions);
      setAnalytics(analyticsData.challenges);
      setStudentProgress(analyticsData.studentProgress);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load admin workspace.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      void loadAdminData();
    }
  }, [user?.role]);

  const setUserActive = async (target: AdminUser) => {
    setNotice('');
    try {
      await apiRequest(`/api/admin/users/${target.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !target.isActive }),
      });
      setNotice(`Account ${target.isActive ? 'disabled' : 'enabled'}.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update account.');
    }
  };
  const setChallengeStatus = async (challenge: AdminChallenge) => {
    const status = challenge.status === 'PUBLISHED' ? 'ARCHIVED' : 'PUBLISHED';
    setNotice('');
    try {
      await apiRequest(`/api/admin/challenges/${challenge.id}/status`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status }),
      });
      setNotice(`Challenge ${status.toLowerCase()}.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to update challenge status.');
    }
  };
  const saveChallengeMetadata = async (challenge: AdminChallenge, event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const title = formData.get('title');
    const description = formData.get('description');
    if (typeof title !== 'string' || typeof description !== 'string') {
      setError('Provide a title and description.');
      return;
    }
    setNotice('');
    try {
      await apiRequest(`/api/admin/challenges/${challenge.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          description,
        }),
      });
      setNotice(`Metadata saved for ${challenge.slug}.`);
      await loadAdminData();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save challenge metadata.');
    }
  };
  const editChallengeContent = async (challenge: AdminChallenge) => {
    setError('');
    try {
      const data = await apiRequest<{ challenge: {
        id: string;
        slug: string;
        learningObjectives: string[];
        explanation: Omit<AdminChallengeContent, 'id' | 'slug' | 'learningObjectives' | 'hints'> | null;
        hints: AdminChallengeContent['hints'];
      } }>(`/api/admin/challenges/${challenge.id}/content`);
      setContentDraft({
        id: data.challenge.id,
        slug: data.challenge.slug,
        learningObjectives: data.challenge.learningObjectives,
        expectedAnswer: data.challenge.explanation?.expectedAnswer ?? '',
        solutionSteps: data.challenge.explanation?.solutionSteps ?? [],
        keyTakeaways: data.challenge.explanation?.keyTakeaways ?? [],
        rootCause: data.challenge.explanation?.rootCause ?? '',
        technicalExplanation: data.challenge.explanation?.technicalExplanation ?? '',
        impact: data.challenge.explanation?.impact ?? '',
        conditions: data.challenge.explanation?.conditions ?? '',
        secureImplementation: data.challenge.explanation?.secureImplementation ?? '',
        remediationGuidance: data.challenge.explanation?.remediationGuidance ?? '',
        detectionIdeas: data.challenge.explanation?.detectionIdeas ?? '',
        hints: data.challenge.hints,
      });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load challenge learning content.');
    }
  };
  const saveChallengeContent = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!contentDraft) return;
    const formData = new FormData(event.currentTarget);
    const text = (name: string) => {
      const value = formData.get(name);
      return typeof value === 'string' ? value : '';
    };
    const lines = (name: string) => text(name).split(/\r?\n/).map((value) => value.trim()).filter(Boolean);
    const hints = lines('hints').map((line) => {
      const [orderValue, penaltyValue, ...contentParts] = line.split('|');
      return {
        order: Number(orderValue),
        pointsPenalty: Number(penaltyValue),
        content: contentParts.join('|').trim(),
      };
    });
    if (hints.some((hint) => !Number.isInteger(hint.order)
      || !Number.isInteger(hint.pointsPenalty)
      || !hint.content)) {
      setError('Enter each hint as order | penalty points | hint text.');
      return;
    }
    setError('');
    setNotice('');
    try {
      await apiRequest(`/api/admin/challenges/${contentDraft.id}/content`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          learningObjectives: lines('learningObjectives'),
          expectedAnswer: text('expectedAnswer'),
          solutionSteps: lines('solutionSteps'),
          keyTakeaways: lines('keyTakeaways'),
          rootCause: text('rootCause'),
          technicalExplanation: text('technicalExplanation'),
          impact: text('impact'),
          conditions: text('conditions'),
          secureImplementation: text('secureImplementation'),
          remediationGuidance: text('remediationGuidance'),
          detectionIdeas: text('detectionIdeas'),
          hints,
        }),
      });
      setNotice(`Learning content saved for ${contentDraft.slug}.`);
      setContentDraft(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to save challenge learning content.');
    }
  };

  if (user?.role !== 'ADMIN') {
    return <section className="learning-page"><p className="form-error" role="alert">This workspace is restricted to administrators.</p></section>;
  }
  return (
    <section className="learning-page">
      <SectionCode>[ ADMIN WORKSPACE ]</SectionCode><h1>Platform management</h1>
      {loading && <p role="status">Loading administrative data...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {notice && <p role="status">{notice}</p>}
      {overview && <div className="progress-stats">
        <article className="learning-card"><span>USERS / ACTIVE</span><strong>{overview.users} / {overview.activeUsers}</strong></article>
        <article className="learning-card"><span>CHALLENGES / PUBLISHED</span><strong>{overview.challenges} / {overview.publishedChallenges}</strong></article>
        <article className="learning-card"><span>SUBMISSIONS</span><strong>{overview.submissions}</strong></article>
        <article className="learning-card"><span>SECURITY EVENTS · 24H</span><strong>{overview.securityEvents24Hours}</strong></article>
      </div>}
      <section className="learning-card"><h2>User accounts</h2>
        <form className="admin-search" onSubmit={(event) => { event.preventDefault(); setUserPage(1); void loadAdminData(userSearch, 1); }}>
          <label>Search username<input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} maxLength={80} /></label>
          <button className="button button-secondary" type="submit">Search</button>
        </form>
        {users.map((target) => <p className="progress-row" key={target.id}><span>{target.username} · {target.role} · {target.isActive ? 'Active' : 'Disabled'}</span>
          {target.role === 'STUDENT' && <button className="button button-secondary" type="button" onClick={() => void setUserActive(target)}>{target.isActive ? 'Disable' : 'Enable'}</button>}</p>)}
        {userTotalPages > 1 && <div className="pagination-controls">
          <button className="button button-secondary" type="button" disabled={userPage <= 1} onClick={() => { const page = userPage - 1; setUserPage(page); void loadAdminData(userSearch, page); }}>Previous</button>
          <span>Page {userPage} of {userTotalPages}</span>
          <button className="button button-secondary" type="button" disabled={userPage >= userTotalPages} onClick={() => { const page = userPage + 1; setUserPage(page); void loadAdminData(userSearch, page); }}>Next</button>
        </div>}
      </section>
      <section className="learning-card"><h2>Challenge publication</h2>
        {challenges.map((challenge) => <div className="admin-challenge-row" key={challenge.id}>
          <p className="progress-row"><span>{challenge.title} · {challenge.category.name} · {challenge.status}</span>
            <button className="button button-secondary" type="button" onClick={() => void setChallengeStatus(challenge)}>{challenge.status === 'PUBLISHED' ? 'Archive' : 'Publish'}</button></p>
          <details><summary>Edit challenge metadata</summary>
            <form className="admin-metadata-form" onSubmit={(event) => void saveChallengeMetadata(challenge, event)}>
              <label>Title<input name="title" defaultValue={challenge.title} maxLength={200} required /></label>
              <label>Description<textarea name="description" defaultValue={challenge.description} maxLength={10_000} required /></label>
              <button className="button button-secondary" type="submit">Save metadata</button>
            </form>
          </details>
          <details open={contentDraft?.id === challenge.id}>
            <summary onClick={(event) => {
              if (!contentDraft || contentDraft.id !== challenge.id) {
                event.preventDefault();
                void editChallengeContent(challenge);
              } else {
                setContentDraft(null);
              }
            }}>Edit educational answers, explanations, objectives and hints</summary>
            {contentDraft?.id === challenge.id && <form className="admin-content-form" onSubmit={(event) => void saveChallengeContent(event)}>
              <p>These are educational solutions, not CTF flags. Hints can only be changed before any learner has revealed one.</p>
              <label>Learning objectives<textarea name="learningObjectives" defaultValue={contentDraft.learningObjectives.join('\n')} required /></label>
              <label>Expected educational answer<textarea name="expectedAnswer" defaultValue={contentDraft.expectedAnswer} required /></label>
              <label>Step-by-step solution<textarea name="solutionSteps" defaultValue={contentDraft.solutionSteps.join('\n')} required /></label>
              <label>Key takeaways<textarea name="keyTakeaways" defaultValue={contentDraft.keyTakeaways.join('\n')} required /></label>
              <label>Root cause<textarea name="rootCause" defaultValue={contentDraft.rootCause} required /></label>
              <label>Technical explanation<textarea name="technicalExplanation" defaultValue={contentDraft.technicalExplanation} required /></label>
              <label>Impact<textarea name="impact" defaultValue={contentDraft.impact} required /></label>
              <label>Conditions<textarea name="conditions" defaultValue={contentDraft.conditions} required /></label>
              <label>Secure implementation<textarea name="secureImplementation" defaultValue={contentDraft.secureImplementation} required /></label>
              <label>Remediation guidance<textarea name="remediationGuidance" defaultValue={contentDraft.remediationGuidance} required /></label>
              <label>Detection ideas<textarea name="detectionIdeas" defaultValue={contentDraft.detectionIdeas} required /></label>
              <label>Hints (one per line: order | penalty points | hint text)
                <textarea name="hints" defaultValue={contentDraft.hints.map((hint) => `${hint.order} | ${hint.pointsPenalty} | ${hint.content}`).join('\n')} />
              </label>
              <button className="button button-secondary" type="submit">Save learning content</button>
            </form>}
          </details>
        </div>)}
      </section>
      <section className="learning-card"><h2>Challenge performance</h2>
        {analytics.map((challenge) => <p className="progress-row" key={challenge.slug}><span>{challenge.title}</span><span>{challenge.solves} solves · {challenge.attempts} attempts · {challenge.hintReveals} hints · {challenge.averageAttemptsPerSolve ?? '—'} avg attempts/solve</span></p>)}
      </section>
      <section className="learning-card"><h2>Student progress summaries</h2>
        {studentProgress.length === 0 && <p className="learning-empty">No active learners have recorded solves.</p>}
        {studentProgress.map((student) => <p className="progress-row" key={student.username}><span>{student.username}</span><span>{student.points} points · {student.solvedChallenges} solves</span></p>)}
      </section>
      <section className="learning-card"><h2>Recent flag submissions</h2>
        {submissions.map((submission) => <p className="progress-row" key={submission.id}><span>{submission.user.username} · {submission.challenge.title} · {submission.result}</span><span>{new Date(submission.submittedAt).toLocaleString()}</span></p>)}
      </section>
      <Link className="workspace-text-link" to="/security-events">OPEN BLUE-TEAM EVENT DASHBOARD →</Link>
    </section>
  );
}

type SecurityEventRecord = {
  id: string;
  eventType: string;
  severity: string;
  requestId: string;
  metadata: Record<string, string | number | boolean | null> | null;
  occurredAt: string;
  actor: { username: string } | null;
  target: { username: string } | null;
};
type SecurityDetection = { eventType: string; severity: string; count: number };

function SecurityEventsPage() {
  const { user } = useAuth();
  const [events, setEvents] = useState<SecurityEventRecord[]>([]);
  const [detections, setDetections] = useState<SecurityDetection[]>([]);
  const [countsBySeverity, setCountsBySeverity] = useState<Array<{ severity: string; count: number }>>([]);
  const [eventType, setEventType] = useState('');
  const [severity, setSeverity] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [loaded, setLoaded] = useState(false);

  const loadEvents = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ limit: '50' });
    if (eventType) query.set('eventType', eventType);
    if (severity) query.set('severity', severity);
    if (fromDate) query.set('from', new Date(`${fromDate}T00:00:00.000Z`).toISOString());
    if (toDate) query.set('to', new Date(`${toDate}T23:59:59.999Z`).toISOString());
    try {
      const data = await apiRequest<{
        events: SecurityEventRecord[];
        detections: SecurityDetection[];
        countsBySeverity: Array<{ severity: string; count: number }>;
      }>(`/api/admin/events?${query}`);
      setEvents(data.events);
      setDetections(data.detections);
      setCountsBySeverity(data.countsBySeverity);
      setLoaded(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to load security events.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { if (user?.role === 'ADMIN') void loadEvents(); }, [user?.role]);

  if (user?.role !== 'ADMIN') {
    return <section className="learning-page"><p className="form-error" role="alert">Security events are restricted to administrators.</p></section>;
  }
  return (
    <section className="learning-page">
      <SectionCode>[ BLUE-TEAM VIEW ]</SectionCode><h1>Security events</h1>
      <p className="learning-intro">Events omit passwords, cookies, tokens, flags, and request bodies. Records older than 90 days are automatically purged.</p>
      <form className="learning-card event-filters" onSubmit={(event) => void loadEvents(event)}>
        <label>Event type<input value={eventType} onChange={(event) => setEventType(event.target.value)} maxLength={80} /></label>
        <label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}><option value="">All</option>{['INFO', 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((value) => <option key={value}>{value}</option>)}</select></label>
        <label>From<input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} /></label>
        <label>To<input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} /></label>
        <button className="button button-primary" type="submit" disabled={loading}>{loading ? 'Loading...' : 'Apply filters'}</button>
      </form>
      {error && <p className="form-error" role="alert">{error}</p>}
      {loading && !loaded && <p role="status">Loading recent security events...</p>}
      {loaded && <section className="progress-stats" aria-label="Security event counts">
        {countsBySeverity.map((count) => <article className={`learning-card severity-${count.severity.toLowerCase()}`} key={count.severity}><span>{count.severity}</span><strong>{count.count}</strong></article>)}
      </section>}
      {detections.length > 0 && <section className="learning-card" aria-label="Detection signals">
        <h2>Detection signals · last 15 minutes</h2>
        {detections.map((detection) => <p className={`severity-${detection.severity.toLowerCase()}`} key={detection.eventType}>{detection.eventType.replaceAll('_', ' ')} · {detection.count} events · {detection.severity}</p>)}
      </section>}
      {!loading && loaded && events.length === 0 && <p className="learning-empty">No security events match these filters.</p>}
      {events.map((item) => <article className={`learning-card security-event severity-${item.severity.toLowerCase()}`} key={item.id}>
        <div className="learning-card-meta"><strong>{item.eventType.replaceAll('_', ' ')}</strong><span>{item.severity}</span></div>
        <p>{new Date(item.occurredAt).toLocaleString()} · {item.actor?.username ?? 'System'}{item.target ? ` → ${item.target.username}` : ''}</p>
        <small>Request {item.requestId}</small>
        {item.metadata && <pre>{JSON.stringify(item.metadata)}</pre>}
      </article>)}
    </section>
  );
}

function WorkspacePage() {
  const location = useLocation();
  let content: ReactNode;

  switch (location.pathname) {
    case '/dashboard':
      content = <DashboardPage />;
      break;
    case '/challenges':
      content = <ChallengeCatalogPage />;
      break;
    case '/categories':
      content = <CategoriesPage />;
      break;
    case '/progress':
      content = <ProgressPage />;
      break;
    case '/leaderboard':
      content = <LeaderboardPage />;
      break;
    case '/analytics':
      content = <AnalyticsPage />;
      break;
    case '/admin':
      content = <AdminPage />;
      break;
    case '/security-events':
      content = <SecurityEventsPage />;
      break;
    default:
      content = location.pathname.startsWith('/challenges/')
        ? <ChallengeDetailPage />
        : <ProfilePage />;
  }

  return <WorkspaceLayout>{content}</WorkspaceLayout>;
}

export default function App() {
  return (
    <AuthProvider>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<AuthPage mode="login" />} />
        <Route path="/register" element={<AuthPage mode="register" />} />
        <Route path="/dashboard" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/challenges" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/challenges/:slug" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/categories" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/leaderboard" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/analytics" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/admin" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/security-events" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
