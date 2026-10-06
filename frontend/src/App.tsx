import { Fragment, type ReactNode } from 'react';

type IconName = 'overview' | 'surface' | 'journey' | 'zones' | 'enter';

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

function Icon({ name }: { name: IconName }) {
  const paths: Record<IconName, React.ReactNode> = {
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

function Header() {
  return (
    <header className="site-header">
      <a className="brand" href="#hero" aria-label="VULNFORGE home">
        <span className="brand-mark" aria-hidden="true" />
        <span className="brand-name">VULNFORGE</span>
        <span className="brand-tagline">BUILD. BREAK. DEFEND.</span>
      </a>
      <div className="header-actions">
        <span className="header-status">PLATFORM: MODULE 01</span>
        <a className="header-enter" href="#enter">EXPLORE <span aria-hidden="true">↗</span></a>
      </div>
    </header>
  );
}

function SectionCode({ children, tone = 'amber' }: { children: ReactNode; tone?: string }) {
  return <span className={`section-code tone-${tone}`}>{children}</span>;
}

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
          <a className="button button-primary" href="#attack-surface">EXPLORE THE SURFACE <span aria-hidden="true">→</span></a>
          <a className="button button-secondary" href="#journey">EXPLORE THE LEARNING PATH</a>
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
    { label: 'DATA LAYER', index: 'STORE 04', name: 'DATA BOUNDARY', detail: 'ACCESS: RESTRICTED', icon: '▤', tone: 'green' },
  ];

  return (
    <section className="surface-section section-frame" id="attack-surface">
      <div className="content-column section-stack">
        <div className="section-heading">
          <SectionCode>[ ATTACK SURFACE ARCHITECTURE ]</SectionCode>
          <h2>Every system has a surface.</h2>
          <p>Security issues often emerge where assumptions meet: untrusted input crosses a boundary, identity checks drift from access policy, or data reaches a place it shouldn’t.</p>
        </div>

        <div className="architecture-panel">
          <div className="panel-heading">
            <span><i className="status-indicator" /> SYSTEM EXECUTION PIPELINE</span>
            <span className="panel-meta">ILLUSTRATIVE MODEL // 04 NODES</span>
          </div>
          <div className="pipeline">
            {nodes.map((node, index) => (
              <Fragment key={node.index}>
                <article className={`pipeline-node node-${node.tone}`}>
                  <div className="node-label"><span>{node.label}</span><span>{node.index}</span></div>
                  <div className="node-name"><strong>{node.name}</strong><span aria-hidden="true">{node.icon}</span></div>
                  <div className="node-detail">{node.detail}</div>
                  {node.tone === 'red' && <span className="flaw-label">RISK SURFACE</span>}
                </article>
                {index < nodes.length - 1 && <span className="pipeline-arrow" aria-hidden="true">→</span>}
              </Fragment>
            ))}
          </div>
          <div className="boundary-note">
            <span><span aria-hidden="true">⌑</span> [TRUST BOUNDARY] Every transition needs an explicit security decision.</span>
            <span className="boundary-state">MODEL: EDUCATIONAL</span>
          </div>
        </div>
      </div>
    </section>
  );
}

function DiscoveryVisual() {
  return (
    <div className="discovery-visual" role="img" aria-label="Illustration of a circuit board with a highlighted trust boundary">
      <div className="board-grid" />
      <svg className="board-traces" viewBox="0 0 900 320" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M0 72h160l42 42h140l37-37h105" />
          <path d="M0 160h115l44-44h103l35 35h138l40-40h110" />
          <path d="M900 73H760l-41 41H588l-34 34H426" />
          <path d="M900 190H764l-50-50H603l-41 41H477" />
          <path d="M107 0v53l40 40v49m129 178v-69l-35-35m448 104v-61l38-38" />
        </g>
        <g fill="currentColor">
          <circle cx="160" cy="72" r="5" /><circle cx="484" cy="77" r="5" />
          <circle cx="760" cy="73" r="5" /><circle cx="115" cy="160" r="5" />
          <circle cx="764" cy="190" r="5" /><circle cx="276" cy="142" r="5" />
        </g>
        <g className="board-chip">
          <rect x="355" y="97" width="190" height="126" rx="5" />
          <rect x="380" y="119" width="140" height="82" rx="2" />
          <path d="M401 145h98m-98 28h98" />
          <path d="M342 116h13m-13 22h13m-13 22h13m-13 22h13m190-64h13m-13 22h13m-13 22h13m-13 22h13" />
        </g>
      </svg>
      <div className="visual-badges">
        <span>SYSTEM / 07 // SURFACE: ANALYZING</span>
        <span>REQUEST: OBSERVED</span>
        <strong>BOUNDARY CHECK: IN PROGRESS</strong>
      </div>
      <div className="visual-caption"><span>ARCHITECTURE STUDY: TRUST FLOW</span><span>OBSERVATION: FIRST STEP</span></div>
    </div>
  );
}

function LearningJourney() {
  return (
    <section className="journey-section section-frame" id="journey">
      <div className="content-column journey-stack">
        <article className="journey-act">
          <div className="act-meta"><SectionCode>[ 01 // DISCOVERY ]</SectionCode><span>VECTOR: OBSERVATION</span></div>
          <h2>Curiosity finds the first crack.</h2>
          <p>Every investigation starts with careful observation: an unexpected response, a confusing permission boundary, or behavior that doesn’t match the system’s rules.</p>
          <DiscoveryVisual />
        </article>

        <article className="journey-act">
          <div className="act-meta"><SectionCode tone="red">[ 02 // VULNERABILITY ]</SectionCode><span className="tone-red">INVARIANT: UNDER REVIEW</span></div>
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
            <pre><code><i>// Validate identity and policy before data access</i>{'\n'}if (!policy.allows(subject, resource)) {'{'}{'\n'}  return deny("access_not_permitted");{'\n'}{'}'}{'\n'}return read(resource);</code></pre>
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
          <a className="button button-primary" href="#attack-surface">EXPLORE VULNFORGE <span aria-hidden="true">→</span></a>
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
  const items: { label: string; href: string; icon: IconName }[] = [
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

export default function App() {
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
