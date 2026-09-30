/**
 * Single source of truth for the two HYT account types.
 *
 * Both the registration wizard and any future role picker read from here so the
 * wording of the requirements can never drift between screens.
 */
export const ACCOUNT_TYPES = {
  'ojt-student': {
    key: 'ojt-student',
    title: 'OJT / Intern',
    shortLabel: 'OJT / Intern',
    icon: 'briefcase',
    color: '#279EB6',
    tint: 'rgba(39, 158, 182, 0.12)',
    description: 'For students fulfilling required internship hours',
    requirements: [
      'Must complete required hours',
      'School Endorsement Letter required',
      'Daily attendance logs (Clock-in/Clock-out)',
      'Daily logbook/report submissions',
      'Strict 8:55 AM - 6:05 PM attendance window',
      'Subject to school and HYT Foundation guidelines',
      'Certificate of Completion upon fulfillment'
    ],
    commitment: 'Full commitment to complete internship requirements as mandated by your educational institution.'
  },
  trainee: {
    key: 'trainee',
    title: 'Trainee',
    shortLabel: 'Trainee',
    icon: 'award',
    color: '#D57156',
    tint: 'rgba(213, 113, 86, 0.12)',
    description: 'For community skill development and growth',
    requirements: [
      'Flexible participation schedule',
      'Access to skill development programs',
      'Event and workshop participation',
      'Community engagement opportunities',
      'Mentorship and guidance programs',
      'Portfolio building support',
      'Certificate of Participation available'
    ],
    commitment: 'Active participation in community programs and continuous learning mindset.'
  }
};

export const ACCOUNT_TYPE_LIST = Object.values(ACCOUNT_TYPES);

export const getAccountType = (key) => ACCOUNT_TYPES[key] || null;
