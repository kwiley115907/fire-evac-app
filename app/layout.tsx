import type { ReactNode } from 'react';
import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
