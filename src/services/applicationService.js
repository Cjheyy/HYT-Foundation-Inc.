import { getApplicationOwnerId } from '../utils/experience';

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

/**
 * Rows loaded from Supabase are camelCased straight from the `applications`
 * table, which has `user_id` — there is no `student_id` column.  Matching on
 * `app.studentId` therefore compared `undefined` against a real id and returned
 * an empty list for every user, which silently blanked both the dashboard
 * "Active Application" card and the whole My Applications page.
 * `getApplicationOwnerId` resolves whichever owner field the row carries.
 */
export function getApplicationsByStudent(applications, studentId) {
  if (!studentId) return [];
  const rows = Array.isArray(applications) ? applications : [];
  return rows.filter((app) => getApplicationOwnerId(app) === studentId);
}

export function getApplicationsByStatus(applications, status) {
  return applications.filter(app => app.status === status);
}

export function canApply(opportunity, currentUser, applications) {
  if (!currentUser) return false;

  // Check if student already has an application for this opportunity
  const existingApplication = (applications || []).find(
    app => getApplicationOwnerId(app) === currentUser.id && app.opportunityId === opportunity.id
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
