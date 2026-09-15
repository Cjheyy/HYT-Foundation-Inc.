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
    studentId: '2022-00123-QC-0',
    fullName: 'Christian Jay Mabbayad',
    firstName: 'Christian Jay',
    lastName: 'Mabbayad',
    course: 'BSIT',
    yearLevel: '4th Year',
    school: 'qcu',
    birthday: '2005-03-15',
    age: 21,
    address: 'Brgy. Commonwealth, Quezon City, Metro Manila',
    contactNumber: '+63 912 345 6789',
    profilePicture: null,
    createdAt: '2024-01-15T08:00:00.000Z'
  };

  const demoStudent2 = {
    id: 'student-002',
    role: 'STUDENT',
    email: 'maria.santos@hyt-demo.com',
    password: 'demo123',
    studentId: '21-2021-456',
    fullName: 'Maria Clara Santos',
    firstName: 'Maria Clara',
    lastName: 'Santos',
    course: 'BSCS',
    yearLevel: '3rd Year',
    school: 'ust',
    birthday: '2006-07-22',
    age: 20,
    address: 'Brgy. Batasan Hills, Quezon City, Metro Manila',
    contactNumber: '+63 917 654 3210',
    profilePicture: null,
    createdAt: '2024-02-10T09:00:00.000Z'
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

  // Dummy Applications
  const applications = [
    {
      id: 'app-001',
      userId: 'student-001',
      programId: 'prog-001',
      type: 'program',
      status: 'Approved',
      appliedAt: '2026-09-01T10:00:00.000Z',
      reviewedAt: '2026-09-05T14:30:00.000Z',
      reviewedBy: 'admin-001',
      notes: 'Excellent application. Student shows great potential.'
    },
    {
      id: 'app-002',
      userId: 'student-001',
      opportunityId: 'opp-005',
      type: 'opportunity',
      status: 'Approved',
      appliedAt: '2026-08-15T09:00:00.000Z',
      reviewedAt: '2026-08-18T11:00:00.000Z',
      reviewedBy: 'admin-001',
      notes: 'Strong technical background. Approved for Technology Unit.'
    },
    {
      id: 'app-003',
      userId: 'student-001',
      opportunityId: 'opp-001',
      type: 'opportunity',
      status: 'Pending',
      appliedAt: '2026-09-10T13:00:00.000Z',
      reviewedAt: null,
      reviewedBy: null,
      notes: null
    },
    {
      id: 'app-004',
      userId: 'student-002',
      opportunityId: 'opp-001',
      type: 'opportunity',
      status: 'Approved',
      appliedAt: '2026-08-10T08:00:00.000Z',
      reviewedAt: '2026-08-12T10:00:00.000Z',
      reviewedBy: 'admin-001',
      notes: 'Strong portfolio in design. Approved for Creative Unit.'
    },
    {
      id: 'app-005',
      userId: 'student-002',
      programId: 'prog-001',
      type: 'program',
      status: 'Approved',
      appliedAt: '2026-08-25T14:00:00.000Z',
      reviewedAt: '2026-08-28T11:00:00.000Z',
      reviewedBy: 'admin-001',
      notes: 'Active participant in community initiatives.'
    }
  ];

  // Dummy OJT Records
  const ojtRecords = [
    {
      id: 'ojt-001',
      studentId: 'student-001',
      opportunityId: 'opp-005',
      status: 'Active',
      startDate: '2026-09-01',
      endDate: '2027-01-15',
      requiredHours: 486,
      completedHours: 184,
      workplace: 'HYT Foundation Office - Technology Unit',
      supervisor: 'Engr. Maria Santos',
      supervisorEmail: 'maria.santos@hyt-foundation.org',
      supervisorPhone: '+63 917 123 4567',
      createdAt: '2026-08-20T10:00:00.000Z',
      updatedAt: '2026-09-14T17:00:00.000Z'
    },
    {
      id: 'ojt-002',
      studentId: 'student-001',
      opportunityId: 'opp-001',
      status: 'Pending',
      startDate: null,
      endDate: null,
      requiredHours: 486,
      completedHours: 0,
      workplace: 'HYT Foundation Office - Creative Unit',
      supervisor: null,
      supervisorEmail: null,
      supervisorPhone: null,
      createdAt: '2026-09-10T13:30:00.000Z',
      updatedAt: '2026-09-10T13:30:00.000Z'
    },
    {
      id: 'ojt-003',
      studentId: 'student-002',
      opportunityId: 'opp-001',
      status: 'Active',
      startDate: '2026-08-20',
      endDate: '2026-12-20',
      requiredHours: 486,
      completedHours: 216,
      workplace: 'HYT Foundation Office - Creative Unit',
      supervisor: 'Ms. Jasmine Reyes',
      supervisorEmail: 'jasmine.reyes@hyt-foundation.org',
      supervisorPhone: '+63 919 876 5432',
      createdAt: '2026-08-15T09:00:00.000Z',
      updatedAt: '2026-09-14T18:00:00.000Z'
    }
  ];

  // Dummy Attendance Records
  const attendance = [
    {
      id: 'att-001',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-02',
      timeIn: '08:15:00',
      timeOut: '17:10:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Completed React component training',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-03T09:00:00.000Z'
    },
    {
      id: 'att-002',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-03',
      timeIn: '08:05:00',
      timeOut: '17:15:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Worked on database schema design',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-04T09:00:00.000Z'
    },
    {
      id: 'att-003',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-04',
      timeIn: '08:20:00',
      timeOut: '17:05:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'API development and testing',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-05T09:00:00.000Z'
    },
    {
      id: 'att-004',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-05',
      timeIn: '08:10:00',
      timeOut: '17:20:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Code review and documentation',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-06T09:00:00.000Z'
    },
    {
      id: 'att-005',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-06',
      timeIn: '08:00:00',
      timeOut: '17:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Team meeting and project planning',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-09T09:00:00.000Z'
    },
    {
      id: 'att-006',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-09',
      timeIn: '08:15:00',
      timeOut: '17:10:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Frontend development - student portal',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-10T09:00:00.000Z'
    },
    {
      id: 'att-007',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-10',
      timeIn: '08:05:00',
      timeOut: '17:15:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Bug fixes and UI improvements',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-11T09:00:00.000Z'
    },
    {
      id: 'att-008',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-11',
      timeIn: '08:10:00',
      timeOut: '17:05:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Database optimization',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-12T09:00:00.000Z'
    },
    {
      id: 'att-009',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-12',
      timeIn: '08:20:00',
      timeOut: '17:10:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Integration testing',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-13T09:00:00.000Z'
    },
    {
      id: 'att-010',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-13',
      timeIn: '08:00:00',
      timeOut: '17:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Sprint review and retrospective',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-14T09:00:00.000Z'
    },
    {
      id: 'att-011',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-14',
      timeIn: '08:15:00',
      timeOut: null,
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Pending',
      hoursWorked: 0,
      notes: null,
      verifiedBy: null,
      verifiedAt: null
    },
    // Student 2 Attendance Records
    {
      id: 'att-012',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-20',
      timeIn: '09:00:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Orientation and onboarding',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-21T09:00:00.000Z'
    },
    {
      id: 'att-013',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-21',
      timeIn: '08:55:00',
      timeOut: '17:50:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Adobe Creative Suite training',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-22T09:00:00.000Z'
    },
    {
      id: 'att-014',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-22',
      timeIn: '09:05:00',
      timeOut: '18:10:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Logo design concepts',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-23T09:00:00.000Z'
    },
    {
      id: 'att-015',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-23',
      timeIn: '08:50:00',
      timeOut: '17:55:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Brand identity development',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-26T09:00:00.000Z'
    },
    {
      id: 'att-016',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-26',
      timeIn: '09:00:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Social media graphics',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-27T09:00:00.000Z'
    },
    {
      id: 'att-017',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-27',
      timeIn: '08:55:00',
      timeOut: '17:50:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Video editing for campaign',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-28T09:00:00.000Z'
    },
    {
      id: 'att-018',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-28',
      timeIn: '09:10:00',
      timeOut: '18:05:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Animation and motion graphics',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-29T09:00:00.000Z'
    },
    {
      id: 'att-019',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-29',
      timeIn: '09:00:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Presentation deck design',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-08-30T09:00:00.000Z'
    },
    {
      id: 'att-020',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-30',
      timeIn: '08:45:00',
      timeOut: '17:50:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Website mockup design',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-02T09:00:00.000Z'
    },
    {
      id: 'att-021',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-02',
      timeIn: '09:05:00',
      timeOut: '18:10:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Photo editing and retouching',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-03T09:00:00.000Z'
    },
    {
      id: 'att-022',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-03',
      timeIn: '09:00:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Branding guidelines document',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-04T09:00:00.000Z'
    },
    {
      id: 'att-023',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-04',
      timeIn: '08:50:00',
      timeOut: '17:55:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Content creation for social media',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-05T09:00:00.000Z'
    },
    {
      id: 'att-024',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-05',
      timeIn: '09:10:00',
      timeOut: '18:05:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Marketing materials design',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-06T09:00:00.000Z'
    },
    {
      id: 'att-025',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-06',
      timeIn: '08:55:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Infographics and data visualization',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-09T09:00:00.000Z'
    },
    {
      id: 'att-026',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-09',
      timeIn: '09:00:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Portfolio building and review',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-10T09:00:00.000Z'
    },
    {
      id: 'att-027',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-10',
      timeIn: '09:05:00',
      timeOut: '18:10:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Client presentation preparation',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-11T09:00:00.000Z'
    },
    {
      id: 'att-028',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-11',
      timeIn: '08:50:00',
      timeOut: '17:50:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Creative brainstorming session',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-12T09:00:00.000Z'
    },
    {
      id: 'att-029',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-12',
      timeIn: '09:00:00',
      timeOut: '18:00:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Design revisions and feedback',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-13T09:00:00.000Z'
    },
    {
      id: 'att-030',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-13',
      timeIn: '09:10:00',
      timeOut: '18:05:00',
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Verified',
      hoursWorked: 8,
      notes: 'Final assets preparation',
      verifiedBy: 'admin-001',
      verifiedAt: '2026-09-14T09:00:00.000Z'
    },
    {
      id: 'att-031',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-14',
      timeIn: '08:55:00',
      timeOut: null,
      location: { lat: 14.6760, lng: 121.0437 },
      status: 'Pending',
      hoursWorked: 0,
      notes: null,
      verifiedBy: null,
      verifiedAt: null
    }
  ];

  // Dummy Daily Reports
  const dailyReports = [
    {
      id: 'dr-001',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-02',
      activities: 'Attended React training session. Learned about component lifecycle, hooks (useState, useEffect), and context API. Created practice components.',
      learnings: 'Understanding of React fundamentals improved significantly. Learned best practices for state management.',
      challenges: 'Initial confusion with useEffect dependencies, but resolved with mentor guidance.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-02T17:30:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-03T09:00:00.000Z',
      feedback: 'Great start! Keep up the learning momentum.'
    },
    {
      id: 'dr-002',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-03',
      activities: 'Worked on designing database schema for the student portal. Created ER diagrams and normalized tables. Presented design to team.',
      learnings: 'Database normalization techniques, relational database design patterns.',
      challenges: 'Balancing normalization with query performance. Learned about denormalization strategies.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-03T17:45:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-04T09:00:00.000Z',
      feedback: 'Excellent database design work!'
    },
    {
      id: 'dr-003',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-04',
      activities: 'Developed REST API endpoints for user authentication and profile management. Implemented JWT token generation and validation.',
      learnings: 'RESTful API design principles, JWT authentication, middleware implementation in Express.js.',
      challenges: 'Token refresh mechanism was tricky, required research on best practices.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-04T17:20:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-05T09:00:00.000Z',
      feedback: 'Solid API implementation. Good security practices.'
    },
    {
      id: 'dr-004',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-05',
      activities: 'Conducted code review for team members. Documented API endpoints using Swagger. Updated README with setup instructions.',
      learnings: 'Code review best practices, API documentation standards, technical writing.',
      challenges: 'Providing constructive feedback diplomatically.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-05T17:40:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-06T09:00:00.000Z',
      feedback: 'Good documentation skills!'
    },
    {
      id: 'dr-005',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-06',
      activities: 'Participated in weekly team meeting. Discussed project timeline and deliverables. Planned tasks for next sprint.',
      learnings: 'Agile methodology, sprint planning, task estimation.',
      challenges: 'Time estimation for unfamiliar tasks.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-06T17:15:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-09T09:00:00.000Z',
      feedback: 'Active participation noted. Good job!'
    },
    {
      id: 'dr-006',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-09',
      activities: 'Frontend development for student portal dashboard. Implemented profile page with edit functionality. Integrated with backend APIs.',
      learnings: 'React Router, form validation, API integration with axios.',
      challenges: 'Managing form state and validation errors.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-09T17:30:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-10T09:00:00.000Z',
      feedback: 'Clean UI implementation!'
    },
    {
      id: 'dr-007',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-10',
      activities: 'Fixed bugs reported in testing. Improved UI responsiveness for mobile devices. Added loading states and error handling.',
      learnings: 'Responsive design, CSS Grid and Flexbox, error boundary implementation.',
      challenges: 'Cross-browser compatibility issues with older browsers.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-10T17:50:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-11T09:00:00.000Z',
      feedback: 'Great attention to detail!'
    },
    {
      id: 'dr-008',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-11',
      activities: 'Database query optimization. Added indexes to frequently queried columns. Reduced API response time by 40%.',
      learnings: 'Database indexing, query execution plans, performance monitoring.',
      challenges: 'Identifying the right columns to index without over-indexing.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-11T17:25:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-12T09:00:00.000Z',
      feedback: 'Impressive performance improvement!'
    },
    {
      id: 'dr-009',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-12',
      activities: 'Integration testing for authentication flow. Wrote unit tests for API endpoints. Achieved 85% code coverage.',
      learnings: 'Jest testing framework, test-driven development, mocking and stubbing.',
      challenges: 'Testing asynchronous operations and database interactions.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-12T17:35:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-13T09:00:00.000Z',
      feedback: 'Excellent testing coverage!'
    },
    {
      id: 'dr-010',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-13',
      activities: 'Sprint review presentation. Demonstrated completed features to stakeholders. Participated in sprint retrospective.',
      learnings: 'Presentation skills, stakeholder communication, agile ceremonies.',
      challenges: 'Explaining technical concepts to non-technical audience.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-13T17:20:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-14T09:00:00.000Z',
      feedback: 'Great presentation skills!'
    },
    {
      id: 'dr-011',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      date: '2026-09-14',
      timeIn: '08:15:00',
      activities: '',
      learnings: '',
      challenges: '',
      hoursWorked: 0,
      status: 'Draft',
      submittedAt: null,
      reviewedBy: null,
      reviewedAt: null,
      feedback: null
    },
    // Student 2 Daily Reports (sample - 10 reports)
    {
      id: 'dr-012',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-20',
      activities: 'Attended orientation session. Met the creative team. Learned about HYT Foundation branding guidelines and ongoing projects.',
      learnings: 'Company culture, brand identity, project workflow.',
      challenges: 'Understanding the scope of different projects.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-20T18:30:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-21T09:00:00.000Z',
      feedback: 'Welcome to the team!'
    },
    {
      id: 'dr-013',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-21',
      activities: 'Completed Adobe Creative Suite training. Learned about Photoshop, Illustrator, and After Effects workflows. Created practice designs.',
      learnings: 'Advanced Photoshop techniques, vector illustration basics, animation principles.',
      challenges: 'Layer management in complex designs.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-21T18:15:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-22T09:00:00.000Z',
      feedback: 'Quick learner! Good progress.'
    },
    {
      id: 'dr-014',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-22',
      activities: 'Worked on logo design concepts for upcoming campaign. Created 3 variations with different styles. Presented to team for feedback.',
      learnings: 'Logo design principles, color theory, concept development.',
      challenges: 'Balancing creativity with brand guidelines.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-22T18:25:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-23T09:00:00.000Z',
      feedback: 'Strong concepts! Love the creativity.'
    },
    {
      id: 'dr-015',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-23',
      activities: 'Developed brand identity package including color palette, typography, and visual elements. Created style guide document.',
      learnings: 'Brand identity systems, style guide creation, consistency in design.',
      challenges: 'Ensuring scalability across different media.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-23T18:10:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-26T09:00:00.000Z',
      feedback: 'Professional quality work!'
    },
    {
      id: 'dr-016',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-26',
      activities: 'Created social media graphics for Facebook, Instagram, and Twitter. Designed carousel posts and story templates.',
      learnings: 'Social media design specifications, engagement-driven design.',
      challenges: 'Adapting designs for different platform dimensions.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-26T18:20:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-27T09:00:00.000Z',
      feedback: 'Eye-catching designs!'
    },
    {
      id: 'dr-017',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-27',
      activities: 'Video editing for marketing campaign. Added transitions, effects, and background music. Created 30-second and 1-minute versions.',
      learnings: 'Video editing in Premiere Pro, pacing and timing, audio mixing.',
      challenges: 'Syncing visuals with audio perfectly.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-27T18:30:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-28T09:00:00.000Z',
      feedback: 'Great storytelling through video!'
    },
    {
      id: 'dr-018',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-28',
      activities: 'Animation and motion graphics using After Effects. Created animated logo intro and transition effects for video content.',
      learnings: 'Keyframe animation, easing curves, motion design principles.',
      challenges: 'Achieving smooth and natural motion.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-28T18:15:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-29T09:00:00.000Z',
      feedback: 'Impressive animation skills!'
    },
    {
      id: 'dr-019',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-29',
      activities: 'Designed presentation deck for stakeholder meeting. Created 15 slides with charts, infographics, and visual hierarchy.',
      learnings: 'Presentation design, data visualization, storytelling.',
      challenges: 'Making complex data easy to understand.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-29T18:25:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-30T09:00:00.000Z',
      feedback: 'Clear and engaging presentation!'
    },
    {
      id: 'dr-020',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-08-30',
      activities: 'Website mockup design in Figma. Created homepage, about page, and contact page. Focused on responsive design.',
      learnings: 'UI/UX design principles, Figma prototyping, responsive layouts.',
      challenges: 'Balancing aesthetics with usability.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-08-30T18:10:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-02T09:00:00.000Z',
      feedback: 'Modern and user-friendly design!'
    },
    {
      id: 'dr-021',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      date: '2026-09-02',
      activities: 'Photo editing and retouching for event documentation. Color correction, background removal, and enhancement.',
      learnings: 'Advanced photo editing, retouching techniques, non-destructive editing.',
      challenges: 'Maintaining natural look while enhancing photos.',
      hoursWorked: 8,
      status: 'Approved',
      submittedAt: '2026-09-02T18:35:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-09-03T09:00:00.000Z',
      feedback: 'Professional photo editing!'
    }
  ];

  // Dummy Requirements
  const requirements = [
    {
      id: 'req-001',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'School Endorsement Letter',
      fileName: 'endorsement_letter.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-20T10:00:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-21T14:00:00.000Z',
      notes: 'Valid endorsement letter received.'
    },
    {
      id: 'req-002',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'Resume/CV',
      fileName: 'Christian_Jay_Resume.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-20T10:05:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-21T14:05:00.000Z',
      notes: 'Well-formatted resume.'
    },
    {
      id: 'req-003',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'Valid School ID',
      fileName: 'school_id_scan.jpg',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-20T10:10:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-21T14:10:00.000Z',
      notes: 'ID verified and valid.'
    },
    {
      id: 'req-004',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'Medical Certificate',
      fileName: 'medical_cert.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-22T09:00:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-23T10:00:00.000Z',
      notes: 'Fit to work.'
    },
    {
      id: 'req-005',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'Parent Consent Form',
      fileName: 'parent_consent.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-22T09:15:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-23T10:15:00.000Z',
      notes: 'Signed by parent/guardian.'
    },
    {
      id: 'req-006',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'Portfolio/GitHub',
      fileName: 'portfolio_link.txt',
      fileUrl: 'https://github.com/cjheyy',
      status: 'Approved',
      submittedAt: '2026-08-22T09:30:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-23T10:30:00.000Z',
      notes: 'Good portfolio with several projects.'
    },
    // Student 2 Requirements
    {
      id: 'req-007',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'School Endorsement Letter',
      fileName: 'UST_endorsement_letter.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-15T10:00:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-16T14:00:00.000Z',
      notes: 'Valid endorsement from UST.'
    },
    {
      id: 'req-008',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'Resume/CV',
      fileName: 'Maria_Santos_Resume.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-15T10:05:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-16T14:05:00.000Z',
      notes: 'Strong design background.'
    },
    {
      id: 'req-009',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'Valid School ID',
      fileName: 'ust_id_scan.jpg',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-15T10:10:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-16T14:10:00.000Z',
      notes: 'ID verified.'
    },
    {
      id: 'req-010',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'Medical Certificate',
      fileName: 'medical_cert_maria.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-16T09:00:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-17T10:00:00.000Z',
      notes: 'Fit to work.'
    },
    {
      id: 'req-011',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'Parent Consent Form',
      fileName: 'parent_consent_maria.pdf',
      fileUrl: null,
      status: 'Approved',
      submittedAt: '2026-08-16T09:15:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-17T10:15:00.000Z',
      notes: 'Properly signed.'
    },
    {
      id: 'req-012',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'Portfolio',
      fileName: 'design_portfolio.pdf',
      fileUrl: 'https://behance.net/mariasantos',
      status: 'Approved',
      submittedAt: '2026-08-16T09:30:00.000Z',
      reviewedBy: 'admin-001',
      reviewedAt: '2026-08-17T10:30:00.000Z',
      notes: 'Impressive design portfolio.'
    }
  ];

  // Dummy Certificates
  const certificates = [
    {
      id: 'cert-001',
      studentId: 'student-001',
      programId: 'prog-001',
      type: 'Program Completion',
      title: 'Certificate of Completion - Youth Leadership Summit',
      issuedDate: '2026-11-20',
      certificateNumber: 'HYT-CERT-2026-001',
      status: 'Issued',
      createdAt: '2026-11-20T10:00:00.000Z'
    },
    {
      id: 'cert-002',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'OJT In Progress',
      title: 'Certificate of OJT Enrollment - Technology Unit',
      issuedDate: '2026-09-01',
      certificateNumber: 'HYT-OJT-2026-005',
      status: 'Issued',
      createdAt: '2026-09-01T10:00:00.000Z'
    },
    {
      id: 'cert-003',
      studentId: 'student-001',
      ojtId: 'ojt-001',
      type: 'OJT Completion',
      title: 'Certificate of OJT Completion - Technology Unit',
      issuedDate: null,
      certificateNumber: null,
      status: 'Pending',
      createdAt: null
    },
    // Student 2 Certificates
    {
      id: 'cert-004',
      studentId: 'student-002',
      programId: 'prog-001',
      type: 'Program Completion',
      title: 'Certificate of Completion - Youth Leadership Summit',
      issuedDate: '2026-11-20',
      certificateNumber: 'HYT-CERT-2026-002',
      status: 'Issued',
      createdAt: '2026-11-20T11:00:00.000Z'
    },
    {
      id: 'cert-005',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'OJT In Progress',
      title: 'Certificate of OJT Enrollment - Creative Unit',
      issuedDate: '2026-08-20',
      certificateNumber: 'HYT-OJT-2026-001',
      status: 'Issued',
      createdAt: '2026-08-20T10:00:00.000Z'
    },
    {
      id: 'cert-006',
      studentId: 'student-002',
      ojtId: 'ojt-003',
      type: 'OJT Completion',
      title: 'Certificate of OJT Completion - Creative Unit',
      issuedDate: null,
      certificateNumber: null,
      status: 'Pending',
      createdAt: null
    }
  ];

  return {
    currentUser: null,
    users: [demoStudent, demoStudent2, demoAdmin],
    programs,
    opportunities,
    applications,
    requirements,
    attendance,
    dailyReports,
    ojtRecords,
    certificates,
    announcements,
    notifications: [],
    settings: {}
  };
}
