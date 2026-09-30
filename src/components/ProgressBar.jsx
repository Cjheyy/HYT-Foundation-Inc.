export function ProgressBar({ 
  value, 
  max = 100, 
  showLabel = true,
  className = '',
  color = 'default'
}) {
  // Guard the arithmetic.  Previously `Math.min((value / max) * 100, 100)` ran
  // unguarded, so a zero `max` produced Infinity (clamped to a *full* bar for no
  // data) and a missing `value` produced NaN, which rendered as "NaN%" next to
  // an empty bar because `width: NaN%` is invalid CSS.
  const numericValue = Number(value);
  const numericMax = Number(max);
  const hasData =
    Number.isFinite(numericValue) && Number.isFinite(numericMax) && numericMax > 0;

  const percentage = hasData
    ? Math.min(Math.max((numericValue / numericMax) * 100, 0), 100)
    : 0;

  const colorClass = color !== 'default' ? color : '';
  
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between mb-2">
          <span className="text-small text-muted">Progress</span>
          <span className="text-small font-semibold">
            {hasData ? `${percentage.toFixed(1)}%` : '—'}
          </span>
        </div>
      )}
      <div className="progress-bar">
        <div 
          className={`progress-bar-fill ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
