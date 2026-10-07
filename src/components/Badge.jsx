import { getStatusColor } from '../utils/helpers';

export function Badge({ children, status, color, className = '', style = {} }) {
  const badgeColor = color || getStatusColor(status || children);
  const colorClass = `badge-${badgeColor}`;
  const pillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    // Was 2px 8px, which rendered as a cramped lozenge. 4px 12px matches the
    // .badge rule in index.css so the inline style and the class agree.
    padding: '4px 12px',
    fontSize: '12px',
    lineHeight: '16px',
    borderRadius: '9999px',
    fontWeight: 600,
    whiteSpace: 'nowrap',
    ...style
  };
  // The trailing utility classes were inert: this project has no Tailwind
  // (no tailwind.config.js, no dependency). Dropped so the class list is honest.
  return (
    <span className={`badge ${colorClass} ${className}`.trim()} style={pillStyle}>
      {children}
    </span>
  );
}
