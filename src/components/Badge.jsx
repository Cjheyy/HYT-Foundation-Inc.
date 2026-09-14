import { getStatusColor } from '../utils/helpers';

export function Badge({ children, status, color, className = '' }) {
  const badgeColor = color || getStatusColor(status || children);
  const colorClass = `badge-${badgeColor}`;
  
  return (
    <span className={`badge ${colorClass} ${className}`}>
      {children}
    </span>
  );
}
