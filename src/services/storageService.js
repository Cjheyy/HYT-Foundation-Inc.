const STORAGE_KEY = 'hyt_foundation_data';

export function saveToLocalStorage(data) {
  try {
    const dataToSave = {
      currentUser: data.currentUser,
      users: data.users,
      programs: data.programs,
      opportunities: data.opportunities,
      applications: data.applications,
      requirements: data.requirements,
      attendance: data.attendance,
      dailyReports: data.dailyReports,
      ojtRecords: data.ojtRecords,
      certificates: data.certificates,
      announcements: data.announcements,
      notifications: data.notifications,
      settings: data.settings || {}
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  } catch (error) {
    console.error('Error saving to localStorage:', error);
  }
}

export function loadFromLocalStorage() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error loading from localStorage:', error);
    return null;
  }
}

export function clearLocalStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error('Error clearing localStorage:', error);
  }
}

export function initializeData() {
  const demoStudent = {
    id: 'student-001',
    role: 'STUDENT',
    email: 'christian.jay@hyt-demo.com',
    password: 'demo123',
    studentId: 'QCU-2026-001',
    fullName: 'Christian Jay',
    firstName: 'Christian',
    lastName: 'Jay',
    course: 'BSIT',
    yearLevel: '4th Year',
    school: 'Quezon City University',
    contactNumber: '+63 912 345 6789',
    address: 'Quezon City, Metro Manila',
    profilePicture: null,
    createdAt: new Date().toISOString()
  };

  const demoAdmin = {
    id: 'admin-001',
    role: 'ADMIN',
    email: 'admin@hyt-foundation.org',
    password: 'admin123',
    fullName: 'HYT Administrator',
    firstName: 'HYT',
    lastName: 'Administrator',
    createdAt: new Date().toISOString()
  };

  const opportunities = [
    {
      id: 'opp-001',
      title: 'Creative Unit - Design & Multimedia',
      organization: 'HYT Foundation',
      description: 'Join our Creative Unit and work on visual design, branding, animation, and multimedia projects. Help create compelling content that communicates HYT\'s mission.',
      objectives: [
        'Logo design and brand identity development',
        'Animation and motion graphics',
        'Social media content creation',
        'Video and photo editing',
        'Website and mobile app mockup design',
        'Pitch deck design and presentation materials',
        'Portfolio building'
      ],
      category: 'OJT',
      thrusts: ['Experience', 'Enhancement', 'Entrepreneurship'],
      location: 'Quezon City, Metro Manila',
      setup: 'Hybrid',
      schedule: 'Flexible (20-40 hours/week)',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Portfolio (if available)',
        'Application Form'
      ],
      availableSlots: 5,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-01T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-002',
      title: 'Human Resources Unit',
      organization: 'HYT Foundation',
      description: 'Be part of our HR team and gain experience in recruitment, HR management systems, employee engagement, and learning & development programs.',
      objectives: [
        'Assist in recruitment and onboarding processes',
        'Research and develop HR Management System (HRMS)',
        'Create employee engagement programs',
        'Support learning and development initiatives',
        'Maintain HR documentation and records'
      ],
      category: 'OJT',
      thrusts: ['Experience', 'Enhancement', 'Empowerment'],
      location: 'Quezon City, Metro Manila',
      setup: 'On-site',
      schedule: 'Monday to Friday, 8:00 AM - 5:00 PM',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Resume',
        'Application Form'
      ],
      availableSlots: 3,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-02T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-003',
      title: 'Sales & Marketing Unit',
      organization: 'HYT Foundation',
      description: 'Drive growth and partnerships through lead generation, marketing strategies, community management, and pitch deck development.',
      objectives: [
        'Lead generation and prospect identification',
        'Develop and execute marketing plans',
        'Build strategic partnerships',
        'Create compelling pitch decks',
        'Manage social media and community engagement'
      ],
      category: 'OJT',
      thrusts: ['Entrepreneurship', 'Experience', 'Enhancement'],
      location: 'Quezon City, Metro Manila',
      setup: 'Hybrid',
      schedule: 'Flexible (20-40 hours/week)',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Resume',
        'Application Form'
      ],
      availableSlots: 4,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-03T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-004',
      title: 'Engineering Unit',
      organization: 'HYT Foundation',
      description: 'Apply engineering principles to real-world projects including time and motion studies, cost-benefit analysis, production planning, and IIOT research.',
      objectives: [
        'Conduct time and motion studies',
        'Facilitate cost-benefit analysis',
        'Production planning and inventory control',
        'Research and develop Industrial Internet of Things (IIOT) solutions'
      ],
      category: 'OJT',
      thrusts: ['Experience', 'Enhancement', 'Exploration'],
      location: 'Quezon City, Metro Manila',
      setup: 'On-site',
      schedule: 'Monday to Friday, 8:00 AM - 5:00 PM',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Resume',
        'Application Form'
      ],
      availableSlots: 3,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-04T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-005',
      title: 'Technology Unit - Software Development',
      organization: 'HYT Foundation',
      description: 'Work on cutting-edge technology projects including front-end and back-end development, website and mobile app design, programming, and systems development.',
      objectives: [
        'Front-end development (React, Vue, Angular)',
        'Back-end development (Node.js, Python, PHP)',
        'Website and mobile app UI/UX design',
        'Programming and software architecture',
        'Research and development',
        'Assist in systems and software development projects'
      ],
      category: 'OJT',
      thrusts: ['Experience', 'Enhancement', 'Exploration'],
      location: 'Quezon City, Metro Manila',
      setup: 'Hybrid',
      schedule: 'Flexible (20-40 hours/week)',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Portfolio or GitHub profile',
        'Resume',
        'Application Form'
      ],
      availableSlots: 6,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-05T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-006',
      title: 'Accounting Unit',
      organization: 'HYT Foundation',
      description: 'Gain practical accounting experience including financial record keeping, accounting information systems research, and administrative support.',
      objectives: [
        'Research and develop Accounting Information System',
        'Financial record keeping and bookkeeping',
        'Administrative tasks and documentation',
        'Research and development of Knowledge Generation Center (KGC)'
      ],
      category: 'OJT',
      thrusts: ['Experience', 'Enhancement', 'Education'],
      location: 'Quezon City, Metro Manila',
      setup: 'On-site',
      schedule: 'Monday to Friday, 8:00 AM - 5:00 PM',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Resume',
        'Application Form'
      ],
      availableSlots: 2,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-06T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-007',
      title: 'Legal & Justice Unit',
      organization: 'HYT Foundation',
      description: 'Gain legal experience through research, document drafting, contract review, and administrative legal support.',
      objectives: [
        'Conduct legal research',
        'Draft legal documents and pleadings',
        'Setting up memorandums and agreements',
        'Transcription of minutes of meetings',
        'Review of contracts and legal documents'
      ],
      category: 'OJT',
      thrusts: ['Experience', 'Enhancement', 'Enlightenment'],
      location: 'Quezon City, Metro Manila',
      setup: 'On-site',
      schedule: 'Monday to Friday, 8:00 AM - 5:00 PM',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Resume',
        'Application Form'
      ],
      availableSlots: 2,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-07T00:00:00.000Z',
      image: null
    },
    {
      id: 'opp-008',
      title: 'Learning & Development Unit',
      organization: 'HYT Foundation',
      description: 'Shape the future of organizational learning through strategic planning, organizational development, partnership building, and people management.',
      objectives: [
        'Lead generation for training programs',
        'Strategic planning and development',
        'Organizational development initiatives',
        'Build strategic partnership plans',
        'Research and development',
        'Handle people management and mentoring',
        'Managerial delegations and leadership support'
      ],
      category: 'OJT',
      thrusts: ['Empowerment', 'Education', 'Enhancement'],
      location: 'Quezon City, Metro Manila',
      setup: 'Hybrid',
      schedule: 'Flexible (20-40 hours/week)',
      requiredHours: 486,
      requirements: [
        'Valid School ID',
        'School Endorsement Letter',
        'Resume',
        'Application Form'
      ],
      availableSlots: 4,
      applicationDeadline: '2026-10-15',
      status: 'Published',
      workplace: {
        name: 'HYT Foundation Office',
        address: 'Quezon City, Metro Manila',
        latitude: 14.6760,
        longitude: 121.0437,
        radius: 100
      },
      workSchedule: {
        days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'],
        timeIn: { start: '08:00', end: '09:00' },
        timeOut: { start: '17:00', end: '18:00' },
        expectedHoursPerDay: 8
      },
      createdAt: '2026-08-08T00:00:00.000Z',
      image: null
    }
  ];

  const programs = [
    {
      id: 'prog-001',
      title: 'Youth Leadership Summit',
      description: 'A comprehensive leadership development program for young aspiring leaders.',
      objectives: [
        'Develop leadership competencies',
        'Build networks with fellow youth leaders',
        'Create actionable community projects'
      ],
      category: 'Leadership',
      thrusts: ['Empowerment', 'Enlightenment'],
      schedule: 'November 15-17, 2026',
      location: 'HYT Foundation Center',
      setup: 'On-site',
      requirements: ['Valid ID', 'Registration Form'],
      availableSlots: 50,
      applicationDeadline: '2026-11-01',
      status: 'Published',
      createdAt: '2026-08-20T00:00:00.000Z',
      image: null
    }
  ];

  const announcements = [
    {
      id: 'ann-001',
      title: 'Welcome to HYT Foundation Platform',
      content: 'We are excited to have you join the HYT Foundation community. Explore opportunities, apply to programs, and start your development journey today!',
      category: 'General',
      priority: 'High',
      status: 'Published',
      publishedAt: new Date().toISOString(),
      createdBy: 'admin-001',
      createdAt: new Date().toISOString()
    },
    {
      id: 'ann-002',
      title: 'New IT Internship Opportunities Available',
      content: 'We have new IT internship positions available with partner companies. Check the Opportunities page and apply now!',
      category: 'Opportunities',
      priority: 'Medium',
      status: 'Published',
      publishedAt: new Date().toISOString(),
      createdBy: 'admin-001',
      createdAt: new Date().toISOString()
    }
  ];

  return {
    currentUser: null,
    users: [demoStudent, demoAdmin],
    programs,
    opportunities,
    applications: [],
    requirements: [],
    attendance: [],
    dailyReports: [],
    ojtRecords: [],
    certificates: [],
    announcements,
    notifications: [],
    settings: {}
  };
}
