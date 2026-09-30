import { useId } from 'react';

export function Input({ 
  label, 
  error, 
  help, 
  type = 'text', 
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  className = '',
  ...props 
}) {
  // A generated id keeps the <label> associated with the input, so the field
  // has a real accessible name and clicking the label focuses it.
  const generatedId = useId();
  const inputId = props.id || `input-${generatedId}`;
  const errorId = `${inputId}-error`;
  const helpId = `${inputId}-help`;
  const describedBy = [error ? errorId : null, help && !error ? helpId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={inputId}>
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </label>
      )}
      <input
        id={inputId}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`form-input ${className} ${error ? 'error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && <div className="form-error" id={errorId} role="alert">{error}</div>}
      {help && !error && <div className="form-help" id={helpId}>{help}</div>}
    </div>
  );
}
