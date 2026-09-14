import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useApp } from '../context/AppContext';
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
          >
            {mobileMenuOpen ? '✕' : '☰'}
          </button>

          <nav className={`nav-menu ${mobileMenuOpen ? 'open' : ''}`}>
            <Link to="/" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Home</Link>
            <Link to="/about" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>About</Link>
            <Link to="/programs" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Programs</Link>
            <Link to="/opportunities" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Opportunities</Link>
            <Link to="/impact" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Our Impact</Link>
            <Link to="/contact" className="nav-link" onClick={() => { setMobileMenuOpen(false); window.scrollTo(0, 0); }}>Contact</Link>
          </nav>

          <div className={`header-actions ${mobileMenuOpen ? 'open' : ''}`}>
            {currentUser ? (
              <button 
                className="btn btn-primary btn-sm"
                onClick={() => {
                  setMobileMenuOpen(false);
                  if (currentUser.role === 'STUDENT') {
                    navigate('/student');
                  } else {
                    navigate('/admin');
                  }
                }}
              >
                Dashboard
              </button>
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
