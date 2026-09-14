import { Card } from '../../components/Card';
import './Impact.css';

export function Impact() {
  const stats = [
    { value: '500+', label: 'Youth Empowered', icon: '👥' },
    { value: '50+', label: 'Partner Organizations', icon: '🤝' },
    { value: '100+', label: 'Opportunities Created', icon: '🎯' },
    { value: '95%', label: 'Completion Rate', icon: '✓' },
    { value: '50,000+', label: 'Training Hours', icon: '⏰' },
    { value: '20+', label: 'Communities Reached', icon: '🌍' }
  ];

  return (
    <div className="impact-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Our Impact</h1>
          <p className="page-subtitle">
            Making a difference in the lives of Filipino youth
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="stats-grid-large">
            {stats.map((stat, index) => (
              <Card key={index} className="stat-card-large">
                <div className="stat-icon">{stat.icon}</div>
                <div className="stat-value-large">{stat.value}</div>
                <div className="stat-label-large">{stat.label}</div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      <section className="section bg-white">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Impact Stories</h2>
            <p className="section-subtitle">Real stories from our community</p>
          </div>

          <div className="stories-grid">
            <Card className="story-card">
              <div className="story-quote">"</div>
              <p className="story-text">
                The IT internship program helped me gain real-world experience and build my professional network. 
                It was instrumental in landing my first job after graduation.
              </p>
              <div className="story-author">
                <div className="author-avatar">CJ</div>
                <div>
                  <div className="author-name">Christian Jay</div>
                  <div className="author-title">BSIT Student</div>
                </div>
              </div>
            </Card>

            <Card className="story-card">
              <div className="story-quote">"</div>
              <p className="story-text">
                HYT Foundation's leadership program transformed my perspective and gave me the confidence 
                to start my own community project. I'm now helping other youth in my barangay.
              </p>
              <div className="story-author">
                <div className="author-avatar">MR</div>
                <div>
                  <div className="author-name">Maria Rodriguez</div>
                  <div className="author-title">Youth Leader</div>
                </div>
              </div>
            </Card>

            <Card className="story-card">
              <div className="story-quote">"</div>
              <p className="story-text">
                The skills training workshops were exactly what I needed. The platform made it easy to track 
                my progress and stay motivated throughout the program.
              </p>
              <div className="story-author">
                <div className="author-avatar">JS</div>
                <div>
                  <div className="author-name">Juan Santos</div>
                  <div className="author-title">Program Graduate</div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">Our Reach</h2>
          </div>

          <div className="reach-content">
            <Card className="reach-card">
              <h3 className="reach-title">Youth Development</h3>
              <p className="reach-text">
                Through comprehensive programs spanning the 8 HYT thrusts, we've supported hundreds of young 
                Filipinos in discovering their potential and building their futures.
              </p>
            </Card>

            <Card className="reach-card">
              <h3 className="reach-title">Partner Network</h3>
              <p className="reach-text">
                Our growing network of partner organizations, schools, and companies provides diverse opportunities 
                for youth across different sectors and industries.
              </p>
            </Card>

            <Card className="reach-card">
              <h3 className="reach-title">Community Impact</h3>
              <p className="reach-text">
                Beyond individual development, our programs create ripple effects in communities as empowered 
                youth become agents of positive change.
              </p>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
