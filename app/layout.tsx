import type { ReactNode } from 'react';
import './globals.css';

export const metadata = {
  title: 'Sentinel Grid — AI Fire Evacuation Planning',
  description: 'Multi-floor evacuation route planning with AI floor-plan detection and a real-time routing assistant.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
