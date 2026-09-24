import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import './ConfirmationModal.css';

export function ConfirmationModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Yes',
  cancelText = 'No',
  type = 'info', // 'info', 'warning', 'danger', 'success'
  children,
  loading = false
}) {
  const [submitting, setSubmitting] = useState(false);
  if (!isOpen) return null;

  const typeIcons = { info: '❓', warning: '⚠️', danger: '🚨', success: '✅' };
  const typeColors = { info: '#667eea', warning: '#F59E0B', danger: '#DC2626', success: '#059669' };

  const handleConfirm = async () => {
    if (loading || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm?.();
      onClose?.();
    } catch (error) {
      // The action owns user-facing error feedback.  Keep the dialog open so a
      // transient network failure can be retried without losing context.
      console.error('Confirmation action failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="confirmation-modal-overlay" onClick={loading || submitting ? undefined : onClose}>
      <Card className="confirmation-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="confirmation-icon" style={{ color: typeColors[type] }}>{typeIcons[type]}</div>
        <h3 className="confirmation-title">{title}</h3>
        {message && <p className="confirmation-message">{message}</p>}
        {children}
        <div className="confirmation-actions">
          <Button variant="secondary" onClick={onClose} disabled={loading || submitting} style={{ flex: 1 }}>{cancelText}</Button>
          <Button onClick={handleConfirm} disabled={loading || submitting} style={{ flex: 1, background: typeColors[type] }}>
            {loading || submitting ? 'Processing...' : confirmText}
          </Button>
        </div>
      </Card>
    </div>
  );
}
