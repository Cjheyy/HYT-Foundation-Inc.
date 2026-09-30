/**
 * Dream Academy — content for the Home page section.
 *
 * Kept as data rather than inline JSX so the copy lives in one place, the way
 * `hytThrusts.js` and `galleryData.js` already work.
 *
 * The accent set is deliberately NOT the vivid brand palette. Every value here
 * is a deepened sibling, because a white label has to sit on it: the vivid stops
 * fail badly (#F3DB6E is 1.38:1 against white, #279EB6 only 3.16:1). Each accent
 * below was measured against white and clears 4.5:1.
 */
export const DA_ACCENTS = {
  orange: '#B8441F', // deepened --primary-orange  5.41:1 on white
  teal: '#16697A', //   deepened --teal            6.30:1 on white
  olive: '#8A6E12', //  deepened --yellow          4.86:1 on white
  brick: '#9C3412', //  deepened --strong-orange   7.21:1 on white
};

export const DA_ABOUT =
  'Dream Academy is a platform developed through the partnership of Helping Youth Transcend Foundation and the Klassic Solutions Inc. to assist young people in developing their abilities, talents, and gaining experience in preparation for their future careers.';

export const DA_PROGRAM = {
  program: {
    title: 'Training Program',
    body: 'The Dream Academy Training Program consists of working as a trainee mainly under the Klassic Group of Companies and trusted partners and sponsors. It is a multi-industry company that helps young people to be flexible, adapt, grow and learn successfully.',
  },
  objectives: {
    title: 'Training Objectives',
    body: 'The Dream Academy is dedicated to assisting the younger generation in thriving, developing, and transforming into their best selves. Since the organization is diversified, with numerous enterprises in different industries, the youth will develop into well-rounded individuals. HYT Foundation Inc. desires young people to transcend and preserve this generation while pursuing their aspirations.',
  },
};

export const DA_GOALS =
  'Our goal is to inspire youths to lead, manage, and educate others as entrepreneurs. Also, bring forth their abilities to explore and applaud it by sharing it with others. To realize its goal of serving the world\u2019s youth and fostering their ambition to lead the next generation, this is to make the world a better place for communities by contributing to our young people and general society in any such, virtuous, and high-quality manner.';

/**
 * The eight units.
 *
 * Accents are cycled so that no two cards sharing an edge look alike — neither
 * the side-by-side pair nor the one above/below it in the two-column grid. The
 * sequence is not a simple rotation for exactly that reason.
 */
export const DA_UNITS = [
  {
    name: 'Creative Unit',
    accent: DA_ACCENTS.orange,
    duties: [
      'Logo',
      'Animation',
      'Brand sheet',
      'Social media posts',
      'Portfolio',
      'Pitch deck design',
      'Video editing',
      'Photo editing',
      'Mock-up for websites and mobile applications',
    ],
  },
  {
    name: 'Human Resources Unit',
    accent: DA_ACCENTS.teal,
    duties: [
      'Recruitment',
      'Research & development of HR management system (HRMS)',
      'Create employee engagement programs',
      'Assist in learning and development unit',
    ],
  },
  {
    name: 'Sales & Marketing Unit',
    accent: DA_ACCENTS.olive,
    duties: [
      'Lead Generation',
      'Marketing Plan',
      'Partnership',
      'Pitch deck',
      'Community management',
    ],
  },
  {
    name: 'Engineering Unit',
    accent: DA_ACCENTS.brick,
    duties: [
      'Time and Motion Study',
      'Facilitate Cost Benefit Analysis',
      'Production Planning and Inventory Control',
      'Research and Develop IIOT',
    ],
  },
  {
    name: 'Technology Unit',
    accent: DA_ACCENTS.teal,
    duties: [
      'Front-end and Back-end Development',
      'Website and Mobile App Design',
      'Programming',
      'Research and Development',
      'Assist in Systems and Software development',
    ],
  },
  {
    name: 'Accounting Unit',
    accent: DA_ACCENTS.olive,
    duties: [
      'Research and Develop Accounting Information System',
      'Administrative',
      'Research and Development of KGC',
    ],
  },
  {
    name: 'Legal & Justice Unit',
    accent: DA_ACCENTS.orange,
    duties: [
      'Legal Research',
      'Draft Legal Documents and Pleadings',
      'Setting up of Memorandum',
      'Transcription of Minutes of the Meetings',
      'Review of Contracts',
    ],
  },
  {
    name: 'Learning & Development Unit',
    accent: DA_ACCENTS.teal,
    duties: [
      'Lead Generation',
      'Strategic Plan',
      'Organizational Development',
      'Build Strategic Partnership Plan',
      'Research and Development',
      'Handle people',
      'Managerial delegations',
    ],
  },
];

/** Short factual facts for the header strip. All three are drawn from the copy above. */
export const DA_FACTS = ['Multi-industry training', 'Eight units', 'Klassic Group of Companies'];
