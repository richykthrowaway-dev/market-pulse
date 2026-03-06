/**
 * Sparkline Design System — Types
 *
 * ALL sparkline variants and configuration types live here.
 * No ad-hoc sparkline implementations are permitted outside this system.
 */

export type SparklineVariant = 'auto' | 'gain' | 'loss' | 'neutral' | 'primary' | 'warning';

export interface SparklineProps {
  /** Array of numeric data points (e.g., close prices). Minimum 2 points. */
  data: number[];
  /** Visual variant. 'auto' derives gain/loss from first→last data point. */
  variant?: SparklineVariant;
  /** Height in pixels. Default: 64 */
  height?: number;
  /** Width — CSS value or number. Default: '100%' */
  width?: number | string;
  /** Show dashed baseline at first data point. Default: true */
  showBaseline?: boolean;
  /** Index of point to highlight (renders a dot). */
  highlightIndex?: number;
  /** Additional CSS class. */
  className?: string;
  /** Accessible label for screen readers. */
  ariaLabel?: string;
  /** Whether to animate the line on mount. Default: true */
  animate?: boolean;
}

export interface SparklineColorSet {
  stroke: string;
  fill: string;
  dot: string;
}
