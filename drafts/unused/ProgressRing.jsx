/**
 * Ring/donut progress indicator.
 *
 * Sibling of ProgressBar: same defensive arithmetic, same "—" fallback, so a
 * card that has no hours on file cannot render "NaN%" or a full ring for no
 * data.  Colours live in CSS (.progress-ring-*) rather than here, so the ring
 * inherits the card's tokens the same way every other element does.
 */
export function ProgressRing({
  value,
  max = 100,
  size = 112,
  stroke = 11,
  caption = 'Complete',
  className = '',
  ...props
}) {
  // Guard the arithmetic exactly as ProgressBar does.  A zero `max` produced
  // Infinity (which clamps to a *full* ring for no data) and a missing `value`
  // produced NaN, which rendered as "NaN%" in the middle of the ring.
  const numericValue = Number(value);
  const numericMax = Number(max);
  const hasData =
    Number.isFinite(numericValue) && Number.isFinite(numericMax) && numericMax > 0;

  const percentage = hasData
    ? Math.min(Math.max((numericValue / numericMax) * 100, 0), 100)
    : 0;

  // Radius that fits the stroke inside the box: the outer edge of the stroke
  // lands exactly on `size / 2`, so the ring never clips at the edges.
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = (percentage / 100) * circumference;
  const center = size / 2;

  return (
    <div
      className={`progress-ring ${className}`.trim()}
      style={{ width: size, height: size }}
      {...props}
    >
      {/* Decorative: the value is real text in the middle, so the SVG must not
          be announced as well or a screen reader reads the number twice. */}
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        aria-hidden="true"
        focusable="false"
      >
        <circle
          className="progress-ring-track"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
        />
        <circle
          className="progress-ring-fill"
          cx={center}
          cy={center}
          r={radius}
          strokeWidth={stroke}
          // A round cap on a zero-length dash still paints a dot, which reads
          // as "some progress made". Only round the cap once there is a dash.
          strokeLinecap={percentage > 0 ? 'round' : 'butt'}
          strokeDasharray={`${dash} ${circumference - dash}`}
        />
      </svg>
      <div className="progress-ring-center">
        <span className="progress-ring-value">
          {hasData ? `${percentage.toFixed(1)}%` : '—'}
        </span>
        {caption && <span className="progress-ring-caption">{caption}</span>}
      </div>
    </div>
  );
}
