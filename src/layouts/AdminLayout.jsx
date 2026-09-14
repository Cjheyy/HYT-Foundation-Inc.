import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import hytLogo from '../assets/HYT.png';
import './PortalLayout.css';
import '../components/Logo.css';

export function AdminLayout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = () => {
    dispatch({ type: 'LOGOUT' });
    navigate('/');
  };

  const isActive = (path) => {
    return location.pathname === path || location.pathname.startsWith(path + '/');
  };

  const navItems = [
    { path: '/admin', label: 'Dashboard', icon: '📊' },
    { path: '/admin/students', label: 'Students', icon: '👥' },
    { path: '/admin/programs', label: 'Programs', icon: '📚' },
    { path: '/admin/opportunities', label: 'Opportunities', icon: '🎯' },
    { path: '/admin/applications', label: 'Applications', icon: '📝' },
    { path: '/admin/attendance', label: 'Attendance Verification', icon: '✓' },
    { path: '/admin/ojt', label: 'OJT Monitoring', icon: '💼' },
    { path: '/admin/daily-reports', label: 'Daily Reports', icon: '📋' },
    { path: '/admin/requirements', label: 'Requirements', icon: '📄' },
    { path: '/admin/certificates', label: 'Certificates', icon: '🏆' },
    { path: '/admin/announcements', label: 'Announcements', icon: '📢' },
    { path: '/admin/reports', label: 'Reports', icon: '📈' }
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
          <button className="logout-btn" onClick={handleLogout}>
            <span>🚪</span>
            <span>Logout</span>
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
