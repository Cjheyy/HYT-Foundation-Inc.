import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../utils/helpers';
import { useNavigate } from 'react-router-dom';
import './Dashboard.css';
import './Admin.css';

export function AdminDashboard() {
  const { state } = useApp();
  const { users, applications, ojtRecords, dailyReports, attendance } = state;
  const navigate = useNavigate();

  const students = users.filter(u => u.role === 'STUDENT');
  const activeApplications = applications.filter(a => 
    ['Applied', 'Under Review', 'Interview'].includes(a.status)
  );
  const ongoingOJT = ojtRecords.filter(o => o.status === 'Active');
  const completedOJT = ojtRecords.filter(o => o.status === 'Completed');
  const pendingReports = dailyReports.filter(r => r.status === 'Submitted');
  const pendingAttendance = attendance.filter(a => a.status === 'Pending Verification');

  const stats = [
    { label: 'Total Students', value: students.length, icon: '👥', color: 'var(--teal)' },
    { label: 'Active Applications', value: activeApplications.length, icon: '📝', color: 'var(--primary-orange)' },
    { label: 'Ongoing OJT', value: ongoingOJT.length, icon: '💼', color: 'var(--yellow)' },
    { label: 'Completed OJT', value: completedOJT.length, icon: '✓', color: '#10B981' },
    { label: 'Pending Reviews', value: pendingReports.length, icon: '📋', color: '#F59E0B' },
    { label: 'Pending Attendance', value: pendingAttendance.length, icon: '⏰', color: '#EF4444' }
  ];

  return (
    <div className="admin-dashboard-page">
      <h1 className="page-title">Admin Dashboard</h1>

      <div className="admin-stats-grid">
        {stats.map((stat, idx) => (
          <Card key={idx} className="admin-stat-card">
            <div className="admin-stat-icon">{stat.icon}</div>
            <div className="admin-stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
            <div className="admin-stat-label">{stat.label}</div>
          </Card>
        ))}
      </div>

      <div className="admin-dashboard-grid">
        <Card>
          <h3 className="admin-section-title">Recent Applications</h3>
          {activeApplications.slice(0, 5).map((app) => {
            const student = users.find(u => u.id === app.studentId);
            return (
              <div 
                key={app.id} 
                className="admin-item"
                onClick={() => navigate(`/admin/applications`)}
              >
                <div className="admin-item-header">
                  <div>
                    <div className="admin-item-name">{student?.fullName}</div>
                    <div className="admin-item-date">{formatDate(app.appliedAt)}</div>
                  </div>
                  <Badge status={app.status}>{app.status}</Badge>
                </div>
              </div>
            );
          })}
        </Card>

        <Card>
          <h3 className="admin-section-title">Pending Daily Reports</h3>
          {pendingReports.slice(0, 5).map((report) => {
            const student = users.find(u => u.id === report.studentId);
            return (
              <div 
                key={report.id} 
                className="admin-item"
                onClick={() => navigate(`/admin/daily-reports`)}
              >
                <div className="admin-item-header">
                  <div>
                    <div className="admin-item-name">{student?.fullName}</div>
                    <div className="admin-item-date">{formatDate(report.date)} - {report.hoursRendered} hours</div>
                  </div>
                  <Badge status={report.status}>{report.status}</Badge>
                </div>
              </div>
            );
          })}
        </Card>
      </div>
    </div>
  );
}
