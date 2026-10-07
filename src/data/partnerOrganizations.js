/**
 * HYT Foundation Inc. partner organizations.
 *
 * Each entry carries the extracted company profile (name, tagline, about,
 * products, services, industry) so the About page can show a rich detail
 * modal, plus the brand's own logo and accent colour so the tiles read as a
 * logo wall rather than a list of initials.
 *
 * `accent` is MEASURED from the logo artwork (the dominant saturated colour),
 * not hand-picked, and `accentDeep` is that same hue scaled toward black until
 * white text on it clears WCAG AA (4.6:1).  Both are produced by
 * `drafts/process-logos.py`; the measured contrast for every brand is in
 * `outputs/logo-report.json`.  The two logos with no saturated colour to sample
 * (a silver seal and a black-and-white wordmark) use a neutral that matches
 * their artwork instead of an invented hue.
 *
 * Used in two places:
 *  - the "Organization" select when an admin creates an OJT posting
 *    (`src/pages/admin/Opportunities.js`), which uses only `name`
 *  - the "Our Partner Organizations" section on the About page
 *    (`src/pages/public/About.jsx`)
 *
 * Keeping one source means an admin can never hand-type a partner name that
 * does not exist, and the public list stays in step with what can be posted.
 */
import brainsLogo from '../assets/partners/brains.webp';
import connectorLogo from '../assets/partners/connector.webp';
import hytGlobalInstituteLogo from '../assets/partners/hyt-global-institute.webp';
import klassicGroupLogo from '../assets/partners/klassic-group.webp';
import klassicMarketingLogo from '../assets/partners/klassic-marketing.webp';
import klassicSolutionsLogo from '../assets/partners/klassic-solutions.webp';
import levelUpLogo from '../assets/partners/level-up.webp';
import luxuriousCleaningLogo from '../assets/partners/luxurious-cleaning.webp';
import finestFitLogo from '../assets/partners/finest-fit.webp';
import greenOasisLogo from '../assets/partners/green-oasis.webp';
import westwoodDevelopmentLogo from '../assets/partners/westwood-development.webp';
import westwoodLawLogo from '../assets/partners/westwood-law.webp';

