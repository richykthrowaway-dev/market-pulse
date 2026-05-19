import { describe, it, expect } from 'vitest';
import { usMarketSession } from './marketSession';

// May 2026 → US Eastern is EDT (UTC-4).
describe('usMarketSession', () => {
  it('open during regular hours (Mon 09:30 ET = 13:30Z)', () => {
    const s = usMarketSession(new Date('2026-05-18T13:30:00Z'));
    expect(s.open).toBe(true);
    expect(s.label).toMatch(/closes in/i);
    expect(s.minsToChange).toBe(390);
  });
  it('closed pre-open same weekday (Mon 08:00 ET = 12:00Z)', () => {
    const s = usMarketSession(new Date('2026-05-18T12:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.label).toMatch(/opens today/i);
    expect(s.minsToChange).toBe(90);
  });
  it('closed after close → tomorrow (Mon 17:00 ET = 21:00Z)', () => {
    const s = usMarketSession(new Date('2026-05-18T21:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.label).toMatch(/opens tomorrow/i);
  });
  it('weekend → opens Mon (Sat 14:00 ET = 18:00Z)', () => {
    const s = usMarketSession(new Date('2026-05-16T18:00:00Z'));
    expect(s.open).toBe(false);
    expect(s.label).toMatch(/opens Mon/i);
  });
});
