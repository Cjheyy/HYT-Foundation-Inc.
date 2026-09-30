import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../utils/helpers';
import { isEventActive, applyToOpportunity, getEventSlotState, applicationReleasesSlot } from '../../services/supabaseService';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import { showToast } from '../../utils/notifications';
import './Detail.css';

function dashboardApplicationsPath(role) {
  const normalized = String(role || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'TRAINEE') return '/trainee/applications';
  if (normalized === 'ADMIN') return '/admin/application-review';
  return '/student/applications';
}

export function OpportunityDetail() {
  const { id } = useParams();
  const { state, dispatch, refreshData } = useApp();
  const { opportunities, applications, currentUser } = state;
  const navigate = useNavigate();
  const [applying, setApplying] = useState(false);

  const opportunity = opportunities.find((o) => o.id === id);
  const slotState = useMemo(() => getEventSlotState(opportunity || {}), [opportunity]);
  const myApplication = useMemo(
    () => (applications || []).find((app) => app.opportunityId === id && app.userId === currentUser?.id),
    [applications, id, currentUser]
  );

  // One OJT posting application per intern. Mirrors applyToEvent()'s server-side
  // guard so the button is disabled instead of failing after the click.
  const blockingApplication = useMemo(() => (applications || []).find((app) => {
    if (app.userId !== currentUser?.id) return false;
    const oppId = app.opportunityId || app.opportunity_id;
    if (!oppId || oppId === id) return false;
    return !applicationReleasesSlot(app.status);
  }), [applications, currentUser, id]);

  if (!opportunity || !isEventActive(opportunity)) {
    return (
      <div className="detail-page">
        <div className="container">
          <div className="not-found">
            <h2>Opportunity Not Found</h2>
            <Button onClick={() => navigate('/opportunities')}>Back to Opportunities</Button>
          </div>
        </div>
      </div>
    );
  }

  // Only render a section when it actually carries content.  Empty arrays used
  // to leave bare "Objectives" / "Requirements" / "HYT Thrusts" headings
  // floating above nothing.
  const objectives = (Array.isArray(opportunity.objectives) ? opportunity.objectives : []).filter(Boolean);
  const requirements = (Array.isArray(opportunity.requirements) ? opportunity.requirements : []).filter(Boolean);
  const thrustTags = (Array.isArray(opportunity.thrusts) ? opportunity.thrusts : []).filter(Boolean);
  const description = String(opportunity.description || '').trim();

  const handleApply = async () => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/opportunities/${id}` } });
      return;
    }
    if (myApplication) {
      navigate(dashboardApplicationsPath(currentUser.role));
      return;
    }
    if (blockingApplication) {
      showToast('You already have an OJT application. Only one OJT posting application is allowed per intern.', 'error');
      return;
    }
    if (slotState.isFull) return;
    setApplying(true);
    try {
      const created = await applyToOpportunity(id, currentUser.id);
      dispatch({ type: 'ADD_APPLICATION', payload: created });
      dispatch({
        type: 'UPDATE_OPPORTUNITY',
        payload: { id, availableSlots: Math.max(0, slotState.available - 1), totalSlots: slotState.total }
      });
      showToast('Application submitted. It is now visible under Application Review.', 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      navigate(dashboardApplicationsPath(currentUser.role));
    } catch (error) {
      console.error('Apply to opportunity failed:', error);
      showToast(error.message || 'Failed to submit application.', 'error');
      await refreshData().catch(() => undefined);
    } finally {
      setApplying(false);
    }
  };

  const applyLabel = !currentUser
    ? 'Login to Apply'
    : myApplication
      ? 'View My Application'
      : blockingApplication
        ? 'One OJT Application Only'
        : slotState.isFull
          ? 'No Slots Available'
          : applying ? 'Submitting...' : 'Apply Now';

  return (
    <div className="detail-page">
      <div className="container">
        <Button variant="ghost" onClick={() => navigate('/opportunities')}>
          Back to OJT Postings
        </Button>

        <div className="detail-grid">
          <div className="detail-main">
            <div className="detail-header">
              <div className="detail-badges">
                <Badge color="blue">{opportunity.category}</Badge>
                <Badge status={opportunity.status}>{opportunity.status}</Badge>
              </div>
              <h1 className="detail-title">{opportunity.title}</h1>
              <p className="detail-org">{opportunity.organization}</p>
            </div>

            <Card>
              <h2 className="section-title">About This Opportunity</h2>
              <p className="detail-description">
                {description || 'No description has been provided for this posting yet.'}
              </p>

              {objectives.length > 0 && (
                <>
                  <h3 className="subsection-title">Objectives</h3>
                  <ul className="detail-list">
                    {objectives.map((obj, idx) => (
                      <li key={idx}>{obj}</li>
                    ))}
                  </ul>
                </>
              )}

              {requirements.length > 0 && (
                <>
                  <h3 className="subsection-title">Requirements</h3>
                  <ul className="detail-list">
                    {requirements.map((req, idx) => (
                      <li key={idx}>{req}</li>
                    ))}
                  </ul>
                </>
              )}

              {thrustTags.length > 0 && (
                <>
                  <h3 className="subsection-title">HYT Thrusts</h3>
                  <div className="thrusts-list">
                    {thrustTags.map((thrust, idx) => (
                      <Badge key={idx} color="blue">{thrust}</Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="detail-sidebar">
            <Card>
              <h3 className="sidebar-title">Details</h3>
              <div className="detail-info">
                <div className="info-item">
                  <span className="info-label">Category</span>
                  <span className="info-value">{opportunity.category}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Location</span>
                  <span className="info-value">{opportunity.location}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Setup</span>
                  <span className="info-value">{opportunity.setup}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Required Hours</span>
                  <span className="info-value">{opportunity.requiredHours} hours</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Schedule</span>
                  <span className="info-value">{opportunity.schedule}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Available Slots</span>
                  <span className="info-value">{slotState.available} of {slotState.total} remaining</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Application Deadline</span>
                  <span className="info-value">{formatDate(opportunity.applicationDeadline)}</span>
                </div>
              </div>

              <Button
                onClick={handleApply}
                disabled={applying || (Boolean(currentUser) && !myApplication && (slotState.isFull || Boolean(blockingApplication)))}
                style={{ width: '100%', marginTop: '20px' }}
              >
                {applyLabel}
              </Button>
              {blockingApplication && !myApplication && (
                <p className="text-small text-muted" style={{ marginTop: '8px', textAlign: 'center' }}>
                  You already have an active OJT application. Only one OJT posting application is allowed per intern.
                </p>
              )}
              {slotState.isFull && !myApplication && !blockingApplication && (
                <p className="text-small text-muted" style={{ marginTop: '8px', textAlign: 'center' }}>
                  This opportunity has reached full capacity.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
