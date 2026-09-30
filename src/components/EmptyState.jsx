import { Button } from './Button';
import { Icon } from './icons';

export function EmptyState({
  icon = 'file',
  title,
  message,
  action,
  actionText,
  onAction
}) {
  const isIconName = typeof icon === 'string' && icon.length <= 20 && !/\p{Extended_Pictographic}/u.test(icon);
  return (
    <div className="empty-state">
      <div className="empty-state-icon" aria-hidden="true">
        {isIconName ? <Icon name={icon} size={40} color="#9CA3AF" /> : icon}
      </div>
      <h3 className="empty-state-title">{title}</h3>
      {message && <p className="empty-state-text">{message}</p>}
      {action && actionText && (
        <Button onClick={onAction}>{actionText}</Button>
      )}
    </div>
  );
}
