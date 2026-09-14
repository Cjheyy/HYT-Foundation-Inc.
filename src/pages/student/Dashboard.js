import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { getApplicationsByStudent } from '../../services/applicationService';
import { getOJTByStudent } from '../../services/ojtService';
import { formatDate } from '../../utils/helpers';
import './Dashboard.css';

export function StudentDashboard() {
  const { state } = useApp();
  const { currentUser, applications, ojtRecords, announcements, requirements } = state;
  const navigate = useNavigate();

  const myApplications = getApplicationsByStudent(applications, currentUser?.id);
  const activeApplication = myApplications.find(app => 
    ['Applied', 'Under Review', 'Interview', 'Accepted', 'Ongoing'].includes(app.status)
  );
  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);
  const myRequirements = requirements.filter(req => req.studentId === currentUser?.id);
  const pendingRequirements = myRequirements.filter(req => 
    ['Required', 'Rejected'].includes(req.status)
  );

  const journeyStages = [
    { name: 'Discover', active: true, completed: true },
    { name: 'Apply', active: !!activeApplication, completed: !!activeApplication },
    { name: 'Prepare', active: activeApplication?.status === 'Accepted', completed: activeApplication?.status === 'Accepted' || activeApplication?.status === 'Ongoing' },
    { name: 'Experience', active: activeApplication?.status === 'Ongoing', completed: activeApplication?.status === 'Ongoing' },
    { name: 'Complete', active: myOJT?.status === 'Completed', completed: myOJT?.status === 'Completed' }
  ];

  const recentAnnouncements = announcements.slice(0, 3);

  return (
    <div className="student-dashboard">
      <div className="dashboard-header">
        <div>
          <h1 className="dashboard-title">Welcome back, {currentUser?.firstName}!</h1>
          <p className="dashboard-subtitle">Track your progress and manage your opportunities</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Active Application */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Active Application</h3>
          </div>
          {activeApplication ? (
            <div className="card-content">
              <div className="application-info">
                <h4 className="application-title">{activeApplication.opportunityTitle || 'Application'}</h4>
                <Badge status={activeApplication.status}>{activeApplication.status}</Badge>
              </div>
              <p className="application-date">Applied on {formatDate(activeApplication.appliedAt)}</p>
              <Button 
                size="sm" 
                onClick={() => navigate(`/student/applications/${activeApplication.id}`)}
                style={{ marginTop: '12px' }}
              >
                View Details
              </Button>
            </div>
          ) : (
            <div className="empty-card-content">
              <p className="empty-text">No active applications</p>
              <Button size="sm" onClick={() => navigate('/student/opportunities')}>
                Browse Opportunities
              </Button>
            </div>
          )}
        </Card>

        {/* OJT Progress */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">OJT / Experience Progress</h3>
          </div>
          {myOJT ? (
            <div className="card-content">
              <div className="ojt-stats">
                <div className="stat-item">
                  <div className="stat-value">{myOJT.verifiedHours}</div>
                  <div className="stat-label">Verified Hours</div>
                </div>
                <div className="stat-item">
                  <div className="stat-value">{myOJT.remainingHours}</div>
                  <div className="stat-label">Remaining</div>
                </div>
              </div>
              <ProgressBar 
                value={myOJT.progress} 
                max={100} 
                showLabel={true}
                className="mt-4"
              />
              <Button 
                size="sm" 
                onClick={() => navigate('/student/ojt')}
                style={{ marginTop: '12px', width: '100%' }}
              >
                View OJT Details
              </Button>
            </div>
          ) : (
            <div className="empty-card-content">
              <p className="empty-text">No active OJT program</p>
              <p className="empty-hint">Apply to opportunities to get started</p>
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
                  onClick={() => navigate('/student/requirements')}
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
                  onClick={() => navigate('/student/requirements')}
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

        {/* Quick Actions */}
        <Card className="dashboard-card quick-actions-card">
          <div className="card-header">
            <h3 className="card-title">Quick Actions</h3>
          </div>
          <div className="quick-actions">
            <button 
              className="action-button"
              onClick={() => navigate('/student/opportunities')}
            >
              <span className="action-icon">🎯</span>
              <span className="action-label">Browse Opportunities</span>
            </button>
            <button 
              className="action-button"
              onClick={() => navigate('/student/applications')}
            >
              <span className="action-icon">📝</span>
              <span className="action-label">My Applications</span>
            </button>
            {myOJT && (
              <button 
                className="action-button"
                onClick={() => navigate('/student/daily-reports')}
              >
                <span className="action-icon">📋</span>
                <span className="action-label">Submit Daily Report</span>
              </button>
            )}
            <button 
              className="action-button"
              onClick={() => navigate('/student/certificates')}
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
          <h3 className="card-title">Your Journey</h3>
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
              onClick={() => navigate('/student/announcements')}
            >
              View All
            </Button>
          </div>
          <div className="announcements-list">
            {recentAnnouncements.map((announcement) => (
              <div 
                key={announcement.id} 
                className="announcement-item"
                onClick={() => navigate('/student/announcements')}
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
