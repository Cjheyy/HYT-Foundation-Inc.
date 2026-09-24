import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { AdminDashboardMetrics, DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import { supabase } from '../../config/supabase';
import {
  getUsers,
  getPendingUserApplications,
  getAttendanceLogs,
  getDailyReports,
  isPendingAttendanceStatus,
  isPendingReportStatus,
  isPendingAccountStatus,
  getAttendanceStage,
  isTraineeRole
} from '../../services/supabaseService';
import { formatDate } from '../../utils/helpers';
import './Dashboard.css';
import './Admin.css';

const normalizeSearch = (value) => String(value || '').trim().toLowerCase();

export function AdminDashboard() {
  const { state } = useApp();
  const navigate = useNavigate();
  const [directoryUsers, setDirectoryUsers] = useState(state.users || []);
  const [pendingApplications, setPendingApplications] = useState([]);
  const [pendingLogs, setPendingLogs] = useState([]);
  const [pendingReports, setPendingReports] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);

  const loadDashboardData = useCallback(async () => {
    setSearchLoading(true);
    try {
      const [users, applications, logs, reports] = await Promise.all([
        getUsers().catch(() => state.users || []),
        getPendingUserApplications().catch(() => []),
        getAttendanceLogs().catch(() => []),
        getDailyReports().catch(() => [])
      ]);
      setDirectoryUsers(users || []);
      setPendingApplications((applications || []).filter((application) =>
        isPendingAccountStatus(application.applicationStatus)
      ));
      setPendingLogs((logs || []).filter((log) => isPendingAttendanceStatus(log.status)));
      setPendingReports((reports || []).filter((report) => isPendingReportStatus(report.status)));
    } finally {
      setSearchLoading(false);
    }
  }, [state.users]);

  useEffect(() => {
    loadDashboardData();
    let refreshTimer;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(loadDashboardData, 150);
    };
    const onLocalChange = () => scheduleRefresh();
    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);

    let channel;
    if (supabase) {
      channel = supabase
        .channel(`admin-dashboard-directory-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, scheduleRefresh)
        .subscribe();
    }

    return () => {
      window.clearTimeout(refreshTimer);
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadDashboardData]);

  const students = useMemo(
    () => directoryUsers.filter((user) => isTraineeRole(user.role)),
    [directoryUsers]
  );

  const searchResults = useMemo(() => {
    const query = normalizeSearch(searchTerm);
    if (!query) return [];
    const matches = (user) => [user.fullName, user.email, user.school, user.studentId]
      .some((value) => normalizeSearch(value).includes(query));
    return students.filter(matches).slice(0, 8);
  }, [searchTerm, students]);

  const recentApplications = pendingApplications.slice(0, 5);
  const recentReports = pendingReports.slice(0, 5);
  const recentLogs = pendingLogs.slice(0, 5);

  const openDirectoryResult = (user) => {
    if (isPendingAccountStatus(user.applicationStatus)) {
      navigate(`/admin/application-review?user=${encodeURIComponent(user.id)}`);
    } else {
      navigate(`/admin/students?user=${encodeURIComponent(user.id)}`);
    }
  };

  return (
    <div className="admin-dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Live overview of HYT Foundation activities</p>
      </div>

      <AdminDashboardMetrics />

      <Card className="admin-search-card">
        <div className="admin-search-heading">
          <div>
            <h2 className="admin-section-title">Live Directory Search</h2>
            <p className="admin-search-help">Search students and registration applications by name, email, school, or student ID.</p>
          </div>
          {searchLoading && <span className="search-sync-label">Syncing...</span>}
        </div>
        <div className="admin-search-input-wrap">
          <span className="admin-search-icon" aria-hidden="true">⌕</span>
          <input
            type="search"
            className="admin-search-input"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search students or applications..."
            aria-label="Search students and applications"
          />
          {searchTerm && (
            <button type="button" className="admin-search-clear" onClick={() => setSearchTerm('')} aria-label="Clear search">×</button>
          )}
        </div>
        {searchTerm && (
          <div className="admin-search-results" aria-live="polite">
            {searchResults.length > 0 ? searchResults.map((user) => (
              <button type="button" className="admin-search-result" key={user.id} onClick={() => openDirectoryResult(user)}>
                <span className="admin-search-avatar">{user.fullName?.charAt(0) || '?'}</span>
                <span className="admin-search-result-copy">
                  <strong>{user.fullName || 'Unknown user'}</strong>
                  <small>{user.email}{user.school ? ` · ${user.school}` : ''}</small>
                </span>
                <span className="admin-search-result-action">View →</span>
              </button>
            )) : <p className="admin-search-empty">No matching students or applications.</p>}
          </div>
        )}
      </Card>

      <div className="admin-dashboard-grid">
        <Card>
          <div className="dashboard-card-heading">
            <h3 className="admin-section-title">Pending Registration Applications</h3>
            <button type="button" className="text-link-button" onClick={() => navigate('/admin/application-review?status=PENDING_APPROVAL')}>View all</button>
          </div>
          {recentApplications.length > 0 ? recentApplications.map((application) => (
            <div key={application.id} className="admin-item" onClick={() => navigate(`/admin/application-review?user=${application.id}`)}>
              <div className="admin-item-header">
                <div>
                  <div className="admin-item-name">{application.fullName || 'Unknown'}</div>
                  <div className="admin-item-date">{formatDate(application.createdAt)}</div>
                </div>
                <Badge status="PENDING_APPROVAL">Pending</Badge>
              </div>
            </div>
          )) : <p className="no-data">No pending registration applications</p>}
        </Card>

        <Card>
          <div className="dashboard-card-heading">
            <h3 className="admin-section-title">Pending Daily Reports</h3>
            <button type="button" className="text-link-button" onClick={() => navigate('/admin/report-approvals?status=pending')}>View all</button>
          </div>
          {recentReports.length > 0 ? recentReports.map((report) => (
            <div key={report.id} className="admin-item" onClick={() => navigate('/admin/report-approvals?status=pending')}>
              <div className="admin-item-header">
                <div>
                  <div className="admin-item-name">{report.user?.fullName || 'Unknown'}</div>
                  <div className="admin-item-date">{formatDate(report.reportDate || report.date)}</div>
                </div>
                <Badge status={report.status}>Pending</Badge>
              </div>
            </div>
          )) : <p className="no-data">No pending daily reports</p>}
        </Card>

        <Card>
          <div className="dashboard-card-heading">
            <h3 className="admin-section-title">Pending Attendance Verification</h3>
            <button type="button" className="text-link-button" onClick={() => navigate('/admin/attendance-verification?status=pending')}>View all</button>
          </div>
          {recentLogs.length > 0 ? recentLogs.map((log) => (
            <div key={log.id} className="admin-item" onClick={() => navigate('/admin/attendance-verification?status=pending')}>
              <div className="admin-item-header">
                <div>
                  <div className="admin-item-name">{log.user?.fullName || 'Unknown'}</div>
                  <div className="admin-item-date">
                    {formatDate(log.date)} · {getAttendanceStage(log) === 'CLOCK_IN' ? 'Clock-in request' : `${Number(log.renderedHours || 0).toFixed(2)} frozen hours`}
                  </div>
                </div>
                <Badge status={log.status}>Review</Badge>
              </div>
            </div>
          )) : <p className="no-data">No pending attendance requests</p>}
        </Card>
      </div>
    </div>
  );
}
