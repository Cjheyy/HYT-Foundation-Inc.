export function createRequirement(data) {
  return {
    id: `req-${Date.now()}`,
    ...data,
    status: 'Required',
    createdAt: new Date().toISOString()
  };
}

export function submitRequirement(requirement, file) {
  return {
    ...requirement,
    status: 'Submitted',
    file,
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function updateRequirementStatus(requirement, newStatus, remarks = '') {
  return {
    ...requirement,
    status: newStatus,
    adminRemarks: remarks,
    reviewedAt: newStatus === 'Approved' || newStatus === 'Rejected' ? new Date().toISOString() : requirement.reviewedAt,
    updatedAt: new Date().toISOString()
  };
}

export function getRequirementsByStudent(requirements, studentId) {
  return requirements.filter(req => req.studentId === studentId);
}

export function getRequirementsByApplication(requirements, applicationId) {
  return requirements.filter(req => req.applicationId === applicationId);
}

export const REQUIREMENT_STATUSES = [
  'Required',
  'Submitted',
  'Under Review',
  'Approved',
  'Rejected'
];
