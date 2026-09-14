export function Loading({ message = 'Loading...' }) {
  return (
    <div className="loading">
      <div className="spinner"></div>
      <p style={{ marginTop: '16px' }}>{message}</p>
    </div>
  );
}
