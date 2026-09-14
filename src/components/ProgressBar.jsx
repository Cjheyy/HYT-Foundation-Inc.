export function ProgressBar({ 
  value, 
  max = 100, 
  showLabel = true,
  className = '',
  color = 'default'
}) {
  const percentage = Math.min((value / max) * 100, 100);
  const colorClass = color !== 'default' ? color : '';
  
  return (
    <div className={className}>
      {showLabel && (
        <div className="flex justify-between mb-2">
          <span className="text-small text-muted">Progress</span>
          <span className="text-small font-semibold">{percentage.toFixed(1)}%</span>
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
