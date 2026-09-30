import {
  PASSWORD_POLICY,
  PASSWORD_RULES,
  calculatePasswordStrength,
  describeAuthError,
  isPasswordRuleMet,
  validatePassword
} from './password';

describe('password policy', () => {
  test('accepts a password that satisfies every rule', () => {
    const result = validatePassword('Hyt@2026');
    expect(result.valid).toBe(true);
    expect(result.message).toBe('');
  });

  test('reports each missing character class', () => {
    expect(validatePassword('short1!').failed.map((rule) => rule.id)).toContain('length');
    expect(validatePassword('nouppercase1!').failed.map((rule) => rule.id)).toContain('uppercase');
    expect(validatePassword('NoNumber!').failed.map((rule) => rule.id)).toContain('number');
    expect(validatePassword('NoSymbol1').failed.map((rule) => rule.id)).toContain('symbol');
  });

  test('enforces the 8-72 character boundaries', () => {
    expect(validatePassword('Hyt@202').valid).toBe(false);
    const maxLength = 'A1!'.repeat(24); // 72 characters
    expect(maxLength).toHaveLength(PASSWORD_POLICY.maxLength);
    expect(validatePassword(maxLength).valid).toBe(true);
    expect(validatePassword(`${maxLength}x`).valid).toBe(false);
  });

  test('does not treat whitespace or non-ASCII characters as a symbol', () => {
    // A naive /[^A-Za-z0-9]/ test accepts these, but Supabase rejects them.
    expect(validatePassword('Passw0rd ').valid).toBe(false);
    expect(validatePassword('Passw0rd£').valid).toBe(false);
    expect(validatePassword('Passw0rd\u{1F512}').valid).toBe(false);
  });

  test('exposes per-rule checks for live checklists', () => {
    expect(isPasswordRuleMet('length', 'Hyt@2026')).toBe(true);
    expect(isPasswordRuleMet('symbol', 'Hyt 2026')).toBe(false);
    expect(PASSWORD_RULES).toHaveLength(4);
  });
});

describe('password strength', () => {
  test('rates a short password as weak', () => {
    expect(calculatePasswordStrength('Ab1!').key).toBe('weak');
  });

  test('rates a long passphrase as strong even without every class', () => {
    const result = calculatePasswordStrength('correct horse battery');
    expect(result.key).toBe('strong');
  });

  test('is empty for an empty value', () => {
    expect(calculatePasswordStrength('').score).toBe(0);
  });
});

describe('auth error messages', () => {
  test('maps rate limits and network failures to actionable copy', () => {
    expect(describeAuthError({ status: 429, message: 'Email rate limit exceeded' }))
      .toMatch(/wait a minute/i);
    expect(describeAuthError({ status: 0, message: 'Failed to fetch' }))
      .toMatch(/could not reach the server/i);
  });

  test('maps a server-side weak password rejection to the local policy', () => {
    const message = describeAuthError({ code: 'weak_password', message: 'Password is too weak' });
    expect(message).toMatch(/uppercase/i);
    expect(message).toMatch(/special character/i);
  });

  test('maps an expired recovery link to a re-request message', () => {
    expect(describeAuthError({ message: 'Token has expired or is invalid' }))
      .toMatch(/request a new one/i);
  });

  test('never leaks an unknown SDK message as-is when it is empty', () => {
    expect(describeAuthError({})).toMatch(/something went wrong/i);
  });
});
