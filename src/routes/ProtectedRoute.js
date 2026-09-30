import { useEffect, useRef } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { normalizeRole } from '../services/supabaseService';
import { toast } from 'react-toastify';

const CENTERED = { display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' };
const DASHBOARD_BY_ROLE = {
  ADMIN: '/admin/dashboard',
  'OJT/INTERN': '/student/dashboard',
  TRAINEE: '/trainee/dashboard'
};

/**
 * The AppContext provider is the single authority for authentication: it only
 * reports `authenticated` after a live Supabase session and the matching
 * public profile have both been validated.  This guard therefore performs no
 * network calls of its own, which removes the duplicate `getSession()` and the
 * stale `isValid` state that used to let a protected tree render for one frame
 * after the identity changed.
 */
export function ProtectedRoute({ children, requiredRole }) {
  const { state, authStatus, authNotice, clearAuthNotice, retryAuth } = useApp();
  const { currentUser, loading } = state;
  const location = useLocation();
  const lastNoticeRef = useRef(null);

  useEffect(() => {
    if (!authNotice?.message) return;
    if (lastNoticeRef.current === authNotice) return;
    lastNoticeRef.current = authNotice;
    const content = authNotice.message;
    if (authNotice.tone === 'warning') toast.warning(content);
    else toast.error(content);
    clearAuthNotice();
  }, [authNotice, clearAuthNotice]);

  if (authStatus === 'initializing' || authStatus === 'verifying' || loading) {
    return (
      <div className="route-loading" style={CENTERED}>
        <p>Verifying your session...</p>
      </div>
    );
  }

  if (authStatus === 'error') {
    return (
      <div className="route-loading" style={CENTERED}>
        <div
          role="alert"
          style={{
            maxWidth: '420px',
            margin: '0 16px',
            padding: '24px',
            borderRadius: '16px',
            background: '#fff',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.12)',
            textAlign: 'center'
          }}
        >
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', color: '#111827' }}>We could not verify your session</h2>
          <p style={{ margin: '0 0 20px', color: '#4B5563', lineHeight: 1.5 }}>
            {authNotice?.message || 'Check your connection and try again. You will not be signed out automatically.'}
          </p>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'center' }}>
            <button type="button" onClick={retryAuth} className="btn btn-primary">Try again</button>
            <a className="btn btn-outline" href="/login">Go to login</a>
          </div>
        </div>
      </div>
    );
  }

  if (authStatus !== 'authenticated' || !currentUser) {
    return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}` }} />;
  }

  if (requiredRole) {
    const actualRole = normalizeRole(currentUser.role);
    const expectedRole = normalizeRole(requiredRole);
    if (actualRole !== expectedRole) {
      return <Navigate to={DASHBOARD_BY_ROLE[actualRole] || '/'} replace />;
    }
  }

  return children;
}
