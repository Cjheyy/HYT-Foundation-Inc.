import { useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../utils/helpers';
import { isEventActive, applyToProgram, getEventSlotState } from '../../services/supabaseService';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import { showToast } from '../../utils/notifications';
import './Detail.css';

function dashboardApplicationsPath(role) {
  const normalized = String(role || '').toUpperCase().replace(/[\s-]+/g, '_');
  if (normalized === 'TRAINEE') return '/trainee/applications';
  if (normalized === 'ADMIN') return '/admin/application-review';
  return '/student/applications';
}

export function ProgramDetail() {
  const { id } = useParams();
  const { state, dispatch, refreshData } = useApp();
  const { programs, applications, currentUser } = state;
  const navigate = useNavigate();
  const [applying, setApplying] = useState(false);

  const program = programs.find((p) => p.id === id);

  const slotState = useMemo(() => getEventSlotState(program || {}), [program]);
  const myApplication = useMemo(
    () => (applications || []).find((app) => app.programId === id && app.userId === currentUser?.id),
    [applications, id, currentUser]
  );

  if (!program || !isEventActive(program)) {
    return (
      <div className="detail-page">
        <div className="container">
          <div className="not-found">
            <h2>Program Not Found</h2>
            <Button onClick={() => navigate('/programs')}>Back to Trainee Programs & Events</Button>
          </div>
        </div>
      </div>
    );
  }

  // Only render a section when it actually carries content, so bare headings
  // never appear above an empty list.
  const objectives = (Array.isArray(program.objectives) ? program.objectives : []).filter(Boolean);
  const requirements = (Array.isArray(program.requirements) ? program.requirements : []).filter(Boolean);
  const thrustTags = (Array.isArray(program.thrusts) ? program.thrusts : []).filter(Boolean);
  const description = String(program.description || '').trim();

  const handleApply = async () => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/programs/${id}` } });
      return;
    }
    if (myApplication) {
      navigate(dashboardApplicationsPath(currentUser.role));
      return;
    }
    if (slotState.isFull) return;
    setApplying(true);
    try {
      const created = await applyToProgram(id, currentUser.id);
      dispatch({ type: 'ADD_APPLICATION', payload: created });
      dispatch({
        type: 'UPDATE_PROGRAM',
        payload: { id, availableSlots: Math.max(0, slotState.available - 1), totalSlots: slotState.total }
      });
      showToast('Application submitted. It is now visible under Application Review.', 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      navigate(dashboardApplicationsPath(currentUser.role));
    } catch (error) {
      console.error('Apply to program failed:', error);
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
      : slotState.isFull
        ? 'No Slots Available'
        : applying ? 'Submitting...' : 'Apply Now';

  return (
    <div className="detail-page">
      <div className="container">
        <Button variant="ghost" onClick={() => navigate('/programs')}>
          Back to Trainee Programs & Events
        </Button>

        <div className="detail-grid">
          <div className="detail-main">
            <div className="detail-header">
              <div className="detail-badges">
                <Badge color="purple">{program.category}</Badge>
                <Badge status={program.status}>{program.status}</Badge>
              </div>
              <h1 className="detail-title">{program.title}</h1>
            </div>

            <Card>
              <h2 className="section-title">About This Program</h2>
              <p className="detail-description">
                {description || 'No description has been provided for this program yet.'}
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
                      <Badge key={idx} color="purple">{thrust}</Badge>
                    ))}
                  </div>
                </>
              )}
            </Card>
          </div>

          <div className="detail-sidebar">
            <Card>
              <h3 className="sidebar-title">Program Details</h3>
              <div className="detail-info">
                <div className="info-item">
                  <span className="info-label">Category</span>
                  <span className="info-value">{program.category}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Schedule</span>
                  <span className="info-value">{program.schedule}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Location</span>
                  <span className="info-value">{program.location}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Setup</span>
                  <span className="info-value">{program.setup}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Available Slots</span>
                  <span className="info-value">{slotState.available} of {slotState.total} remaining</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Application Deadline</span>
                  <span className="info-value">{formatDate(program.applicationDeadline)}</span>
                </div>
              </div>

              <Button
                onClick={handleApply}
                disabled={applying || (Boolean(currentUser) && !myApplication && slotState.isFull)}
                style={{ width: '100%', marginTop: '20px' }}
              >
                {applyLabel}
              </Button>
              {slotState.isFull && !myApplication && (
                <p className="text-small text-muted" style={{ marginTop: '8px', textAlign: 'center' }}>
                  This program has reached full capacity.
                </p>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
