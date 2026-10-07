import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { showToast } from '../../utils/notifications';
import { markOJTCompleted } from '../../services/ojtService';
import { createCertificate } from '../../services/certificateService';

export function AdminOJT() {
  const { state, dispatch } = useApp();
  const { ojtRecords, users, opportunities } = state;

  const handleComplete = (record) => {
    try {
      const completed = markOJTCompleted(record);
      dispatch({ type: 'UPDATE_OJT_RECORD', payload: completed });

      const student = users.find(u => u.id === record.studentId);
      const opportunity = opportunities.find(o => o.id === record.opportunityId);

      const certificate = createCertificate({
        studentId: record.studentId,
        ojtRecordId: record.id,
        studentName: student?.fullName,
        programTitle: opportunity?.title,
        company: record.company,
        completionDate: new Date().toISOString(),
        totalHours: record.verifiedHours
      });
      dispatch({ type: 'ADD_CERTIFICATE', payload: certificate });

      showToast('OJT marked as completed! Certificate generated.', 'success');
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div>
      <h1 className="page-title">OJT Monitoring</h1>

      <div className="ojt-record-list">
        {ojtRecords.map((record) => {
          const student = users.find(u => u.id === record.studentId);
          return (
            <Card key={record.id} className="ojt-record-card">
              <div className="ojt-record-head">
                <h3 className="ojt-record-title">{student?.fullName}</h3>
                <p className="ojt-record-org">{record.company}</p>
              </div>

              <div className="ojt-stat-grid">
                <div className="ojt-stat">
                  <div className="ojt-stat-value is-required">{record.requiredHours}</div>
                  <div className="ojt-stat-label">Required</div>
                </div>
                <div className="ojt-stat">
                  <div className="ojt-stat-value is-verified">{record.verifiedHours}</div>
                  <div className="ojt-stat-label">Verified</div>
                </div>
                <div className="ojt-stat">
                  <div className="ojt-stat-value is-remaining">{record.remainingHours}</div>
                  <div className="ojt-stat-label">Remaining</div>
                </div>
                <div className="ojt-stat">
                  <div className="ojt-stat-value is-progress">{record.progress}%</div>
                  <div className="ojt-stat-label">Progress</div>
                </div>
              </div>

              <ProgressBar value={record.progress} max={100} showLabel={false} className="mb-4" />

              <div className="ojt-record-footer">
                <Badge status={record.status}>{record.status}</Badge>
                {record.status === 'Active' && record.verifiedHours >= record.requiredHours && (
                  <Button size="sm" onClick={() => handleComplete(record)}>
                    Mark OJT Completed
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
