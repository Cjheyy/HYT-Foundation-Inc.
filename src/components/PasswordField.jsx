import { useId, useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { Input } from './Input';

/**
 * Professional password field with Eye / EyeOff toggle.
 * Copy/paste is disabled on password inputs for security.
 */
export function PasswordField({
  label = 'Password',
  id,
  value,
  onChange,
  error,
  help,
  placeholder,
  autoComplete = 'current-password',
  maxLength = 72,
  required = false,
  disabled = false,
  name = 'password',
  onBlur,
  describedById
}) {
  const generatedId = useId();
  const inputId = id || `password-${generatedId}`;
  const [visible, setVisible] = useState(false);
  const toggleLabel = `${visible ? 'Hide' : 'Show'} ${label.toLowerCase()}`;

  const blockClipboard = (event) => {
    event.preventDefault();
  };

  return (
    <div className="password-input-wrapper">
      <Input
        id={inputId}
        name={name}
        label={label}
        type={visible ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        error={error}
        help={help}
        placeholder={placeholder}
        autoComplete={autoComplete}
        maxLength={maxLength}
        required={required}
        disabled={disabled}
        aria-describedby={describedById}
        onPaste={blockClipboard}
        onCopy={blockClipboard}
        onCut={blockClipboard}
      />
      <button
        type="button"
        className="password-toggle"
        onClick={() => setVisible((previous) => !previous)}
        aria-label={toggleLabel}
        aria-pressed={visible}
        aria-controls={inputId}
        title={toggleLabel}
      >
        <span aria-hidden="true" className="password-toggle-icon">
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </span>
      </button>
    </div>
  );
}
