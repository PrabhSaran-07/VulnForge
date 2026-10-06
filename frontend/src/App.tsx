import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom';

const navItems = [
  { label: 'About', href: '#about' },
  { label: 'How It Works', href: '#how-it-works' },
  { label: 'Labs', href: '#labs' },
  { label: 'Features', href: '#features' },
];

const labCards = [
  'Authentication',
  'Access Control',
  'Injection',
  'Session Security',
  'File Upload',
  'API Security',
  'Configuration Security',
  'Logging & Detection',
];

const workflowSteps = [
  'Choose a challenge',
  'Explore the application',
  'Identify the vulnerability',
  'Capture the flag',
  'Submit the flag',
  'Learn why it worked',
  'Learn how to fix it',
  'Understand how to detect it',
];

const audiences = [
  'Cybersecurity students',
  'Ethical hacking learners',
  'Web developers',
  'Security enthusiasts',
  'Students preparing for CTFs',
];

const featureList = [
  'Interactive CTF challenges',
  'Hints',
  'Flags',
  'Scoring',
  'Leaderboard',
  'Progress tracking',
  'Vulnerability explanations',
  'Remediation guidance',
  'Security logs',
  'Detection',
  'Isolated challenge environments',
];

function ScrollToTop() {
  const { pathname } = useLocation();

  return <div key={pathname} />;
}

function ComingSoonPage({ title, description }: { title: string; description: string }) {
  return (
    <div className="page-shell min-h-screen px-6 py-24 text-slate-100">
      <div className="mx-auto max-w-3xl rounded-3xl border border-slate-700 bg-slate-900/80 p-10 shadow-[0_0_40px_rgba(14,165,233,0.15)]">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">Future module</p>
        <h1 className="text-4xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
        <p className="mt-6 text-lg text-slate-300">{description}</p>
        <div className="mt-8 flex flex-wrap gap-4">
          <Link to="/" className="inline-flex items-center rounded-full bg-cyan-400 px-5 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
            Return home
          </Link>
        </div>
      </div>
    </div>
  );
}

