// SVG colours. Kept in JS (not CSS vars) because SVG presentation
// attributes don't resolve var(); mirrored in app/globals.css.
export const C = {
  ink: '#070a0f',
  line: 'rgba(160, 200, 240, 0.34)',
  lineFaint: 'rgba(160, 200, 240, 0.12)',
  roomFill: 'rgba(120, 170, 220, 0.055)',
  text: '#eaf2f8',
  textDim: '#8fa3b5',
  go: '#2fe39a',
  goDeep: '#0e9f66',
  signal: '#4cc9ff',
  fire: '#ff5a36',
  smoke: '#ffb547',
  plum: '#b18cff',
};

// Time-to-safety heat: exit-sign green -> amber -> fire red as a room's
// escape time approaches the travel limit.
export function heatColor(fraction: number, alpha = 1): string {
  const f = Math.max(0, Math.min(1, fraction));
  const hue = 155 - 145 * Math.pow(f, 0.85);
  return `hsla(${hue.toFixed(0)}, 88%, ${(56 + 4 * (1 - f)).toFixed(0)}%, ${alpha})`;
}
