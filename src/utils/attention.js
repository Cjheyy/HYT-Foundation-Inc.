/**
 * Shared "what needs the trainee's attention" logic.
 *
 * Used by two places that must never disagree:
 *   - AttentionCenter (the bell + panel in the portal header)
 *   - the sidebar count badges in StudentLayout / TraineeLayout
 *
 * Pure functions over app state, so they unit test without React.
 */
import { normalizeStatus } from '../services/supabaseService';
import { formatDate, formatRelativeTime } from './helpers';

// Requirements that are waiting on the trainee, not on an admin.
const REQUIREMENT_ACTION_STATUSES = ['REQUIRED', 'REJECTED'];

const PENDING_ATTENDANCE_STATUSES = [
  'PENDING_CLOCK_IN',
  'PENDING_CLOCK_IN_APPROVAL',
  'PENDING_IN',
  'PENDING_CLOCK_OUT',
  'PENDING_OUT',
  'PENDING_APPROVAL',
  'PENDING_REVIEW',
  'PENDING_APPROVE',
  'PENDING'
];

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/** A row belongs to the viewer when it carries no owner, or the same owner. */
const isOwnedBy = (row, userId) => {
  const owner = row?.studentId || row?.student_id || row?.userId || row?.user_id;
  if (!userId || !owner) return true;
  return owner === userId;
};

export const getActionableRequirements = (state, userId) =>
  (state?.requirements || []).filter(
    (req) => isOwnedBy(req, userId) && REQUIREMENT_ACTION_STATUSES.includes(normalizeStatus(req.status))
  );

export const getRejectedDailyReports = (state, userId) =>
  (state?.dailyReports || []).filter(
    (report) => isOwnedBy(report, userId) && normalizeStatus(report.status) === 'REJECTED'
  );

export const getPendingAttendance = (state, userId) =>
  (state?.attendance || []).filter(
    (log) => isOwnedBy(log, userId) && PENDING_ATTENDANCE_STATUSES.includes(normalizeStatus(log.status))
  );

export const getPublishedAnnouncements = (state) =>
  (state?.announcements || []).filter(
    (announcement) => normalizeStatus(announcement.status) === 'PUBLISHED'
  );

export const getUnreadAnnouncements = (state, readIds = new Set()) =>
  getPublishedAnnouncements(state).filter((announcement) => !readIds.has(announcement.id));

/**
 * Counts for the sidebar badges.
 * Returns `{ requirements, announcements }`; a zero means "no badge".
 */
export function resolveNavBadges({ state, userId, readIds = new Set() }) {
  return {
    requirements: getActionableRequirements(state, userId).length,
    announcements: getUnreadAnnouncements(state, readIds).length
  };
}

/** Ordered list of attention items for the header panel. */
export function buildAttentionItems({ state, userId, basePath = '/student', readIds = new Set() }) {
  const items = [];

  const requirements = getActionableRequirements(state, userId);
  if (requirements.length) {
    const names = requirements.map((req) => req.name).filter(Boolean);
    items.push({
      id: 'requirements',
      tone: 'warning',
      icon: 'inbox',
      title: `${pluralize(requirements.length, 'requirement')} need${requirements.length === 1 ? 's' : ''} action`,
      detail: names.slice(0, 3).join(' · ') || 'Upload the missing documents',
      to: `${basePath}/requirements`
    });
  }

  const rejectedReports = getRejectedDailyReports(state, userId);
  if (rejectedReports.length) {
    const latest = rejectedReports[0];
    const reportDate = latest.date || latest.reportDate || latest.report_date || latest.createdAt;
    items.push({
      id: 'daily-reports',
      tone: 'danger',
      icon: 'alert',
      title: rejectedReports.length === 1
        ? `Daily report returned${reportDate ? ` — ${formatDate(reportDate)}` : ''}`
        : `${pluralize(rejectedReports.length, 'daily report')} returned`,
      detail: latest.adminNote || latest.adminRemarks || latest.admin_note || 'Open the report to read the admin note',
      to: `${basePath}/daily-reports`
    });
  }

  const pendingAttendance = getPendingAttendance(state, userId);
  if (pendingAttendance.length) {
    const latest = pendingAttendance[0];
    const submittedAt = latest.createdAt || latest.created_at || latest.submittedAt || latest.timeIn;
    const relative = formatRelativeTime(submittedAt);
    items.push({
      id: 'attendance',
      tone: 'info',
      icon: 'clock',
      title: (latest.timeIn || latest.time_in)
        ? 'Clock-out request waiting for approval'
        : 'Clock-in request waiting for approval',
      detail: relative ? `Submitted ${relative}` : 'Waiting for an administrator to review it',
      to: `${basePath}/attendance`
    });
  }

  const unreadAnnouncements = getUnreadAnnouncements(state, readIds);
  if (unreadAnnouncements.length) {
    items.push({
      id: 'announcements',
      tone: 'info',
      icon: 'bell',
      title: pluralize(unreadAnnouncements.length, 'unread announcement'),
      detail: unreadAnnouncements[0]?.title || 'Open Announcements to read them',
      to: `${basePath}/announcements`
    });
  }

  return items;
}
