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
    'Approved': 'green',
    
    // Attendance statuses
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
  
  return statusColors[status] || 'gray';
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
  'Internship',
  'OJT',
  'Training',
  'Workshop',
  'Youth Program',
  'Community Activity'
];

export const PROGRAM_CATEGORIES = [
  'Leadership',
  'Skills Development',
  'Community Service',
  'Education',
  'Sports',
  'Arts',
  'Technology'
];
