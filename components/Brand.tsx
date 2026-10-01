import type { ReactNode } from 'react';
import Image from 'next/image';
import banner from '@/assets/brand/sentinel-grid-banner.webp';
import logo from '@/assets/brand/sg-logo.png';

export const BANNER_ALT =
  'Sentinel Grid: a sentinel stands guard over a glowing building grid, with green exit signs and evacuation routes leading out';

/** The SG hex badge. */
export function BrandLogo({ size = 30, className = 'brand-mark' }: { size?: number; className?: string }) {
  return <Image src={logo} alt="" width={size} height={size} className={className} />;
}

/** "SENTINEL GRID" set in Orbitron, coloured like the banner title. */
export function BrandWordmark() {
  return (
    <span className="brand-word">
      <span className="brand-word-a">Sentinel</span> <span className="brand-word-b">Grid</span>
    </span>
  );
}

// The key art, full-bleed at the top of the landing page. The frame keeps
// the art's 16:9 shape and never grows taller than the first screen, so on
// wide screens it sits on a blurred copy of itself instead of cropping off
// the SG logo or the "you are here" marker.
export function BrandBanner() {
  return (
    <section className="brand-banner">
      <div className="brand-banner-frame">
        <Image src={banner} alt={BANNER_ALT} fill preload placeholder="blur" sizes="100vw" className="brand-banner-img" />
      </div>
    </section>
  );
}

/** Full-height page area with the banner dimmed behind its content. */
export function BrandBackdrop({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <main className={`brand-backdrop ${className}`.trim()}>{children}</main>;
}

/** Loading screen: the SG badge breathing over the dimmed banner. */
export function BrandSplash({ label }: { label: string }) {
  return (
    <BrandBackdrop className="brand-splash">
      <div className="brand-splash-inner" role="status" aria-live="polite">
        <BrandLogo size={96} className="brand-splash-logo" />
        <span className="brand-splash-label">
          <span className="spinner" /> {label}
        </span>
      </div>
    </BrandBackdrop>
  );
}
