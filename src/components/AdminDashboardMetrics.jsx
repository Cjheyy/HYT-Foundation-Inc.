import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../config/supabase';
import { getAdminDashboardStats, cleanupExpiredEvents } from '../services/supabaseService';
import { Card } from './Card';
import './AdminDashboardMetrics.css';

export const DASHBOARD_DATA_CHANGED_EVENT = 'hyt:dashboard-data-changed';

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
    icon: '👥',
    color: '#667eea',
    description: 'Trainee and OJT/Intern accounts',
    path: '/admin/students'
  },
  {
    key: 'totalApplications',
    label: 'Total Applications',
    icon: '📝',
    color: '#10B981',
    description: 'New sign-ups awaiting review',
    path: '/admin/application-review?status=PENDING_APPROVAL'
  },
  {
    key: 'acceptedApplications',
    label: 'Accepted Applications',
    icon: '✅',
    color: '#059669',
    description: 'Approved trainee accounts',
    path: '/admin/application-review?status=APPROVED'
  },
  {
    key: 'completedOJT',
    label: 'Completed OJT',
    icon: '🎓',
    color: '#8B5CF6',
    description: 'Reached 100% of required hours',
    path: '/admin/students?progress=completed'
  },
  {
    key: 'totalProgramsOpportunities',
    label: 'Active Programs & Opportunities',
    icon: '🎯',
    color: '#F59E0B',
    description: 'Published, non-expired listings',
    path: '/admin/programs?status=active'
  },
  {
    key: 'pendingAttendance',
    label: 'Pending Attendance',
    icon: '⏰',
    color: '#EF4444',
    description: 'Clock-in or clock-out requests',
    path: '/admin/attendance-verification?status=pending'
  },
  {
    key: 'pendingDailyReports',
    label: 'Pending Reports',
    icon: '📋',
    color: '#EC4899',
    description: 'Daily reports awaiting review',
    path: '/admin/report-approvals?status=pending'
  }
];

export function AdminDashboardMetrics() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(initialMetrics);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [realtimeConnected, setRealtimeConnected] = useState(false);
  const refreshTimer = useRef(null);

  const loadMetrics = useCallback(async ({ showLoader = false } = {}) => {
    if (showLoader) setLoading(true);
    try {
      const nextMetrics = await getAdminDashboardStats();
      setMetrics((previous) => ({ ...previous, ...nextMetrics }));
      setError('');
    } catch (loadError) {
      console.error('Error fetching dashboard metrics:', loadError);
      setError('Live metrics are temporarily unavailable. Retrying automatically.');
    } finally {
      if (showLoader) setLoading(false);
    }
  }, []);

  useEffect(() => {
    let mounted = true;
    loadMetrics({ showLoader: true });
    cleanupExpiredEvents().catch(() => undefined);

    const scheduleRefresh = () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      refreshTimer.current = setTimeout(() => {
        if (mounted) loadMetrics();
      }, 120);
    };

    const onLocalChange = () => scheduleRefresh();
    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);

    let channel;
    const pollTimer = window.setInterval(() => loadMetrics(), 30_000);

    if (supabase) {
      channel = supabase
        .channel(`admin-dashboard-${Date.now()}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_reports' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, scheduleRefresh)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, scheduleRefresh)
        .subscribe((status) => {
          if (!mounted) return;
          setRealtimeConnected(status === 'SUBSCRIBED');
          if (status === 'SUBSCRIBED') scheduleRefresh();
        });
    }

    return () => {
      mounted = false;
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
      if (refreshTimer.current) clearTimeout(refreshTimer.current);
      window.clearInterval(pollTimer);
      if (channel) supabase.removeChannel(channel);
    };
  }, [loadMetrics]);

  if (loading) {
    return (
      <div className="metrics-loading" role="status" aria-live="polite">
        <div className="spinner" />
        <p>Loading live metrics...</p>
      </div>
    );
  }

  return (
    <>
      {error && <div className="metrics-error" role="alert">{error}</div>}
      <div className="admin-metrics-grid" aria-label="Live admin statistics">
        {metricDefinitions.map((metric) => {
          const value = metrics[metric.key] ?? 0;
          return (
            <Card
              key={metric.key}
              className="metric-card metric-card-button"
              clickable
              role="link"
              tabIndex={0}
              aria-label={`${metric.label}: ${value}. Open ${metric.label}`}
              onClick={() => navigate(metric.path)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  navigate(metric.path);
                }
              }}
            >
              <div className="metric-icon" style={{ background: metric.color }}>{metric.icon}</div>
              <div className="metric-content">
                <div className="metric-value" style={{ color: metric.color }}>{value}</div>
                <div className="metric-label">{metric.label}</div>
                <div className="metric-description">{metric.description}</div>
              </div>
              <div className="metric-live-indicator" title={realtimeConnected ? 'Realtime connected' : 'Refreshing live'}>
                <span className={`live-dot ${realtimeConnected ? '' : 'live-dot-offline'}`} />
                <span className="live-text">{realtimeConnected ? 'Live' : 'Sync'}</span>
              </div>
            </Card>
          );
        })}
      </div>
    </>
  );
}
