import { Link } from 'react-router-dom';
import hytLogo from '../assets/HYT.png';
import './PublicFooter.css';
import './Logo.css';

export function PublicFooter() {
  const handleLinkClick = () => {
    window.scrollTo(0, 0);
  };

  return (
    <footer className="public-footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-section">
            <div className="footer-logo">
              <img src={hytLogo} alt="HYT Foundation" className="footer-logo-image" />
            </div>
            <p className="footer-tagline">Bringing the Next Generation Forward</p>
            <p className="footer-description">
              Empowering youth through programs, opportunities, and community development.
            </p>
          </div>

          <div className="footer-section">
            <h4 className="footer-title">Quick Links</h4>
            <ul className="footer-links">
              <li><Link to="/about" onClick={handleLinkClick}>About Us</Link></li>
              <li><Link to="/programs" onClick={handleLinkClick}>Programs</Link></li>
              <li><Link to="/opportunities" onClick={handleLinkClick}>Opportunities</Link></li>
              <li><Link to="/impact" onClick={handleLinkClick}>Our Impact</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-title">Get Started</h4>
            <ul className="footer-links">
              <li><Link to="/register" onClick={handleLinkClick}>Create Account</Link></li>
              <li><Link to="/login" onClick={handleLinkClick}>Login</Link></li>
              <li><Link to="/contact" onClick={handleLinkClick}>Contact Us</Link></li>
            </ul>
          </div>

          <div className="footer-section">
            <h4 className="footer-title">Contact</h4>
            <ul className="footer-links">
              <li>Email: info@hyt-foundation.org</li>
              <li>Phone: +63 2 1234 5678</li>
              <li>Address: Quezon City, Metro Manila</li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Helping Youth Transcend Foundation Inc. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
