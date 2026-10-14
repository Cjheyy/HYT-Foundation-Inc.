import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/icons';
import { getApplicationsByStudent } from '../../services/applicationService';
import { getEventSlotState, isEventActive } from '../../services/supabaseService';
import { formatEventWindow } from '../student/Events';
import { formatDate, getFirstName } from '../../utils/helpers';
import {
  getApplicationListingTitle,
  getApplicationListingTypeLabel,
  isApplicationActive,
  isApplicationApproved
} from '../../utils/experience';
import '../student/Dashboard.css';

export function TraineeDashboard() {
  const { state } = useApp();
  const { currentUser, applications, announcements, requirements, opportunities, programs, events } = state;
  const navigate = useNavigate();

  const myApplications = getApplicationsByStudent(applications, currentUser?.id);

  /** Every program application still in play, plus the first for the journey. */
  const activeApplications = useMemo(
    () => myApplications.filter(isApplicationActive),
    [myApplications]
  );
  const activeApplication = activeApplications[0];

  const [selectedApplication, setSelectedApplication] = useState(null);

  const listingTitle = (app) =>
    getApplicationListingTitle(app, { opportunities, programs, events });

  const acceptedCount = myApplications.filter(isApplicationApproved).length;
  const myRequirements = requirements.filter(req => req.studentId === currentUser?.id);
  const pendingRequirements = myRequirements.filter(req => 
    ['Required', 'Rejected'].includes(req.status)
  );

  /**
   * The published events this portal can still join.  RLS already restricts a
   * non-admin session to PUBLISHED rows, but the status test is repeated here
   * so the dashboard, the Events page and the landing page cannot disagree
   * about what "available" means.
   */
  const availableEvents = useMemo(
    () => (events || []).filter(
      (item) => String(item.status).toLowerCase() === 'published' && isEventActive(item)
    ),
    [events]
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
          <h1 className="dashboard-title">Welcome back, {getFirstName(currentUser)}!</h1>
          <p className="dashboard-subtitle">Track your training progress and manage your programs</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Active Application */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Active Training</h3>
            {activeApplications.length > 0 && (
              <span className="active-app-count">{activeApplications.length}</span>
            )}
          </div>
          {activeApplications.length > 0 ? (
            <div className="card-content">
              <ul className="active-app-list">
                {activeApplications.map((app) => (
                  <li key={app.id}>
                    <button
                      type="button"
                      className="active-app-row"
                      onClick={() => setSelectedApplication(app)}
                      aria-label={`More info about ${listingTitle(app)}`}
                    >
                      <span className="active-app-main">
                        <span className="active-app-title">{listingTitle(app)}</span>
                        <span className="active-app-date">
                          Applied on {formatDate(app.appliedAt || app.createdAt) || '--'}
                        </span>
                      </span>
                      <Badge status={app.status}>{app.status}</Badge>
                    </button>
                  </li>
                ))}
              </ul>
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/trainee/applications')}
                style={{ marginTop: '12px', width: '100%' }}
              >
                View Details
              </Button>
            </div>
          ) : (
            <div className="empty-card-content">
              <p className="empty-text">No active training programs</p>
              <Button size="sm" onClick={() => navigate('/trainee/programs')}>
                Browse Programs
              </Button>
            </div>
          )}
        </Card>

        {/* Events — the published events this portal can still join. Reuses the
            Active Training card's list markup so no new design is added. */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Events</h3>
            {availableEvents.length > 0 && (
              <span className="active-app-count">{availableEvents.length}</span>
            )}
          </div>
          <div className="card-content">
            {availableEvents.length > 0 ? (
              <>
                <ul className="active-app-list">
                  {availableEvents.map((event) => {
                    const slots = getEventSlotState(event);
                    return (
                      <li key={event.id}>
                        <button
                          type="button"
                          className="active-app-row"
                          onClick={() => navigate('/trainee/events')}
                          aria-label={`More info about ${event.title}`}
                        >
                          <span className="active-app-main">
                            <span className="active-app-title">{event.title}</span>
                            <span className="active-app-date">{formatEventWindow(event)}</span>
                          </span>
                          <Badge color={slots.isFull ? 'red' : 'green'}>
                            {slots.isFull ? 'Full' : `${slots.available} slots`}
                          </Badge>
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate('/trainee/events')}
                  style={{ marginTop: '12px', width: '100%' }}
                >
                  Browse Events
                </Button>
              </>
            ) : (
              <div className="empty-card-content">
                <p className="empty-text">No events posted yet</p>
                <p className="empty-hint">
                  Only published events appear here — a draft stays hidden until an
                  administrator publishes it
                </p>
                <Button size="sm" onClick={() => navigate('/trainee/events')}>
                  Browse Events
                </Button>
              </div>
            )}
          </div>
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
                  <span className="alert-icon"><Icon name="alert" size={16} /></span>
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
                    <div className="stat-value">{acceptedCount}</div>
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
                <Button size="sm" onClick={() => navigate('/trainee/programs')}>
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
              onClick={() => navigate('/trainee/programs')}
            >
              <span className="action-icon"><Icon name="target" size={20} /></span>
              <span className="action-label">Browse Programs</span>
            </button>
            <button
              className="action-button"
              onClick={() => navigate('/trainee/applications')}
            >
              <span className="action-icon"><Icon name="file" size={20} /></span>
              <span className="action-label">My Applications</span>
            </button>
            <button
              className="action-button"
              onClick={() => navigate('/trainee/attendance')}
            >
              <span className="action-icon"><Icon name="check" size={20} /></span>
              <span className="action-label">Check Attendance</span>
            </button>
            <button
              className="action-button"
              onClick={() => navigate('/trainee/certificates')}
            >
              <span className="action-icon"><Icon name="award" size={20} /></span>
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
                <div className="announcement-icon"><Icon name="bell" size={18} /></div>
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

      {/* "More info" for one active program application. */}
      <Modal
        isOpen={!!selectedApplication}
        onClose={() => setSelectedApplication(null)}
        title={selectedApplication ? listingTitle(selectedApplication) : ''}
        footer={
          <Button size="sm" onClick={() => setSelectedApplication(null)}>
            Close
          </Button>
        }
      >
        {selectedApplication && (
          <div className="application-detail">
            <div className="application-detail-row">
              <span className="application-detail-label">Status</span>
              <span className="application-detail-value">
                <Badge status={selectedApplication.status}>{selectedApplication.status}</Badge>
              </span>
            </div>
            <div className="application-detail-row">
              <span className="application-detail-label">Type</span>
              <span className="application-detail-value">
                {getApplicationListingTypeLabel(selectedApplication)}
              </span>
            </div>
            <div className="application-detail-row">
              <span className="application-detail-label">Applied on</span>
              <span className="application-detail-value">
                {formatDate(selectedApplication.appliedAt || selectedApplication.createdAt) || '--'}
              </span>
            </div>
            <div className="application-detail-row">
              <span className="application-detail-label">Reviewed on</span>
              <span className="application-detail-value">
                {selectedApplication.reviewedAt
                  ? formatDate(selectedApplication.reviewedAt)
                  : 'Not yet reviewed'}
              </span>
            </div>
            <div className="application-detail-row">
              <span className="application-detail-label">Notes</span>
              <span className="application-detail-value">
                {selectedApplication.notes || selectedApplication.adminNote || '--'}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
