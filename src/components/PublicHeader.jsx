import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { normalizeRole } from '../services/supabaseService';
import { Icon } from './icons';
import { ThemeToggle } from './ThemeToggle';
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
            {/* Programs and Events are two separate listings, so they get two
                separate entries - the combined "Programs & Events" link is
                gone.  The order matches the sidebar of both portals, where
                Programmes come before Events. */}
            <Link to="/programs" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Programs</Link>
            <Link to="/events" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Events</Link>
            <Link to="/opportunities" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>OJT Postings</Link>
            <Link to="/impact" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Our Impact</Link>
            <Link to="/contact" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Contact</Link>
          </nav>

          <div className={`header-actions ${mobileMenuOpen ? 'open' : ''}`}>
            <ThemeToggle />
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
              /* A single <Link> styled as a button. The previous markup was a
                 <button> nested inside a <Link> - two interactive elements one
                 inside the other, which is invalid and gives the control two
                 conflicting roles. It was also btn-sm, which made the primary
                 call to action the smallest thing in the header. */
              <Link
                to="/login"
                className="btn btn-primary header-login-btn"
                onClick={() => setMobileMenuOpen(false)}
              >
                <Icon name="user" size={18} />
                <span>Log In</span>
              </Link>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}
