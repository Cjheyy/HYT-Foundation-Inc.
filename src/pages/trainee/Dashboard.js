import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { getApplicationsByStudent } from '../../services/applicationService';
import { formatDate } from '../../utils/helpers';
import '../student/Dashboard.css';

export function TraineeDashboard() {
  const { state } = useApp();
  const { currentUser, applications, announcements, requirements } = state;
  const navigate = useNavigate();

  const myApplications = getApplicationsByStudent(applications, currentUser?.id);
  const activeApplication = myApplications.find(app => 
    ['Applied', 'Under Review', 'Interview', 'Accepted', 'Ongoing'].includes(app.status)
  );
  const myRequirements = requirements.filter(req => req.studentId === currentUser?.id);
  const pendingRequirements = myRequirements.filter(req => 
    ['Required', 'Rejected'].includes(req.status)
  );

  const journeyStages = [
    { name: 'Discover', active: true, completed: true },
    { name: 'Apply', active: !!activeApplication, completed: !!activeApplication },
    { name: 'Prepare', active: activeApplication?.status === 'Accepted', completed: activeApplication?.status === 'Accepted' || activeApplication?.status === 'Ongoing' },
    { name: 'Train', active: activeApplication?.status === 'Ongoing', completed: activeApplication?.status === 'Ongoing' },
    { name: 'Complete', active: activeApplication?.status === 'Completed', completed: activeApplication?.status === 'Completed' }
  ];

  const recentAnnouncements = announcements.slice(0, 3);

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Welcome back, {currentUser?.firstName}!</h1>
          <p className="dashboard-subtitle">Track your training progress and manage your programs</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Active Application */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Active Training</h3>
          </div>
          {activeApplication ? (
            <div className="card-content">
              <div className="application-info">
                <h4 className="application-title">{activeApplication.opportunityTitle || 'Training Program'}</h4>
                <Badge status={activeApplication.status}>{activeApplication.status}</Badge>
              </div>
              <p className="application-date">Started on {formatDate(activeApplication.appliedAt)}</p>
              <Button 
                size="sm" 
                onClick={() => navigate(`/trainee/applications/${activeApplication.id}`)}
                style={{ marginTop: '12px' }}
              >
                View Details
              </Button>
            </div>
          ) : (
            <div className="empty-card-content">
              <p className="empty-text">No active training programs</p>
              <Button size="sm" onClick={() => navigate('/trainee/opportunities')}>
                Browse Programs
              </Button>
            </div>
          )}
        </Card>

        {/* Requirements */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Requirements</h3>
          </div>
          <div className="card-content">
            {pendingRequirements.length > 0 ? (
              <>
                <div className="requirement-alert">
                  <span className="alert-icon">⚠️</span>
                  <span>{pendingRequirements.length} requirement(s) need attention</span>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/trainee/requirements')}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  View Requirements
                </Button>
              </>
            ) : myRequirements.length > 0 ? (
              <>
                <div className="requirement-success">
                  <span className="success-icon">✓</span>
                  <span>All requirements submitted</span>
                </div>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => navigate('/trainee/requirements')}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  View Requirements
                </Button>
              </>
            ) : (
              <div className="empty-card-content">
                <p className="empty-text">No requirements yet</p>
              </div>
            )}
          </div>
        </Card>

        {/* My Applications */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">My Applications</h3>
          </div>
          <div className="card-content">
            {myApplications.length > 0 ? (
              <>
                <div className="ojt-stats">
                  <div className="stat-item">
                    <div className="stat-value">{myApplications.length}</div>
                    <div className="stat-label">Total Applications</div>
                  </div>
                  <div className="stat-item">
                    <div className="stat-value">
                      {myApplications.filter(a => a.status === 'Accepted').length}
                    </div>
                    <div className="stat-label">Accepted</div>
                  </div>
                </div>
                <Button 
                  size="sm" 
                  onClick={() => navigate('/trainee/applications')}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  View All Applications
                </Button>
              </>
            ) : (
              <div className="empty-card-content">
                <p className="empty-text">No applications yet</p>
                <Button size="sm" onClick={() => navigate('/trainee/opportunities')}>
                  Apply Now
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Quick Actions */}
        <Card className="dashboard-card quick-actions-card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <button 
              className="action-button"
              onClick={() => navigate('/trainee/opportunities')}
            >
              <span className="action-icon">🎯</span>
              <span className="action-label">Browse Programs</span>
            </button>
            <button 
              className="action-button"
              onClick={() => navigate('/trainee/applications')}
            >
              <span className="action-icon">📝</span>
              <span className="action-label">My Applications</span>
            </button>
            <button 
              className="action-button"
              onClick={() => navigate('/trainee/attendance')}
            >
              <span className="action-icon">✓</span>
              <span className="action-label">Check Attendance</span>
            </button>
            <button 
              className="action-button"
              onClick={() => navigate('/trainee/certificates')}
            >
              <span className="action-icon">🏆</span>
              <span className="action-label">View Certificates</span>
            </button>
          </div>
        </Card>
      </div>

      {/* Journey Progress */}
      <Card className="journey-card">
        <div className="card-header">
          <h3 className="card-title">Your Training Journey</h3>
        </div>
        <div className="journey-stages">
          {journeyStages.map((stage, index) => (
            <div key={index} className={`journey-stage ${stage.active ? 'active' : ''} ${stage.completed ? 'completed' : ''}`}>
              <div className="stage-indicator">
                {stage.completed ? '✓' : index + 1}
              </div>
              <div className="stage-name">{stage.name}</div>
            </div>
          ))}
        </div>
      </Card>

      {/* Announcements */}
      {recentAnnouncements.length > 0 && (
        <Card>
          <div className="card-header">
            <h3 className="card-title">Recent Announcements</h3>
            <Button 
              variant="ghost" 
              size="sm"
              onClick={() => navigate('/trainee/announcements')}
            >
              View All
            </Button>
          </div>
          <div className="announcements-list">
            {recentAnnouncements.map((announcement) => (
              <div 
                key={announcement.id} 
                className="announcement-item"
                onClick={() => navigate('/trainee/announcements')}
              >
                <div className="announcement-icon">📢</div>
                <div className="announcement-content">
                  <h4 className="announcement-title">{announcement.title}</h4>
                  <p className="announcement-preview">
                    {announcement.content.substring(0, 100)}...
                  </p>
                  <span className="announcement-date">{formatDate(announcement.publishedAt)}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
