// Quezon City Schools with their Student ID formats
export const qcSchools = [
  {
    id: 'qcu',
    name: 'Quezon City University',
    idFormat: 'QCU-YYYY-###',
    idPattern: /^QCU-\d{4}-\d{3}$/,
    example: 'QCU-2024-001',
    description: 'Format: QCU-YEAR-NUMBER (e.g., QCU-2024-001)'
  },
  {
    id: 'up',
    name: 'University of the Philippines Diliman',
    idFormat: 'YYYY-#####',
    idPattern: /^\d{4}-\d{5}$/,
    example: '2024-12345',
    description: 'Format: YEAR-STUDENT NUMBER (e.g., 2024-12345)'
  },
  {
    id: 'ateneo',
    name: 'Ateneo de Manila University',
    idFormat: '###-####',
    idPattern: /^\d{3}-\d{4}$/,
    example: '202-4567',
    description: 'Format: BATCH-NUMBER (e.g., 202-4567)'
  },
  {
    id: 'ust',
    name: 'University of Santo Tomas',
    idFormat: 'YYYY######',
    idPattern: /^\d{10}$/,
    example: '2024123456',
    description: 'Format: YEAR + 6-DIGIT NUMBER (e.g., 2024123456)'
  },
  {
    id: 'feu',
    name: 'Far Eastern University',
    idFormat: 'YYYY-#####-QC',
    idPattern: /^\d{4}-\d{5}-QC$/,
    example: '2024-12345-QC',
    description: 'Format: YEAR-NUMBER-QC (e.g., 2024-12345-QC)'
  },
  {
    id: 'pup',
    name: 'Polytechnic University of the Philippines',
    idFormat: 'YYYY-#####-QC',
    idPattern: /^\d{4}-\d{5}-QC$/,
    example: '2024-12345-QC',
    description: 'Format: YEAR-NUMBER-QC (e.g., 2024-12345-QC)'
  },
  {
    id: 'nu',
    name: 'National University',
    idFormat: 'NU-YYYY####',
    idPattern: /^NU-\d{8}$/,
    example: 'NU-20241234',
    description: 'Format: NU-YEAR + 4-DIGIT NUMBER (e.g., NU-20241234)'
  },
  {
    id: 'clsu',
    name: 'Central Luzon State University',
    idFormat: 'CLSU-YYYY-####',
    idPattern: /^CLSU-\d{4}-\d{4}$/,
    example: 'CLSU-2024-1234',
    description: 'Format: CLSU-YEAR-NUMBER (e.g., CLSU-2024-1234)'
  },
  {
    id: 'mapua',
    name: 'Mapúa University',
    idFormat: 'YYYY#####',
    idPattern: /^\d{9}$/,
    example: '202412345',
    description: 'Format: YEAR + 5-DIGIT NUMBER (e.g., 202412345)'
  },
  {
    id: 'adamson',
    name: 'Adamson University',
    idFormat: 'YYYY######',
    idPattern: /^\d{10}$/,
    example: '2024123456',
    description: 'Format: YEAR + 6-DIGIT NUMBER (e.g., 2024123456)'
  },
  {
    id: 'dlsu',
    name: 'De La Salle University',
    idFormat: '###-####',
    idPattern: /^\d{3}-\d{4}$/,
    example: '120-4567',
    description: 'Format: ID NUMBER (e.g., 120-4567)'
  },
  {
    id: 'psba',
    name: 'Philippine School of Business Administration',
    idFormat: 'PSBA-YYYY-####',
    idPattern: /^PSBA-\d{4}-\d{4}$/,
    example: 'PSBA-2024-1234',
    description: 'Format: PSBA-YEAR-NUMBER (e.g., PSBA-2024-1234)'
  },
  {
    id: 'msu',
    name: 'Miriam College',
    idFormat: 'MC-YYYY####',
    idPattern: /^MC-\d{8}$/,
    example: 'MC-20241234',
    description: 'Format: MC-YEAR + NUMBER (e.g., MC-20241234)'
  },
  {
    id: 'slu',
    name: 'St. Luke\'s College of Medicine - QC',
    idFormat: 'SL-YYYY-####',
    idPattern: /^SL-\d{4}-\d{4}$/,
    example: 'SL-2024-1234',
    description: 'Format: SL-YEAR-NUMBER (e.g., SL-2024-1234)'
  },
  {
    id: 'other',
    name: 'Other School',
    idFormat: 'Custom Format',
    idPattern: null,
    example: 'Enter your student ID',
    description: 'Enter your student ID in your school\'s format'
  }
];

export function getSchoolById(id) {
  return qcSchools.find(school => school.id === id);
}

export function validateStudentId(schoolId, studentId) {
  const school = getSchoolById(schoolId);
  if (!school || !school.idPattern) return true; // Allow custom format
  return school.idPattern.test(studentId);
}
