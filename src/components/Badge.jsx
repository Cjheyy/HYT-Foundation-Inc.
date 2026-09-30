import { getStatusColor } from '../utils/helpers';

export function Badge({ children, status, color, className = '', style = {} }) {
  const badgeColor = color || getStatusColor(status || children);
  const colorClass = `badge-${badgeColor}`;
  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '2px 8px',
    fontSize: '12px',
    lineHeight: '16px',
    borderRadius: '9999px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    ...style
  };
  return (
    <span className={`badge ${colorClass} ${className} px-2 py-0.5 text-xs rounded-full`} style={pillStyle}>
      {children}
    </span>
  );
}
