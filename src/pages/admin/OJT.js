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

      <div style={{ display: 'grid', gap: '16px' }}>
        {ojtRecords.map((record) => {
          const student = users.find(u => u.id === record.studentId);
          return (
            <Card key={record.id}>
              <div style={{ marginBottom: '16px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{student?.fullName}</h3>
                <p style={{ color: 'var(--muted-text)' }}>{record.company}</p>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '16px' }}>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--teal)' }}>{record.requiredHours}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Required</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#10B981' }}>{record.verifiedHours}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Verified</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--primary-orange)' }}>{record.remainingHours}</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Remaining</div>
                </div>
                <div style={{ textAlign: 'center', padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: 'var(--dark-text)' }}>{record.progress}%</div>
                  <div style={{ fontSize: '12px', color: 'var(--muted-text)' }}>Progress</div>
                </div>
              </div>

              <ProgressBar value={record.progress} max={100} showLabel={false} className="mb-4" />

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
