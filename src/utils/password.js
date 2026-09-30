/**
 * Single source of truth for password rules.
 *
 * Supabase owns the authoritative policy (Auth -> Settings -> Password
 * Security).  These values mirror the dashboard configuration used by this
 * project so the client can give immediate, specific feedback, and they are
 * intentionally ASCII-only: whitespace, accented letters and emoji pass a naive
 * `[^A-Za-z0-9]` test but are rejected by the server.
 */

export const PASSWORD_POLICY = {
  minLength: 8,
  // Supabase (GoTrue) rejects passwords longer than 72 bytes.
  maxLength: 72,
  upperCase: true,
  number: true,
  // The symbol set accepted by Supabase's password validation.
  symbol: /[!@#$%^&*()_+\-=[\]{};':"|<>?,./~]/
};

export const PASSWORD_RULES = [
  {
    id: 'length',
    label: `${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} characters`,
    test: (value) => value.length >= PASSWORD_POLICY.minLength && value.length <= PASSWORD_POLICY.maxLength
  },
  {
    id: 'uppercase',
    label: '1 uppercase letter',
    test: (value) => /[A-Z]/.test(value)
  },
  {
    id: 'number',
    label: '1 number',
    test: (value) => /[0-9]/.test(value)
  },
  {
    id: 'symbol',
    label: '1 special character (!@#$%^&* etc.)',
    test: (value) => PASSWORD_POLICY.symbol.test(value)
  }
];

/**
 * @returns {{ valid: boolean, failed: Array<{id: string, label: string}>, message: string }}
 */
export function validatePassword(value) {
  const password = typeof value === 'string' ? value : '';
  const failed = PASSWORD_RULES.filter((rule) => !rule.test(password));
  return {
    valid: failed.length === 0,
    failed,
    message: failed.length === 0
      ? ''
      : `Password must be ${PASSWORD_RULES.map((rule) => rule.label).join(', ')}.`
  };
}

export function isPasswordRuleMet(ruleId, value) {
  const rule = PASSWORD_RULES.find((item) => item.id === ruleId);
  return rule ? rule.test(typeof value === 'string' ? value : '') : false;
}

/**
 * Strength is driven primarily by length, then by character variety, so a long
 * passphrase is never labelled "weak" purely for missing symbols.
 */
export function calculatePasswordStrength(value) {
  const password = typeof value === 'string' ? value : '';
  if (!password) return { key: '', label: '', score: 0, color: '' };

  const variety = PASSWORD_RULES.filter((rule) => rule.test(password)).length;
  let score;
  if (password.length < PASSWORD_POLICY.minLength) {
    score = 1;
  } else if (variety >= 4 || password.length >= 16) {
    score = 3;
  } else if (variety >= 3 || password.length >= 12) {
    score = 2;
  } else {
    score = 1;
  }

  if (score === 1) return { key: 'weak', label: 'Weak password', score, color: '#DC2626' };
  if (score === 2) return { key: 'medium', label: 'Good password', score, color: '#2563EB' };
  return { key: 'strong', label: 'Strong password', score, color: '#059669' };
}

/** Shared copy for validation, registration and reset. */
export const PASSWORD_HELP_TEXT = `${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} characters with 1 uppercase letter, 1 number, and 1 special character`;

/**
 * Translate a Supabase auth failure into copy a user can act on.  Raw SDK
 * messages leak internals and are shown inconsistently, so every auth surface
 * routes errors through this helper.
 */
export function describeAuthError(error) {
  const hasStatus = error?.status !== undefined && error?.status !== null;
  const status = Number(error?.status);
  const code = String(error?.code || '').toLowerCase();
  const raw = String(error?.message || '');

  if (status === 429 || code === 'over_request_rate' || /rate limit|too many/i.test(raw)) {
    return 'Too many attempts. Please wait a minute before trying again.';
  }
  if ((hasStatus && status === 0) || /network|failed to fetch|load failed/i.test(raw)) {
    return 'We could not reach the server. Check your connection and try again.';
  }
  if (code === 'weak_password' || /password is too weak/i.test(raw)) {
    return `Password is not strong enough. Use ${PASSWORD_HELP_TEXT}.`;
  }
  if (code === 'same_password' || /same as the old/i.test(raw)) {
    return 'Choose a password you have not used before.';
  }
  if (code === 'expired_token' || /expired|invalid link|token/i.test(raw)) {
    return 'This password reset link is invalid or has expired. Please request a new one.';
  }
  if (code === 'new_password_should_be_different' || /new password should be different/i.test(raw)) {
    return 'Choose a password you have not used before.';
  }
  if (code === 'email_not_confirmed') {
    return 'Confirm your email address before resetting your password.';
  }
  if (code === 'user_not_found') {
    // resetPasswordForEmail is non-enumerating; keep the same neutral copy.
    return 'If an account exists for that email, a reset link is on its way.';
  }
  if (raw) return raw;
  return 'Something went wrong. Please try again.';
}
