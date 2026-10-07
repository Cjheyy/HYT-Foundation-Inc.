import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import './Reports.css';

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

  // `tone` only drives the small accent rule on the card; the NUMBER itself is
  // always the card's own text token.  The previous version set the number's
  // colour to the accent, and every one of those accents measured under 3:1
  // against the card gradient's orange end (#279EB6 1.71, #D57156 1.63,
  // #10B981 2.13, #8B5CF6 1.28, #EF4444 1.44, #F59E0B 2.52).
  const stats = [
    { label: 'Total Students', value: students.length, tone: 'teal' },
    { label: 'Total Applications', value: applications.length, tone: 'orange' },
    { label: 'Accepted Applications', value: acceptedApplications.length, tone: 'green' },
    { label: 'Active OJT Programs', value: activeOJT.length, tone: 'amber' },
    { label: 'Completed OJT', value: completedOJT.length, tone: 'violet' },
    { label: 'Total Programs', value: programs.length, tone: 'teal' },
    { label: 'Total Opportunities', value: opportunities.length, tone: 'orange' },
    { label: 'Total Verified OJT Hours', value: totalVerifiedHours, tone: 'green' },
    { label: 'Pending Attendance Verification', value: pendingAttendance.length, tone: 'red' },
    { label: 'Pending Daily Reports', value: pendingReports.length, tone: 'amber' }
  ];

  return (
    <div>
      <h1 className="page-title">Reports &amp; Analytics</h1>

      <div className="reports-stat-grid">
        {stats.map((stat) => (
          <Card key={stat.label} className={`report-stat-card tone-${stat.tone}`}>
            <div className="report-stat-value">{stat.value}</div>
            <div className="report-stat-label">{stat.label}</div>
          </Card>
        ))}
      </div>
    </div>
  );
}
