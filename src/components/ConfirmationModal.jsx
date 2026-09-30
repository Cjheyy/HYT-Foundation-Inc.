import { useState } from 'react';
import { toast } from 'react-toastify';
import { Card } from './Card';
import { Button } from './Button';
import { Icon } from './icons';
import { isGeolocationError } from '../utils/location';
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

  const typeIcons = { info: 'info', warning: 'alert', danger: 'alert', success: 'check' };
  const typeColors = { info: '#667eea', warning: '#F59E0B', danger: '#DC2626', success: '#059669' };

  const handleConfirm = async () => {
    if (loading || submitting) return;
    setSubmitting(true);
    try {
      await onConfirm?.();
      onClose?.();
    } catch (error) {
      // The action owns user-facing error feedback.  Keep the dialog open so a
      // transient network or GPS failure can be retried without losing context.
      // Geolocation timeouts on desktops are surfaced here as a friendly
      // permission hint instead of a raw GeolocationPositionError.
      if (isGeolocationError(error)) {
        toast.error(error?.message || 'Please enable location permission on your browser to clock in.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="confirmation-modal-overlay" onClick={loading || submitting ? undefined : onClose}>
      <Card className="confirmation-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="confirmation-icon" style={{ color: typeColors[type] }}>
          <Icon name={typeIcons[type]} size={32} color={typeColors[type]} />
        </div>
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
