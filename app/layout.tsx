import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import localFont from 'next/font/local';
import './globals.css';

// Orbitron Black, the face of the Sentinel Grid wordmark on the banner.
// Only the navbar wordmark and a few brand headings use it.
const orbitron = localFont({
  src: './fonts/orbitron-black-latin.woff2',
  weight: '900',
  display: 'swap',
  variable: '--font-brand',
});

export const metadata: Metadata = {
  metadataBase: new URL('https://evacuate.today'),
  title: 'Sentinel Grid — See every way out',
  description:
    'Evacuation route planning with live re-routing around fire, a whole-building escape flow map, a 3D floor stack, and turn-by-turn guidance with a Plan B.',
};

export const viewport: Viewport = {
  themeColor: '#070a0f',
  colorScheme: 'dark',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={orbitron.variable}>
      <body>{children}</body>
    </html>
  );
}
