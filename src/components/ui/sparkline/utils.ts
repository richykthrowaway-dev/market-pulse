/**
 * Sparkline Design System — Utilities
 *
 * Pure functions for color resolution, path generation, and performance calculation.
 * All sparkline rendering MUST use these utilities for consistency.
 */

import type { SparklineVariant, SparklineColorSet } from './types';

/**
 * 10-band performance thresholds (% change).
 * Each band maps to a CSS variable --spark-band-N.
 * Band 1 = worst (deep red), Band 10 = best (deep green).
 */
const BAND_THRESHOLDS = [
  { max: -8,   band: 1 },
  { max: -5,   band: 2 },
  { max: -3,   band: 3 },
  { max: -1.5, band: 4 },
  { max: -0.5, band: 5 },
  { max: 0.5,  band: 6 },
  { max: 1.5,  band: 7 },
  { max: 3,    band: 8 },
  { max: 5,    band: 9 },
  { max: Infinity, band: 10 },
];

/** Resolve a % change to a band number (1–10). */
export function resolveBand(changePct: number): number {
  for (const t of BAND_THRESHOLDS) {
    if (changePct <= t.max) return t.band;
  }
  return 10;
}

/** CSS variable references for non-band variants */
const VARIANT_TOKENS: Record<Exclude<SparklineVariant, 'auto'>, SparklineColorSet> = {
  gain: { stroke: 'hsl(var(--spark-band-10))', fill: 'hsl(var(--spark-band-10))', dot: 'hsl(var(--spark-band-10))' },
  loss: { stroke: 'hsl(var(--spark-band-1))', fill: 'hsl(var(--spark-band-1))', dot: 'hsl(var(--spark-band-1))' },
  neutral: { stroke: 'hsl(var(--spark-neutral-stroke))', fill: 'hsl(var(--spark-neutral-fill))', dot: 'hsl(var(--spark-neutral-stroke))' },
  primary: { stroke: 'hsl(var(--spark-primary-stroke))', fill: 'hsl(var(--spark-primary-fill))', dot: 'hsl(var(--spark-primary-stroke))' },
  warning: { stroke: 'hsl(var(--spark-warning-stroke))', fill: 'hsl(var(--spark-warning-fill))', dot: 'hsl(var(--spark-warning-stroke))' },
};

/**
 * Resolve the variant from data when 'auto' is selected.
 * Uses first→last comparison: gain if positive, loss if negative, neutral if zero.
 */
export function resolveVariant(data: number[], variant: SparklineVariant): Exclude<SparklineVariant, 'auto'> {
  if (variant !== 'auto') return variant;
  if (data.length < 2) return 'neutral';
  const start = data[0];
  const end = data[data.length - 1];
  if (start === 0) return 'neutral';
  const change = end - start;
  if (change > 0) return 'gain';
  if (change < 0) return 'loss';
  return 'neutral';
}

/**
 * Get the color set for a resolved variant (used for non-auto fixed variants).
 */
export function getColorSet(variant: Exclude<SparklineVariant, 'auto'>): SparklineColorSet {
  return VARIANT_TOKENS[variant];
}

/**
 * Get the color set based on performance band (10-step gradient).
 * This is the primary color resolver for 'auto' variant sparklines.
 */
export function getColorSetByPerformance(data: number[]): SparklineColorSet {
  const pct = computeChangePct(data);
  const band = resolveBand(pct);
  const token = `hsl(var(--spark-band-${band}))`;
  return { stroke: token, fill: token, dot: token };
}

/**
 * Compute the change percentage from first to last data point.
 * Returns 0 if data has fewer than 2 points or start is 0.
 */
export function computeChangePct(data: number[]): number {
  if (data.length < 2 || data[0] === 0) return 0;
  return ((data[data.length - 1] - data[0]) / data[0]) * 100;
}

/**
 * Generate an SVG polyline points string from numeric data.
 */
export function generatePath(
  data: number[],
  width: number,
  height: number,
  padding = 0.03
): string {
  if (data.length < 2) return '';
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = range * padding;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;

  return data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - yMin) / yRange) * height;
      return `${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(' ');
}

/**
 * Generate the fill polygon points (area under the line).
 */
export function generateFillPath(
  data: number[],
  width: number,
  height: number,
  padding = 0.03
): string {
  if (data.length < 2) return '';
  const linePath = generatePath(data, width, height, padding);
  return `${linePath} ${width.toFixed(2)},${height.toFixed(2)} 0,${height.toFixed(2)}`;
}

/**
 * Compute the Y position of the baseline (first data point) in SVG coordinates.
 */
export function getBaselineY(
  data: number[],
  height: number,
  padding = 0.03
): number {
  if (data.length === 0) return height;
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = range * padding;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;
  return height - ((data[0] - yMin) / yRange) * height;
}

/**
 * Get the SVG coordinates for a specific data point.
 */
export function getPointCoords(
  data: number[],
  index: number,
  width: number,
  height: number,
  padding = 0.03
): { x: number; y: number } {
  if (data.length < 2 || index < 0 || index >= data.length) return { x: 0, y: 0 };
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const pad = range * padding;
  const yMin = min - pad;
  const yMax = max + pad;
  const yRange = yMax - yMin;
  const x = (index / (data.length - 1)) * width;
  const y = height - ((data[index] - yMin) / yRange) * height;
  return { x, y };
}
