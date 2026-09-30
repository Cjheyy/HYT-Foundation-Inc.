/**
 * The 8 HYT Thrusts — single source of truth.
 *
 * Shared by:
 *  - the Home page grid (`icon` + `color` render the circular emblems)
 *  - the About page list (`description` renders the explanation)
 *
 * Keeping one list means the two pages can never drift apart, and the Home
 * tiles can safely deep-link to /about#thrusts because the wording matches.
 */
export const HYT_THRUSTS = [
  {
    name: 'Education',
    icon: '📚',
    color: '#279EB6',
    tagline: 'Knowledge opens the first door',
    description:
      'Providing access to quality education and learning resources to empower youth with knowledge and skills.'
  },
  {
    name: 'Enhancement',
    icon: '⚡',
    color: '#D57156',
    tagline: 'Sharpening what employers look for',
    description:
      'Developing competencies and capabilities through training, workshops, and skill-building programs.'
  },
  {
    name: 'Experience',
    icon: '💼',
    color: '#F3DB6E',
    tagline: 'Learning by doing',
    description:
      'Creating opportunities for practical, hands-on experience through internships, OJT, and real-world projects.'
  },
  {
    name: 'Entrepreneurship',
    icon: '💡',
    color: '#8DD0DE',
    tagline: 'The courage to build',
    description:
      'Fostering entrepreneurial mindset and supporting youth in developing business ideas and ventures.'
  },
  {
    name: 'Endurance',
    icon: '💪',
    color: '#D85A3E',
    tagline: 'Growth takes grit',
    description:
      'Building resilience, perseverance, and the ability to overcome challenges and setbacks.'
  },
  {
    name: 'Exploration',
    icon: '🗺️',
    color: '#279EB6',
    tagline: 'Beyond the comfort zone',
    description:
      'Encouraging curiosity, discovery, and the exploration of new ideas, cultures, and opportunities.'
  },
  {
    name: 'Empowerment',
    icon: '🌟',
    color: '#D57156',
    tagline: 'A voice and a choice',
    description:
      'Giving youth the confidence, resources, and support to take control of their future and make positive changes.'
  },
  {
    name: 'Enlightenment',
    icon: '✨',
    color: '#F3DB6E',
    tagline: 'Seeing the bigger picture',
    description:
      'Promoting awareness, understanding, and wisdom through reflection, learning, and personal growth.'
  }
];
