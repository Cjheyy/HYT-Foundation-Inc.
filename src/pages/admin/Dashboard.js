import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/icons';
import { ListItemSkeleton } from '../../components/Skeleton';
import {
  AdminDashboardMetrics,
  DASHBOARD_DATA_CHANGED_EVENT,
  DASHBOARD_SNAPSHOT_READY_EVENT
} from '../../components/AdminDashboardMetrics';
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
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // The realtime channel is owned by <AdminDashboardMetrics />, which also
  // handles realtime setup/teardown and its own fallback polling.  This page
  // only needs the freshest snapshot, so it listens for the snapshot event and
  // for cross-route invalidations instead of subscribing to the same tables.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const contextUsersRef = useRef(state.users);
  contextUsersRef.current = state.users;

  const loadDashboardData = useCallback(async ({ showLoader = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showLoader) setSearchLoading(true);
    try {
      const [usersResult, applicationsResult, logsResult, reportsResult] = await Promise.allSettled([
        getUsers(),
        getPendingUserApplications(),
        getAttendanceLogs(),
        getDailyReports()
      ]);

      if (!mountedRef.current || requestId !== requestIdRef.current) return;

      const failures = [
        usersResult.status === 'rejected' ? usersResult.reason : usersResult.value?.error,
        applicationsResult.status === 'rejected' ? applicationsResult.reason : applicationsResult.value?.error,
        logsResult.status === 'rejected' ? logsResult.reason : logsResult.value?.error,
        reportsResult.status === 'rejected' ? reportsResult.reason : reportsResult.value?.error
      ].filter(Boolean);

      if (failures.length) {
        // Keep the previous lists instead of rendering convincing empties.
        console.error('Admin dashboard data load failed.', failures);
        setLoadError('Some dashboard data could not be loaded. Retrying automatically.');
        return;
      }

      const users = usersResult.value?.data || usersResult.value || [];
      const rawApplications = applicationsResult.value?.data || applicationsResult.value || [];
      const rawLogs = logsResult.value?.data || logsResult.value || [];
      const rawReports = reportsResult.value?.data || reportsResult.value || [];
      setDirectoryUsers(Array.isArray(users) ? users : []);
      setPendingApplications((Array.isArray(rawApplications) ? rawApplications : []).filter((application) =>
        isPendingAccountStatus(application.applicationStatus)
      ));
      setPendingLogs((Array.isArray(rawLogs) ? rawLogs : []).filter((log) => isPendingAttendanceStatus(log.status)));
      setPendingReports((Array.isArray(rawReports) ? rawReports : []).filter((report) => isPendingReportStatus(report.status)));
      setLoadError('');
    } finally {
      if (mountedRef.current && showLoader && requestId === requestIdRef.current) setSearchLoading(false);
      if (mountedRef.current && requestId === requestIdRef.current) setInitialLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadDashboardData({ showLoader: true });

    let refreshTimer;
    const scheduleRefresh = () => {
      window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => {
        if (mountedRef.current) loadDashboardData();
      }, 150);
    };
    const onLocalChange = () => scheduleRefresh();
    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
    window.addEventListener(DASHBOARD_SNAPSHOT_READY_EVENT, onLocalChange);

    // Safety net for a dropped socket, a missing realtime publication, or a
    // backgrounded tab that missed events while asleep.
    const pollTimer = window.setInterval(() => loadDashboardData(), 60_000);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadDashboardData();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      mountedRef.current = false;
      window.clearTimeout(refreshTimer);
      window.clearInterval(pollTimer);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
      window.removeEventListener(DASHBOARD_SNAPSHOT_READY_EVENT, onLocalChange);
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

  const recentApplications = useMemo(() => pendingApplications.slice(0, 5), [pendingApplications]);
  const recentReports = useMemo(() => pendingReports.slice(0, 5), [pendingReports]);
  const recentLogs = useMemo(() => pendingLogs.slice(0, 5), [pendingLogs]);
  const dashboardCounts = useMemo(() => ({
    applications: pendingApplications.length,
    reports: pendingReports.length,
    logs: pendingLogs.length
  }), [pendingApplications.length, pendingReports.length, pendingLogs.length]);

  const openDirectoryResult = useCallback((user) => {
    if (isPendingAccountStatus(user.applicationStatus)) {
      navigate(`/admin/application-review?user=${encodeURIComponent(user.id)}`);
    } else {
      navigate(`/admin/students?user=${encodeURIComponent(user.id)}`);
    }
  }, [navigate]);

  const handleSearchChange = useCallback((event) => setSearchTerm(event.target.value), []);
  const handleClearSearch = useCallback(() => setSearchTerm(''), []);

  return (
    <div className="admin-dashboard-page">
      <div className="page-header">
        <h1 className="page-title">Admin Dashboard</h1>
        <p className="page-subtitle">Live overview of HYT Foundation activities</p>
      </div>

      <AdminDashboardMetrics />

      {loadError && (
        <div className="metrics-error" role="alert" style={{ marginBottom: '16px' }}>{loadError}</div>
      )}

      <Card className="admin-search-card">
        <div className="admin-search-heading">
          <div>
            <h2 className="admin-section-title">Live Directory Search</h2>
            <p className="admin-search-help">Search students and registration applications by name, email, school, or student ID.</p>
          </div>
          {searchLoading && <span className="search-sync-label">Syncing...</span>}
        </div>
        <div className="admin-search-input-wrap">
          <span className="admin-search-icon" aria-hidden="true"><Icon name="search" size={16} /></span>
          <input
            type="search"
            className="admin-search-input"
            value={searchTerm}
            onChange={handleSearchChange}
            placeholder="Search students or applications..."
            aria-label="Search students and applications"
          />
          {searchTerm && (
            <button type="button" className="admin-search-clear" onClick={handleClearSearch} aria-label="Clear search"><Icon name="x" size={14} /></button>
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
                <Badge status={user.applicationStatus || 'UNKNOWN'}>
                  {isPendingAccountStatus(user.applicationStatus) ? 'Application' : 'Student'}
                </Badge>
                <span className="admin-search-result-action">View</span>
              </button>
            )) : <p className="admin-search-empty">No matching students or applications.</p>}
          </div>
        )}
      </Card>

      <div className="admin-dashboard-grid">
        <Card>
          <div className="dashboard-card-heading">
            <h3 className="admin-section-title">Pending Registration Applications ({dashboardCounts.applications})</h3>
            <button type="button" className="text-link-button" onClick={() => navigate('/admin/application-review?status=PENDING_APPROVAL')}>View all</button>
          </div>
          {initialLoading ? <ListItemSkeleton rows={2} /> : recentApplications.length > 0 ? recentApplications.map((application) => (
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
            <h3 className="admin-section-title">Pending Daily Reports ({dashboardCounts.reports})</h3>
            <button type="button" className="text-link-button" onClick={() => navigate('/admin/report-approvals?status=pending')}>View all</button>
          </div>
          {initialLoading ? <ListItemSkeleton rows={2} /> : recentReports.length > 0 ? recentReports.map((report) => (
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
            <h3 className="admin-section-title">Pending Attendance Verification ({dashboardCounts.logs})</h3>
            <button type="button" className="text-link-button" onClick={() => navigate('/admin/attendance-verification?status=pending')}>View all</button>
          </div>
          {initialLoading ? <ListItemSkeleton rows={2} /> : recentLogs.length > 0 ? recentLogs.map((log) => (
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
