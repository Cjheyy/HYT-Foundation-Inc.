import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/icons';
import { ProfileModal } from '../components/ProfileModal';
import hytLogo from '../assets/HYT.png';
import './PortalLayout.css';
import '../components/Logo.css';

export function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { state, signOut } = useApp();
  const { currentUser } = state;
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    if (loggingOut) return; // Prevent double-click
    setLoggingOut(true);
    try {
      // The provider owns the sign-out transaction: it only clears the context
      // after Supabase confirms the persisted session is gone.
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout handler error:', error);
      // Force redirect even on error
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  const isActive = (path) => {
    if (path === '/admin') return location.pathname === '/admin' || location.pathname === '/admin/dashboard';
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: 'dashboard' },
    { path: '/admin/application-review', label: 'Application Review', icon: 'inbox' },
    { path: '/admin/students', label: 'Students', icon: 'users' },
    { path: '/admin/programs', label: 'Trainee Programs & Events', icon: 'book' },
    { path: '/admin/opportunities', label: 'OJT Postings', icon: 'target' },
    { path: '/admin/attendance-verification', label: 'Attendance Verification', icon: 'check' },
    { path: '/admin/ot-approvals', label: 'OT Approvals', icon: 'clock' },
    { path: '/admin/report-approvals', label: 'Report Approvals', icon: 'file' },
    { path: '/admin/certificates', label: 'Certificates', icon: 'award' },
    { path: '/admin/announcements', label: 'Announcements', icon: 'bell' }
  ];

  const avatarInitial = currentUser?.fullName?.trim()?.charAt(0)?.toUpperCase()
    || currentUser?.firstName?.charAt(0)?.toUpperCase()
    || 'A';

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
            aria-label="Close navigation"
          >
            <Icon name="x" size={18} />
          </button>
        </div>

        <button
          type="button"
          className="sidebar-user sidebar-user-button"
          onClick={() => setProfileOpen(true)}
          title="Open Profile Settings"
          aria-label="Open Profile Settings"
          style={{ cursor: 'pointer', background: 'none', border: 'none', width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: '12px' }}
        >
          <span className="user-avatar admin" style={{ overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }} aria-hidden="true">
            {currentUser?.profilePicture || currentUser?.profile_picture ? (
              <img src={currentUser.profilePicture || currentUser.profile_picture} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              avatarInitial
            )}
          </span>
          <span className="user-info">
            <span className="user-name" style={{ display: 'block' }}>{currentUser?.fullName}</span>
            <span className="user-role" style={{ display: 'block' }}>Administrator</span>
          </span>
        </button>

        <nav className="sidebar-nav" aria-label="Admin navigation">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`nav-item ${isActive(item.path) ? 'active' : ''}`}
              onClick={() => setSidebarOpen(false)}
            >
              <span className="nav-icon nav-icon-svg"><Icon name={item.icon} size={19} /></span>
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
            <Icon name="logout" size={17} />
            <span>{loggingOut ? 'Logging out...' : 'Logout'}</span>
          </button>
        </div>
      </aside>

      <div className="main-content">
        <header className="portal-header">
          <button
            className="mobile-menu-toggle"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label="Toggle navigation"
          >
            <Icon name="menu" size={19} color="#fff" />
          </button>
          <div className="header-title">Admin Portal</div>
          <div className="portal-header-actions">
            <Link to="/" className="portal-header-btn" title="Visit the public home page">
              <Icon name="home" size={15} /><span>Home</span>
            </Link>
            <Link to="/admin/dashboard" className="portal-header-btn primary" title="Back to admin dashboard">
              <Icon name="dashboard" size={15} /><span>Dashboard</span>
            </Link>
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
      <ProfileModal isOpen={profileOpen} onClose={() => setProfileOpen(false)} />
    </div>
  );
}
