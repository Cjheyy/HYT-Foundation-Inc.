import { useEffect, useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { Icon } from '../../components/icons';
import { MarqueeRibbon } from '../../components/MarqueeRibbon';
import { DreamAcademy } from '../../components/DreamAcademy';
import { HYT_THRUSTS } from '../../data/hytThrusts';
import { useMagnetic } from '../../hooks/useMagnetic';
import { useRevealOnScroll } from '../../hooks/useRevealOnScroll';
import { CountUp } from '../../components/CountUp';
import { Swiper, SwiperSlide } from 'swiper/react';
import { Autoplay, EffectCoverflow, Pagination } from 'swiper/modules';
import { GalleryModal } from '../../components/GalleryModal';
import { Modal } from '../../components/Modal';
import { galleryItems } from '../../data/galleryData';
import { isEventActive } from '../../services/supabaseService';

// Import Swiper styles
import 'swiper/css';
import 'swiper/css/effect-coverflow';
import 'swiper/css/pagination';
import './Home.css';
// Motion layer — imported after Home.css so its rules win ties on specificity.
import './HomeMotion.css';

// The hero headline is rendered word-by-word so each word can rise out of its
// own clip box. Kept as data rather than inline spans so the stagger is derived
// from the index and the wording stays in one place.
const HERO_WORDS = ['Bringing', 'the', 'Next', 'Generation', 'Forward'];

const FEATURES = [
  {
    icon: '🎯',
    title: 'Opportunity Matching',
    description:
      'Connect with internships, OJT programs, and training opportunities that match your goals and interests',
  },
  {
    icon: '📚',
    title: 'Skill Development',
    description:
      'Access workshops, training programs, and resources to enhance your skills and competencies',
  },
  {
    icon: '🤝',
    title: 'Community Support',
    description:
      'Join a supportive community of peers, mentors, and professionals committed to youth development',
  },
  {
    icon: '🏆',
    title: 'Recognition',
    description:
      'Earn certificates and recognition for your achievements and completed experiences',
  },
];

const JOURNEY_STEPS = [
  {
    title: 'Discover',
    description: 'Explore programs and opportunities that match your interests',
  },
  {
    title: 'Apply',
    description: 'Submit your application and required documents',
  },
  {
    title: 'Prepare',
    description: 'Get ready with orientation and initial requirements',
  },
  {
    title: 'Experience',
    description: 'Participate in your program and gain valuable experience',
  },
  {
    title: 'Complete',
    description: 'Finish your journey and receive your certificate',
  },
];

const RIBBON_THRUSTS = HYT_THRUSTS.map((thrust) => thrust.name);
const RIBBON_IMPACT = [
  'Helping Youth Transcend',
  'OJT Placements',
  'Skills Training',
  'Mentorship',
  'Certificates',
  'Community',
  'Impact',
];

// Impact figures. Kept as numbers (not pre-formatted strings) because the
// bento counts them up — `suffix` carries the "+" / "%" and is rendered in its
// own <em> so it can take the accent colour independently of the digits.
const STATS = [
  { value: 500, suffix: '+', label: 'Youth Empowered' },
  { value: 50, suffix: '+', label: 'Partner Organizations' },
  { value: 100, suffix: '+', label: 'Opportunities Created' },
  { value: 95, suffix: '%', label: 'Completion Rate' },
];

const pad2 = (n) => String(n + 1).padStart(2, '0');

export function Home() {
  const navigate = useNavigate();
  const { state } = useApp();
  const { opportunities, programs } = state;
  const [selectedGalleryItem, setSelectedGalleryItem] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [authPromptOpen, setAuthPromptOpen] = useState(false);

  const magnetic = useMagnetic();

  // Page-wide scroll reveal. Fails safe: the CSS only hides [data-reveal]
  // elements once this hook has added `has-reveal` to the root, so a JS failure
  // can never leave the page stuck at opacity 0.
  const pageRef = useRef(null);
  useRevealOnScroll(pageRef);

  const publishedOpportunities = (opportunities || [])
    .filter((opportunity) => String(opportunity.status).toLowerCase() === 'published' && isEventActive(opportunity))
    .slice(0, 3);

  const publishedPrograms = (programs || [])
    .filter((program) => String(program.status).toLowerCase() === 'published' && isEventActive(program))
    .slice(0, 3);

  const handleSlideClick = (item) => {
    setSelectedGalleryItem(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => {
      setSelectedGalleryItem(null);
    }, 300);
  };

  /* ---------------------------------------------------------------------
     "What We Do" pinned horizontal scroll
     --------------------------------------------------------------------- */

  const wwdSectionRef = useRef(null);
  const wwdTrackRef = useRef(null);
  const wwdBarRef = useRef(null);
  const [pinned, setPinned] = useState(false);

  // Pinned mode depends on three things, so it is decided at runtime rather
  // than in CSS alone:
  //   - `overflow: clip` support — without it `.home-page` would fall back to
  //     `overflow-x: hidden`, which creates a scroll container and silently
  //     kills `position: sticky`.
  //   - a wide viewport — below 769px the cards stack and horizontal travel is
  //     pointless (and would fight touch scrolling).
  //   - motion being allowed.
  useEffect(() => {
    // `matchMedia` is genuinely absent in some environments (jsdom, very old
    // browsers), and every other motion hook in the codebase guards it. A
    // missing API falls back to `false`, which keeps the section in its static
    // stacked layout — the safe default.
    const query = (mq) => (
      typeof window.matchMedia === 'function' ? window.matchMedia(mq).matches : false
    );

    const decide = () => {
      const supportsClip =
        typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('overflow', 'clip');
      const wide = query('(min-width: 769px)');
      const still = query('(prefers-reduced-motion: reduce)');
      setPinned(supportsClip && wide && !still);
    };

    decide();
    window.addEventListener('resize', decide);
    return () => window.removeEventListener('resize', decide);
  }, []);

  // Drive the horizontal translate from how far the sticky section has been
  // scrolled through. `-rect.top / span` gives 0 at the moment the section
  // pins and 1 when it is about to release.
  useEffect(() => {
    if (!pinned) return undefined;

    // Captured once: the cleanup closure must not read `.current` later, since
    // by then React may have swapped the node out.
    const sectionEl = wwdSectionRef.current;
    const trackEl = wwdTrackRef.current;
    const barEl = wwdBarRef.current;

    let raf = 0;
    const tick = () => {
      if (sectionEl && trackEl) {
        const rect = sectionEl.getBoundingClientRect();
        const span = rect.height - window.innerHeight;
        const progress = span > 0 ? Math.min(1, Math.max(0, -rect.top / span)) : 0;

        const parent = trackEl.parentElement;
        const travel = Math.max(0, trackEl.scrollWidth - (parent ? parent.clientWidth : 0));

        trackEl.style.transform = `translate3d(${(-progress * travel).toFixed(2)}px, 0, 0)`;
        if (barEl) {
          barEl.style.width = `${(progress * 100).toFixed(2)}%`;
        }
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      // Leaving pinned mode (e.g. rotated to portrait) must clear the inline
      // transform, or the grid renders shifted.
      if (trackEl) trackEl.style.transform = '';
    };
  }, [pinned]);

  /* ---------------------------------------------------------------------
     "Your Journey" self-drawing path
     --------------------------------------------------------------------- */

  const journeyRef = useRef(null);
  const journeyPathRef = useRef(null);
  const [litSteps, setLitSteps] = useState(0);
  // Dimming un-reached steps is only safe once JS is definitely running —
  // otherwise a JS failure would leave the timeline permanently faded.
  const [journeyReady, setJourneyReady] = useState(false);

  useEffect(() => {
    let raf = 0;
    const tick = () => {
      const journey = journeyRef.current;
      const path = journeyPathRef.current;

      if (journey && path) {
        setJourneyReady(true);

        const rect = journey.getBoundingClientRect();
        const progress = Math.min(1, Math.max(0, (window.innerHeight * 0.85 - rect.top) / rect.height));

        // pathLength="1" normalises the geometry, so 1 → 0 is the whole draw.
        path.style.strokeDashoffset = String(1 - progress);
        setLitSteps(Math.floor(progress * JOURNEY_STEPS.length + 0.001));
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <div className="home-page" ref={pageRef}>
      {/* Hero Section */}
      <section className="hero">
        {/* Decorative layers — aurora blobs behind, cursor spotlight above. */}
        <div className="hero-aurora" aria-hidden="true">
          <span className="blob blob-1" />
          <span className="blob blob-2" />
          <span className="blob blob-3" />
        </div>
        <div className="hero-spot" aria-hidden="true" />

        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              {HERO_WORDS.map((word, index) => (
                <span
                  key={word}
                  className="hero-word"
                  style={{ '--wd': `${0.06 + index * 0.08}s` }}
                >
                  <span
                    className={
                      index === HERO_WORDS.length - 1
                        ? 'hero-word-inner is-accent'
                        : 'hero-word-inner'
                    }
                  >
                    {word}
                  </span>
                </span>
              ))}
            </h1>
            <p className="hero-subtitle">
              Discover opportunities, build experience, develop your skills, and grow with HYT Foundation
            </p>
            <div className="hero-actions">
              <Button size="lg" onClick={() => navigate('/opportunities')} {...magnetic}>
                Explore Opportunities
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/register')} {...magnetic}>
                Join HYT
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Accomplishments Gallery — landscape coverflow. Deliberately the first
          section after the hero: this is the highlight, so it should not be
          buried at the bottom of the page. */}
      <section className="section bg-white">
        <div className="container">
          <div className="section-header" data-reveal>
            <h2 className="section-title">Our Accomplishments</h2>
            <p className="section-subtitle">
              Celebrating milestones and impact in youth development
            </p>
          </div>

          <Swiper
            effect={'coverflow'}
            grabCursor={true}
            centeredSlides={true}
            slidesPerView={'auto'}
            loop={true}
            // Gentler rotate + a little more depth than the old portrait config:
            // landscape slides are wider, so 50deg swung them too far out.
            coverflowEffect={{
              rotate: 38,
              stretch: 0,
              depth: 120,
              modifier: 1,
              slideShadows: true,
            }}
            autoplay={{
              delay: 2000,
              disableOnInteraction: false,
              pauseOnMouseEnter: false,
            }}
            speed={800}
            pagination={{
              clickable: true,
            }}
            modules={[Autoplay, EffectCoverflow, Pagination]}
            className="accomplishments-swiper"
          >
            {galleryItems.map((item) => (
              <SwiperSlide key={item.id}>
                <div
                  className="swiper-slide-content"
                  onClick={() => handleSlideClick(item)}
                  style={{ cursor: 'pointer' }}
                >
                  <img src={item.image} alt={item.title} />
                  <div className="swiper-slide-caption">
                    <h3>{item.title}</h3>
                    <p>{item.description}</p>
                  </div>
                  <div className="swiper-slide-overlay">
                    <span className="view-details-btn">View Details</span>
                  </div>
                </div>
              </SwiperSlide>
            ))}
          </Swiper>
        </div>
      </section>

      {/* Gallery Modal */}
      <GalleryModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        galleryItem={selectedGalleryItem}
      />

      {/* What HYT Does — pinned horizontal scroll when the viewport allows it */}
      <section
        ref={wwdSectionRef}
        className={`section what-we-do${pinned ? ' is-pinned' : ''}`}
      >
        <div className="wwd-pin">
          <div className="container">
            <div className="section-header" data-reveal>
              <h2 className="section-title">What We Do</h2>
              <p className="section-subtitle">
                Empowering youth through comprehensive development programs
              </p>
            </div>

            {/* The viewport clips and edge-fades the track; the track itself
                carries the transform. Wrapping is what keeps the fade off the
                section heading. */}
            <div className="wwd-viewport">
              <div ref={wwdTrackRef} className="wwd-track">
                {FEATURES.map((feature) => (
                  <Card key={feature.title} className="feature-card">
                    <div className="feature-icon">{feature.icon}</div>
                    <h3 className="feature-title">{feature.title}</h3>
                    <p className="feature-description">{feature.description}</p>
                  </Card>
                ))}
              </div>
            </div>

            {pinned && (
              <div className="wwd-progress" aria-hidden="true">
                <span ref={wwdBarRef} />
              </div>
            )}
          </div>
        </div>
      </section>

      {/* 8 HYT Thrusts — M2 "Seam". The eight names run as two marquees on an
          ink floor, with the logo ramp on the seam above them.
          The rail + pane are gone: the pane held each thrust's *meaning*, and
          that now lives on the About page — which is what the button below
          points at. So a second, static copy of the names up here would only
          repeat what the ribbons already say. */}
      <section className="thrusts-seam">
        <div className="seam-top container">
          <div className="section-header" data-reveal>
            <div className="seam-kicker">Eight thrusts · one direction</div>
            <h2 className="section-title">The 8 HYT Thrusts</h2>
            <p className="section-subtitle">
              See how each thrust shapes our work — every programme we run maps
              back to one of the eight.
            </p>
          </div>
        </div>

        {/* The seam itself: the logo ramp, static. It IS the divider, so it gets
            no shadow and no animation. */}
        <div className="seam-ramp" aria-hidden="true" />

        <div className="seam-floor">
          <div className="rib-stack">
            <MarqueeRibbon items={RIBBON_THRUSTS} tone="ink" speed={38} />
            <MarqueeRibbon items={RIBBON_IMPACT} tone="tri" reverse speed={30} />
          </div>
          <div className="seam-floor-cta container" data-reveal>
            <Link className="seam-cta-link" to="/about#thrusts">
              What the 8 Thrusts mean →
            </Link>
          </div>
        </div>
      </section>

      {/* Featured OJT Postings */}
      {publishedOpportunities.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header" data-reveal>
              <h2 className="section-title">Featured OJT Postings</h2>
              <Link to="/opportunities">
                <Button variant="ghost">View All →</Button>
              </Link>
            </div>

            <div className="grid grid-3">
              {publishedOpportunities.map((opp) => (
                <Card
                  key={opp.id}
                  clickable
                  data-reveal
                  className="reveal-card"
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                >
                  <span className="reveal-wipe" aria-hidden="true" />
                  <h3 className="card-title">{opp.title}</h3>
                  <p className="card-org">{opp.organization}</p>
                  <p className="card-description">{String(opp.description || '').substring(0, 100)}...</p>
                  <div className="card-meta">
                    <span className="meta-item"><Icon name="pin" size={14} /> {opp.location}</span>
                    <span className="meta-item"><Icon name="clock" size={14} /> {opp.requiredHours} hours</span>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <Button size="sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); navigate(`/opportunities/${opp.id}`); }}>View Details</Button>
                    <Button size="sm" variant="outline" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); if (!state.currentUser) setAuthPromptOpen(true); else navigate(`/opportunities/${opp.id}`); }}>Apply Now</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Featured Trainee Programs & Events */}
      {publishedPrograms.length > 0 && (
        <section className="section bg-white">
          <div className="container">
            <div className="section-header" data-reveal>
              <h2 className="section-title">Featured Trainee Programs &amp; Events</h2>
              <Link to="/programs">
                <Button variant="ghost">View All →</Button>
              </Link>
            </div>
            <div className="grid grid-3">
              {publishedPrograms.map((program) => (
                <Card
                  key={program.id}
                  clickable
                  data-reveal
                  className="reveal-card"
                  onClick={() => navigate(`/programs/${program.id}`)}
                >
                  <span className="reveal-wipe" aria-hidden="true" />
                  <h3 className="card-title">{program.title}</h3>
                  <p className="card-description">{String(program.description || '').substring(0, 100)}...</p>
                  <div className="card-meta">
                    <span className="meta-item"><Icon name="pin" size={14} /> {program.location}</span>
                    <span className="meta-item"><Icon name="calendar" size={14} /> {program.schedule}</span>
                  </div>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <Button size="sm" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); navigate(`/programs/${program.id}`); }}>View Details</Button>
                    <Button size="sm" variant="outline" style={{ flex: 1 }} onClick={(e) => { e.stopPropagation(); if (!state.currentUser) setAuthPromptOpen(true); else navigate(`/programs/${program.id}`); }}>Apply Now</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {authPromptOpen && (
        <Modal
          isOpen={authPromptOpen}
          onClose={() => setAuthPromptOpen(false)}
          title="Please sign in to apply"
          size="sm"
        >
          <p className="text-muted">
            Guests can browse details freely. Create an account or log in to submit an application.
          </p>
          <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
            <Button variant="outline" style={{ flex: 1 }} onClick={() => setAuthPromptOpen(false)}>Continue Browsing</Button>
            <Button style={{ flex: 1 }} onClick={() => navigate('/login')}>Login / Register</Button>
          </div>
        </Modal>
      )}

      {/* Impact figures — bento (B3). The first figure becomes a full-height ink
          hero panel, so the four numbers stop competing at equal weight and the
          section commits to a hierarchy. */}
      <section className="section stats-section">
        <div className="container">
          <div className="bento-grid">
            {STATS.map((stat, index) => (
              <div
                key={stat.label}
                data-reveal
                className={[
                  'bento-cell',
                  index === 0 ? 'bento-hero' : '',
                  index === STATS.length - 1 ? 'bento-wide' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                <div className="bento-index" aria-hidden="true">{pad2(index)}</div>
                <div className="bento-value">
                  <CountUp
                    value={stat.value}
                    suffix={stat.suffix}
                    duration={index === 0 ? 1600 : 1400}
                  />
                </div>
                <div className="bento-label">{stat.label}</div>
                {index === 0 && (
                  <p className="bento-note">
                    Young people who have completed at least one HYT programme.
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Youth Journey */}
      <section className="section bg-white">
        <div className="container">
          <div className="section-header" data-reveal>
            <h2 className="section-title">Your Journey with HYT</h2>
            <p className="section-subtitle">
              From discovery to completion, we support you every step of the way
            </p>
          </div>

          <div
            className={`journey-timeline${journeyReady ? ' is-ready' : ''}`}
            ref={journeyRef}
          >
            {/* Horizontal connector that draws itself as the section scrolls.
                viewBox is 1000 wide and the line runs 8.8%→91.2%, which is the
                centre of the first and last column in a 5-column grid
                (5 equal columns, 32px gaps) — so the line terminates *under*
                the first and last circles.
                `preserveAspectRatio="none"` lets it stretch to any width. */}
            <svg
              className="journey-path"
              viewBox="0 0 1000 4"
              preserveAspectRatio="none"
              aria-hidden="true"
              focusable="false"
            >
              <defs>
                {/* userSpaceOnUse, NOT the default objectBoundingBox: this path
                    is perfectly horizontal, so its bounding box has zero height
                    and a bounding-box gradient is degenerate — the stroke then
                    renders as nothing at all. */}
                <linearGradient
                  id="journeyPathGrad"
                  gradientUnits="userSpaceOnUse"
                  x1="0"
                  y1="0"
                  x2="1000"
                  y2="0"
                >
                  <stop offset="0%" stopColor="#279EB6" />
                  <stop offset="55%" stopColor="#D57156" />
                  <stop offset="100%" stopColor="#F3DB6E" />
                </linearGradient>
              </defs>
              <path ref={journeyPathRef} d="M88 2 H912" pathLength="1" />
            </svg>

            {JOURNEY_STEPS.map((step, index) => (
              <div
                key={step.title}
                className={`journey-step${index < litSteps ? ' is-lit' : ''}`}
                data-reveal
              >
                <div className="step-number">{index + 1}</div>
                <h3 className="step-title">{step.title}</h3>
                <p className="step-description">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Dream Academy — the closing section. Replaced the generic
          "Ready to Start Your Journey?" CTA, which was removed on request. */}
      <DreamAcademy />
    </div>
  );
}
