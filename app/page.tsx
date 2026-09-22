import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';

const DEMO_GRID = [
  '..........WW',
  '..RRRR....WW',
  '..R..R....WW',
  'SR..R..DDD.W',
  '..R..R....EE',
  '..RRRR....EE',
  '..........WW',
].join('');

function DemoGrid() {
  const cells = DEMO_GRID.split('');
  return (
    <div className="route-demo-grid">
      {cells.map((c, i) => {
        let cls = 'cell';
        if (c === 'W') cls += ' wall';
        if (c === 'R' || c === 'D') cls += ' path';
        if (c === 'E') cls += ' exit';
        if (c === 'S') cls += ' start';
        return <div key={i} className={cls} />;
      })}
    </div>
  );
}

const FEATURES = [
  {
    icon: '🧭',
    title: 'Dijkstra-verified routing',
    desc: 'Every route is computed by a tested, multi-floor shortest-path engine over your real room graph — never guessed by AI.',
  },
  {
    icon: '🛰️',
    title: 'AI floor-plan detection',
    desc: 'Upload a floor plan image and Claude drafts rooms, walls, and doors for you to review and adjust before saving.',
  },
  {
    icon: '💬',
    title: 'Natural-language assistant',
    desc: '"Nearest exit from the server room?" — the assistant resolves the room and hands off to the real routing engine.',
  },
  {
    icon: '🏢',
    title: 'Multi-floor aware',
    desc: 'Stairwells and elevators connect floors with configurable evacuation-safety, so unsafe elevators are never routed through.',
  },
  {
    icon: '🔒',
    title: 'Private by default',
    desc: 'Every building is row-level-security scoped to your account in Postgres — not just filtered in application code.',
  },
  {
    icon: '⚡',
    title: 'Instant recompute',
    desc: 'Move a wall, add a door, or mark a new exit — click anywhere on the plan and see the updated route immediately.',
  },
];

export default function LandingPage() {
  return (
    <div className="shell">
      <NavBar />
      <main>
        <section className="hero">
          <div className="container">
            <span className="eyebrow">
              <span className="pulse-dot" />
              Real-time evacuation intelligence
            </span>
            <h1>
              Plan the fastest way out,
              <br />
              <span className="accent">verified, not vibes.</span>
            </h1>
            <p className="lead">
              Sentinel Grid pairs a tested multi-floor routing engine with AI floor-plan
              detection and a conversational assistant — so every evacuation route is both
              smart and provably correct.
            </p>
            <div className="hero-actions">
              <Link href="/signup" className="btn btn-primary">
                Start planning free
              </Link>
              <Link href="/login" className="btn btn-ghost">
                Sign in
              </Link>
            </div>

            <div className="hero-visual glass-panel">
              <DemoGrid />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-title">
              <h2>Built for how buildings actually work</h2>
              <p>Not a pixel painter. A real graph of rooms, doors, stairs, and exits.</p>
            </div>
            <div className="feature-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feature-card glass-panel">
                  <div className="feature-icon">{f.icon}</div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
