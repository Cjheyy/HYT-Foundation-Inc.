import { Button } from './Button';

export function EmptyState({ 
  icon = '📋', 
  title, 
  message, 
  action,
  actionText,
  onAction 
}) {
  return (
    <div className="empty-state">
      <div className="empty-state-icon">{icon}</div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-text">{message}</p>}
      {action && actionText && (
        <Button onClick={onAction}>{actionText}</Button>
      )}
    </div>
  );
}
