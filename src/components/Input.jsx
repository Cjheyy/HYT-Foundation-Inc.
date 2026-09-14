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
  return (
    <div className="form-group">
      {label && (
        <label className="form-label">
          {label}
          {required && <span style={{ color: 'red' }}> *</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        required={required}
        disabled={disabled}
        className={`form-input ${className} ${error ? 'error' : ''}`}
        {...props}
      />
      {error && <div className="form-error">{error}</div>}
      {help && !error && <div className="form-help">{help}</div>}
    </div>
  );
}
