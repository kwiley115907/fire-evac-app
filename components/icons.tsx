import type { SVGProps } from 'react';

// Hand-drawn 24px stroke icon set — no icon-font or library dependency.
const PATHS = {
  select: 'M5 3l13 7.5-5.6 1.4L9.8 18z',
  room: 'M4 5h16v14H4zM4 12h7M11 12v7',
  wall: 'M4 20L20 4M4 20h3M20 4v3',
  door: 'M6 21V4.5L14 3v18M14 21h4V5h-4M11 12h.01',
  stairs: 'M4 20h4v-4h4v-4h4V8h4',
  fire: 'M12 21c-3.9 0-6.5-2.6-6.5-6.2 0-3.1 2.2-5.1 3.4-6.9.4 1.6 1.3 2.6 2.2 3.1C11 7.6 12.4 4.8 15 3c-.4 3 .9 4.8 2.1 6.6 1 1.4 1.4 3 1.4 4.6 0 4-2.6 6.8-6.5 6.8zM12 21c-1.6 0-2.8-1.2-2.8-2.9 0-1.6 1.2-2.5 2.1-3.7.6 1.1 3.5 1.9 3.5 3.9 0 1.6-1.2 2.7-2.8 2.7z',
  route: 'M5 19a2 2 0 1 0 0-.01M19 5a2 2 0 1 0 0-.01M7 18h6.5a3.5 3.5 0 0 0 0-7h-3a3.5 3.5 0 0 1 0-7H17',
  sparkle: 'M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2 2.2.8-2.2.8L19 22l-.8-2.2-2.2-.8 2.2-.8z',
  image: 'M4 5h16v14H4zM4 16l5-5 4 4 2-2 5 5M15.5 9.5h.01',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  redo: 'M15 14l5-5-5-5M20 9H9.5a5.5 5.5 0 0 0 0 11H13',
  check: 'M5 12.5l4.5 4.5L19 7.5',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  fit: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
  layers: 'M12 3l9 5-9 5-9-5zM3 13l9 5 9-5M3 17.5l9 5 9-5',
  flow: 'M3 8c3-3 6 3 9 0s6 3 9 0M3 13c3-3 6 3 9 0s6 3 9 0M3 18c3-3 6 3 9 0s6 3 9 0',
  plan: 'M3 3h18v18H3zM3 9h18M9 21V9M15 9v12',
  back: 'M15 5l-7 7 7 7',
  close: 'M6 6l12 12M18 6L6 18',
  trash: 'M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13',
  play: 'M7 4.5v15l12-7.5z',
  pause: 'M7 4h3.5v16H7zM13.5 4H17v16h-3.5z',
  alert: 'M12 3l10 18H2zM12 10v4.5M12 17.5h.01',
  shield: 'M12 3l8 3v6c0 4.6-3.3 8-8 9-4.7-1-8-4.4-8-9V6zM8.5 12l2.5 2.5 4.5-5',
  building: 'M4 21V5l8-3v19M12 9l8 2v10M2 21h20M7.5 8h1M7.5 12h1M7.5 16h1M15.5 14h1M15.5 17.5h1',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 1 0 0-18zM12 7v5l3.5 2',
  ruler: 'M3 16.5L16.5 3 21 7.5 7.5 21zM7 12.5l2 2M10 9.5l2 2M13 6.5l2 2',
  exit: 'M14 4h5v16h-5M10 8l-4 4 4 4M6 12h10',
  'turn-left': 'M16 20v-7a4 4 0 0 0-4-4H5M9 5L5 9l4 4',
  'turn-right': 'M8 20v-7a4 4 0 0 1 4-4h7M15 5l4 4-4 4',
  'slight-left': 'M15 20v-6.5L8.5 7M8 13V7h6',
  'slight-right': 'M9 20v-6.5L15.5 7M16 13V7h-6',
  'sharp-left': 'M15 20V7l-8 8M7 9v6h6',
  'sharp-right': 'M9 20V7l8 8M17 9v6h-6',
  straight: 'M12 20V4M6 10l6-6 6 6',
  'u-turn': 'M8 20V9a4 4 0 0 1 8 0v4M12 10l4 4 4-4',
  'stairs-down': 'M3 6h4v4h4v4h4v4h6M17 4v7M14 8l3 3 3-3',
  'stairs-up': 'M3 18h4v-4h4v-4h4V6h6M17 20v-7M14 16l3-3 3 3',
  pin: 'M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21zM12 7a2.5 2.5 0 1 0 0 5 2.5 2.5 0 1 0 0-5z',
  menu: 'M4 7h16M4 12h16M4 17h16',
  chat: 'M4 5h16v11H9l-5 4z',
  chevronUp: 'M6 15l6-6 6 6',
  chevronDown: 'M6 9l6 6 6-6',
  orbit: 'M12 8a4 4 0 1 0 0 8 4 4 0 1 0 0-8zM3 12c0-2.5 4-4.5 9-4.5s9 2 9 4.5-4 4.5-9 4.5c-2 0-3.8-.3-5.3-.9M8 19l-1.8-2.4L9 15',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 18, ...rest }: { name: IconName; size?: number } & SVGProps<SVGSVGElement>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...rest}
    >
      <path d={PATHS[name]} />
    </svg>
  );
}
