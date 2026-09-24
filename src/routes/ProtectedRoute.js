import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { supabase } from '../config/supabase';
import { isAccountApproved, isPendingAccount, isRejectedAccount } from '../services/authService';
import { toast } from 'react-toastify';

export function ProtectedRoute({ children, requiredRole }) {
  const { state, dispatch, authInitialized } = useApp();
  const { currentUser, loading } = state;
  const [checking, setChecking] = useState(true);
  const [isValid, setIsValid] = useState(false);

  useEffect(() => {
    let mounted = true;

    const validateSession = async () => {
      setChecking(true);
      try {
        if (!supabase) throw new Error('Supabase is not configured.');
        const { data: sessionData, error } = await supabase.auth.getSession();
        if (error) {
          // Supabase will emit SIGNED_OUT for a genuinely invalid session.
          // A transient read failure must not log the user out during F5.
          if (mounted) {
            setIsValid(Boolean(currentUser));
            setChecking(false);
          }
          return;
        }
        if (!sessionData?.session) {
          if (mounted) {
            dispatch({ type: 'LOGOUT' });
            setIsValid(false);
          }
          return;
        }

        if (!currentUser) {
          if (mounted) setIsValid(false);
          return;
        }

        if (isPendingAccount(currentUser)) {
          await supabase.auth.signOut().catch(() => undefined);
          if (mounted) {
            dispatch({ type: 'LOGOUT' });
            toast.warning('Please wait for the admin to confirm your account.');
            setIsValid(false);
          }
          return;
        }

        if (isRejectedAccount(currentUser) || !isAccountApproved(currentUser)) {
          await supabase.auth.signOut().catch(() => undefined);
          if (mounted) {
            dispatch({ type: 'LOGOUT' });
            toast.error('Your account is not active. Please contact HYT support.');
            setIsValid(false);
          }
          return;
        }

        if (mounted) setIsValid(true);
      } catch (error) {
        console.error('Session validation error:', error);
        if (mounted) {
          dispatch({ type: 'LOGOUT' });
          setIsValid(false);
        }
      } finally {
        if (mounted) setChecking(false);
      }
    };

    validateSession();
    return () => { mounted = false; };
  }, [currentUser, dispatch]);

  if (!authInitialized || loading || checking) {
    return (
      <div className="route-loading" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <p>Verifying session...</p>
      </div>
    );
  }

  if (!currentUser || !isValid) return <Navigate to="/login" replace />;

  if (requiredRole) {
    const actualRole = String(currentUser.role || '').toUpperCase();
    const expectedRole = String(requiredRole || '').toUpperCase();
    if (actualRole !== expectedRole) {
      if (actualRole === 'ADMIN') return <Navigate to="/admin/dashboard" replace />;
      if (actualRole === 'OJT/INTERN') return <Navigate to="/student/dashboard" replace />;
      if (actualRole === 'TRAINEE') return <Navigate to="/trainee/dashboard" replace />;
      return <Navigate to="/" replace />;
    }
  }

  return children;
}
