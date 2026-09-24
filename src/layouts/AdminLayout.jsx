import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { logout } from '../services/authService';
import hytLogo from '../assets/HYT.png';
import './PortalLayout.css';
import '../components/Logo.css';

export function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (loggingOut) return; // Prevent double-click
    
    try {
      setLoggingOut(true);
      
      // CRITICAL: Clear context state IMMEDIATELY to prevent null role access
      dispatch({ type: 'LOGOUT' });
      
      // Small delay to allow state to propagate
      await new Promise(resolve => setTimeout(resolve, 50));
      
      // Call logout service (handles storage, Supabase, redirect)
      await logout();
      
      // Sign out the Supabase session, then return through the router.
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout handler error:', error);
      // Force redirect even on error
      window.location.href = '/login';
    }
  };

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/application-review', label: 'Application Review', icon: '✉️' },
    { path: '/admin/students', label: 'Students', icon: '👥' },
    { path: '/admin/programs', label: 'Programs', icon: '📚' },
    { path: '/admin/opportunities', label: 'Opportunities', icon: '🎯' },
    { path: '/admin/attendance-verification', label: 'Attendance Verification', icon: '✓' },
    { path: '/admin/ot-approvals', label: 'OT Approvals', icon: '⏰' },
    { path: '/admin/report-approvals', label: 'Report Approvals', icon: '📋' },
    { path: '/admin/requirements', label: 'Requirements', icon: '📄' },
    { path: '/admin/certificates', label: 'Certificates', icon: '🏆' },
    { path: '/admin/announcements', label: 'Announcements', icon: '📢' }
  ];

  return (
    <div className="portal-layout">
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <div className="logo">
            <img src={hytLogo} alt="HYT Foundation" className="sidebar-logo-image" />
          </div>
          <button 
            className="sidebar-close"
            onClick={() => setSidebarOpen(false)}
          >
            ×
          </button>
        </div>

        <div className="sidebar-user">
          <div className="user-avatar admin">
            {currentUser?.firstName?.charAt(0) || 'A'}
          </div>
          <div className="user-info">
            <div className="user-name">{currentUser?.fullName}</div>
            <div className="user-role">Administrator</div>
          </div>
        </div>

        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span className="nav-label">{item.label}</span>
            </Link>
          ))}
        </nav>

        <div className="sidebar-footer">
          <button 
            className="logout-btn" 
            onClick={handleLogout}
            disabled={loggingOut}
          >
            <span>🚪</span>
            <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="portal-header">
          <button 
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
          >
            ☰
          </button>
          <div className="header-title">Admin Portal</div>
          <div className="header-user">
            {currentUser?.fullName}
          </div>
        </header>

        <main className="content-area">
          {children}
        </main>
      </div>

      {sidebarOpen && (
        <div 
          className="sidebar-overlay" 
          onClick={() => setSidebarOpen(false)}
        />
      )}
    </div>
  );
}
