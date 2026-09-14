import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { EmptyState } from '../../components/EmptyState';
import { getOJTByStudent } from '../../services/ojtService';
import { formatDate, calculateDaysCompleted } from '../../utils/helpers';

export function StudentOJT() {
  const { state } = useApp();
  const { currentUser, ojtRecords } = state;
  
  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);

  if (!myOJT) {
    return (
      <div>
        <h1 className="page-title">OJT / Experience</h1>
        <EmptyState
          icon="💼"
          title="No Active OJT Program"
          message="Apply to opportunities to start your OJT journey"
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">OJT / Experience</h1>

      <div style={{ display: 'grid', gap: '24px' }}>
        <Card>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Program Details</h3>
          <div style={{ display: 'grid', gap: '12px' }}>
            <div><strong>Company:</strong> {myOJT.company}</div>
            <div><strong>Supervisor:</strong> {myOJT.supervisor}</div>
            <div><strong>Start Date:</strong> {formatDate(myOJT.startDate)}</div>
            <div><strong>Days Completed:</strong> {calculateDaysCompleted(myOJT.startDate)}</div>
            <div><Badge status={myOJT.status}>{myOJT.status}</Badge></div>
          </div>
        </Card>

        <Card>
          <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Hours Tracking</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--teal)' }}>{myOJT.requiredHours}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>Required</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#10B981' }}>{myOJT.verifiedHours}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>Verified</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: '#F59E0B' }}>{myOJT.pendingHours || 0}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>Pending</div>
            </div>
            <div style={{ textAlign: 'center', padding: '16px', background: 'var(--background)', borderRadius: '8px' }}>
              <div style={{ fontSize: '28px', fontWeight: '700', color: 'var(--primary-orange)' }}>{myOJT.remainingHours}</div>
              <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>Remaining</div>
            </div>
          </div>
          <ProgressBar value={myOJT.progress} max={100} showLabel={true} />
        </Card>

        {myOJT.status === 'Completed' && (
          <Card style={{ background: '#D1FAE5', border: '2px solid #10B981' }}>
            <h3 style={{ fontSize: '20px', fontWeight: '600', color: '#065F46', marginBottom: '8px' }}>
              🎉 Congratulations!
            </h3>
            <p style={{ color: '#065F46' }}>
              You have successfully completed your OJT program. Your certificate is now available.
            </p>
          </Card>
        )}
      </div>
    </div>
  );
}
