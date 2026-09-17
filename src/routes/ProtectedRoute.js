import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';

export function ProtectedRoute({ children, requiredRole }) {
  const { state } = useApp();
  const { currentUser } = state;

  if (!currentUser) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole && currentUser.role !== requiredRole) {
    // Redirect to appropriate dashboard based on role
    if (currentUser.role === 'ADMIN') {
      return <Navigate to="/admin/dashboard" replace />;
    } else if (currentUser.role === 'OJT/Intern') {
      return <Navigate to="/student/dashboard" replace />;
    } else if (currentUser.role === 'Trainee') {
      return <Navigate to="/trainee/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
