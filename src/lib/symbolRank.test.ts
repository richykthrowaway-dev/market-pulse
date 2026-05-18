import { describe, it, expect } from 'vitest';
import { rankSymbols } from './symbolRank';

const row = (canonicalTicker: string, name: string) =>
  ({ canonicalTicker, name }) as any;

describe('rankSymbols', () => {
  it('exact ticker match ranks first (the AAPL bug)', () => {
    const out = rankSymbols('AAPL', [
      row('AAPD', 'Direxion Daily AAPL Bear 1X Shares'),
      row('AAPU', 'Direxion Daily AAPL Bull 1.5X Shares'),
      row('APLY', 'YieldMax AAPL Option Income ETF'),
      row('AAPL', 'Apple Inc'),
      row('AAPB', 'GraniteShares 2x Long AAPL ETF'),
    ]);
    expect(out[0].canonicalTicker).toBe('AAPL');
  });

  it('order: exact ticker → ticker-prefix → name-prefix → ticker-contains → name-contains', () => {
    const out = rankSymbols('APP', [
      row('XAPP', 'Zeta corp'),                 // ticker-contains
      row('ZZZ', 'Applied Materials'),          // name-prefix
      row('APPN', 'Appian Corp'),               // ticker-prefix
      row('APP', 'AppLovin Corp'),              // exact ticker
      row('QQQ', 'Snap APP holdings'),          // name-contains
    ]);
    expect(out.map((r) => r.canonicalTicker)).toEqual(['APP', 'APPN', 'ZZZ', 'XAPP', 'QQQ']);
  });

  it('is case-insensitive', () => {
    const out = rankSymbols('aapl', [row('AAPD', 'x AAPL'), row('AAPL', 'Apple Inc')]);
    expect(out[0].canonicalTicker).toBe('AAPL');
  });

  it('tiebreak: same tier → shorter ticker first, then alphabetical', () => {
    const out = rankSymbols('AA', [
      row('AAB', 'b'), row('AAA', 'a'), row('AA', 'exact-not-this-tier'),
    ]);
    // 'AA' is exact (tier 0). 'AAA','AAB' are ticker-prefix (tier 1): shorter first (equal len 3) then alpha
    expect(out.map((r) => r.canonicalTicker)).toEqual(['AA', 'AAA', 'AAB']);
  });

  it('empty/whitespace query returns a copy unchanged, does not mutate input', () => {
    const input = [row('B', 'b'), row('A', 'a')];
    const out = rankSymbols('   ', input);
    expect(out).toEqual(input);
    expect(out).not.toBe(input);
  });

  it('does not mutate the input array', () => {
    const input = [row('AAPD', 'x AAPL'), row('AAPL', 'Apple')];
    const snapshot = input.map((r) => r.canonicalTicker);
    rankSymbols('AAPL', input);
    expect(input.map((r) => r.canonicalTicker)).toEqual(snapshot);
  });
});
