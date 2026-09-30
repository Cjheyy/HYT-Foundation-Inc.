import { useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { getOJTByStudent } from '../../services/ojtService';
import { normalizeStatus } from '../../services/supabaseService';
import { formatDate, calculateDaysCompleted } from '../../utils/helpers';
import { getRoleTerms } from '../../utils/roleTerms';
import './OJT.css';

export function StudentOJT() {
  const { state } = useApp();
  const { currentUser, ojtRecords, applications, opportunities, dataLoading } = state;

  // Shared by the OJT/Intern and Trainee portals — the Trainee used to read
  // "OJT / Experience" and "Apply to postings to start your OJT journey".
  const terms = getRoleTerms(currentUser?.role);

  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);

  const activePosting = useMemo(() => {
    const approved = (applications || []).find((app) => {
      const owner = app.userId || app.studentId;
      if (owner && owner !== currentUser?.id) return false;
      const isPosting = Boolean(app.opportunityId || app.opportunity_id || String(app.type || '').toUpperCase() === 'OPPORTUNITY');
      if (!isPosting) return false;
      return ['APPROVED', 'ACCEPTED', 'ACTIVE'].includes(normalizeStatus(app.status));
    });
    if (!approved) return null;
    const postingId = approved.opportunityId || approved.opportunity_id;
    const posting = (opportunities || []).find((o) => o.id === postingId) || null;
    return { application: approved, posting };
  }, [applications, opportunities, currentUser?.id]);

  const progress = useMemo(() => {
    const required = Number(currentUser?.requiredHours || myOJT?.requiredHours || 0);
    const rendered = Number(currentUser?.renderedHours || myOJT?.verifiedHours || 0);
    const percent = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
    return { required, rendered, percent };
  }, [currentUser, myOJT]);

  if (dataLoading) {
    return (
      <div className="ojt-page">
        <Skeleton width="220px" height={30} style={{ marginBottom: 20 }} />
        <div className="ojt-content">
          <Card>
            <Skeleton width="45%" height={20} style={{ marginBottom: 16 }} />
            <Skeleton width="90%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="55%" height={14} />
          </Card>
          <Card>
            <Skeleton width="35%" height={20} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={96} radius={12} />
          </Card>
        </div>
      </div>
    );
  }

  if (!myOJT && !activePosting) {
    return (
      <div className="ojt-page">
        <h1 className="page-title">{terms.experienceLabel}</h1>
        <EmptyState
          icon="briefcase"
          title="No Active OJT Program"
          message={terms.journeyEmptyMessage}
        />
      </div>
    );
  }

  if (!myOJT && activePosting) {
    const { application, posting } = activePosting;
    const approvedDate = application.reviewedAt || application.updatedAt || application.createdAt;
    return (
      <div className="ojt-page">
        <h1 className="page-title">{terms.experienceLabel}</h1>
        <div className="ojt-content">
          <Card className="ojt-details-section">
            <h3>Active Placement</h3>
            <div className="ojt-details-grid">
              <div><strong>Position Title:</strong> {posting?.title || terms.postingLabel}</div>
              <div><strong>Company / Foundation Branch:</strong> {posting?.organization || posting?.location || 'HYT Foundation Inc.'}</div>
              <div><strong>Approved Date:</strong> {approvedDate ? formatDate(approvedDate) : '--'}</div>
              <div><Badge status="Accepted">Accepted</Badge></div>
            </div>
          </Card>
          <Card className="ojt-details-section">
            <h3>Progress</h3>
            <div className="ojt-details-grid">
              <div>Rendered: {progress.rendered.toFixed(2)} / {progress.required.toFixed(2)} hrs</div>
            </div>
            <ProgressBar value={progress.percent} max={100} showLabel />
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="ojt-page">
      <h1 className="page-title">{terms.experienceLabel}</h1>

      <div className="ojt-content">
        <Card className="ojt-details-section">
          <h3>Program Details</h3>
          <div className="ojt-details-grid">
            <div><strong>Company:</strong> {myOJT.company}</div>
            <div><strong>Supervisor:</strong> {myOJT.supervisor}</div>
            <div><strong>Start Date:</strong> {formatDate(myOJT.startDate)}</div>
            <div><strong>Days Completed:</strong> {calculateDaysCompleted(myOJT.startDate)}</div>
            <div><Badge status={myOJT.status}>{myOJT.status}</Badge></div>
          </div>
        </Card>

        <Card className="ojt-details-section">
          <h3>Hours Tracking</h3>
          <div className="ojt-hours-grid">
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value">{myOJT.requiredHours}</div>
              <div className="ojt-hour-label">Required</div>
            </div>
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value verified">{myOJT.verifiedHours}</div>
              <div className="ojt-hour-label">Verified</div>
            </div>
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value pending">{myOJT.pendingHours || 0}</div>
              <div className="ojt-hour-label">Pending</div>
            </div>
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value remaining">{myOJT.remainingHours}</div>
              <div className="ojt-hour-label">Remaining</div>
            </div>
          </div>
          <ProgressBar value={myOJT.progress} max={100} showLabel={true} />
        </Card>

        {myOJT.status === 'Completed' && (
          <Card className="ojt-completion-notice">
            <h3 className="ojt-completion-title">{terms.completionTitle}</h3>
            <p className="ojt-completion-text">{terms.completionNotice}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
