import { useId } from 'react';

export function Textarea({ 
  label, 
  error, 
  help, 
  placeholder,
  value,
  onChange,
  required = false,
  disabled = false,
  rows = 4,
  className = '',
  ...props 
}) {
  // Same wiring as `Input`, and for the same reason: without an `id` on the
  // control and a matching `htmlFor` on the label, the label is decoration.
  // A screen reader announces the textarea with no name, and clicking the
  // label does not focus it. Every admin create-form uses this component for
  // its description field, so the defect was on ten screens at once.
  const generatedId = useId();
  const textareaId = props.id || `textarea-${generatedId}`;
  const errorId = `${textareaId}-error`;
  const helpId = `${textareaId}-help`;
  const describedBy = [error ? errorId : null, help && !error ? helpId : null]
    .filter(Boolean)
    .join(' ') || undefined;

  return (
    <div className="form-group">
      {label && (
        <label className="form-label" htmlFor={textareaId}>
          {label}
          {required && <span className="required-marker" aria-hidden="true"> *</span>}
        </label>
      )}
      <textarea
        id={textareaId}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        rows={rows}
        className={`form-textarea ${className} ${error ? 'error' : ''}`}
        aria-invalid={error ? 'true' : undefined}
        aria-describedby={describedBy}
        {...props}
      />
      {error && <div className="form-error" id={errorId} role="alert">{error}</div>}
      {help && !error && <div className="form-help" id={helpId}>{help}</div>}
    </div>
  );
}
