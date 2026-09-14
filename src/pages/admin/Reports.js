import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';

export function AdminReports() {
  const { state } = useApp();
  const { users, applications, ojtRecords, programs, opportunities, attendance, dailyReports } = state;

  const students = users.filter(u => u.role === 'STUDENT');
  const acceptedApplications = applications.filter(a => a.status === 'Accepted');
  const activeOJT = ojtRecords.filter(o => o.status === 'Active');
  const completedOJT = ojtRecords.filter(o => o.status === 'Completed');
  const totalVerifiedHours = ojtRecords.reduce((sum, o) => sum + o.verifiedHours, 0);
  const pendingAttendance = attendance.filter(a => a.status === 'Pending Verification');
  const pendingReports = dailyReports.filter(r => r.status === 'Submitted');

  const stats = [
    { label: 'Total Students', value: students.length, color: 'var(--teal)' },
    { label: 'Total Applications', value: applications.length, color: 'var(--primary-orange)' },
    { label: 'Accepted Applications', value: acceptedApplications.length, color: '#10B981' },
    { label: 'Active OJT Programs', value: activeOJT.length, color: 'var(--yellow)' },
    { label: 'Completed OJT', value: completedOJT.length, color: '#8B5CF6' },
    { label: 'Total Programs', value: programs.length, color: 'var(--teal)' },
    { label: 'Total Opportunities', value: opportunities.length, color: 'var(--primary-orange)' },
    { label: 'Total Verified OJT Hours', value: totalVerifiedHours, color: '#10B981' },
    { label: 'Pending Attendance Verification', value: pendingAttendance.length, color: '#EF4444' },
    { label: 'Pending Daily Reports', value: pendingReports.length, color: '#F59E0B' }
  ];

  return (
    <div>
      <h1 className="page-title">Reports & Analytics</h1>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' }}>
        {stats.map((stat, idx) => (
          <Card key={idx} style={{ textAlign: 'center', padding: '32px 24px' }}>
            <div style={{ fontSize: '36px', fontWeight: '700', color: stat.color, marginBottom: '8px' }}>
              {stat.value}
            </div>
            <div style={{ fontSize: '14px', color: 'var(--muted-text)' }}>{stat.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
