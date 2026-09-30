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
 * render (see StudentLayout's avatar initial).  `firstName` is only a fallback —
 * a row that carries `fullName` but no `firstName` used to greet the user with
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
