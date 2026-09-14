export function createDailyReport(data) {
  return {
    id: `report-${Date.now()}`,
    ...data,
    status: 'Submitted',
    submittedAt: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}

export function updateReportStatus(report, newStatus, remarks = '') {
  return {
    ...report,
    status: newStatus,
    adminRemarks: remarks,
    reviewedAt: newStatus === 'Reviewed' ? new Date().toISOString() : report.reviewedAt,
    updatedAt: new Date().toISOString()
  };
}

export function approveDailyReport(report, attendance, ojtRecord) {
  // Validate report hours against attendance
  const attendanceHours = attendance?.renderedHours || 0;
  const reportHours = report.hoursRendered;
  
  if (reportHours > attendanceHours) {
    throw new Error('Reported hours exceed verified attendance hours');
  }
  
  // Update OJT record with approved hours
  const updatedVerifiedHours = ojtRecord.verifiedHours + reportHours;
  const updatedRemainingHours = Math.max(0, ojtRecord.requiredHours - updatedVerifiedHours);
  const progress = (updatedVerifiedHours / ojtRecord.requiredHours) * 100;
  
  const updatedOjtRecord = {
    ...ojtRecord,
    verifiedHours: updatedVerifiedHours,
    remainingHours: updatedRemainingHours,
    progress: Math.round(progress * 10) / 10,
    lastActivityDate: new Date().toISOString()
  };
  
  // Check if OJT is ready for completion
  if (updatedVerifiedHours >= ojtRecord.requiredHours && ojtRecord.status !== 'Completed') {
    updatedOjtRecord.status = 'Ready for Completion';
  }
  
  return {
    updatedReport: updateReportStatus(report, 'Reviewed', 'Daily report approved'),
    updatedOjtRecord
  };
}

export function getReportsByStudent(reports, studentId) {
  return reports.filter(report => report.studentId === studentId);
}

export function getPendingReports(reports) {
  return reports.filter(report => report.status === 'Submitted');
}

export const REPORT_STATUSES = [
  'Draft',
  'Submitted',
  'Under Review',
  'Reviewed',
  'Returned'
];
