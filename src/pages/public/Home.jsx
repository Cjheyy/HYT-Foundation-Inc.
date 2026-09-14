import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import './Home.css';

export function Home() {
  const navigate = useNavigate();
  const { state } = useApp();
  const { opportunities } = state;

  const publishedOpportunities = opportunities.filter(o => o.status === 'Published').slice(0, 3);

  const thrusts = [
    { name: 'Education', icon: '📚', color: '#279EB6' },
    { name: 'Enhancement', icon: '⚡', color: '#D57156' },
    { name: 'Experience', icon: '💼', color: '#F3DB6E' },
    { name: 'Entrepreneurship', icon: '💡', color: '#8DD0DE' },
    { name: 'Endurance', icon: '💪', color: '#D85A3E' },
    { name: 'Exploration', icon: '🗺️', color: '#279EB6' },
    { name: 'Empowerment', icon: '🌟', color: '#D57156' },
    { name: 'Enlightenment', icon: '✨', color: '#F3DB6E' }
  ];

  const stats = [
    { value: '500+', label: 'Youth Empowered' },
    { value: '50+', label: 'Partner Organizations' },
    { value: '100+', label: 'Opportunities Created' },
    { value: '95%', label: 'Completion Rate' }
  ];

  return (
    <div className="home-page">
      {/* Hero Section */}
      <section className="hero">
        <div className="container">
          <div className="hero-content">
            <h1 className="hero-title">
              Bringing the Next Generation Forward
            </h1>
            <p className="hero-subtitle">
              Discover opportunities, build experience, develop your skills, and grow with HYT Foundation
            </p>
            <div className="hero-actions">
              <Button size="lg" onClick={() => navigate('/opportunities')}>
                Explore Opportunities
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/register')}>
                Join HYT
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* What HYT Does */}
      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">What We Do</h2>
            <p className="section-subtitle">
              Empowering youth through comprehensive development programs
            </p>
          </div>
          
          <div className="features-grid">
            <Card className="feature-card">
              <div className="feature-icon">🎯</div>
              <h3 className="feature-title">Opportunity Matching</h3>
              <p className="feature-description">
                Connect with internships, OJT programs, and training opportunities that match your goals and interests
              </p>
            </Card>
            
            <Card className="feature-card">
              <div className="feature-icon">📚</div>
              <h3 className="feature-title">Skill Development</h3>
              <p className="feature-description">
                Access workshops, training programs, and resources to enhance your skills and competencies
              </p>
            </Card>
            
            <Card className="feature-card">
              <div className="feature-icon">🤝</div>
              <h3 className="feature-title">Community Support</h3>
              <p className="feature-description">
                Join a supportive community of peers, mentors, and professionals committed to youth development
              </p>
            </Card>
            
            <Card className="feature-card">
              <div className="feature-icon">🏆</div>
              <h3 className="feature-title">Recognition</h3>
              <p className="feature-description">
                Earn certificates and recognition for your achievements and completed experiences
              </p>
            </Card>
          </div>
        </div>
      </section>

      {/* 8 HYT Thrusts */}
      <section className="section bg-white">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">The 8 HYT Thrusts</h2>
            <p className="section-subtitle">
              Our comprehensive approach to youth development
            </p>
          </div>
          
          <div className="thrusts-grid">
            {thrusts.map((thrust) => (
              <div key={thrust.name} className="thrust-card">
                <div className="thrust-icon" style={{ background: thrust.color }}>
                  {thrust.icon}
                </div>
                <h3 className="thrust-name">{thrust.name}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Featured Opportunities */}
      {publishedOpportunities.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-header">
              <h2 className="section-title">Featured Opportunities</h2>
              <Link to="/opportunities">
                <Button variant="ghost">View All →</Button>
              </Link>
            </div>
            
            <div className="grid grid-3">
              {publishedOpportunities.map((opp) => (
                <Card 
                  key={opp.id} 
                  clickable 
                  onClick={() => navigate(`/opportunities/${opp.id}`)}
                >
                  <h3 className="card-title">{opp.title}</h3>
                  <p className="card-org">{opp.organization}</p>
                  <p className="card-description">{opp.description.substring(0, 100)}...</p>
                  <div className="card-meta">
                    <span className="meta-item">📍 {opp.location}</span>
                    <span className="meta-item">⏰ {opp.requiredHours} hours</span>
                  </div>
                  <div style={{ marginTop: '12px' }}>
                    <Button size="sm" style={{ width: '100%' }}>View Details</Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Stats */}
      <section className="section stats-section">
        <div className="container">
          <div className="stats-grid">
            {stats.map((stat, index) => (
              <div key={index} className="stat-card">
                <div className="stat-value">{stat.value}</div>
                <div className="stat-label">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Accomplishments Gallery */}
      <section className="section bg-white">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Our Accomplishments</h2>
            <p className="section-subtitle">
              Celebrating milestones and impact in youth development
            </p>
          </div>
          
          <div className="gallery-grid">
            <div className="gallery-item">
              <div className="gallery-placeholder">
                <div className="gallery-icon">🎓</div>
              </div>
              <div className="gallery-caption">
                <h4>Youth Leadership Summit 2026</h4>
                <p>50+ young leaders trained in community development</p>
              </div>
            </div>
            
            <div className="gallery-item">
              <div className="gallery-placeholder">
                <div className="gallery-icon">💼</div>
              </div>
              <div className="gallery-caption">
                <h4>OJT Partnership Program</h4>
                <p>200+ students placed in quality internships</p>
              </div>
            </div>
            
            <div className="gallery-item">
              <div className="gallery-placeholder">
                <div className="gallery-icon">🌟</div>
              </div>
              <div className="gallery-caption">
                <h4>Skills Training Workshop</h4>
                <p>100+ youth upskilled in technology and entrepreneurship</p>
              </div>
            </div>
            
            <div className="gallery-item">
              <div className="gallery-placeholder">
                <div className="gallery-icon">🤝</div>
              </div>
              <div className="gallery-caption">
                <h4>Community Outreach Program</h4>
                <p>30+ communities served through youth volunteers</p>
              </div>
            </div>
            
            <div className="gallery-item">
              <div className="gallery-placeholder">
                <div className="gallery-icon">🏆</div>
              </div>
              <div className="gallery-caption">
                <h4>Excellence Awards Ceremony</h4>
                <p>150+ certificates awarded to outstanding students</p>
              </div>
            </div>
            
            <div className="gallery-item">
              <div className="gallery-placeholder">
                <div className="gallery-icon">🚀</div>
              </div>
              <div className="gallery-caption">
                <h4>Innovation Showcase</h4>
                <p>25+ youth-led projects presented to industry partners</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Youth Journey */}
      <section className="section bg-white">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Your Journey with HYT</h2>
            <p className="section-subtitle">
              From discovery to completion, we support you every step of the way
            </p>
          </div>
          
          <div className="journey-timeline">
            <div className="journey-step">
              <div className="step-number">1</div>
              <h3 className="step-title">Discover</h3>
              <p className="step-description">Explore programs and opportunities that match your interests</p>
            </div>
            <div className="journey-step">
              <div className="step-number">2</div>
              <h3 className="step-title">Apply</h3>
              <p className="step-description">Submit your application and required documents</p>
            </div>
            <div className="journey-step">
              <div className="step-number">3</div>
              <h3 className="step-title">Prepare</h3>
              <p className="step-description">Get ready with orientation and initial requirements</p>
            </div>
            <div className="journey-step">
              <div className="step-number">4</div>
              <h3 className="step-title">Experience</h3>
              <p className="step-description">Participate in your program and gain valuable experience</p>
            </div>
            <div className="journey-step">
              <div className="step-number">5</div>
              <h3 className="step-title">Complete</h3>
              <p className="step-description">Finish your journey and receive your certificate</p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="section cta-section">
        <div className="container">
          <div className="cta-content">
            <h2 className="cta-title">Ready to Start Your Journey?</h2>
            <p className="cta-text">
              Join hundreds of youth who are building their future with HYT Foundation
            </p>
            <div className="cta-actions">
              <Button size="lg" onClick={() => navigate('/register')}>
                Create Account
              </Button>
              <Button variant="outline" size="lg" onClick={() => navigate('/opportunities')}>
                Browse Opportunities
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
