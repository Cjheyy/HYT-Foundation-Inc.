import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { EmptyState } from '../../components/EmptyState';
import { showToast } from '../../utils/notifications';
import { submitRequirement } from '../../services/requirementService';

export function StudentRequirements() {
  const { state, dispatch } = useApp();
  const { currentUser, requirements } = state;
  const [selectedReq, setSelectedReq] = useState(null);
  const [file, setFile] = useState('');

  const myRequirements = requirements.filter(req => req.studentId === currentUser?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    const updated = submitRequirement(selectedReq, file);
    dispatch({ type: 'UPDATE_REQUIREMENT', payload: { ...updated, status: 'Submitted' } });
    showToast('Requirement submitted successfully!', 'success');
    setSelectedReq(null);
    setFile('');
  };

  return (
    <div>
      <h1 className="page-title">Requirements</h1>

      {myRequirements.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {myRequirements.map((req) => (
            <Card key={req.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600', marginBottom: '4px' }}>{req.name}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted-text)' }}>{req.description}</p>
                  {req.adminRemarks && (
                    <p style={{ fontSize: '13px', color: '#DC2626', marginTop: '8px' }}>
                      Admin: {req.adminRemarks}
                    </p>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Badge status={req.status}>{req.status}</Badge>
                  {['Required', 'Rejected'].includes(req.status) && (
                    <Button size="sm" onClick={() => setSelectedReq(req)}>
                      {req.status === 'Rejected' ? 'Resubmit' : 'Upload'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📄"
          title="No Requirements"
          message="Requirements will appear when you apply to opportunities"
        />
      )}

      <Modal
        isOpen={!!selectedReq}
        onClose={() => setSelectedReq(null)}
        title="Submit Requirement"
        footer={
          <>
            <Button variant="outline" onClick={() => setSelectedReq(null)}>Cancel</Button>
            <Button onClick={handleSubmit}>Submit</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <Input
            label="File Name"
            value={file}
            onChange={(e) => setFile(e.target.value)}
            placeholder="e.g., Resume.pdf"
            help="In a real application, this would be a file upload"
            required
          />
        </form>
      </Modal>
    </div>
  );
}
