import { useParams, useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../utils/helpers';
import './Detail.css';

export function ProgramDetail() {
  const { id } = useParams();
  const { state } = useApp();
  const { programs, currentUser } = state;
  const navigate = useNavigate();

  const program = programs.find(p => p.id === id);

  if (!program) {
    return (
      <div className="detail-page">
        <div className="container">
          <div className="not-found">
            <h2>Program Not Found</h2>
            <Button onClick={() => navigate('/programs')}>Back to Programs</Button>
          </div>
        </div>
      </div>
    );
  }

  const handleApply = () => {
    if (!currentUser) {
      navigate('/login', { state: { from: `/programs/${id}` } });
    } else {
      navigate('/student/applications/new', { state: { programId: id } });
    }
  };

  return (
    <div className="detail-page">
      <div className="container">
        <Button variant="ghost" onClick={() => navigate('/programs')}>
          ← Back to Programs
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
              <p className="detail-description">{program.description}</p>

              <h3 className="subsection-title">Objectives</h3>
              <ul className="detail-list">
                {program.objectives.map((obj, idx) => (
                  <li key={idx}>{obj}</li>
                ))}
              </ul>

              <h3 className="subsection-title">Requirements</h3>
              <ul className="detail-list">
                {program.requirements.map((req, idx) => (
                  <li key={idx}>{req}</li>
                ))}
              </ul>

              <h3 className="subsection-title">HYT Thrusts</h3>
              <div className="thrusts-list">
                {program.thrusts.map((thrust, idx) => (
                  <Badge key={idx} color="purple">{thrust}</Badge>
                ))}
              </div>
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
                  <span className="info-value">{program.availableSlots}</span>
                </div>
                <div className="info-item">
                  <span className="info-label">Application Deadline</span>
                  <span className="info-value">{formatDate(program.applicationDeadline)}</span>
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
