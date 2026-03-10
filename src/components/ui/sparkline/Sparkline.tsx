/**
 * Sparkline Design System — Core Component
 *
 * This is the ONLY sanctioned sparkline renderer in the application.
 * All sparklines MUST use this component to ensure visual consistency.
 *
 * Usage:
 *   <Sparkline data={[100, 102, 98, 105]} />
 *   <Sparkline data={prices} variant="primary" height={48} />
 *   <Sparkline data={prices} highlightIndex={prices.length - 1} />
 */

import React, { useId, useMemo, useRef, useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import type { SparklineProps } from './types';
import {
  resolveVariant,
  getColorSet,
  getColorSetByPerformance,
  generateLinearPath,
  generateLinearFillPath,
  getBaselineY,
  getPointCoords,
} from './utils';

const DEFAULT_HEIGHT = 64;
const SVG_INTERNAL_WIDTH = 200;
const STROKE_WIDTH = 1.5;
const DOT_RADIUS = 2.5;
const FILL_OPACITY = 0.15;
const BASELINE_OPACITY = 0.45;

export function Sparkline({
  data,
  variant = 'auto',
  height = DEFAULT_HEIGHT,
  width = '100%',
  showBaseline = true,
  highlightIndex,
  className,
  ariaLabel,
  animate = true,
}: SparklineProps) {
  const gradientId = useId();
  const polylineRef = useRef<SVGPathElement>(null);
  const [mounted, setMounted] = useState(!animate);

  // Animate the stroke on mount
  useEffect(() => {
    if (!animate || !polylineRef.current) {
      setMounted(true);
      return;
    }
    const el = polylineRef.current;
    const length = el.getTotalLength();
    el.style.strokeDasharray = `${length}`;
    el.style.strokeDashoffset = `${length}`;
    // Trigger reflow then animate
    el.getBoundingClientRect();
    el.style.transition = 'stroke-dashoffset 0.8s ease-out';
    el.style.strokeDashoffset = '0';
    const timer = setTimeout(() => setMounted(true), 850);
    return () => clearTimeout(timer);
  }, [animate, data]);

  const resolved = useMemo(() => resolveVariant(data, variant), [data, variant]);
  const colors = useMemo(() => {
    // For 'auto' variant, use 10-band performance colors; otherwise use fixed variant colors
    if (variant === 'auto') return getColorSetByPerformance(data);
    return getColorSet(resolved);
  }, [data, variant, resolved]);

  const svgHeight = height;
  const linePath = useMemo(() => generateLinearPath(data, SVG_INTERNAL_WIDTH, svgHeight), [data, svgHeight]);
  const fillPath = useMemo(() => generateLinearFillPath(data, SVG_INTERNAL_WIDTH, svgHeight), [data, svgHeight]);
  const baselineY = useMemo(() => getBaselineY(data, svgHeight), [data, svgHeight]);

  const highlightPoint = useMemo(() => {
    if (highlightIndex == null) return null;
    return getPointCoords(data, highlightIndex, SVG_INTERNAL_WIDTH, svgHeight);
  }, [data, highlightIndex, svgHeight]);

  if (data.length < 2) {
    return (
      <div
        className={cn('flex items-center justify-center text-muted-foreground text-xs', className)}
        style={{ width, height }}
        role="img"
        aria-label={ariaLabel || 'No data available'}
      >
        —
      </div>
    );
  }

  return (
    <div
      className={cn('sparkline-container', className)}
      style={{ width, height }}
      role="img"
      aria-label={ariaLabel || `Sparkline chart showing ${resolved} trend`}
    >
      <svg
        viewBox={`0 0 ${SVG_INTERNAL_WIDTH} ${svgHeight}`}
        preserveAspectRatio="none"
        width="100%"
        height="100%"
        className="overflow-visible"
      >
        <defs>
          <linearGradient id={`spark-fill-${gradientId}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={colors.fill} stopOpacity={FILL_OPACITY} />
            <stop offset="100%" stopColor={colors.fill} stopOpacity={0.01} />
          </linearGradient>
        </defs>

        {/* Fill area */}
        <path
          d={fillPath}
          fill={`url(#spark-fill-${gradientId})`}
          stroke="none"
          opacity={mounted ? 1 : 0}
          style={{ transition: 'opacity 0.4s ease-out 0.4s' }}
        />

        {/* Baseline */}
        {showBaseline && (
          <line
            x1="0"
            y1={baselineY}
            x2={SVG_INTERNAL_WIDTH}
            y2={baselineY}
            stroke="hsl(var(--spark-baseline))"
            strokeWidth="0.75"
            strokeDasharray="4 3"
            strokeOpacity={BASELINE_OPACITY}
          />
        )}

        {/* Stroke line */}
        <path
          ref={polylineRef}
          d={linePath}
          fill="none"
          stroke={colors.stroke}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          strokeLinejoin="round"
          vectorEffect="non-scaling-stroke"
        />

        {/* Highlight dot */}
        {highlightPoint && (
          <circle
            cx={highlightPoint.x}
            cy={highlightPoint.y}
            r={DOT_RADIUS}
            fill={colors.dot}
            stroke="hsl(var(--card))"
            strokeWidth="1"
            opacity={mounted ? 1 : 0}
            style={{ transition: 'opacity 0.3s ease-out 0.6s' }}
          />
        )}
      </svg>
    </div>
  );
}

export default Sparkline;
