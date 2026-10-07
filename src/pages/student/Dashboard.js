import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Icon } from '../../components/icons';
import { getApplicationsByStudent } from '../../services/applicationService';
import { getOJTByStudent } from '../../services/ojtService';
import {
  formatDate,
  formatScheduleRange,
  getFirstName,
  toLocalISODate
} from '../../utils/helpers';
import { getRoleTerms } from '../../utils/roleTerms';
import {
  deriveExperienceEntries,
  computeExperienceSchedule,
  getApplicationListingTitle,
  isApplicationActive
} from '../../utils/experience';
import './Dashboard.css';

/**
 * Hours to two decimals, so Rendered / Remaining / Required line up as a
 * column.  Guarded rather than trusting the value: `toFixed` on a non-finite
 * number renders "NaN.00" straight into the card.
 */
const formatHours = (value) => {
  const hours = Number(value);
  return Number.isFinite(hours) ? hours.toFixed(2) : '0.00';
};

export function StudentDashboard() {
  const { state } = useApp();
  const { currentUser, applications, ojtRecords, announcements, requirements, programs, opportunities } = state;
  const navigate = useNavigate();

  // "OJT / Experience" for an OJT/Intern, plain "Experience" for a Trainee.
  const terms = getRoleTerms(currentUser?.role);

  const myApplications = getApplicationsByStudent(applications, currentUser?.id);

  /**
   * Every application still in play — pending AND approved-but-unfinished.
   * `activeApplication` (singular) is kept for the journey stages below.
   */
  const activeApplications = useMemo(
    () => myApplications.filter(isApplicationActive),
    [myApplications]
  );
  const activeApplication = activeApplications[0];

  /** Which application the "more info" dialog is showing. */
  const [selectedApplication, setSelectedApplication] = useState(null);

  const listingTitle = (app) =>
    getApplicationListingTitle(app, { opportunities, programs });

  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);
  const myRequirements = requirements.filter(req => req.studentId === currentUser?.id);
  const pendingRequirements = myRequirements.filter(req => 
    ['Required', 'Rejected'].includes(req.status)
  );

  /**
   * Approved applications become experiences.  A pending one must never appear
   * here — it stays in My Applications until an administrator approves it.
   */
  const experiences = useMemo(() => {
    const entries = deriveExperienceEntries({
      applications,
      programs,
      opportunities,
      currentUser
    });

    const requiredHours = Number(currentUser?.requiredHours || myOJT?.requiredHours || 0);
    const renderedHours = Number(currentUser?.renderedHours || myOJT?.verifiedHours || 0);

    return entries.map((entry) => ({
      ...entry,
      schedule: computeExperienceSchedule({
        startDate: myOJT?.startDate || entry.approvedAt,
        requiredHours,
        renderedHours,
        completedAt: myOJT?.completionDate || entry.completedAt
      })
    }));
  }, [applications, programs, opportunities, currentUser, myOJT]);

  /** Rendered-vs-required hours, shared by the experience card and its bar. */
  const progress = useMemo(() => {
    const required = Number(currentUser?.requiredHours || myOJT?.requiredHours || 0);
    const rendered = Number(currentUser?.renderedHours || myOJT?.verifiedHours || 0);
    const remaining = Math.max(0, Math.round((required - rendered) * 100) / 100);
    const percent = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
    return { required, rendered, remaining, percent };
  }, [currentUser, myOJT]);

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
          <h1 className="dashboard-title">Welcome back, {getFirstName(currentUser)}!</h1>
          <p className="dashboard-subtitle">Track your progress and manage your opportunities</p>
        </div>
      </div>

      <div className="dashboard-grid">
        {/* Active Application */}
        <Card className="dashboard-card">
          <div className="card-header">
            <h3 className="card-title">Active Application</h3>
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
                onClick={() => navigate('/student/applications')}
                style={{ marginTop: '12px', width: '100%' }}
              >
                View my applications
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

        {/* Experience — every approved application lands here */}
        <Card className="dashboard-card experience-card">
          <div className="card-header">
            <h3 className="card-title">{terms.experienceLabel}</h3>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/student/applications')}
            >
              View my applications
            </Button>
          </div>

          {experiences.length > 0 ? (
            <div className="card-content">
              <ul className="experience-list">
                {experiences.map((entry) => (
                  <li key={entry.id} className="experience-item">
                    <div className="experience-item-head">
                      <h4 className="experience-item-title">{entry.title}</h4>
                      <Badge
                        status={entry.isComplete ? 'Completed' : 'Ongoing'}
                        color={entry.isComplete ? 'green' : 'teal'}
                      >
                        {entry.state}
                      </Badge>
                    </div>
                    <div className="experience-item-meta">
                      <span className="experience-item-org">{entry.organization}</span>
                      <span className="experience-item-dates">
                        {formatScheduleRange(
                          toLocalISODate(entry.schedule.startDate),
                          toLocalISODate(entry.schedule.endDate)
                        ) || '--'}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
              <p className="experience-note">
                End dates are projected from the hours still to be rendered.
              </p>

              {progress.required > 0 && (
                <>
                  <div className="experience-stats">
                    <div className="experience-tile is-rendered">
                      <div className="experience-tile-label">Rendered</div>
                      <div className="experience-tile-value">
                        {formatHours(progress.rendered)}
                        <span className="unit">h</span>
                      </div>
                    </div>
                    <div className="experience-tile is-remaining">
                      <div className="experience-tile-label">Remaining</div>
                      <div className="experience-tile-value">
                        {formatHours(progress.remaining)}
                        <span className="unit">h</span>
                      </div>
                    </div>
                  </div>

                  <div className="experience-progress">
                    <div className="experience-progress-main">
                      <div className="experience-progress-label">
                        Progress · {formatHours(progress.required)} h required
                      </div>
                      <div className="progress-bar">
                        <div
                          className="progress-bar-fill"
                          style={{
                            width: `${progress.percent}%`,
                            // Only reserve a sliver once there is something to
                            // show. A blanket min-width painted an 8px bar at
                            // 0%, which reads as progress that was never made.
                            minWidth: progress.percent > 0 ? 6 : 0
                          }}
                        />
                      </div>
                    </div>
                    <span className="experience-progress-value">
                      {progress.percent.toFixed(1)}%
                    </span>
                  </div>
                </>
              )}

              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate('/student/ojt')}
                style={{ marginTop: '16px', width: '100%' }}
              >
                View {terms.experienceLabel} Details
              </Button>
            </div>
          ) : (
            <div className="empty-card-content">
              <p className="empty-text">
                No approved {terms.isTrainee ? 'program' : 'posting'} yet
              </p>
              <p className="empty-hint">
                An application moves here once an administrator approves it
              </p>
              <Button size="sm" onClick={() => navigate('/student/applications')}>
                View my applications
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
                  <span className="alert-icon"><Icon name="alert" size={16} /></span>
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
              <span className="action-icon"><Icon name="target" size={20} /></span>
              <span className="action-label">Browse Opportunities</span>
            </button>
            <button
              className="action-button"
              onClick={() => navigate('/student/applications')}
            >
              <span className="action-icon"><Icon name="file" size={20} /></span>
              <span className="action-label">My Applications</span>
            </button>
            {myOJT && (
              <button
                className="action-button"
                onClick={() => navigate('/student/daily-reports')}
              >
                <span className="action-icon"><Icon name="file" size={20} /></span>
                <span className="action-label">Submit Daily Report</span>
              </button>
            )}
            <button
              className="action-button"
              onClick={() => navigate('/student/certificates')}
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

      {/* "More info" for one active application. */}
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
                {selectedApplication.opportunityId ? 'OJT Posting' : 'Training Program'}
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
