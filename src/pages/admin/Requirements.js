import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { showToast } from '../../utils/notifications';
import { updateRequirementStatus } from '../../services/requirementService';

export function AdminRequirements() {
  const { state, dispatch } = useApp();
  const { requirements, users } = state;

  const handleApprove = (req) => {
    const updated = updateRequirementStatus(req, 'Approved', 'Requirement approved');
    dispatch({ type: 'UPDATE_REQUIREMENT', payload: updated });
    showToast('Requirement approved!', 'success');
  };

  const handleReject = (req) => {
    const updated = updateRequirementStatus(req, 'Rejected', 'Please resubmit with correct format');
    dispatch({ type: 'UPDATE_REQUIREMENT', payload: updated });
    showToast('Requirement rejected', 'error');
  };

  const pendingReqs = requirements.filter(r => r.status === 'Submitted');

  return (
    <div>
      <h1 className="page-title">Requirements</h1>

      {pendingReqs.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {pendingReqs.map((req) => {
            const student = users.find(u => u.id === req.studentId);
            return (
              <Card key={req.id}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                  <div>
                    <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{student?.fullName}</h3>
                    <p style={{ color: 'var(--muted-text)', marginTop: '4px' }}>{req.name}</p>
                    <p style={{ fontSize: '13px', color: 'var(--muted-text)', marginTop: '4px' }}>File: {req.file}</p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <Badge status={req.status}>{req.status}</Badge>
                    <Button size="sm" variant="success" onClick={() => handleApprove(req)}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => handleReject(req)}>Reject</Button>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <Card><p style={{ textAlign: 'center', color: 'var(--muted-text)' }}>No pending requirements</p></Card>
      )}
    </div>
  );
}
