import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import hytLogo from '../assets/HYT.png';
import './PortalLayout.css';
import '../components/Logo.css';

export function StudentLayout({ children }) {
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
    { path: '/student', label: 'Dashboard', icon: '📊' },
    { path: '/student/profile', label: 'My Profile', icon: '👤' },
    { path: '/student/programs', label: 'Programs', icon: '📚' },
    { path: '/student/opportunities', label: 'Opportunities', icon: '🎯' },
    { path: '/student/applications', label: 'My Applications', icon: '📝' },
    { path: '/student/requirements', label: 'Requirements', icon: '📄' },
    { path: '/student/ojt', label: 'OJT / Experience', icon: '💼' },
    { path: '/student/attendance', label: 'Attendance', icon: '✓' },
    { path: '/student/daily-reports', label: 'Daily Reports', icon: '📋' },
    { path: '/student/certificates', label: 'Certificates', icon: '🏆' },
    { path: '/student/announcements', label: 'Announcements', icon: '📢' }
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
          <div className="user-avatar">
            {currentUser?.firstName?.charAt(0) || 'U'}
          </div>
          <div className="user-info">
            <div className="user-name">{currentUser?.fullName}</div>
            <div className="user-role">Student</div>
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
          <div className="header-title">Student Portal</div>
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
