import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/helpers';
import { normalizeStatus } from '../../services/supabaseService';
import { getApplicationsByStudent } from '../../services/applicationService';
import './Applications.css';

const displayStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (['APPROVED', 'ACCEPTED', 'ACTIVE'].includes(normalized)) return 'Accepted';
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

  const getListingTitle = (app) => {
    const oppId = app.opportunityId || app.opportunity_id;
    const progId = app.programId || app.program_id;
    if (oppId) return (opportunities || []).find((o) => o.id === oppId)?.title || 'OJT Posting';
    if (progId) return (programs || []).find((p) => p.id === progId)?.title || 'Program';
    return 'Application';
  };

  return (
    <div className="applications-page">
      <h1 className="page-title">My Applications</h1>

      {myApplications.length > 0 ? (
        <div className="applications-list">
          {myApplications.map((app) => {
            const label = displayStatus(app.status);
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
                <Badge status={label} className="px-2 py-0.5 text-xs rounded-full">{label}</Badge>
              </div>

              {label === 'Accepted' && (
                <div className="application-accepted-notice">
                  <strong>Accepted</strong>
                  <p>
                    Your application has been accepted. Check your OJT page for details.
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
          })}
        </div>
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
