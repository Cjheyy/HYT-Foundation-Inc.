export function formatDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

export function formatDateTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

export function formatTime(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

/**
 * "2 hours ago" / "in 5 minutes" style label for a timestamp.
 *
 * Used by the attendance stepper and the attention center, where how long the
 * user has been waiting matters more than the exact clock time.  Returns '' for
 * a missing or unparseable value so callers can fall back to another string.
 */
export function formatRelativeTime(dateString, referenceDate = new Date()) {
  if (!dateString) return '';
  const date = new Date(dateString);
  const reference = referenceDate instanceof Date ? referenceDate : new Date(referenceDate);
  if (Number.isNaN(date.getTime()) || Number.isNaN(reference.getTime())) return '';

  const diffMs = reference.getTime() - date.getTime();
  const isPast = diffMs >= 0;
  const seconds = Math.floor(Math.abs(diffMs) / 1000);
  const plural = (value, unit) => `${value} ${unit}${value === 1 ? '' : 's'}`;

  let label;
  if (seconds < 45) return 'just now';
  else if (seconds < 90) label = plural(1, 'minute');
  else if (seconds < 3600) label = plural(Math.round(seconds / 60), 'minute');
  else if (seconds < 5400) label = plural(1, 'hour');
  else if (seconds < 86400) label = plural(Math.round(seconds / 3600), 'hour');
  else if (seconds < 172800) return isPast ? 'yesterday' : 'tomorrow';
  else if (seconds < 604800) label = plural(Math.round(seconds / 86400), 'day');
  else label = plural(Math.round(seconds / 604800), 'week');

  return isPast ? `${label} ago` : `in ${label}`;
}

export function generateId(prefix = 'id') {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function truncateText(text, maxLength = 100) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

export function getStatusColor(status) {
  const statusColors = {
    // Application statuses
    'Applied': 'blue',
    'Under Review': 'yellow',
    'Interview': 'purple',
    'Accepted': 'green',
    'Ongoing': 'blue',
    'Completed': 'green',
    'Rejected': 'red',
    'Withdrawn': 'gray',
    
    // Requirement statuses
    'Required': 'gray',
    'Submitted': 'blue',
    
    // Attendance statuses - State Machine
    'CLOCKED_IN': 'blue',          // State 1: Active timer
    'PENDING_CLOCK_IN': 'yellow',
    'PENDING_CLOCK_IN_APPROVAL': 'yellow',
    'PENDING_IN': 'yellow',
    'PENDING_CLOCK_OUT': 'yellow',
    'PENDING_OUT': 'yellow',
    'PENDING_REVIEW': 'yellow',
    'PENDING_APPROVAL': 'yellow',
    'PENDING_APPROVE': 'yellow',
    'PENDING': 'yellow',
    'Pending': 'yellow',
    'Clocked In': 'blue',
    'In Progress': 'blue',
    'Pending Approval': 'yellow',
    'APPROVED': 'green',            // State 3A: Admin approved
    'Approved': 'green',
    'REJECTED': 'red',              // State 3B: Admin rejected
    'VOID': 'gray',                 // Voided (no clock-out)
    'Void': 'gray',
    'CANCELLED': 'gray',
    
    // Legacy attendance statuses (for backwards compatibility)
    'IN_PROGRESS': 'blue',
    'Pending Verification': 'yellow',
    'Verified': 'green',
    'Active': 'green',
    'Timed Out': 'blue',
    'Pending Review': 'yellow',
    'Flagged': 'red',
    
    // Report statuses
    'Reviewed': 'green',
    'Returned': 'orange',
    
    // OJT statuses
    'Ready for Completion': 'purple',
    'On Hold': 'orange',
    'Terminated': 'red',
    
    // General
    'Published': 'green',
    'Draft': 'gray',
    'Archived': 'gray',
    'Available': 'green'
  };
  
  const rawStatus = String(status ?? '');
  return statusColors[rawStatus] || statusColors[rawStatus.toUpperCase()] || statusColors[rawStatus.toLowerCase()] || 'gray';
}

export function calculateDaysCompleted(startDate) {
  if (!startDate) return 0;
  const start = new Date(startDate);
  const now = new Date();
  const diffTime = Math.abs(now - start);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays;
}

export function getInitials(name) {
  if (!name) return '';
  const parts = name.split(' ');
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * First name, for greetings and labels.
 *
 * Prefers the first word of `fullName` because that is what the portal layouts
 * render (see StudentLayout's avatar initial).  `firstName` is only a fallback - * a row that carries `fullName` but no `firstName` used to greet the user with
 * "Welcome back, !".
 */
export function getFirstName(user, fallback = 'there') {
  const fullName = String(user?.fullName || user?.full_name || '').trim();
  if (fullName) return fullName.split(/\s+/)[0];
  const firstName = String(user?.firstName || user?.first_name || '').trim();
  return firstName || fallback;
}

export function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

export function validatePhone(phone) {
  const re = /^[+]?[(]?[0-9]{1,4}[)]?[-\s.]?[(]?[0-9]{1,4}[)]?[-\s.]?[0-9]{1,9}$/;
  return re.test(phone);
}

export const HYT_THRUSTS = [
  'Education',
  'Enhancement',
  'Experience',
  'Entrepreneurship',
  'Endurance',
  'Exploration',
  'Empowerment',
  'Enlightenment'
];

export const OPPORTUNITY_CATEGORIES = [
  'Technical Training',
  'Community Outreach',
  'Skill Building',
  'General'
];

export const PROGRAM_CATEGORIES = [
  'Technical Training',
  'Community Outreach',
  'Skill Building',
  'General'
];

export const PROGRAM_SLOT_OPTIONS = [5, 10, 20, 50, 100];

/**
 * Categories an EVENT may carry.
 *
 * Kept separate from PROGRAM_CATEGORIES: a programme is a Dream Academy unit's
 * ongoing service, while an event is a one-off activity.  "Leadership" is
 * included because a live row already uses it.
 */
export const EVENT_CATEGORIES = [
  'Leadership',
  'Community Outreach',
  'Skill Building',
  'Technical Training',
  'General'
];

export const CERTIFICATE_TYPES = [
  'OJT Completion with Hours',
  'Trainee Skills Completion'
];

export const HYT_BRANDING = {
  organization: 'HYT Foundation Inc.',
  tagline: 'Bringing the Next Generation Forward',
  founder: 'Mrs. Hydee Tabao',
  founderTitle: 'Founder & CEO'
};

/**
 * `YYYY-MM-DD` in LOCAL time.
 *
 * `Date.prototype.toISOString()` is UTC, so a Date sitting at local midnight in
 * GMT+8 serialises to 16:00 the *previous* day.  `formatScheduleRange` slices
 * the first 10 characters off its input, so handing it a `toISOString()` value
 * renders every date one day early - silently, and only in positive-offset
 * timezones, which is the worst way for a date bug to behave.
 *
 * Pass the result of this instead.  Returns '' for junk so the caller's
 * existing `--` fallback still applies.
 */
export function toLocalISODate(value) {
  // `new Date(null)` is 1970-01-01, not an invalid date - null coerces to 0 and
  // 0 is a perfectly good epoch timestamp.  So a missing date would have
  // rendered as "Jan 1, 1970" rather than falling back to "--".  Reject the
  // empty-ish values before handing them to the Date constructor.
  if (value === null || value === undefined || value === '') return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/**
 * A `datetime-local` value (`YYYY-MM-DDTHH:mm`, in the ADMIN's local time) as a
 * real instant, ready for a `timestamptz` column.
 *
 * The sibling of `toLocalISODate` and the same GMT+8 trap.  Handing
 * `'2026-10-20T09:00'` straight to Postgres lets POSTGRES pick the zone, and
 * Supabase's session runs in UTC - so 09:00 Manila would be stored as 09:00Z
 * and read back as 17:00.  `new Date()` treats a date-TIME string with no
 * offset as LOCAL (only a date-ONLY string is UTC), so `.toISOString()` yields
 * the correct instant.
 *
 * Returns undefined for junk, so the caller drops the key instead of writing an
 * invalid timestamp.
 */
export function toIsoInstant(value) {
  if (value === null || value === undefined || value === '') return undefined;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

export function formatScheduleRange(startISO, endISO) {
  const formatPart = (iso) => {
    if (!iso) return '';
    const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };
  const formatYear = (iso) => {
    if (!iso) return '';
    const date = new Date(`${String(iso).slice(0, 10)}T00:00:00`);
    if (Number.isNaN(date.getTime())) return '';
    return date.getFullYear();
  };
  const start = formatPart(startISO);
  const end = formatPart(endISO);
  if (start && end) {
    const sameYear =
      String(startISO).slice(0, 4) === String(endISO).slice(0, 4) && formatYear(endISO);
    if (String(startISO).slice(0, 10) === String(endISO).slice(0, 10)) {
      return `${start}, ${formatYear(startISO)}`;
    }
    return sameYear ? `${start} - ${end}, ${formatYear(endISO)}` : `${start}, ${formatYear(startISO)} - ${end}, ${formatYear(endISO)}`;
  }
  return start || end || '';
}

export function parseScheduleRange(schedule) {
  if (!schedule) return { start: '', end: '' };
  const years = String(schedule).match(/\d{4}/g) || [];
  const year = years[years.length - 1] || String(new Date().getFullYear());
  const parts = String(schedule).split('-').map((part) => part.trim());
  if (parts.length < 2) return { start: '', end: '' };
  const toISO = (part) => {
    const cleaned = part.replace(/,\s*\d{4}/, '').trim();
    const date = new Date(`${cleaned} ${year}`);
    if (Number.isNaN(date.getTime())) return '';
    return date.toISOString().slice(0, 10);
  };
  return { start: toISO(parts[0]), end: toISO(parts[1]) };
}

/**
 * `246.0000` -> `246`, `243.5` -> `243.5`, `0` -> `0`.
 *
 * Hours were printed with `toFixed(4)` on the Attendance page, so a 246-hour
 * target rendered as "246.0000 hrs" - four digits of noise that pushed a 28px
 * figure onto two lines inside a narrow card. The stored column is NUMERIC(8,4)
 * but the fourth digit has never meant anything to anyone reading it, so two
 * decimals is the most this prints, and trailing zeros are dropped because
 * "246" is easier to scan than "246.00".
 */
export function formatHours(value) {
  const hours = Number(value);
  if (!Number.isFinite(hours)) return '0';
  return String(Number(hours.toFixed(2)));
}
