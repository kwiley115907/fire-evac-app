import { describe, expect, it } from 'vitest';
import { fitWithin, isPdf, MAX_EDGE } from './plan-image';

describe('fitWithin', () => {
  it('scales the long side down to the limit and keeps the aspect ratio', () => {
    expect(fitWithin(6000, 3000)).toEqual({ width: MAX_EDGE, height: MAX_EDGE / 2 });
    expect(fitWithin(1000, 4000, 2000)).toEqual({ width: 500, height: 2000 });
  });
  it('never scales up', () => {
    expect(fitWithin(273, 496)).toEqual({ width: 273, height: 496 });
  });
});

describe('isPdf', () => {
  it('accepts the PDF mime type or a .pdf name', () => {
    expect(isPdf(new File([], 'plan.bin', { type: 'application/pdf' }))).toBe(true);
    expect(isPdf(new File([], 'Floor Plans.PDF'))).toBe(true);
    expect(isPdf(new File([], 'plan.png', { type: 'image/png' }))).toBe(false);
  });
});
