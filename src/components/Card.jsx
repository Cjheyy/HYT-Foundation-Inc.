export function Card({ children, clickable = false, onClick, className = '', ...props }) {
  const baseClass = 'card';
  const clickableClass = clickable ? 'card-clickable' : '';
  
  return (
    <div 
      className={`${baseClass} ${clickableClass} ${className}`}
      onClick={onClick}
      {...props}
    >
      {children}
    </div>
  );
}
