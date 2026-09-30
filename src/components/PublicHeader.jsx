import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { normalizeRole } from '../services/supabaseService';
import { Icon } from './icons';
import hytLogo from '../assets/HYT.png';
import './PublicHeader.css';
import './Logo.css';

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { state } = useApp();
  const { currentUser } = state;
  const navigate = useNavigate();

  return (
    <header className="public-header">
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo">
            <img src={hytLogo} alt="HYT Foundation" className="header-logo" />
          </Link>

          <button 
            className="mobile-menu-toggle"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
            aria-expanded={mobileMenuOpen}
          >
            <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={20} />
          </button>

          <nav className={`nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
            <Link to="/" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Home</Link>
            <Link to="/about" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>About</Link>
            <Link to="/programs" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Trainee Programs & Events</Link>
            <Link to="/opportunities" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>OJT Postings</Link>
            <Link to="/impact" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Our Impact</Link>
            <Link to="/contact" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Contact</Link>
          </nav>

          <div className={`header-actions ${mobileMenuOpen ? 'open' : ''}`}>
            {currentUser ? (
              <>
                <Link
                  to="/"
                  className="btn btn-outline btn-sm"
                  onClick={() => setMobileMenuOpen(false)}
                  title="Go to public landing page"
                >
                  Home
                </Link>
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => {
                    setMobileMenuOpen(false);
                    const role = normalizeRole(currentUser.role);
                    if (role === 'ADMIN') {
                      navigate('/admin/dashboard');
                    } else if (role === 'OJT/INTERN') {
                      navigate('/student/dashboard');
                    } else if (role === 'TRAINEE') {
                      navigate('/trainee/dashboard');
                    } else {
                      navigate('/');
                    }
                  }}
                >
                  Dashboard
                </button>
              </>
            ) : (
              <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                <button className="btn btn-primary btn-sm">Login</button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
