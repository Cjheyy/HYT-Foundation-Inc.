import { useCallback, useEffect, useRef, useState } from 'react';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons';
import { PartnerModal } from '../../components/PartnerModal';
import { PartnerLogo } from '../../components/PartnerLogo';
import { HYT_THRUSTS } from '../../data/hytThrusts';
import { PARTNER_ORGANIZATIONS, partnerAccentVars } from '../../data/partnerOrganizations';
import './About.css';

/**
 * Feeds the cursor position into the card so the spotlight highlight follows
 * the pointer.  Written straight to the element's style to avoid a React
 * re-render on every mouse move.
 */
const trackPointerGlow = (event) => {
  const el = event.currentTarget;
  const rect = el.getBoundingClientRect();
  el.style.setProperty('--mx', `${event.clientX - rect.left}px`);
  el.style.setProperty('--my', `${event.clientY - rect.top}px`);
};

/**
 * A tile only opens its dialog once the pointer has rested on it, so sweeping
 * the cursor across the grid does not fire eleven dialogs in a row.
 */
const HOVER_OPEN_DELAY_MS = 200;

export function About() {
  const thrusts = HYT_THRUSTS;
  const [activePartner, setActivePartner] = useState(null);
  const openTimerRef = useRef(null);
  /** True while the pointer is still resting on a tile whose dialog just closed. */
  const suppressHoverRef = useRef(false);

  /** Cancel an open that has not fired yet — never closes an open dialog. */
  const cancelPendingOpen = useCallback(() => {
    if (openTimerRef.current) {
      clearTimeout(openTimerRef.current);
      openTimerRef.current = null;
    }
  }, []);

  /**
   * Closing deliberately does NOT happen on mouse-leave.
   *
   * The dialog renders a full-viewport backdrop, so the moment it opens the
   * pointer is no longer over the tile — a mouse-leave close would fire
   * immediately, the dialog would close, the tile would be hovered again, and
   * the two would flicker forever.  The dialog is dismissed the way a modal
   * should be: backdrop click, the close control, or Escape.
   *
   * `suppressHoverRef` guards the mirror-image trap: when the overlay unmounts
   * the pointer is usually still over the tile, so the browser fires a fresh
   * `mouseenter` and the dialog would re-open instantly — making the close look
   * broken.  The flag is cleared the next time the pointer actually leaves.
   */
  const closePartner = useCallback(() => {
    suppressHoverRef.current = true;
    cancelPendingOpen();
    setActivePartner(null);
  }, [cancelPendingOpen]);

  /** Arm the delayed open; a second call replaces the pending one. */
  const scheduleOpen = useCallback((partner) => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
    openTimerRef.current = setTimeout(() => {
      openTimerRef.current = null;
      setActivePartner(partner);
    }, HOVER_OPEN_DELAY_MS);
  }, []);

  const handleTileEnter = useCallback(
    (partner) => {
      if (suppressHoverRef.current) return;
      scheduleOpen(partner);
    },
    [scheduleOpen]
  );

  const handleTileLeave = useCallback(() => {
    suppressHoverRef.current = false;
    cancelPendingOpen();
  }, [cancelPendingOpen]);

  // A hover still in flight must not set state after the page unmounts.
  useEffect(() => () => {
    if (openTimerRef.current) clearTimeout(openTimerRef.current);
  }, []);

  return (
    <div className="about-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">About HYT Foundation</h1>
          <p className="page-subtitle">
            Helping Youth Transcend Foundation Inc. is dedicated to bringing the next generation forward
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="content-grid">
            <div>
              <h2 className="content-title">Who We Are</h2>
              <p className="content-text">
                Helping Youth Transcend (HYT) Foundation Inc. is a youth-focused organization committed to 
                empowering the next generation through comprehensive development programs, meaningful opportunities, 
                and strong community support.
              </p>
              <p className="content-text">
                We believe that every young person has the potential to excel and make a positive impact in their 
                communities. Through our platform and programs, we connect youth with opportunities that help them 
                discover their passions, develop their skills, and build their future.
              </p>
            </div>
            <Card className="info-card">
              <h3 className="card-heading">Our Vision</h3>
              <p className="card-text">
                "Establish a competent society of young professional leaders and entrepreneurs through honing their vocational aptitude with the means of advanced technology, innovating creations to serve the world."
              </p>
              <h3 className="card-heading" style={{ marginTop: '24px' }}>Our Mission</h3>
              <p className="card-text">
                "Guiding young and aspiring generation leaders by professionally mentoring them, developing a social responsibility and empowering them to pass it forward to future generations while growing internationally."
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="section bg-white" id="thrusts">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">The 8 HYT Thrusts</h2>
            <p className="section-subtitle">
              Our comprehensive framework for youth development
            </p>
          </div>

          <div className="thrusts-list">
            {thrusts.map((thrust, index) => (
              <article
                key={thrust.name}
                className="thrust-item"
                style={{ '--i': index }}
                onMouseMove={trackPointerGlow}
              >
                <span className="thrust-glow" aria-hidden="true" />
                <span className="thrust-number" aria-hidden="true">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <div className="thrust-content">
                  <h3 className="thrust-title">{thrust.name}</h3>
                  <p className="thrust-description">{thrust.description}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="section" id="partners">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Our Partner Organizations</h2>
            <p className="section-subtitle">
              Companies and institutions hosting HYT youth across Metro Manila
            </p>
          </div>

          {/*
            Tiles open their dialog on hover — there is no click-to-open step for
            a pointer.  `onClick` is kept only as the touch and keyboard path:
            a tap has no hover, and a real <button> fires click on Enter/Space,
            which is how a keyboard user opens the dialog.  It is not the
            primary affordance and nothing about the tile invites a click.
          */}
          <div className="partners-grid">
            {PARTNER_ORGANIZATIONS.map((partner) => (
              <button
                type="button"
                key={partner.key}
                className="partner-chip"
                style={partnerAccentVars(partner.accent, partner.accentDeep)}
                onMouseEnter={() => handleTileEnter(partner)}
                onMouseLeave={handleTileLeave}
                onMouseMove={trackPointerGlow}
                onClick={() => setActivePartner(partner)}
                aria-haspopup="dialog"
              >
                <span className="partner-chip-glow" aria-hidden="true" />
                <PartnerLogo partner={partner} />
                <span className="partner-name">{partner.name}</span>
                <span className="partner-chip-hint" aria-hidden="true">
                  <Icon name="info" size={16} />
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">What We Offer</h2>
          </div>
          
          <div className="grid grid-3">
            <Card>
              <div className="offer-icon"><Icon name="target" size={28} /></div>
              <h3 className="offer-title">Opportunity Matching</h3>
              <p className="offer-description">
                We connect youth with internships, OJT programs, training opportunities, and community programs
                that align with their interests and career goals.
              </p>
            </Card>

            <Card>
              <div className="offer-icon"><Icon name="book" size={28} /></div>
              <h3 className="offer-title">Skills Development</h3>
              <p className="offer-description">
                Access workshops, seminars, training programs, and resources designed to develop both technical
                and soft skills essential for personal and professional growth.
              </p>
            </Card>

            <Card>
              <div className="offer-icon"><Icon name="users" size={28} /></div>
              <h3 className="offer-title">Community Network</h3>
              <p className="offer-description">
                Join a supportive community of fellow youth, mentors, professionals, and organizations
                committed to youth development and empowerment.
              </p>
            </Card>

            <Card>
              <div className="offer-icon"><Icon name="briefcase" size={28} /></div>
              <h3 className="offer-title">Experience Tracking</h3>
              <p className="offer-description">
                Comprehensive system for tracking attendance, progress, daily activities, and achievements
                throughout your development journey.
              </p>
            </Card>

            <Card>
              <div className="offer-icon"><Icon name="file" size={28} /></div>
              <h3 className="offer-title">Application Management</h3>
              <p className="offer-description">
                Streamlined application process with document management, requirement tracking, and
                real-time status updates throughout your application journey.
              </p>
            </Card>

            <Card>
              <div className="offer-icon"><Icon name="award" size={28} /></div>
              <h3 className="offer-title">Recognition</h3>
              <p className="offer-description">
                Earn certificates and recognition for completed programs, verified experiences, and
                achievements that demonstrate your growth and capabilities.
              </p>
            </Card>
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Our Commitment</h2>
          </div>
          
          <div className="commitment-content">
            <p className="content-text large">
              We are committed to providing a platform that genuinely supports youth development. 
              Every feature, every process, and every opportunity we offer is designed with the youth's 
              best interests in mind.
            </p>
            <p className="content-text large">
              Through technology, partnerships, and community engagement, we're building an ecosystem 
              where young Filipinos can discover their potential, develop their capabilities, and create 
              their own paths to success.
            </p>
          </div>
        </div>
      </section>

      <PartnerModal partner={activePartner} onClose={closePartner} />
    </div>
  );
}
