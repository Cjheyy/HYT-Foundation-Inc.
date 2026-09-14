import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../utils/helpers';
import './Detail.css';

export function OpportunityDetail() {
  const { id } = useParams();
  const { state } = useApp();
  const { opportunities, currentUser } = state;
  const navigate = useNavigate();

  const opportunity = opportunities.find(o => o.id === id);

  if (!opportunity) {
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

  const handleApply = () => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/opportunities/${id}` } });
    } else {
      navigate('/student/applications/new', { state: { opportunityId: id } });
    }
  };

  return (
    <div className="detail-page">
      <div className="container">
        <Button variant="ghost" onClick={() => navigate('/opportunities')}>
          ← Back to Opportunities
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
              <p className="detail-description">{opportunity.description}</p>

              <h3 className="subsection-title">Objectives</h3>
              <ul className="detail-list">
                {opportunity.objectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>

              <h3 className="subsection-title">Requirements</h3>
              <ul className="detail-list">
                {opportunity.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>

              <h3 className="subsection-title">HYT Thrusts</h3>
              <div className="thrusts-list">
                {opportunity.thrusts.map((thrust, idx) => (
                  <Badge key={idx} color="blue">{thrust}</Badge>
                ))}
              </div>
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
                  <span className="info-value">{opportunity.availableSlots}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Application Deadline</span>
                  <span className="info-value">{formatDate(opportunity.applicationDeadline)}</span>
                </div>
              </div>

              <Button 
                onClick={handleApply}
                style={{ width: '100%', marginTop: '20px' }}
              >
                {currentUser ? 'Apply Now' : 'Login to Apply'}
              </Button>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
