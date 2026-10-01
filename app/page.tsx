import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { SiteFooter } from '@/components/SiteFooter';
import { Icon, type IconName } from '@/components/icons';
import { LiveDemo } from '@/components/live/LiveDemo';
import { DrillArt, FieldArt, LifelineArt, ScanArt, StackArt } from '@/components/live/ModeArt';

const MODES = [
  {
    n: '01',
    icon: 'route' as IconName,
    title: 'Lifeline',
    art: <LifelineArt />,
    desc: 'Turn-by-turn from any room — real left/right turns from your plan geometry, a live countdown painted along the path, and a Plan B through a different exit.',
  },
  {
    n: '02',
    icon: 'flow' as IconName,
    title: 'Escape Field',
    art: <FieldArt />,
    desc: 'Every room’s way out at once. Streams thicken where the building funnels together, so bottleneck doors and slow rooms jump out before a drill ever does.',
  },
  {
    n: '03',
    icon: 'layers' as IconName,
    title: 'Floor Stack',
    art: <StackArt />,
    desc: 'An exploded, orbitable 3D view of the whole building with the route threaded down through the stairwells. Tap any room on any floor.',
  },
];

const FEATURES: { icon: IconName; title: string; desc: string }[] = [
  { icon: 'shield', title: 'Egress audit', desc: 'Flags rooms with no way out, travel distance over your limit, rooms that depend on a single exit, and how load spreads across exits.' },
  { icon: 'sparkle', title: 'AI floor-plan detection', desc: 'Upload a floor plan image and Claude drafts rooms, walls and doors for you to review before anything is saved.' },
  { icon: 'chat', title: 'Ask in plain English', desc: '“Way out of the server room?” The assistant finds the room — the routing engine draws the path. The model never invents one.' },
  { icon: 'stairs', title: 'Stair-aware, multi-floor', desc: 'Stairs and lifts link floors; anything not safe to use in an evacuation is never routed through.' },
  { icon: 'door', title: 'Doors that snap', desc: 'Click two rooms and the door lands on the wall they share. Corners snap too, so plans stay clean.' },
  { icon: 'clock', title: 'Instant, offline-fast', desc: 'Routing runs in your browser on every edit — no waiting on a server to see what a new wall does.' },
];

export default function LandingPage() {
  return (
    <div className="shell">
      <NavBar />
      <main>
        <section className="hero">
          <div className="container hero-grid">
            <div>
              <span className="eyebrow">
                <span className="pulse-dot" />
                Evacuation planning, reimagined
              </span>
              <h1>
                See every way out.
                <br />
                <span className="go">Before you need one.</span>
              </h1>
              <p className="lead">
                Draw your building once. Sentinel Grid computes the fastest escape from every room on every floor, re-plans
                instantly around fire and blocked doors, and shows it three ways no other planner can.
              </p>
              <div className="hero-actions">
                <Link href="/demo" className="btn btn-primary btn-lg">
                  <Icon name="play" size={16} /> Try the live demo
                </Link>
                <Link href="/signup" className="btn btn-ghost btn-lg">
                  Start free
                </Link>
              </div>
              <div className="hero-proof">
                <div>
                  <strong>3</strong>
                  <span>ways to see the route</span>
                </div>
                <div>
                  <strong>Live</strong>
                  <span>re-plans as you edit</span>
                </div>
                <div>
                  <strong>Plan B</strong>
                  <span>on every route</span>
                </div>
              </div>
            </div>
            <LiveDemo />
          </div>
        </section>

        <section className="section" id="views">
          <div className="container">
            <div className="section-title">
              <span className="section-kicker">Three views, one engine</span>
              <h2>Not a map with an arrow on it</h2>
              <p>Every view is drawn from the same verified shortest-path engine — switch between them in one tap.</p>
            </div>
            <div className="modes">
              {MODES.map((m) => (
                <article key={m.title} className="card mode-card">
                  <div className="mode-art">{m.art}</div>
                  <span className="mode-num">{m.n}</span>
                  <h3>
                    <Icon name={m.icon} size={18} /> {m.title}
                  </h3>
                  <p>{m.desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container split">
            <div>
              <span className="section-kicker">Drill mode</span>
              <h2>Drop a fire. Watch the building re-route itself.</h2>
              <p>
                Tap a room to set it alight, or block a door or stairwell. Every route in the building is re-planned on the
                spot — and anyone already following a route gets told exactly where they’re going instead.
              </p>
              <ul className="ticks">
                <li>
                  <Icon name="check" size={18} /> Burning rooms are never routed through — but you can always get out of one
                </li>
                <li>
                  <Icon name="check" size={18} /> Rooms beside a fire are treated as smoke-logged and avoided when there’s a better way
                </li>
                <li>
                  <Icon name="check" size={18} /> “No Plan B” warnings show where one lost exit traps people
                </li>
              </ul>
            </div>
            <div className="card drill-art">
              <DrillArt />
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container split">
            <div className="card drill-art">
              <ScanArt />
            </div>
            <div>
              <span className="section-kicker">AR Scan</span>
              <h2>Film the route. Get it in 3D.</h2>
              <p>
                Walk an escape route holding your phone like you&apos;re filming it. AR Scan tracks every step, turn and flight of
                stairs, rebuilds the walk in 3D, and pins it onto your plan right next to the computed way out.
              </p>
              <ul className="ticks">
                <li>
                  <Icon name="check" size={18} /> Works on any phone: the camera films while motion sensors count steps and turns
                </li>
                <li>
                  <Icon name="check" size={18} /> Precise AR mode on ARCore phones paints a live trail on the floor and captures stairs automatically
                </li>
                <li>
                  <Icon name="check" size={18} /> Replay the walk with its video, then see it threaded through the Floor Stack
                </li>
              </ul>
              <div className="hero-actions" style={{ marginTop: '1.5rem' }}>
                <Link href="/demo?scan=1" className="btn btn-primary">
                  <Icon name="camera" size={16} /> Try AR Scan
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="section">
          <div className="container">
            <div className="section-title">
              <span className="section-kicker">Built for real buildings</span>
              <h2>A graph of rooms, doors and stairs — not a drawing</h2>
            </div>
            <div className="feature-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="card feature-card">
                  <div className="feature-icon">
                    <Icon name={f.icon} size={20} />
                  </div>
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container">
          <div className="cta-band">
            <h2>Your building’s way out, mapped tonight.</h2>
            <p>Free to start. No credit card. Your plans stay private to your account.</p>
            <div className="hero-actions">
              <Link href="/signup" className="btn btn-primary btn-lg">
                Start planning free
              </Link>
              <Link href="/demo" className="btn btn-ghost btn-lg">
                Explore the demo
              </Link>
            </div>
          </div>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}