export const PARTNER_ORGANIZATIONS = [
  {
    key: 'brains',
    name: 'Brains',
    logo: brainsLogo,
    accent: '#FA05D8',
    accentDeep: '#D204B5',
    tagline: 'Progressive technology for a better world',
    about:
      'Brains Infinite Innovations Inc. is a Filipino technology company providing business solutions, software, infrastructure, cloud services, e-commerce platforms and mobile apps. It also develops green-tech and IoT products for hotels, buildings and homes.',
    products: [
      'Connector ERP system',
      'ASAP! all-services app',
      'Thehco Green Tech fuel device',
      'Millennium interactive touch panel',
      'IoT systems (Frontdesk, Landlord, Butler, Sekyu, Housekeeper)'
    ],
    services: [
      'Software & mobile app development',
      'ERP, cloud & infrastructure solutions',
      'E-commerce platform development',
      'IoT & smart-building systems',
      'Green-tech products'
    ],
    industry: 'Software & IT Services',
    source:
      'Brains Company Profile 2025.pdf; Brains Business Portfolio; Brains Internet of Things Portfolio; KGC Marketing File - 2026_compressed.pdf'
  },
  {
    key: 'connector-system',
    name: 'Connector System',
    logo: connectorLogo,
    accent: '#97104B',
    accentDeep: '#97104B',
    tagline: 'Business management, made modular',
    about:
      'Connector is a modular, web-based ERP and business management system offered by Brains Infinite Innovations Inc. It integrates the core functions of a business into a single unified platform for organisations of any size or nature.',
    products: [
      'Human Resource Management System',
      'Accounting Information System',
      'Customer Relationship Management',
      'Inventory & Purchasing Management System',
      'Project Management System',
      'Point-of-Sale (POS)'
    ],
    services: [
      'ERP implementation',
      'Business process automation',
      'Management information & reporting',
      'Systems integration'
    ],
    industry: 'Software & IT Services (ERP)',
    source: 'Connector.docx.pdf'
  },
  {
    key: 'hyt-global-institute',
    name: 'HYT Global Institute',
    logo: hytGlobalInstituteLogo,
    accent: '#64748B',
    accentDeep: '#64748B',
    tagline: 'Shaping skilled, job-ready professionals',
    about:
      'HYT Global Institute Inc. is the education and training institute within the HYT group. The Klassic Group of Companies profile describes it as established with a clear mission: to shape individuals into skilled, job-ready professionals equipped for both local and international opportunities.',
    products: ['Industry-aligned training programs'],
    services: [
      'Technical & vocational training',
      'Hands-on skills development',
      'Learner support & mentoring'
    ],
    industry: 'Education & Training',
    source:
      'KGC Marketing File - 2026_compressed.pdf (company listing). NOTE: HYT GLOBAL INSTITUTE PROFILE 2025/2026.pdf is the primary source and has not been extracted — the 2025 file is 122 MB.'
  },
  {
    key: 'klassic-group',
    name: 'Klassic Group of Companies',
    logo: klassicGroupLogo,
    accent: '#02164A',
    accentDeep: '#02164A',
    tagline: 'One group, many industries',
    about:
      'The Klassic Group of Companies (KGC) is the parent group behind Klassic Marketing Inc., Klassic Solutions Inc., Level Up International Manpower Services Corp., WestWood Development Corp., WestWood Law Firm, Brains Infinite Innovations Inc., HYT Global Institute Inc. and its own homegrown brands. Its stated mission is to shape individuals into skilled, job-ready professionals equipped for both local and international opportunities.',
    products: [],
    services: [
      'Manpower & workforce solutions',
      'Import & trading / supply chain',
      'Construction & property development',
      'Legal services',
      'Technology, software & engineering',
      'Education & training'
    ],
    industry: 'Holding Group / Conglomerate',
    source: 'KGC Marketing File - 2026_compressed.pdf'
  },
  {
    key: 'klassic-marketing',
    name: 'Klassic Marketing Inc. (KMI)',
    logo: klassicMarketingLogo,
    accent: '#B0CE4B',
    accentDeep: '#6A7C2D',
    tagline: 'Full-service legitimate importing and trading',
    about:
      'Established in 2021, Klassic Marketing Inc. (KMI) is an importing and trading company and market network backed by systems integration and global access. It supplies enterprises across several categories through its PORTRESS supply-chain platform.',
    products: [
      'Medical supplies & equipment',
      'Hotel supplies & equipment',
      'Construction materials & equipment',
      'Chemical supplies',
      'Office stationery & supplies'
    ],
    services: [
      'Importation & trading',
      'Supply chain management (PORTRESS)',
      'Systems integration',
      'Sourcing & distribution'
    ],
    industry: 'Import & Trading / Supply Chain',
    source:
      'Klassic Marketing Inc - Company Profile 2025.pdf; KMI Product Catalogue (Medical, Hotel, Construction, Chemical, Office)'
  },
  {
    key: 'klassic-solutions',
    name: 'Klassic Solutions Inc.',
    logo: klassicSolutionsLogo,
    accent: '#529A24',
    accentDeep: '#45811E',
    tagline: 'Delivering the right people to the right jobs',
    about:
      'Established in 2010, Klassic Solutions Inc. is a full-service, legitimate job contractor and manpower services organisation. It supplies qualified talent to Philippine businesses for non-core activities, with a focus on the marketing and manufacturing sectors.',
    products: ['Job contracting & manpower', 'Marketing services'],
    services: [
      'Manpower sourcing & deployment',
      'Job contracting',
      'Marketing services',
      'Flexible work arrangements'
    ],
    industry: 'Manpower & HR Services',
    source: 'Klassic Solutions Inc.pdf'
  },
  {
    key: 'level-up',
    name: 'Level Up International Manpower Services Corp.',
    logo: levelUpLogo,
    accent: '#0C7749',
    accentDeep: '#0C7749',
    tagline: 'Global solutions, tailored manpower',
    about:
      'Level Up International Manpower Services Corporation specialises in recruiting, training and deploying skilled Filipino workers to international clients. It provides end-to-end recruitment, assessment and deployment across many industries and partner countries.',
    products: ['International manpower placement'],
    services: [
      'Recruitment & selection',
      'Training & development',
      'Workforce consulting & outsourcing',
      'Talent management',
      'End-to-end client support'
    ],
    industry: 'International Manpower Services',
    source: 'LEVEL UP COMPANY PROFILE 2026 (2).pdf'
  },
  {
    key: 'luxurious-cleaning',
    name: 'Luxurious Cleaning Co.',
    logo: luxuriousCleaningLogo,
    accent: '#F1BB27',
    accentDeep: '#917017',
    tagline: 'Professional cleaning services',
    about:
      'Luxurious Cleaning Co. is one of the homegrown brands of the Klassic Group of Companies, providing professional cleaning services.',
    products: [],
    services: ['Professional cleaning services'],
    industry: 'Cleaning Services',
    source:
      'KGC Marketing File - 2026_compressed.pdf (KGC home brand). No dedicated profile PDF exists in the partner drive folder yet.'
  },
  {
    key: 'finest-fit',
    name: 'The Finest Fit',
    logo: finestFitLogo,
    accent: '#262626',
    accentDeep: '#262626',
    tagline: 'Uniforms and apparel',
    about:
      'The Finest Fit is one of the homegrown brands of the Klassic Group of Companies, producing uniforms and apparel.',
    products: ['Uniforms & apparel'],
    services: [],
    industry: 'Apparel & Uniform Manufacturing',
    source:
      'KGC Marketing File - 2026_compressed.pdf (KGC home brand). No dedicated profile PDF exists in the partner drive folder yet.'
  },
  {
    key: 'green-oasis',
    name: 'The Green Oasis',
    logo: greenOasisLogo,
    accent: '#368A05',
    accentDeep: '#348405',
    tagline: 'Landscape and design specialists',
    about:
      'The Green Oasis was introduced in early 2017 by Klassic Marketing Inc. as a full-service landscaping company serving residential and commercial clients. It designs, installs and maintains outdoor spaces, gardens and irrigation systems.',
    products: [
      'Landscape design & consultancy',
      'Plants, flowers & garden supplies',
      'Irrigation systems'
    ],
    services: [
      'Landscaping & installation',
      'Lawn & garden maintenance',
      'Pest control',
      'Irrigation installation & maintenance'
    ],
    industry: 'Landscaping & Design',
    source: 'The Green Oasis Company Profile (Revised).pdf; TGO Product Catalogue (1)_compressed.pdf'
  },
  {
    key: 'wdc',
    name: 'WestWood Development Corp.',
    logo: westwoodDevelopmentLogo,
    accent: '#B78916',
    accentDeep: '#926E12',
    tagline: 'General contractors and builders',
    about:
      'Formed in 2018, Westwood Development Corporation (WDC) is a general contractor and builder serving residential, commercial, industrial and institutional projects. It also promotes green technology and supplies construction and auxiliary products.',
    products: [
      'Cement, steel, tiles & CHB',
      'Electrical wires',
      'CCTV units & equipment',
      'Air-conditioning units',
      'Fire detection & alarm systems'
    ],
    services: [
      'Civil & general commercial works',
      'Architectural works',
      'Project management',
      'Finishing & custom fit-out works',
      'Trucking & hauling'
    ],
    industry: 'Construction & Real Estate',
    source: 'WDC Company Profile.pdf'
  },
  {
    key: 'wlf',
    name: 'WestWood Law Firm',
    logo: westwoodLawLogo,
    accent: '#042C73',
    accentDeep: '#042C73',
    tagline: 'Trusted counsel since 1998',
    about:
      'Westwood Law Firm was established in August 1998 and is managed by Atty. Ernesto "Boyet" Tabao. It serves corporate and individual clients through a nationwide network of lawyers and diverse practice areas.',
    products: [
      'Corporate & commercial law',
      'Labor & industrial relations',
      'Litigation & asset recovery'
    ],
    services: [
      'Labor & industrial relations',
      'Banking law & asset recovery',
      'Corporate & commercial law',
      'Civil, criminal & administrative cases',
      'Immigration, mining, energy & taxation'
    ],
    industry: 'Legal Services',
    source: 'WLF Company Profile (Revised 2).pdf'
  }
];

