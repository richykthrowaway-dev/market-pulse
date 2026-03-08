/**
 * Sparkline Design System — Public API
 *
 * Import everything sparkline-related from this barrel.
 *
 * Usage:
 *   import { Sparkline, computeChangePct, resolveVariant } from '@/components/ui/sparkline';
 */

export { Sparkline } from './Sparkline';
export type { SparklineProps, SparklineVariant, SparklineColorSet } from './types';
export { resolveVariant, getColorSet, getColorSetByPerformance, resolveBand, computeChangePct, generatePath, generateFillPath, generateSmoothPath, generateSmoothFillPath, getBaselineY, getPointCoords } from './utils';
