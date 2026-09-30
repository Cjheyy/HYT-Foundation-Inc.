import { getRoleTerms, isTraineeRole } from './roleTerms';

describe('getRoleTerms', () => {
  test('an OJT / Intern sees OJT wording', () => {
    const terms = getRoleTerms('OJT/Intern');
    expect(terms.isTrainee).toBe(false);
    expect(terms.roleLabel).toBe('OJT / Intern');
    expect(terms.portalName).toBe('OJT Portal');
    expect(terms.hoursTitle).toBe('OJT Hours Progress');
  });

  test('a Trainee stops seeing OJT wording', () => {
    // Seven of eight /trainee/* routes render a student component, so this is
    // what kept "OJT Hours Progress" on a trainee's screen.
    const terms = getRoleTerms('Trainee');
    expect(terms.isTrainee).toBe(true);
    expect(terms.roleLabel).toBe('Trainee');
    expect(terms.hoursTitle).toBe('Training Hours Progress');
    expect(terms.journeyEmptyMessage).not.toMatch(/OJT/);
    expect(terms.attendanceSubtitle).not.toMatch(/OJT/);
    expect(terms.attendanceLockedCopy).not.toMatch(/OJT/);
    expect(terms.completionNotice).not.toMatch(/OJT/);
  });

  test('normalises casing, spacing and separators', () => {
    expect(getRoleTerms('  trainee ').isTrainee).toBe(true);
    expect(getRoleTerms('TRAINEE').isTrainee).toBe(true);
    expect(getRoleTerms('ojt/intern').isTrainee).toBe(false);
    expect(getRoleTerms('OJT-Intern').isTrainee).toBe(false);
  });

  test("treats 'STUDENT' as the non-OJT audience, matching TRAINEE_ROLES", () => {
    expect(isTraineeRole('Student')).toBe(true);
    expect(getRoleTerms('student').roleLabel).toBe('Trainee');
  });

  test('falls back to OJT wording when the role is missing', () => {
    expect(getRoleTerms(undefined).key).toBe('OJT/INTERN');
    expect(getRoleTerms(null).key).toBe('OJT/INTERN');
    expect(getRoleTerms('ADMIN').key).toBe('OJT/INTERN');
  });

  test('every term is a non-empty string', () => {
    ['OJT/Intern', 'Trainee'].forEach((role) => {
      const { isTrainee, ...strings } = getRoleTerms(role);
      expect(typeof isTrainee).toBe('boolean');
      const values = Object.values(strings);
      expect(values.length).toBeGreaterThan(0);
      values.forEach((value) => {
        expect(typeof value).toBe('string');
        expect(value.length).toBeGreaterThan(0);
      });
    });
  });
});
