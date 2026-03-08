/**
 * Sparkline Performance Band Colours — TradingView Widget Edition
 *
 * TradingView widget overrides cannot consume CSS variables, so we replicate
 * the 10-band HSL values from index.css as resolved hex / rgba strings.
 *
 * Band thresholds (% change):
 *  1 ≤ -8%   Deep red
 *  2 ≤ -5%   Red
 *  3 ≤ -3%   Orange-red
 *  4 ≤ -1.5% Orange
 *  5 ≤ -0.5% Amber
 *  6 ≤ +0.5% Yellow
 *  7 ≤ +1.5% Lime
 *  8 ≤ +3%   Green
 *  9 ≤ +5%   Emerald
 * 10 >  +5%  Deep green
 */

export { resolveBand } from '@/components/ui/sparkline/utils';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Convert HSL components to a CSS hex string. */
function hslToHex(h: number, s: number, l: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return (
    '#' +
    [f(0), f(8), f(4)]
      .map(x => Math.round(x * 255).toString(16).padStart(2, '0'))
      .join('')
  );
}

/** Convert HSL components + alpha to an rgba() string. */
function hslToRgba(h: number, s: number, l: number, alpha: number): string {
  s /= 100; l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    Math.round(
      (l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))) * 255,
    );
  return `rgba(${f(0)},${f(8)},${f(4)},${alpha})`;
}

// ---------------------------------------------------------------------------
// Band colour tables — copied verbatim from index.css [h, s, l]
// Index 0 is unused; indices 1–10 match band numbers.
// ---------------------------------------------------------------------------

const BAND_HSL: Record<'light' | 'dark', ReadonlyArray<readonly [number, number, number]>> = {
  light: [
    [0,   0,   0 ],  // 0 unused
    [0,   85,  45],  // 1 Deep red    < -8%
    [8,   80,  52],  // 2 Red         -8% → -5%
    [18,  85,  55],  // 3 Orange-red  -5% → -3%
    [30,  90,  50],  // 4 Orange      -3% → -1.5%
    [45,  95,  48],  // 5 Amber       -1.5% → -0.5%
    [55,  80,  48],  // 6 Yellow      -0.5% → +0.5%
    [75,  70,  42],  // 7 Lime        +0.5% → +1.5%
    [120, 55,  42],  // 8 Green       +1.5% → +3%
    [150, 70,  38],  // 9 Emerald     +3% → +5%
    [160, 85,  32],  // 10 Deep green  > +5%
  ],
  dark: [
    [0,   0,   0 ],  // 0 unused
    [0,   80,  50],  // 1 Deep red
    [8,   75,  55],  // 2 Red
    [18,  80,  58],  // 3 Orange-red
    [30,  85,  55],  // 4 Orange
    [45,  90,  52],  // 5 Amber
    [55,  75,  52],  // 6 Yellow
    [75,  65,  48],  // 7 Lime
    [120, 50,  48],  // 8 Green
    [150, 65,  44],  // 9 Emerald
    [160, 80,  38],  // 10 Deep green
  ],
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Get the hex line colour for a performance band + theme.
 * @param band  1–10 (from `resolveBand`)
 * @param theme 'light' | 'dark'
 */
export function getBandHex(band: number, theme: 'light' | 'dark'): string {
  const idx = Math.max(1, Math.min(10, band));
  const [h, s, l] = BAND_HSL[theme][idx];
  return hslToHex(h, s, l);
}

/**
 * Get an rgba fill colour for a performance band + theme.
 * @param band  1–10 (from `resolveBand`)
 * @param theme 'light' | 'dark'
 * @param alpha 0–1 opacity
 */
export function getBandRgba(
  band: number,
  theme: 'light' | 'dark',
  alpha: number,
): string {
  const idx = Math.max(1, Math.min(10, band));
  const [h, s, l] = BAND_HSL[theme][idx];
  return hslToRgba(h, s, l, alpha);
}