/**
 * Expands a brand accent into the CSS custom properties the tiles and the
 * dialog consume.  Alpha variants are pre-mixed into 8-digit hex rather than
 * using color-mix(), so the styling does not depend on a recent CSS feature.
 *
 * Returns an empty object when there is no accent, so a partner object that
 * omits the field (a test fixture, say) degrades to the inherited brand colours
 * instead of emitting a literal "undefined29".
 */
export const partnerAccentVars = (accent, accentDeep) => {
  if (!accent) return {};
  return {
    '--accent': accent,
    '--accent-deep': accentDeep || accent,
    '--accent-soft': `${accent}29`, // 16% — tile glow
    '--accent-mid': `${accent}4D`,  // 30% — hover ring
    '--accent-ring': `${accent}66`  // 40% — focus ring
  };
};

/**
 * Short label used only as the fallback when a logo image fails to load, so a
 * broken file degrades to initials instead of an empty tile.
 *
 * Takes a plain NAME STRING (callers pass `partner.name`).
 */
export const partnerMonogram = (name) => {
  const ignored = new Set(['inc', 'inc.', 'corp', 'corp.', 'co', 'co.', 'the', 'and']);
  const words = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word && !ignored.has(word.toLowerCase()));
  if (words.length === 0) return 'HY';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};
