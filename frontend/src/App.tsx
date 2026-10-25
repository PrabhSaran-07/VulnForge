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
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { ApiError, apiRequest } from './api';

type UserRole = 'STUDENT' | 'ADMIN';

type AuthUser = {
  id: string;
  username: string;
  email: string;
  role: UserRole;
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
  { path: '/profile', label: 'Profile', short: 'AC' },
];

function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [logoutError, setLogoutError] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const location = useLocation();

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
              className={`workspace-nav-link${location.pathname === item.path ? ' active' : ''}`}
              to={item.path}
              aria-current={location.pathname === item.path ? 'page' : undefined}
            >
              <span className="workspace-nav-icon" aria-hidden="true">{item.short}</span>
              <span>{item.label}</span>
            </Link>
          ))}
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
            className={`workspace-mobile-link${location.pathname === item.path ? ' active' : ''}`}
            to={item.path}
            aria-current={location.pathname === item.path ? 'page' : undefined}
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

  return (
    <>
      <section className="workspace-welcome">
        <SectionCode>[ STUDENT DASHBOARD ]</SectionCode>
        <h1>Welcome, {user?.username}</h1>
        <p>Your learning workspace is ready. Explore planned learning areas below; activity and progress tracking are not available yet.</p>
        <div className="workspace-quick-links">
          <Link className="button button-primary" to="/challenges">EXPLORE CHALLENGES <span aria-hidden="true">→</span></Link>
          <Link className="button button-secondary" to="/categories">BROWSE CATEGORIES</Link>
        </div>
      </section>

      <section className="workspace-stats" aria-label="Learning summary">
        {[
          ['POINTS', 'Not available', 'Points are not tracked yet'],
          ['CHALLENGES SOLVED', 'Not available', 'Challenge solving is planned for Module 4'],
          ['CHALLENGES ATTEMPTED', 'Not available', 'Challenge attempts are planned for Module 4'],
          ['OVERALL PROGRESS', 'Not available', 'Progress tracking planned'],
        ].map(([label, value, note]) => (
          <article className="workspace-stat-card" key={label}>
            <span className="workspace-stat-label">{label}</span>
            <strong>{value}</strong>
            <p>{note}</p>
          </article>
        ))}
      </section>

      <section className="workspace-panel workspace-next">
        <div>
          <SectionCode>[ NEXT STEP ]</SectionCode>
          <h2>Explore the learning areas</h2>
          <p>Explore planned challenges and security learning categories. Challenge solving and progress tracking are not available yet.</p>
        </div>
        <div className="workspace-next-links">
          <Link className="workspace-text-link" to="/challenges">VIEW CHALLENGES <span aria-hidden="true">→</span></Link>
          <Link className="workspace-text-link" to="/categories">VIEW CATEGORIES <span aria-hidden="true">→</span></Link>
        </div>
      </section>
    </>
  );
}

function WorkspacePlaceholder({ section }: { section: 'Challenges' | 'Categories' | 'My Progress' }) {
  const copy = {
    Challenges: {
      code: 'CHALLENGE CATALOGUE',
      description: 'Challenge browsing, attempts, and submissions are planned for a later module. No challenges are available to launch yet.',
    },
    Categories: {
      code: 'LEARNING CATEGORIES',
      description: 'Security learning categories are planned. Category content will appear here when the catalogue is implemented.',
    },
    'My Progress': {
      code: 'LEARNING PROGRESS',
      description: 'Progress summaries will be based on real challenge activity. Tracking is not available yet, so no statistics are shown.',
    },
  }[section];

  return (
    <section className="workspace-placeholder">
      <SectionCode>[ {copy.code} ]</SectionCode>
      <h1>{section}</h1>
      <p>{copy.description}</p>
      <span className="workspace-planned-badge"><span className="signal-dot" /> PLANNED — NOT AVAILABLE YET</span>
      <Link className="workspace-text-link" to="/dashboard">← BACK TO DASHBOARD</Link>
    </section>
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

function WorkspacePage() {
  const location = useLocation();
  let content: ReactNode;

  switch (location.pathname) {
    case '/dashboard':
      content = <DashboardPage />;
      break;
    case '/challenges':
      content = <WorkspacePlaceholder section="Challenges" />;
      break;
    case '/categories':
      content = <WorkspacePlaceholder section="Categories" />;
      break;
    case '/progress':
      content = <WorkspacePlaceholder section="My Progress" />;
      break;
    default:
      content = <ProfilePage />;
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
        <Route path="/categories" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/progress" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><WorkspacePage /></ProtectedRoute>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AuthProvider>
  );
}
