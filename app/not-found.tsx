import Link from 'next/link';
import { NavBar } from '@/components/NavBar';
import { BrandBackdrop, BrandLogo } from '@/components/Brand';
import { Icon } from '@/components/icons';

export default function NotFound() {
  return (
    <div className="shell">
      <NavBar />
      <BrandBackdrop className="brand-lost">
        <div className="brand-lost-card glass-panel">
          <BrandLogo size={72} className="brand-lost-logo" />
          <span className="section-kicker">404 · Route blocked</span>
          <h1>Wrong turn.</h1>
          <p>This page doesn&apos;t exist, but the way out does.</p>
          <div className="hero-actions">
            <Link href="/" className="btn btn-primary">
              <Icon name="route" size={16} /> Take me home
            </Link>
            <Link href="/demo" className="btn btn-ghost">
              Live demo
            </Link>
          </div>
        </div>
      </BrandBackdrop>
    </div>
  );
}
