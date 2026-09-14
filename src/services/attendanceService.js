export function createAttendance(data) {
  return {
    id: `att-${Date.now()}`,
    ...data,
    status: 'Pending Verification',
    createdAt: new Date().toISOString()
  };
}

export function verifyLocation(userLat, userLon, workplaceLat, workplaceLon, radius) {
  if (!userLat || !userLon) return false;
  
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (userLat * Math.PI) / 180;
  const φ2 = (workplaceLat * Math.PI) / 180;
  const Δφ = ((workplaceLat - userLat) * Math.PI) / 180;
  const Δλ = ((workplaceLon - userLon) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = R * c;
  return distance <= radius;
}

export function verifySchedule(timeIn, workSchedule) {
  const now = new Date(timeIn);
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long' });
  
  // Check if today is a work day
  if (!workSchedule.days.includes(dayName)) {
    return {
      valid: false,
      message: 'Not a scheduled work day'
    };
  }
  
  const timeString = now.toTimeString().slice(0, 5); // HH:MM format
  const [hours, minutes] = timeString.split(':').map(Number);
  const currentMinutes = hours * 60 + minutes;
  
  const [startHours, startMinutes] = workSchedule.timeIn.start.split(':').map(Number);
  const [endHours, endMinutes] = workSchedule.timeIn.end.split(':').map(Number);
  
  const startMinutesTotal = startHours * 60 + startMinutes;
  const endMinutesTotal = endHours * 60 + endMinutes;
  
  if (currentMinutes >= startMinutesTotal && currentMinutes <= endMinutesTotal) {
    return {
      valid: true,
      message: 'Within scheduled time'
    };
  }
  
  return {
    valid: false,
    message: 'Outside scheduled time window'
  };
}

export function calculateRenderedHours(timeIn, timeOut) {
  if (!timeIn || !timeOut) return 0;
  
  const start = new Date(timeIn);
  const end = new Date(timeOut);
  const diffMs = end - start;
  const diffHours = diffMs / (1000 * 60 * 60);
  
  return Math.round(diffHours * 100) / 100; // Round to 2 decimal places
}

export function updateAttendanceStatus(attendance, newStatus, note = '') {
  return {
    ...attendance,
    status: newStatus,
    statusNote: note,
    updatedAt: new Date().toISOString()
  };
}

export function getPendingVerifications(attendanceRecords) {
  return attendanceRecords.filter(att => att.status === 'Pending Verification');
}

export function getAttendanceByStudent(attendanceRecords, studentId) {
  return attendanceRecords.filter(att => att.studentId === studentId);
}

export const ATTENDANCE_STATUSES = [
  'Not Started',
  'Pending Verification',
  'Verified',
  'Active',
  'Timed Out',
  'Pending Review',
  'Approved',
  'Rejected',
  'Flagged'
];
