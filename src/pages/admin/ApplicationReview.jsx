import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { supabase } from '../../config/supabase';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import {
  getApplications,
  setApplicationStatus
} from '../../services/supabaseService';
import { Icon } from '../../components/icons';
import { ListItemSkeleton } from '../../components/Skeleton';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Admin.css';

export function ApplicationReview() {
  const { state, refreshData } = useApp();
  const { programs, opportunities, users } = state;
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [eventApplications, setEventApplications] = useState([]);
  // Overlapping reloads (manual refresh + realtime + local invalidation) must
  // not resolve out of order.
  const requestIdRef = useRef(0);
  const mountedRef = useRef(true);

  const loadApplications = useCallback(async ({ loader = false } = {}) => {
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    if (loader) setLoading(true);
    try {
      const eventData = await getApplications().catch(() => []);
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setEventApplications(Array.isArray(eventData) ? eventData : []);
    } catch (error) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      toast.error('Failed to load applications');
    } finally {
      if (mountedRef.current && loader && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    loadApplications({ loader: true });
    let timer;
    const refresh = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => { if (mountedRef.current) loadApplications(); }, 120);
    };
    const onLocalChange = () => refresh();
    window.addEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
    let channel;
    if (supabase) {
      try {
        channel = supabase
          .channel(`admin-application-review-${Date.now()}`)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, refresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'applications' }, refresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'programs' }, refresh)
          .on('postgres_changes', { event: '*', schema: 'public', table: 'opportunities' }, refresh)
          .subscribe();
      } catch (error) {
        channel = null;
      }
    }
    return () => {
      mountedRef.current = false;
      window.clearTimeout(timer);
      window.removeEventListener(DASHBOARD_DATA_CHANGED_EVENT, onLocalChange);
      try {
        if (channel && supabase) supabase.removeChannel(channel);
      } catch (error) {
        // Ignore cleanup errors (e.g. closed message channel).
      }
    };
  }, [loadApplications]);

  // Delegates to the service so the listing's available-slot count moves with
  // the decision: approving consumes a slot, rejecting gives it back.
  const updateApplicationStatus = (id, statuses) => setApplicationStatus(id, statuses);

  const handleApproveEvent = async (application) => {
    try {
      setActionLoading(true);
      await updateApplicationStatus(application.id, ['Approved', 'APPROVED', 'Accepted', 'ACCEPTED']);
      toast.success('Application approved successfully.');
      await loadApplications();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      toast.error(error.message || 'Failed to approve application');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectEvent = async (application) => {
    try {
      setActionLoading(true);
      await updateApplicationStatus(application.id, ['Rejected', 'REJECTED', 'Declined', 'DECLINED']);
      toast.success('Application rejected.');
      await loadApplications();
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      toast.error(error.message || 'Failed to reject application');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) return <div className="admin-page"><ListItemSkeleton rows={3} /></div>;

  const resolveEventTitle = (app) => {
    if (app.type === 'program' || app.programId || app.program_id) {
      return programs.find((program) => program.id === (app.programId || app.program_id))?.title || 'Program application';
    }
    return opportunities.find((opportunity) => opportunity.id === (app.opportunityId || app.opportunity_id))?.title || 'OJT Posting application';
  };

  const resolveApplicant = (app) => {
    const userId = app.userId || app.user_id;
    return users.find((user) => user.id === userId) || null;
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Application Review</h1>
        <p className="page-subtitle">Review OJT applications and program/event registrations. Approval activates the applicant for clock-in.</p>
      </div>

      <div className="filter-notice">
        {eventApplications.length > 0 ? `${eventApplications.length} program/OJT application(s) received.` : 'Applications submitted through Apply Now will appear here immediately.'}
      </div>

      {eventApplications.length > 0 ? (
          <div className="applications-grid">
            {eventApplications.map((application) => {
              const applicant = resolveApplicant(application);
              const statusUpper = String(application.status || '').toUpperCase();
              const isPending = ['PENDING', 'PENDING_APPROVAL', 'APPLIED', 'SUBMITTED', 'UNDER_REVIEW'].includes(statusUpper);
              return (
                <Card key={application.id} className="application-card">
                  <div className="application-header">
                    <div className="applicant-info">
                      <div className="applicant-avatar">{(applicant?.fullName || 'A')?.charAt(0)}</div>
                      <div>
                        <h3 className="applicant-name">{applicant?.fullName || 'Applicant'}</h3>
                        <p className="applicant-email">{applicant?.email || application.userId}</p>
                      </div>
                    </div>
                    <Badge status={application.status}>{application.status}</Badge>
                  </div>
                  <div className="application-details">
                    <div className="detail-row"><span className="detail-label">Listing:</span><span className="detail-value">{resolveEventTitle(application)}</span></div>
                    <div className="detail-row"><span className="detail-label">Type:</span><span className="detail-value">{application.type || (application.programId ? 'program' : 'opportunity')}</span></div>
                    <div className="detail-row"><span className="detail-label">Applied:</span><span className="detail-value">{formatDate(application.appliedAt || application.createdAt)}</span></div>
                    {application.notes && <div className="detail-row"><span className="detail-label">Notes:</span><span className="detail-value">{application.notes}</span></div>}
                  </div>
                  {isPending && (
                    <div className="application-actions">
                      <Button size="sm" variant="success" disabled={actionLoading} onClick={() => handleApproveEvent(application)}>Approve</Button>
                      <Button size="sm" variant="danger" disabled={actionLoading} onClick={() => handleRejectEvent(application)}>Reject</Button>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        ) : (
          <Card><div className="empty-state"><div className="empty-icon"><Icon name="inbox" size={40} color="#9CA3AF" /></div><h3>No program applications yet</h3><p>Applications submitted through Apply Now will appear here immediately.</p></div></Card>
        )}
    </div>
  );
}
