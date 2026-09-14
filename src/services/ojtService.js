export function createOJTRecord(data) {
  return {
    id: `ojt-${Date.now()}`,
    ...data,
    verifiedHours: 0,
    pendingHours: 0,
    remainingHours: data.requiredHours,
    progress: 0,
    status: 'Active',
    startDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}

export function updateOJTRecord(record, updates) {
  return {
    ...record,
    ...updates,
    updatedAt: new Date().toISOString()
  };
}

export function markOJTCompleted(record) {
  if (record.verifiedHours < record.requiredHours) {
    throw new Error('Cannot complete OJT. Required verified hours not yet reached.');
  }
  
  return {
    ...record,
    status: 'Completed',
    completionDate: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function getOJTByStudent(ojtRecords, studentId) {
  return ojtRecords.find(record => record.studentId === studentId && record.status !== 'Completed');
}

export function getActiveOJTs(ojtRecords) {
  return ojtRecords.filter(record => record.status === 'Active' || record.status === 'Ready for Completion');
}

export function getCompletedOJTs(ojtRecords) {
  return ojtRecords.filter(record => record.status === 'Completed');
}

export const OJT_STATUSES = [
  'Active',
  'On Hold',
  'Ready for Completion',
  'Completed',
  'Terminated'
];
