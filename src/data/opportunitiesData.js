// Dummy Opportunities Data for all 6 categories
// Categories: Internship, OJT, Training, Workshop, Youth Program, Community Activity

export const dummyOpportunities = [
  // ========== INTERNSHIP OPPORTUNITIES ==========
  {
    id: 'intern-001',
    title: 'Software Development Internship',
    organization: 'Tech Solutions Inc.',
    description: 'Gain hands-on experience in web and mobile development. Work with modern technologies and experienced mentors.',
    objectives: [
      'Develop web applications using React and Node.js',
      'Learn agile development methodologies',
      'Participate in code reviews and testing',
      'Build a portfolio project'
    ],
    category: 'Internship',
    thrusts: ['Experience', 'Enhancement', 'Entrepreneurship'],
    location: 'Makati City, Metro Manila',
    setup: 'Hybrid',
    schedule: 'Monday to Friday, 9:00 AM - 5:00 PM',
    duration: '3 months',
    requiredHours: 480,
    requirements: [
      'Currently enrolled in IT/CS program',
      'Basic knowledge of programming',
      'Resume and cover letter',
      'School endorsement'
    ],
    availableSlots: 5,
    applicationDeadline: '2026-10-30',
    status: 'Published',
    createdAt: '2026-09-01T00:00:00.000Z',
    image: null
  },
  {
    id: 'intern-002',
    title: 'Digital Marketing Internship',
    organization: 'Creative Media Agency',
    description: 'Learn digital marketing strategies, social media management, and content creation from industry professionals.',
    objectives: [
      'Create social media content and campaigns',
      'Analyze marketing metrics and insights',
      'Assist in email marketing campaigns',
      'Learn SEO and SEM basics'
    ],
    category: 'Internship',
    thrusts: ['Experience', 'Enhancement', 'Entrepreneurship'],
    location: 'Quezon City, Metro Manila',
    setup: 'Hybrid',
    schedule: 'Flexible (20-30 hours/week)',
    duration: '3-6 months',
    requiredHours: 400,
    requirements: [
      'Currently enrolled in Marketing/Communications',
      'Good communication skills',
      'Portfolio (if available)',
      'School endorsement'
    ],
    availableSlots: 3,
    applicationDeadline: '2026-10-25',
    status: 'Published',
    createdAt: '2026-09-02T00:00:00.000Z',
    image: null
  },
  {
    id: 'intern-003',
    title: 'Graphic Design Internship',
    organization: 'Design Studio PH',
    description: 'Work on real client projects and build your design portfolio with professional guidance.',
    objectives: [
      'Create visual designs for various clients',
      'Learn industry-standard design tools',
      'Participate in creative brainstorming',
      'Build professional portfolio'
    ],
    category: 'Internship',
    thrusts: ['Experience', 'Enhancement', 'Entrepreneurship'],
    location: 'Pasig City, Metro Manila',
    setup: 'On-site',
    schedule: 'Monday to Friday, 10:00 AM - 6:00 PM',
    duration: '3 months',
    requiredHours: 480,
    requirements: [
      'Currently enrolled in Design/Multimedia program',
      'Portfolio required',
      'Adobe Creative Suite knowledge',
      'School endorsement'
    ],
    availableSlots: 2,
    applicationDeadline: '2026-10-20',
    status: 'Published',
    createdAt: '2026-09-03T00:00:00.000Z',
    image: null
  },

  // ========== OJT OPPORTUNITIES ==========
  {
    id: 'ojt-001',
    title: 'Creative Unit - Design & Multimedia',
    organization: 'HYT Foundation',
    description: 'Join our Creative Unit and work on visual design, branding, animation, and multimedia projects.',
    objectives: [
      'Logo design and brand identity development',
      'Animation and motion graphics',
      'Social media content creation',
      'Video and photo editing',
      'Website mockup design',
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
    createdAt: '2026-08-01T00:00:00.000Z',
    image: null
  },
  {
    id: 'ojt-002',
    title: 'Human Resources Unit',
    organization: 'HYT Foundation',
    description: 'Be part of our HR team and gain experience in recruitment, employee engagement, and learning & development.',
    objectives: [
      'Assist in recruitment and onboarding',
      'Research HR Management System',
      'Create employee engagement programs',
      'Support learning initiatives',
      'Maintain HR documentation'
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
    createdAt: '2026-08-02T00:00:00.000Z',
    image: null
  },
  {
    id: 'ojt-003',
    title: 'Sales & Marketing Unit',
    organization: 'HYT Foundation',
    description: 'Drive growth and partnerships through lead generation, marketing strategies, and community management.',
    objectives: [
      'Lead generation and prospect identification',
      'Develop marketing plans',
      'Build strategic partnerships',
      'Create pitch decks',
      'Manage social media engagement'
    ],
    category: 'OJT',
    thrusts: ['Experience', 'Enhancement', 'Entrepreneurship'],
    location: 'Quezon City, Metro Manila',
    setup: 'Hybrid',
    schedule: 'Flexible (30-40 hours/week)',
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
    createdAt: '2026-08-03T00:00:00.000Z',
    image: null
  },

  // ========== TRAINING OPPORTUNITIES ==========
  {
    id: 'train-001',
    title: 'Web Development Bootcamp',
    organization: 'HYT Foundation',
    description: 'Comprehensive training program covering HTML, CSS, JavaScript, and modern web frameworks.',
    objectives: [
      'Learn front-end development fundamentals',
      'Build responsive websites',
      'Introduction to React.js',
      'Project-based learning',
      'Certification upon completion'
    ],
    category: 'Training',
    thrusts: ['Education', 'Enhancement', 'Empowerment'],
    location: 'HYT Foundation Training Center',
    setup: 'On-site',
    schedule: 'Monday to Friday, 1:00 PM - 5:00 PM',
    duration: '8 weeks',
    requiredHours: 120,
    requirements: [
      'Basic computer literacy',
      'Own laptop',
      'Commitment to attend all sessions',
      'Application form'
    ],
    availableSlots: 25,
    applicationDeadline: '2026-10-10',
    status: 'Published',
    createdAt: '2026-08-15T00:00:00.000Z',
    image: null
  },
  {
    id: 'train-002',
    title: 'Digital Marketing Mastery',
    organization: 'HYT Foundation',
    description: 'Master digital marketing strategies including social media, SEO, email marketing, and analytics.',
    objectives: [
      'Social media marketing strategies',
      'SEO and content marketing',
      'Email marketing campaigns',
      'Google Analytics basics',
      'Certification upon completion'
    ],
    category: 'Training',
    thrusts: ['Education', 'Enhancement', 'Entrepreneurship'],
    location: 'Online via Zoom',
    setup: 'Remote',
    schedule: 'Saturdays, 9:00 AM - 12:00 PM',
    duration: '6 weeks',
    requiredHours: 60,
    requirements: [
      'Interest in digital marketing',
      'Stable internet connection',
      'Own device (laptop/tablet)',
      'Application form'
    ],
    availableSlots: 30,
    applicationDeadline: '2026-10-05',
    status: 'Published',
    createdAt: '2026-08-16T00:00:00.000Z',
    image: null
  },
  {
    id: 'train-003',
    title: 'Leadership Excellence Program',
    organization: 'HYT Foundation',
    description: 'Develop leadership skills, effective communication, and team management capabilities.',
    objectives: [
      'Leadership principles and practices',
      'Effective communication skills',
      'Team building and management',
      'Conflict resolution',
      'Certificate of completion'
    ],
    category: 'Training',
    thrusts: ['Education', 'Empowerment', 'Enlightenment'],
    location: 'HYT Foundation Conference Hall',
    setup: 'On-site',
    schedule: 'Sundays, 2:00 PM - 6:00 PM',
    duration: '5 weeks',
    requiredHours: 40,
    requirements: [
      'Open to all youth leaders',
      'Commitment to attend all sessions',
      'Pre-training assessment',
      'Application form'
    ],
    availableSlots: 20,
    applicationDeadline: '2026-09-30',
    status: 'Published',
    createdAt: '2026-08-17T00:00:00.000Z',
    image: null
  },
  {
    id: 'train-004',
    title: 'OJT Preparation Workshop (OJT-Specific)',
    organization: 'HYT Foundation',
    description: 'Specialized training for OJT students to prepare for workplace readiness and professional conduct.',
    objectives: [
      'Resume and portfolio building',
      'Interview preparation',
      'Workplace etiquette and professionalism',
      'Time management and reporting',
      'OJT documentation requirements'
    ],
    category: 'Training',
    thrusts: ['Experience', 'Enhancement', 'Empowerment'],
    location: 'HYT Foundation Office',
    setup: 'On-site',
    schedule: 'Saturday, 9:00 AM - 12:00 PM',
    duration: '1 day',
    requiredHours: 3,
    requirements: [
      'OJT Student ID required',
      'School endorsement for OJT',
      'Application form'
    ],
    availableSlots: 15,
    applicationDeadline: '2026-09-25',
    status: 'Published',
    restrictedTo: 'OJT', // Only OJT students can see this
    createdAt: '2026-08-18T00:00:00.000Z',
    image: null
  },

  // ========== WORKSHOP OPPORTUNITIES ==========
  {
    id: 'workshop-001',
    title: 'Entrepreneurship Basics Workshop',
    organization: 'HYT Foundation',
    description: 'One-day intensive workshop on starting and managing your own business venture.',
    objectives: [
      'Business idea validation',
      'Business model canvas',
      'Financial planning basics',
      'Marketing your business',
      'Workshop certificate'
    ],
    category: 'Workshop',
    thrusts: ['Entrepreneurship', 'Education', 'Empowerment'],
    location: 'HYT Foundation Innovation Hub',
    setup: 'On-site',
    schedule: 'Saturday, October 12, 2026, 9:00 AM - 5:00 PM',
    duration: '1 day',
    requiredHours: 8,
    requirements: [
      'Valid ID',
      'Business idea (optional)',
      'Notebook and pen',
      'Registration fee: ₱200'
    ],
    availableSlots: 40,
    applicationDeadline: '2026-10-08',
    status: 'Published',
    createdAt: '2026-08-20T00:00:00.000Z',
    image: null
  },
  {
    id: 'workshop-002',
    title: 'Public Speaking & Presentation Skills',
    organization: 'HYT Foundation',
    description: 'Improve your confidence and delivery skills through practical exercises and feedback.',
    objectives: [
      'Overcome stage fright',
      'Voice modulation and body language',
      'Persuasive speaking techniques',
      'Handling Q&A sessions',
      'Practice presentations'
    ],
    category: 'Workshop',
    thrusts: ['Enhancement', 'Empowerment', 'Education'],
    location: 'HYT Foundation Auditorium',
    setup: 'On-site',
    schedule: 'Sunday, October 20, 2026, 1:00 PM - 6:00 PM',
    duration: '1 day',
    requiredHours: 5,
    requirements: [
      'Open to all',
      'Comfortable clothing',
      'Application form',
      'Registration fee: ₱150'
    ],
    availableSlots: 30,
    applicationDeadline: '2026-10-15',
    status: 'Published',
    createdAt: '2026-08-21T00:00:00.000Z',
    image: null
  },
  {
    id: 'workshop-003',
    title: 'Creative Design Workshop',
    organization: 'HYT Foundation',
    description: 'Learn graphic design fundamentals using industry-standard tools like Canva and Adobe Creative Suite.',
    objectives: [
      'Design principles and color theory',
      'Canva for beginners',
      'Social media graphics',
      'Portfolio building',
      'Workshop certificate'
    ],
    category: 'Workshop',
    thrusts: ['Enhancement', 'Entrepreneurship', 'Experience'],
    location: 'HYT Foundation Training Room',
    setup: 'On-site',
    schedule: 'Saturday, October 26, 2026, 10:00 AM - 4:00 PM',
    duration: '1 day',
    requiredHours: 6,
    requirements: [
      'Own laptop',
      'Canva account (free)',
      'Application form',
      'Registration fee: ₱250'
    ],
    availableSlots: 25,
    applicationDeadline: '2026-10-20',
    status: 'Published',
    createdAt: '2026-08-22T00:00:00.000Z',
    image: null
  },

  // ========== YOUTH PROGRAM OPPORTUNITIES ==========
  {
    id: 'youth-001',
    title: 'Youth Leadership Summit 2026',
    organization: 'HYT Foundation',
    description: 'Three-day intensive program to develop the next generation of youth leaders through workshops, mentorship, and networking.',
    objectives: [
      'Leadership skills development',
      'Community project planning',
      'Networking with youth leaders',
      'Mentorship from industry leaders',
      'Certificate of participation'
    ],
    category: 'Youth Program',
    thrusts: ['Empowerment', 'Education', 'Enlightenment'],
    location: 'HYT Foundation Main Office',
    setup: 'On-site',
    schedule: 'November 15-17, 2026, 8:00 AM - 5:00 PM',
    duration: '3 days',
    requiredHours: 24,
    requirements: [
      'Age 15-25 years old',
      'Valid ID',
      'Motivation letter',
      'Free registration'
    ],
    availableSlots: 50,
    applicationDeadline: '2026-11-05',
    status: 'Published',
    createdAt: '2026-08-25T00:00:00.000Z',
    image: null
  },
  {
    id: 'youth-002',
    title: 'Youth Volunteer Program',
    organization: 'HYT Foundation',
    description: 'Make a difference in your community through volunteer activities including educational support, feeding programs, and environmental initiatives.',
    objectives: [
      'Community service experience',
      'Educational assistance for children',
      'Environmental cleanup drives',
      'Feeding programs',
      'Volunteer certificate'
    ],
    category: 'Youth Program',
    thrusts: ['Empowerment', 'Exploration', 'Experience'],
    location: 'Various Communities in Quezon City',
    setup: 'On-site',
    schedule: 'Every Saturday, 8:00 AM - 12:00 PM',
    duration: 'Ongoing (minimum 4 sessions)',
    requiredHours: 16,
    requirements: [
      'Age 16-30 years old',
      'Valid ID',
      'Application form',
      'Free participation'
    ],
    availableSlots: 100,
    applicationDeadline: '2026-12-31',
    status: 'Published',
    createdAt: '2026-08-26T00:00:00.000Z',
    image: null
  },
  {
    id: 'youth-003',
    title: 'Youth Innovation Challenge',
    organization: 'HYT Foundation',
    description: 'Pitch your innovative ideas to solve community problems. Winners receive funding and mentorship support.',
    objectives: [
      'Innovation and problem-solving',
      'Pitch presentation skills',
      'Business planning',
      'Networking with investors',
      'Potential funding for winners'
    ],
    category: 'Youth Program',
    thrusts: ['Entrepreneurship', 'Innovation', 'Empowerment'],
    location: 'HYT Foundation Innovation Hub',
    setup: 'On-site',
    schedule: 'December 5-6, 2026, 9:00 AM - 5:00 PM',
    duration: '2 days',
    requiredHours: 16,
    requirements: [
      'Age 18-28 years old',
      'Team of 3-5 members',
      'Innovation proposal',
      'Free registration'
    ],
    availableSlots: 15,
    applicationDeadline: '2026-11-20',
    status: 'Published',
    createdAt: '2026-08-27T00:00:00.000Z',
    image: null
  },

  // ========== COMMUNITY ACTIVITY OPPORTUNITIES ==========
  {
    id: 'community-001',
    title: 'Coastal Cleanup Drive',
    organization: 'HYT Foundation',
    description: 'Join us in protecting our environment through a beach cleanup activity. Help keep our coasts clean and raise awareness about plastic pollution.',
    objectives: [
      'Environmental conservation',
      'Community engagement',
      'Waste segregation awareness',
      'Team building',
      'Certificate of participation'
    ],
    category: 'Community Activity',
    thrusts: ['Exploration', 'Empowerment', 'Experience'],
    location: 'Manila Bay Area',
    setup: 'On-site',
    schedule: 'Sunday, October 27, 2026, 6:00 AM - 10:00 AM',
    duration: '1 day',
    requiredHours: 4,
    requirements: [
      'Open to all ages',
      'Wear comfortable clothes',
      'Bring water and sunscreen',
      'Free participation'
    ],
    availableSlots: 80,
    applicationDeadline: '2026-10-22',
    status: 'Published',
    createdAt: '2026-08-28T00:00:00.000Z',
    image: null
  },
  {
    id: 'community-002',
    title: 'Feeding Program for Street Children',
    organization: 'HYT Foundation',
    description: 'Share your blessings by preparing and serving meals to street children in Metro Manila.',
    objectives: [
      'Community service',
      'Compassion and empathy building',
      'Meal preparation and distribution',
      'Interaction with beneficiaries',
      'Certificate of appreciation'
    ],
    category: 'Community Activity',
    thrusts: ['Empowerment', 'Experience', 'Exploration'],
    location: 'Various Locations in Metro Manila',
    setup: 'On-site',
    schedule: 'Every Sunday, 7:00 AM - 11:00 AM',
    duration: 'Ongoing (weekly)',
    requiredHours: 4,
    requirements: [
      'Age 15 and above',
      'Valid ID',
      'Application form',
      'Free participation'
    ],
    availableSlots: 50,
    applicationDeadline: '2026-12-31',
    status: 'Published',
    createdAt: '2026-08-29T00:00:00.000Z',
    image: null
  },
  {
    id: 'community-003',
    title: 'Free Tutorial for Underprivileged Kids',
    organization: 'HYT Foundation',
    description: 'Volunteer as a tutor to help underprivileged children with their school subjects and homework.',
    objectives: [
      'Educational support',
      'Mentorship and guidance',
      'Subject tutoring (Math, Science, English)',
      'Building confidence in children',
      'Volunteer certificate'
    ],
    category: 'Community Activity',
    thrusts: ['Education', 'Empowerment', 'Experience'],
    location: 'Community Learning Centers, Quezon City',
    setup: 'On-site',
    schedule: 'Tuesdays and Thursdays, 4:00 PM - 6:00 PM',
    duration: 'Ongoing (minimum 8 sessions)',
    requiredHours: 16,
    requirements: [
      'Age 16 and above',
      'Good academic standing',
      'Teaching materials (provided)',
      'Free participation'
    ],
    availableSlots: 20,
    applicationDeadline: '2026-11-30',
    status: 'Published',
    createdAt: '2026-08-30T00:00:00.000Z',
    image: null
  },
  {
    id: 'community-004',
    title: 'Tree Planting Activity',
    organization: 'HYT Foundation',
    description: 'Help combat climate change by planting trees in designated areas. Learn about environmental conservation.',
    objectives: [
      'Environmental conservation',
      'Climate change awareness',
      'Hands-on tree planting',
      'Community bonding',
      'Certificate of participation'
    ],
    category: 'Community Activity',
    thrusts: ['Exploration', 'Experience', 'Empowerment'],
    location: 'La Mesa Eco Park, Quezon City',
    setup: 'On-site',
    schedule: 'Saturday, November 9, 2026, 7:00 AM - 11:00 AM',
    duration: '1 day',
    requiredHours: 4,
    requirements: [
      'Open to all ages',
      'Wear outdoor/gardening clothes',
      'Bring water and snacks',
      'Free participation'
    ],
    availableSlots: 100,
    applicationDeadline: '2026-11-05',
    status: 'Published',
    createdAt: '2026-08-31T00:00:00.000Z',
    image: null
  }
];

// Filter function for user-based access
export const filterOpportunitiesByAccountType = (opportunities, accountType) => {
  return opportunities.filter(opp => {
    // Admin sees everything
    if (accountType === 'Admin') {
      return true;
    }

    // OJT Student sees everything
    if (accountType === 'OJT Student') {
      return true;
    }

    // Trainee (Training) sees:
    // - Internship, OJT, Youth Program
    // - All Training EXCEPT OJT-specific training
    if (accountType === 'Training') {
      if (opp.category === 'Internship' || opp.category === 'OJT' || opp.category === 'Youth Program') {
        return true;
      }
      
      // For Training category, exclude OJT-specific ones
      if (opp.category === 'Training') {
        return opp.restrictedTo !== 'OJT';
      }
      
      return false;
    }

    // Default: show nothing if account type is unknown
    return false;
  });
};
