/**
 * Tiny inline SVG sparkline. Zero deps, no chart library needed.
 *
 * Designed for in-header usage where a 60×16 mini-chart adds context
 * without claiming visual real estate from the primary content. The
 * line is anti-aliased, the last point is dotted (so users can see
 * where "now" is), and the area below is optionally filled with a
 * faded version of the stroke color.
 */

export interface SparklineProps {
  /** Series values, oldest → newest. Empty / single-value series renders null. */
  values: number[];
  width?: number;
  height?: number;
  /** Stroke colour. Pass any CSS color (hex, hsl, var(--…), etc.). */
  color?: string;
  /** Whether to render a faded fill below the line. */
  showFill?: boolean;
  /** Whether to mark the last point with a dot. */
  showLastDot?: boolean;
  /** Aria-label / title for accessibility + native browser tooltip. */
  label?: string;
  className?: string;
}

export function Sparkline({
  values,
  width = 64,
  height = 16,
  color = 'currentColor',
  showFill = true,
  showLastDot = true,
  label,
  className,
}: SparklineProps) {
  if (!values || values.length < 2) return null;

  const PAD = 1.5; // pixels of vertical breathing room so the line + dot don't touch edges
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const stepX = (width - PAD * 2) / (values.length - 1);

  const points = values.map((v, i) => {
    const x = PAD + i * stepX;
    const y = PAD + (height - PAD * 2) * (1 - (v - min) / range);
    return [x, y] as const;
  });

  const polyline = points.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  // Build a closed polygon for the fill area (line + drop down + close)
  const lastX = points[points.length - 1][0];
  const firstX = points[0][0];
  const fillPoly = `${firstX.toFixed(2)},${(height - PAD).toFixed(2)} ${polyline} ${lastX.toFixed(2)},${(height - PAD).toFixed(2)}`;

  const [lastPx, lastPy] = points[points.length - 1];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      className={className}
      style={{ overflow: 'visible' }}
    >
      {label && <title>{label}</title>}
      {showFill && (
        <polygon
          points={fillPoly}
          fill={color}
          opacity={0.18}
        />
      )}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth={1.4}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {showLastDot && (
        <circle cx={lastPx} cy={lastPy} r={1.8} fill={color} />
      )}
    </svg>
  );
}
