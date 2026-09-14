export function createApplication(applicationData) {
  return {
    id: `app-${Date.now()}`,
    ...applicationData,
    status: 'Applied',
    appliedAt: new Date().toISOString(),
    timeline: [
      {
        status: 'Applied',
        date: new Date().toISOString(),
        note: 'Application submitted'
      }
    ]
  };
}

export function updateApplicationStatus(application, newStatus, note = '') {
  const updatedTimeline = [
    ...application.timeline,
    {
      status: newStatus,
      date: new Date().toISOString(),
      note
    }
  ];

  return {
    ...application,
    status: newStatus,
    timeline: updatedTimeline,
    updatedAt: new Date().toISOString()
  };
}

export function getApplicationsByStudent(applications, studentId) {
  return applications.filter(app => app.studentId === studentId);
}

export function getApplicationsByStatus(applications, status) {
  return applications.filter(app => app.status === status);
}

export function canApply(opportunity, currentUser, applications) {
  if (!currentUser) return false;
  
  // Check if student already has an application for this opportunity
  const existingApplication = applications.find(
    app => app.studentId === currentUser.id && app.opportunityId === opportunity.id
  );
  
  return !existingApplication;
}

export const APPLICATION_STATUSES = [
  'Applied',
  'Under Review',
  'Interview',
  'Accepted',
  'Ongoing',
  'Completed',
  'Rejected',
  'Withdrawn'
];
