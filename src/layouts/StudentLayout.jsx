import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Icon } from '../components/icons';
import { ProfileModal } from '../components/ProfileModal';
import { AttentionCenter } from '../components/AttentionCenter';
import { STUDENT_NAV, groupNavItems, resolveActiveNavPath } from '../utils/portalNav';
import { getRoleTerms } from '../utils/roleTerms';
import { resolveNavBadges } from '../utils/attention';
import { useAnnouncementReads } from '../utils/announcementReads';
import hytLogo from '../assets/HYT.png';
import './PortalLayout.css';
import '../components/Logo.css';

export function StudentLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const { state, signOut } = useApp();
  const { currentUser } = state;
  const location = useLocation();
  const navigate = useNavigate();

  const terms = getRoleTerms(currentUser?.role);
  const navGroups = useMemo(() => groupNavItems(STUDENT_NAV), []);

  // Longest matching nav target wins, so "/student" (Dashboard) no longer stays
  // highlighted while the user is on "/student/attendance".
  const activePath = useMemo(
    () => resolveActiveNavPath(STUDENT_NAV, location.pathname),
    [location.pathname]
  );

  const { readIds } = useAnnouncementReads(currentUser?.id);
  const badges = useMemo(
    () => resolveNavBadges({ state, userId: currentUser?.id, readIds }),
    [state, currentUser?.id, readIds]
  );

  const handleLogout = async () => {
    if (loggingOut) return; // Prevent double-click
    setLoggingOut(true);
    try {
      await signOut();
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Logout handler error:', error);
      window.location.href = '/login';
    } finally {
      setLoggingOut(false);
    }
  };

  const avatarInitial = currentUser?.fullName?.trim()?.charAt(0)?.toUpperCase()
    || currentUser?.firstName?.charAt(0)?.toUpperCase()
    || 'U';

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
          <span
            className="user-avatar"
            style={{ overflow: 'hidden', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
            aria-hidden="true"
          >
            {currentUser?.profilePicture || currentUser?.profile_picture ? (
              <img
                src={currentUser.profilePicture || currentUser.profile_picture}
                alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover' }}
              />
            ) : (
              avatarInitial
            )}
          </span>
          <span className="user-info">
            <span className="user-name" style={{ display: 'block' }}>{currentUser?.fullName}</span>
            <span className="user-role" style={{ display: 'block' }}>{terms.roleLabel}</span>
          </span>
        </button>

        <nav className="sidebar-nav" aria-label={`${terms.portalName} navigation`}>
          {navGroups.map((group) => (
            <div className="nav-group" key={group.name || 'default'}>
              {group.name && <div className="nav-group-label">{group.name}</div>}
              {group.items.map((item) => {
                const badgeCount = item.badge ? badges[item.badge] : 0;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={`nav-item ${activePath === item.path ? 'active' : ''}`}
                    aria-current={activePath === item.path ? 'page' : undefined}
                    onClick={() => setSidebarOpen(false)}
                  >
                    <span className="nav-icon nav-icon-svg"><Icon name={item.icon} size={19} /></span>
                    <span className="nav-label">{item.label}</span>
                    {badgeCount > 0 && (
                      <span className="nav-badge" aria-label={`${badgeCount} pending`}>{badgeCount}</span>
                    )}
                  </Link>
                );
              })}
            </div>
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
          <div className="header-title">{terms.portalName}</div>
          <div className="portal-header-actions">
            <Link to="/" className="portal-header-btn" title="Visit the public home page">
              <Icon name="home" size={15} /><span>Home</span>
            </Link>
            <Link to="/student/dashboard" className="portal-header-btn primary" title="Back to dashboard">
              <Icon name="dashboard" size={15} /><span>Dashboard</span>
            </Link>
            <AttentionCenter basePath="/student" />
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