function LandingPage() {
  return (
    <div className="page-shell text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 sm:px-6 lg:px-8" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-3 text-lg font-bold tracking-[0.16em] text-white" aria-label="VULNFORGE home">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-cyan-400/60 bg-cyan-400/10 text-sm font-black text-cyan-300">V</span>
            VULNFORGE
          </Link>

          <div className="hidden items-center gap-8 text-sm text-slate-300 md:flex">
            {navItems.map((item) => (
              <a key={item.label} href={item.href} className="transition hover:text-cyan-300">
                {item.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="hidden rounded-full border border-slate-700 px-4 py-2 text-sm font-medium text-slate-200 transition hover:border-cyan-400 hover:text-cyan-300 sm:inline-flex">
              Login
            </Link>
            <a href="#platform" className="inline-flex items-center rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
              Get Started
            </a>
          </div>
        </nav>
      </header>

      <main>
        <section id="platform" className="relative overflow-hidden">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(59,130,246,0.12),_transparent_30%)]" aria-hidden="true" />
          <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-20 sm:px-6 lg:grid-cols-[1.2fr_0.8fr] lg:px-8 lg:py-28">
            <div>
              <p className="mb-5 inline-flex items-center rounded-full border border-cyan-500/40 bg-cyan-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-cyan-300">
                Cybersecurity learning platform
              </p>
              <h1 className="max-w-2xl text-5xl font-black tracking-tight text-white md:text-6xl">
                VULNFORGE
                <span className="mt-3 block text-2xl font-medium tracking-[0.12em] text-cyan-300 md:text-3xl">
                  Build. Break. Defend.
                </span>
              </h1>
              <p className="mt-6 max-w-xl text-lg leading-8 text-slate-300">
                Learn cybersecurity by interacting with controlled, intentionally vulnerable applications, discovering flaws, solving hands-on challenges, and understanding how to secure systems the right way.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <a href="#about" className="inline-flex items-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                  Explore VULNFORGE
                </a>
                <Link to="/register" className="inline-flex items-center rounded-full border border-slate-700 bg-slate-900/70 px-6 py-3 text-sm font-semibold text-white transition hover:border-cyan-400 hover:text-cyan-300">
                  Start Learning
                </Link>
              </div>
              <div className="mt-10 flex flex-wrap gap-6 text-sm text-slate-300">
                <div>
                  <div className="text-2xl font-bold text-white">Hands-on</div>
                  <div>Practical learning</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">CTF Ready</div>
                  <div>Challenge driven</div>
                </div>
                <div>
                  <div className="text-2xl font-bold text-white">Secure by design</div>
                  <div>Defensive focus</div>
                </div>
              </div>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="relative w-full max-w-md rounded-3xl border border-slate-700 bg-slate-900/80 p-6 shadow-[0_0_40px_rgba(34,211,238,0.1)]">
                <div className="mb-6 flex items-center justify-between">
                  <span className="text-sm font-medium uppercase tracking-[0.24em] text-cyan-300">Security status</span>
                  <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-300">Operational</span>
                </div>
                <div className="space-y-4">
                  {[
                    ['Learning path', 'Web app security fundamentals'],
                    ['Challenge labs', 'Application and API security'],
                    ['Detection', 'Logs, monitoring, and remediation'],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-2xl border border-slate-800 bg-slate-950/80 p-4">
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-400">{label}</div>
                      <div className="mt-2 text-base font-semibold text-white">{value}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="about" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-3xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">What is VULNFORGE?</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Learn cybersecurity through practice.</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              'Learn cybersecurity through practice',
              'Explore intentionally vulnerable applications',
              'Discover vulnerabilities and understand their impact',
              'Submit flags, earn points, and study remediation',
            ].map((item) => (
              <article key={item} className="rounded-3xl border border-slate-800 bg-slate-900/60 p-6 shadow-[0_0_30px_rgba(15,23,42,0.45)]">
                <div className="mb-4 h-10 w-10 rounded-xl bg-cyan-400/10 ring-1 ring-cyan-400/30" aria-hidden="true" />
                <p className="text-lg font-semibold text-white">{item}</p>
              </article>
            ))}
          </div>
        </section>

        <section id="how-it-works" className="border-y border-slate-800 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">How it works</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">A structured learning workflow.</h2>
            </div>

            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
              {workflowSteps.map((step, index) => (
                <div key={step} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-5">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-cyan-400/10 text-sm font-bold text-cyan-300 ring-1 ring-cyan-400/30">
                    {index + 1}
                  </div>
                  <p className="text-base font-medium text-slate-100">{step}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="labs" className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Security labs</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Future learning categories.</h2>
          </div>

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {labCards.map((card) => (
              <article key={card} className="rounded-3xl border border-slate-800 bg-slate-900/70 p-6 transition hover:-translate-y-1 hover:border-cyan-400/40 hover:shadow-[0_0_25px_rgba(34,211,238,0.12)]">
                <div className="mb-4 h-12 w-12 rounded-2xl bg-gradient-to-br from-cyan-500/25 to-blue-500/10 ring-1 ring-cyan-400/30" aria-hidden="true" />
                <h3 className="text-xl font-semibold text-white">{card}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">
                  Learners will eventually study how this issue is discovered, exploited, and remediated in a secure environment.
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-y border-slate-800 bg-slate-950/80">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Why VULNFORGE?</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Built to make security learning practical and memorable.</h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-3">
              {[
                'Hands-on learning',
                'Controlled vulnerable environments',
                'CTF-based learning',
                'Real-world security concepts',
                'Secure coding knowledge',
                'Offensive + defensive security',
                'Progress tracking',
                'Explanations and remediation',
                'Safe experimentation',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-slate-200">
                  {item}
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="rounded-[2rem] border border-cyan-500/30 bg-gradient-to-br from-slate-900 via-slate-900 to-slate-950 p-8 md:p-12">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Build. Break. Defend.</p>
            <div className="mt-8 grid gap-8 lg:grid-cols-3">
              {[
                ['Build', 'Understand how secure web applications are created, structured, and maintained.'],
                ['Break', 'Learn how vulnerabilities are discovered and exploited in controlled environments.'],
                ['Defend', 'Study remediation, detection, monitoring, and secure coding practices.'],
              ].map(([title, text]) => (
                <div key={title} className="rounded-3xl border border-slate-800 bg-slate-950/70 p-6">
                  <h3 className="text-2xl font-bold text-white">{title}</h3>
                  <p className="mt-4 text-base leading-7 text-slate-300">{text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="border-y border-slate-800 bg-slate-900/60">
          <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
            <div className="mb-12 max-w-2xl">
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Features</p>
              <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">A platform built for structured security training.</h2>
            </div>

            <ul className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {featureList.map((feature) => (
                <li key={feature} className="rounded-2xl border border-slate-800 bg-slate-950/70 p-5 text-slate-200">
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6 lg:px-8">
          <div className="mb-12 max-w-2xl">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Who is it for?</p>
            <h2 className="mt-4 text-3xl font-black tracking-tight text-white md:text-4xl">Built for learners who want to understand security in context.</h2>
          </div>

          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
            {audiences.map((audience) => (
              <div key={audience} className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 text-center text-slate-200">
                {audience}
              </div>
            ))}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
          <div className=" rounded-[2rem] border border-cyan-500/25 bg-slate-900/80 px-6 py-16 text-center md:px-12">
            <p className="text-sm font-semibold uppercase tracking-[0.28em] text-cyan-300">Ready to learn?</p>
            <h2 className="mt-6 text-3xl font-black tracking-tight text-white md:text-5xl">Ready to learn by breaking things?</h2>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-300">
              Explore cybersecurity the way it is meant to be learned — hands-on, practical, and rooted in real-world security thinking.
            </p>
            <div className="mt-8 flex justify-center gap-4">
              <Link to="/register" className="inline-flex items-center rounded-full bg-cyan-400 px-6 py-3 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300">
                Start Learning
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-slate-800 bg-slate-950/80">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 lg:grid-cols-[1.2fr_0.9fr_0.9fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3 text-lg font-bold tracking-[0.16em] text-white">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-cyan-400/60 bg-cyan-400/10 text-sm font-black text-cyan-300">V</span>
              VULNFORGE
            </div>
            <p className="mt-4 max-w-sm text-sm leading-7 text-slate-300">
              A cybersecurity learning platform designed to help students build technical understanding by exploring vulnerabilities in controlled environments.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Navigation</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {navItems.map((item) => (
                <li key={item.label}>
                  <a href={item.href} className="transition hover:text-cyan-300">
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold uppercase tracking-[0.24em] text-slate-400">Labs</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-300">
              {labCards.slice(0, 5).map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-800 px-4 py-5 text-center text-xs text-slate-400 sm:px-6 lg:px-8">
          <p>© 2026 VULNFORGE. Project status: Module 1 — Foundation and landing page.</p>
        </div>
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/login" element={<ComingSoonPage title="Login" description="Authentication will be introduced in a future module. This placeholder page helps keep the product structure ready for upcoming user flows." />} />
        <Route path="/register" element={<ComingSoonPage title="Register" description="Registration flows are planned for a later module. The platform foundation is being prepared now to support them cleanly." />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}
