import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { showToast } from '../../utils/notifications';
import { createDailyReport, getReportsByStudent } from '../../services/dailyReportService';
import { getOJTByStudent } from '../../services/ojtService';
import { formatDate } from '../../utils/helpers';

export function StudentDailyReports() {
  const { state, dispatch } = useApp();
  const { currentUser, dailyReports, ojtRecords } = state;
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    date: new Date().toISOString().split('T')[0],
    hoursRendered: '',
    tasksCompleted: '',
    skillsLearned: '',
    problemsEncountered: '',
    remarks: ''
  });

  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);
  const myReports = getReportsByStudent(dailyReports, currentUser?.id);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    const report = createDailyReport({
      ...formData,
      studentId: currentUser.id,
      ojtRecordId: myOJT.id,
      hoursRendered: parseFloat(formData.hoursRendered)
    });

    dispatch({ type: 'ADD_DAILY_REPORT', payload: report });
    showToast('Daily report submitted successfully!', 'success');
    setShowForm(false);
    setFormData({
      date: new Date().toISOString().split('T')[0],
      hoursRendered: '',
      tasksCompleted: '',
      skillsLearned: '',
      problemsEncountered: '',
      remarks: ''
    });
  };

  if (!myOJT) {
    return (
      <div>
        <h1 className="page-title">Daily Reports</h1>
        <EmptyState
          icon="📋"
          title="No Active OJT"
          message="You need an active OJT program to submit daily reports"
        />
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Daily Reports</h1>
        <Button onClick={() => setShowForm(true)}>Submit Report</Button>
      </div>

      {myReports.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {myReports.map((report) => (
            <Card key={report.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '600' }}>{formatDate(report.date)}</h3>
                  <p style={{ fontSize: '14px', color: 'var(--muted-text)' }}>{report.hoursRendered} hours</p>
                </div>
                <Badge status={report.status}>{report.status}</Badge>
              </div>
              <div style={{ fontSize: '14px', color: 'var(--muted-text)' }}>
                <div><strong>Tasks:</strong> {report.tasksCompleted}</div>
                {report.adminRemarks && (
                  <div style={{ marginTop: '8px', padding: '8px', background: '#FEF3C7', borderRadius: '4px', color: '#92400E' }}>
                    <strong>Admin:</strong> {report.adminRemarks}
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📋"
          title="No Daily Reports"
          message="Submit your first daily report to track your progress"
        />
      )}

      <Modal
        isOpen={showForm}
        onClose={() => setShowForm(false)}
        title="Submit Daily Report"
        size="lg"
      >
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <Input
              label="Date"
              type="date"
              value={formData.date}
              onChange={(e) => setFormData({...formData, date: e.target.value})}
              required
            />
            <Input
              label="Hours Rendered"
              type="number"
              step="0.5"
              value={formData.hoursRendered}
              onChange={(e) => setFormData({...formData, hoursRendered: e.target.value})}
              required
            />
            <Textarea
              label="Tasks Completed"
              value={formData.tasksCompleted}
              onChange={(e) => setFormData({...formData, tasksCompleted: e.target.value})}
              required
            />
            <Textarea
              label="Skills Learned"
              value={formData.skillsLearned}
              onChange={(e) => setFormData({...formData, skillsLearned: e.target.value})}
              required
            />
            <Textarea
              label="Problems Encountered"
              value={formData.problemsEncountered}
              onChange={(e) => setFormData({...formData, problemsEncountered: e.target.value})}
            />
            <Textarea
              label="Remarks"
              value={formData.remarks}
              onChange={(e) => setFormData({...formData, remarks: e.target.value})}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Submit Report</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
