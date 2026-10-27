import { Link, useNavigate } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { normalizeRole } from '../services/supabaseService';
import { Icon } from './icons';
import { ThemeToggle } from './ThemeToggle';
import hytLogo from '../assets/HYT.png';
import './PublicHeader.css';
import './Logo.css';

/* The width at which the desktop row stops fitting and the drawer takes over.
   Kept in one place so the CSS breakpoint and the "close the drawer on resize"
   check can never drift apart. */
const MOBILE_BREAKPOINT = 1180;

const NAV_LINKS = [
  { to: '/', label: 'Home' },
  { to: '/about', label: 'About' },
  // Programs and Events are two separate listings, so they get two separate
  // entries - the combined "Programs & Events" link is gone.  The order
  // matches the sidebar of both portals, where Programmes come before Events.
  { to: '/programs', label: 'Programs' },
  { to: '/events', label: 'Events' },
  { to: '/opportunities', label: 'OJT Postings' },
  { to: '/impact', label: 'Our Impact' },
  { to: '/contact', label: 'Contact' }
];

export function PublicHeader() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const headerRef = useRef(null);
  const { state } = useApp();
  const { currentUser } = state;
  const navigate = useNavigate();

  const closeMenu = () => setMobileMenuOpen(false);

  /* While the drawer is open: close it on Escape, on a tap outside the header,
     and on a resize back into the desktop row.  One effect owns all three so
     there is a single place that adds and removes the listeners. */
  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      if (headerRef.current && !headerRef.current.contains(event.target)) {
        setMobileMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setMobileMenuOpen(false);
    };
    const handleResize = () => {
      if (window.innerWidth > MOBILE_BREAKPOINT) setMobileMenuOpen(false);
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown, { passive: true });
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('resize', handleResize);

    /* Stop the page behind the drawer from scrolling under it. */
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('resize', handleResize);
      document.body.style.overflow = previousOverflow;
    };
  }, [mobileMenuOpen]);

  const goToDashboard = () => {
    closeMenu();
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
  };

  return (
    <header className="public-header" ref={headerRef}>
      <div className="container">
        <div className="header-content">
          <Link to="/" className="logo" onClick={closeMenu}>
            <img src={hytLogo} alt="HYT Foundation" className="header-logo" />
          </Link>

          <button
            type="button"
            className={`mobile-menu-toggle ${mobileMenuOpen ? 'open' : ''}`}
            onClick={() => setMobileMenuOpen((open) => !open)}
            aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
            aria-expanded={mobileMenuOpen}
            aria-controls="public-nav-panel"
          >
            <Icon name={mobileMenuOpen ? 'x' : 'menu'} size={20} />
          </button>

          {/* One wrapper, one panel. It used to be two siblings - `.nav-menu`
              and `.header-actions` - each absolutely positioned at `top: 100%`,
              with the actions pushed down by a hard-coded `margin-top: 280px`.
              That magic number only matched the height of the seven links by
              coincidence, so on short viewports the two panels drew on top of
              each other. On desktop the wrapper is `display: contents`, so the
              links and buttons still behave as direct children of the row. */}
          <div
            id="public-nav-panel"
            className={`header-menu ${mobileMenuOpen ? 'open' : ''}`}
          >
            <nav className="nav-menu" aria-label="Main navigation">
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="nav-link"
                  onClick={() => {
                    closeMenu();
                    window.scrollTo(0, 0);
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            <div className="header-actions">
              <ThemeToggle />
              {currentUser ? (
                <>
                  <Link
                    to="/"
                    className="btn btn-outline btn-sm"
                    onClick={closeMenu}
                    title="Go to public landing page"
                  >
                    Home
                  </Link>
                  <button type="button" className="btn btn-primary btn-sm" onClick={goToDashboard}>
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
                  onClick={closeMenu}
                >
                  <Icon name="user" size={18} />
                  <span>Log In</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
