import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { getAdminDashboardStats } from '../services/supabaseService';
import { Card } from './Card';
import { Icon } from './icons';
import { MetricCardSkeleton } from './Skeleton';
import './AdminDashboardMetrics.css';

export const DASHBOARD_DATA_CHANGED_EVENT = 'hyt:dashboard-data-changed';
// Internal notification: the metrics component owns the single realtime
// channel, so sibling sections refresh from this instead of opening their own.
export const DASHBOARD_SNAPSHOT_READY_EVENT = 'hyt:dashboard-snapshot-ready';

const initialMetrics = {
  totalStudents: 0,
  totalApplications: 0,
  acceptedApplications: 0,
  completedOJT: 0,
  activePrograms: 0,
  activeOpportunities: 0,
  totalProgramsOpportunities: 0,
  pendingAttendance: 0,
  pendingReports: 0,
  pendingDailyReports: 0
};

const metricDefinitions = [
  {
    key: 'totalStudents',
    label: 'Total Students',
    icon: 'users',
    color: '#667eea',
    description: 'All Trainee and OJT/Intern accounts',
    path: '/admin/students'
  },
  {
    key: 'totalApplications',
    label: 'Total Applications',
    icon: 'file',
    color: '#10B981',
    description: 'New sign-ups awaiting review',
    path: '/admin/application-review?role=all&status=PENDING_APPROVAL'
  },
  {
    key: 'acceptedApplications',
    label: 'Accepted Applications',
    icon: 'check',
    color: '#059669',
    description: 'Approved trainee accounts',
    path: '/admin/application-review?role=all&status=APPROVED'
  },
  {
    key: 'completedOJT',
    label: 'Completed OJT',
    icon: 'award',
    color: '#8B5CF6',
    description: 'Active students at 100% of required hours',
    path: '/admin/students?progress=completed'
  },
  {
    key: 'totalProgramsOpportunities',
    label: 'Active Programs & Opportunities',
    icon: 'target',
    color: '#F59E0B',
    description: 'Published, non-expired listings',
    path: '/admin/programs?status=active'
  },
  {
    key: 'pendingAttendance',
    label: 'Pending Attendance',
    icon: 'clock',
    color: '#EF4444',
    description: 'Clock-in or clock-out requests',
    path: '/admin/attendance-verification?status=pending'
  },
  {
    key: 'pendingDailyReports',
    label: 'Pending Reports',
    icon: 'file',
    color: '#EC4899',
    description: 'Daily reports awaiting review',
    path: '/admin/report-approvals?status=pending'
  }
];

const REFRESH_DEBOUNCE_MS = 150;
const POLL_INTERVAL_MS = 30_000;

export function AdminDashboardMetrics() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [realtimeStatus, setRealtimeStatus] = useState('connecting');
  const refreshTimer = useRef(null);
  // A monotonic request id: an older response can never overwrite a newer one.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);
  const metricsCacheRef = useRef({ data: initialMetrics, timestamp: 0 });

  const loadMetrics = useCallback(async ({ showLoader = false, force = false } = {}) => {
    const now = Date.now();
    // Local cache: skip refetch when a fresh snapshot is already available.
    if (!force && now - metricsCacheRef.current.timestamp < 10_000 && !showLoader) return;
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (showLoader) setLoading(true);
    try {
      const nextMetrics = await getAdminDashboardStats();
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      metricsCacheRef.current = { data: nextMetrics, timestamp: Date.now() };
      setMetrics((previous) => ({ ...previous, ...nextMetrics }));
      setLastUpdatedAt(Date.now());
      setError('');
      // Let the rest of the dashboard refresh from the same snapshot.
      window.dispatchEvent(new CustomEvent(DASHBOARD_SNAPSHOT_READY_EVENT));
    } catch (loadError) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      console.error('Error fetching dashboard metrics:', loadError);
      // Keep the last known values; never replace them with zeroes.
      setError('Live metrics are temporarily unavailable. Showing the last known values and retrying automatically.');
    } finally {
      if (mountedRef.current && showLoader && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadMetrics({ showLoader: true, force: true });

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (mountedRef.current) loadMetrics();
      }, REFRESH_DEBOUNCE_MS);
    };

    const onLocalChange = () => scheduleRefresh();
    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
    // Realtime is the fast path; polling and focus recovery are the safety net
    // for a dropped socket, a missing publication, or a sleeping tab.
    const pollTimer = window.setInterval(() => loadMetrics(), POLL_INTERVAL_MS);
    const onVisibility = () => {
      if (document.visibilityState === 'visible') loadMetrics({ force: true });
    };
    document.addEventListener('visibilitychange', onVisibility);

    let channel;
    if (supabase) {
      channel = supabase
        .channel(`admin-dashboard-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, scheduleRefresh)
        .subscribe((status) => {
          if (!mountedRef.current) return;
          setRealtimeStatus(status === 'SUBSCRIBED' ? 'live' : 'offline');
          // Close the gap between the first paint and the subscription.
          if (status === 'SUBSCRIBED') scheduleRefresh();
        });
    } else {
      setRealtimeStatus('offline');
    }

    return () => {
      mountedRef.current = false;
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
      document.removeEventListener('visibilitychange', onVisibility);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      window.clearInterval(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadMetrics]);

  const handleNavigate = useCallback((path) => () => navigate(path), [navigate]);

  const cards = useMemo(() => metricDefinitions.map((metric) => ({
    ...metric,
    value: metrics[metric.key] ?? 0
  })), [metrics]);

  const statusLabel = useMemo(() => {
    if (error) return 'Stale';
    return realtimeStatus === 'live' ? 'Live' : 'Polling';
  }, [error, realtimeStatus]);

  const statusTitle = useMemo(() => {
    if (error) return `Last successful update: ${lastUpdatedAt ? new Date(lastUpdatedAt).toLocaleTimeString() : 'unknown'}`;
    return realtimeStatus === 'live' ? 'Realtime connected' : 'Realtime unavailable — refreshing every 30 seconds';
  }, [error, lastUpdatedAt, realtimeStatus]);

  if (loading) {
    return (
      <div className="admin-metrics-grid" aria-label="Loading live admin statistics" role="status" aria-live="polite">
        {cards.map((metric) => (
          <MetricCardSkeleton key={metric.key} />
        ))}
      </div>
    );
  }

  return (
    <>
      {error && <div className="metrics-error" role="alert">{error}</div>}
      <div className="admin-metrics-grid" aria-label="Live admin statistics">
        {cards.map((metric) => (
          <Card
            key={metric.key}
            className="metric-card metric-card-button"
            clickable
            role="link"
            tabIndex={0}
            aria-label={`${metric.label}: ${metric.value}. Open ${metric.label}`}
            onClick={handleNavigate(metric.path)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                navigate(metric.path);
              }
            }}
          >
            <div className="metric-icon metric-icon-svg" style={{ background: metric.color }}>
              <Icon name={metric.icon} size={26} color="#fff" />
            </div>
            <div className="metric-content">
              <div className="metric-value" style={{ color: metric.color }}>{metric.value}</div>
              <div className="metric-label">{metric.label}</div>
              <div className="metric-description">{metric.description}</div>
            </div>
            <div className="metric-live-indicator" title={statusTitle}>
              <span className={`live-dot ${realtimeStatus === 'live' && !error ? '' : 'live-dot-offline'}`} />
              <span className="live-text">{statusLabel}</span>
            </div>
          </Card>
        ))}
      </div>
    </>
  );
}
