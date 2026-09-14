import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Select } from '../../components/Select';
import { showToast } from '../../utils/notifications';
import { updateApplicationStatus, APPLICATION_STATUSES } from '../../services/applicationService';
import { createOJTRecord } from '../../services/ojtService';
import { formatDate } from '../../utils/helpers';

export function AdminApplications() {
  const { state, dispatch } = useApp();
  const { applications, users, opportunities } = state;
  const [selectedApp, setSelectedApp] = useState(null);
  const [newStatus, setNewStatus] = useState('');

  const handleUpdateStatus = () => {
    const updatedApp = updateApplicationStatus(selectedApp, newStatus, 'Status updated by admin');
    dispatch({ type: 'UPDATE_APPLICATION', payload: updatedApp });

    // If status is Accepted, create OJT record
    if (newStatus === 'Accepted') {
      const opportunity = opportunities.find(o => o.id === selectedApp.opportunityId);
      const ojtRecord = createOJTRecord({
        studentId: selectedApp.studentId,
        opportunityId: selectedApp.opportunityId,
        applicationId: selectedApp.id,
        company: opportunity?.organization || 'Company',
        supervisor: 'Supervisor Name',
        requiredHours: opportunity?.requiredHours || 486
      });
      dispatch({ type: 'ADD_OJT_RECORD', payload: ojtRecord });
    }

    showToast('Application status updated successfully!', 'success');
    setSelectedApp(null);
    setNewStatus('');
  };

  return (
    <div>
      <h1 className="page-title">Applications</h1>

      <div style={{ display: 'grid', gap: '16px' }}>
        {applications.map((app) => {
          const student = users.find(u => u.id === app.studentId);
          const opportunity = opportunities.find(o => o.id === app.opportunityId);
          return (
            <Card key={app.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '4px' }}>{student?.fullName}</h3>
                  <p style={{ color: 'var(--muted-text)', fontSize: '14px', marginBottom: '8px' }}>
                    {opportunity?.title || 'Opportunity'}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--muted-text)' }}>
                    Applied: {formatDate(app.appliedAt)}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <Badge status={app.status}>{app.status}</Badge>
                  <Button size="sm" onClick={() => { setSelectedApp(app); setNewStatus(app.status); }}>
                    Update
                  </Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal
        isOpen={!!selectedApp}
        onClose={() => setSelectedApp(null)}
        title="Update Application Status"
      >
        <Select
          label="New Status"
          value={newStatus}
          onChange={(e) => setNewStatus(e.target.value)}
          options={APPLICATION_STATUSES}
        />
        <div style={{ display: 'flex', gap: '12px', marginTop: '20px' }}>
          <Button variant="outline" onClick={() => setSelectedApp(null)}>Cancel</Button>
          <Button onClick={handleUpdateStatus} disabled={!newStatus || newStatus === selectedApp?.status}>
            Update Status
          </Button>
        </div>
      </Modal>
    </div>
  );
}
