import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/helpers';
import { normalizeStatus } from '../../services/supabaseService';
import { getApplicationsByStudent } from '../../services/applicationService';
import { getApplicationExperienceState, groupApplications } from '../../utils/experience';
import './Applications.css';

const displayStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (['APPROVED', 'ACCEPTED', 'ACTIVE', 'ONGOING', 'COMPLETED', 'DONE'].includes(normalized)) return 'Accepted';
  if (['REJECTED', 'DECLINED', 'DENIED'].includes(normalized)) return 'Declined';
  return 'Pending';
};

export function StudentApplications() {
  const { state } = useApp();
  const { currentUser, applications, opportunities, programs } = state;
  const navigate = useNavigate();

  const myApplications = useMemo(
    () => getApplicationsByStudent(applications, currentUser?.id),
    [applications, currentUser?.id]
  );

  /**
   * "View my applications" must show everything — pending AND approved — so the
   * page groups rather than filters.  Approved rows additionally carry the
   * Ongoing / Already Done state they will show on the dashboard.
   */
  const grouped = useMemo(() => groupApplications(myApplications), [myApplications]);

  const getListingTitle = (app) => {
    const oppId = app.opportunityId || app.opportunity_id;
    const progId = app.programId || app.program_id;
    if (oppId) return (opportunities || []).find((o) => o.id === oppId)?.title || 'OJT Posting';
    if (progId) return (programs || []).find((p) => p.id === progId)?.title || 'Program';
    return 'Application';
  };

  const renderCard = (app) => {
    const label = displayStatus(app.status);
    const experienceState = getApplicationExperienceState(app);

    return (
      <Card key={app.id}>
        <div className="application-card-header">
          <div className="application-card-info">
            <h3 className="application-card-title">
              {getListingTitle(app)}
            </h3>
            <p className="application-card-date">
              Applied on {formatDate(app.appliedAt || app.createdAt)}
            </p>
          </div>
          <Badge status={experienceState || label}>
            {experienceState || label}
          </Badge>
        </div>

        {experienceState && (
          <div className="application-accepted-notice">
            <strong>{experienceState}</strong>
            <p>
              {experienceState === 'Already Done'
                ? 'This experience is complete. Your certificate is available on the Certificates page.'
                : 'Your application was approved and this experience is now ongoing. Track the dates and hours on your dashboard.'}
            </p>
          </div>
        )}
        {label === 'Declined' && (
          <div className="application-declined-notice">
            <strong>Declined</strong>
            <p>Your application was not approved. Please contact support.</p>
          </div>
        )}
      </Card>
    );
  };

  const renderGroup = (title, rows, emptyHint) => (
    <section className="applications-group">
      <div className="applications-group-header">
        <h2 className="applications-group-title">{title}</h2>
        <span className="applications-group-count">{rows.length}</span>
      </div>
      {rows.length > 0 ? (
        <div className="applications-list">{rows.map(renderCard)}</div>
      ) : (
        <p className="applications-group-empty">{emptyHint}</p>
      )}
    </section>
  );

  return (
    <div className="applications-page">
      <h1 className="page-title">My Applications</h1>
      <p className="applications-intro">
        Every application you have submitted. Once an administrator approves one it becomes an
        experience — Ongoing while it runs, Already Done when it finishes.
      </p>

      {myApplications.length > 0 ? (
        <>
          {renderGroup(
            'Pending',
            grouped.pending,
            'No applications are waiting for review.'
          )}
          {renderGroup(
            'Approved',
            [...grouped.approved, ...grouped.completed],
            'Nothing approved yet — an approved application appears here and on your dashboard.'
          )}
          {grouped.rejected.length > 0 && renderGroup('Not approved', grouped.rejected, '')}
        </>
      ) : (
        <EmptyState
          icon="file"
          title="No Applications Yet"
          message="Browse postings and apply to get started"
          action={true}
          actionText="Browse OJT Postings"
          onAction={() => navigate('/student/opportunities')}
        />
      )}
    </div>
  );
}
