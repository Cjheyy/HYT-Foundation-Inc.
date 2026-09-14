import { Card } from '../../components/Card';
import './About.css';

export function About() {
  const thrusts = [
    {
      name: 'Education',
      description: 'Providing access to quality education and learning resources to empower youth with knowledge and skills.'
    },
    {
      name: 'Enhancement',
      description: 'Developing competencies and capabilities through training, workshops, and skill-building programs.'
    },
    {
      name: 'Experience',
      description: 'Creating opportunities for practical, hands-on experience through internships, OJT, and real-world projects.'
    },
    {
      name: 'Entrepreneurship',
      description: 'Fostering entrepreneurial mindset and supporting youth in developing business ideas and ventures.'
    },
    {
      name: 'Endurance',
      description: 'Building resilience, perseverance, and the ability to overcome challenges and setbacks.'
    },
    {
      name: 'Exploration',
      description: 'Encouraging curiosity, discovery, and the exploration of new ideas, cultures, and opportunities.'
    },
    {
      name: 'Empowerment',
      description: 'Giving youth the confidence, resources, and support to take control of their future and make positive changes.'
    },
    {
      name: 'Enlightenment',
      description: 'Promoting awareness, understanding, and wisdom through reflection, learning, and personal growth.'
    }
  ];

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

      <section className="section bg-white">
        <div className="container">
          <div className="section-header">
            <h2 className="section-title">The 8 HYT Thrusts</h2>
            <p className="section-subtitle">
              Our comprehensive framework for youth development
            </p>
          </div>
          
          <div className="thrusts-list">
            {thrusts.map((thrust, index) => (
              <Card key={index} className="thrust-item">
                <div className="thrust-number">{index + 1}</div>
                <div className="thrust-content">
                  <h3 className="thrust-title">{thrust.name}</h3>
                  <p className="thrust-description">{thrust.description}</p>
                </div>
              </Card>
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
              <div className="offer-icon">🎯</div>
              <h3 className="offer-title">Opportunity Matching</h3>
              <p className="offer-description">
                We connect youth with internships, OJT programs, training opportunities, and community programs 
                that align with their interests and career goals.
              </p>
            </Card>
            
            <Card>
              <div className="offer-icon">📚</div>
              <h3 className="offer-title">Skills Development</h3>
              <p className="offer-description">
                Access workshops, seminars, training programs, and resources designed to develop both technical 
                and soft skills essential for personal and professional growth.
              </p>
            </Card>
            
            <Card>
              <div className="offer-icon">🤝</div>
              <h3 className="offer-title">Community Network</h3>
              <p className="offer-description">
                Join a supportive community of fellow youth, mentors, professionals, and organizations 
                committed to youth development and empowerment.
              </p>
            </Card>
            
            <Card>
              <div className="offer-icon">💼</div>
              <h3 className="offer-title">Experience Tracking</h3>
              <p className="offer-description">
                Comprehensive system for tracking attendance, progress, daily activities, and achievements 
                throughout your development journey.
              </p>
            </Card>
            
            <Card>
              <div className="offer-icon">📋</div>
              <h3 className="offer-title">Application Management</h3>
              <p className="offer-description">
                Streamlined application process with document management, requirement tracking, and 
                real-time status updates throughout your application journey.
              </p>
            </Card>
            
            <Card>
              <div className="offer-icon">🏆</div>
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
    </div>
  );
}
