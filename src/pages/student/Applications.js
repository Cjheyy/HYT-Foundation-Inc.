import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/helpers';
import { getApplicationsByStudent } from '../../services/applicationService';
import './Applications.css';

export function StudentApplications() {
  const { state } = useApp();
  const { currentUser, applications, opportunities } = state;
  const navigate = useNavigate();

  const myApplications = getApplicationsByStudent(applications, currentUser?.id);

  const getOpportunityTitle = (oppId) => {
    const opp = opportunities.find(o => o.id === oppId);
    return opp?.title || 'Opportunity';
  };

  return (
    <div className="applications-page">
      <h1 className="page-title">My Applications</h1>

      {myApplications.length > 0 ? (
        <div className="applications-list">
          {myApplications.map((app) => (
            <Card 
              key={app.id} 
              clickable
              onClick={() => navigate(`/student/applications/${app.id}`)}
            >
              <div className="application-card-header">
                <div className="application-card-info">
                  <h3 className="application-card-title">
                    {getOpportunityTitle(app.opportunityId)}
                  </h3>
                  <p className="application-card-date">
                    Applied on {formatDate(app.appliedAt)}
                  </p>
                </div>
                <Badge status={app.status}>{app.status}</Badge>
              </div>

              {app.status === 'Accepted' && (
                <div className="application-accepted-notice">
                  <strong>🎉 Congratulations!</strong>
                  <p>
                    Your application has been accepted. Check your OJT page for details.
                  </p>
                </div>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📝"
          title="No Applications Yet"
          message="Browse opportunities and apply to get started"
          action={true}
          actionText="Browse Opportunities"
          onAction={() => navigate('/student/opportunities')}
        />
      )}
    </div>
  );
}
