import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase, SUPABASE_CONFIG_ERROR } from '../../config/supabase';
import { useApp } from '../../context/AppContext';
import {
  PASSWORD_POLICY,
  PASSWORD_RULES,
  calculatePasswordStrength,
  describeAuthError,
  isPasswordRuleMet,
  validatePassword
} from '../../utils/password';
import { Button } from '../../components/Button';
import { PasswordField } from '../../components/PasswordField';
import { Card } from '../../components/Card';
import { toast } from 'react-toastify';
import hytLogo from '../../assets/HYT.png';
import './Auth.css';
import '../../components/Logo.css';

export function ResetPassword() {
  const navigate = useNavigate();
  const { authStatus, recoveryUserId, signOut } = useApp();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [confirmTouched, setConfirmTouched] = useState(false);
  const [errors, setErrors] = useState({});

  // The gate is the PASSWORD_RECOVERY event captured by AppContext, not "any
  // session exists".  A normal signed-in session must not be able to change a
  // password from this page, and an expired/reused link must not be masked by
  // an unrelated live session.
  const isChecking = authStatus === 'initializing';
  const hasRecoverySession = Boolean(recoveryUserId);

  const strength = calculatePasswordStrength(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;

  useEffect(() => {
    if (hasRecoverySession) setErrors({});
  }, [hasRecoverySession]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || !hasRecoverySession) return;
    setErrors({});

    const validation = validatePassword(newPassword);
    const validationErrors = {};
    if (!newPassword) {
      validationErrors.newPassword = 'Password is required';
    } else if (!validation.valid) {
      validationErrors.newPassword = validation.message;
    }
    if (!confirmPassword) {
      validationErrors.confirmPassword = 'Please confirm your new password';
    } else if (newPassword !== confirmPassword) {
      validationErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      // Supabase revokes other sessions on a password change; this closes the
      // recovery session on this device and clears the app state.
      try {
        await signOut();
      } catch (signOutError) {
        console.warn('Post-reset sign-out reported an error.', signOutError);
      }

      setNewPassword('');
      setConfirmPassword('');
      toast.success('Password updated successfully. Please log in with your new password.');
      navigate('/login', { replace: true });
    } catch (error) {
      console.error('Password reset error:', error);
      setErrors({ general: describeAuthError(error) });
    } finally {
      setLoading(false);
    }
  };

  if (!supabase) {
    return (
      <div className="auth-page">
        <Card className="auth-card">
          <div className="auth-header">
            <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
            <h1 className="auth-title">Password reset unavailable</h1>
          </div>
          <div className="alert alert-error" role="alert">
            {SUPABASE_CONFIG_ERROR || 'Password reset is unavailable right now.'}
          </div>
          <div className="auth-footer">
            <Link to="/login" className="auth-link">← Back to Login</Link>
          </div>
        </Card>
      </div>
    );
  }

  if (isChecking) {
    return (
      <div className="auth-page">
        <Card className="auth-card">
          <div className="auth-header">
            <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
            <h1 className="auth-title">Verifying...</h1>
            <p className="auth-subtitle">Please wait while we verify your reset link</p>
          </div>
        </Card>
      </div>
    );
  }

  if (!hasRecoverySession) {
    return (
      <div className="auth-page">
        <Card className="auth-card">
          <div className="auth-header">
            <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
            <h1 className="auth-title">This reset link is no longer valid</h1>
            <p className="auth-subtitle">
              Password reset links can only be used once and expire shortly after they are issued.
            </p>
          </div>

          <div className="auth-form">
            <div className="alert alert-error" role="alert">
              Request a new link to choose a new password.
            </div>
            <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
              Request a new link
            </Link>
            <div className="auth-footer">
              <Link to="/login" className="auth-link">← Back to Login</Link>
            </div>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-header">
          <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
          <h1 className="auth-title">Create New Password</h1>
          <p className="auth-subtitle">Choose a strong password for your account</p>
        </div>

        {errors.general && <div className="alert alert-error" role="alert">{errors.general}</div>}

        <form onSubmit={handleSubmit} className="auth-form" noValidate>
          <PasswordField
            label="New Password"
            name="newPassword"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setErrors((previous) => ({ ...previous, newPassword: '' }));
            }}
            error={errors.newPassword}
            placeholder={`${PASSWORD_POLICY.minLength}-${PASSWORD_POLICY.maxLength} characters`}
            maxLength={PASSWORD_POLICY.maxLength}
            autoComplete="new-password"
            required
            autoFocus
          />

          {newPassword && (
            <div className={`password-strength strength-${strength.key}`} aria-live="polite">
              <div className="strength-track">
                <div
                  className="strength-bar"
                  style={{ width: `${strength.score * 33.333}%`, background: strength.color }}
                />
              </div>
              <span className="strength-text" style={{ color: strength.color }}>{strength.label}</span>
            </div>
          )}

          <PasswordField
            label="Confirm New Password"
            name="confirmPassword"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setConfirmTouched(true);
              setErrors((previous) => ({ ...previous, confirmPassword: '' }));
            }}
            onBlur={() => setConfirmTouched(true)}
            error={errors.confirmPassword}
            placeholder="Re-enter your password"
            maxLength={PASSWORD_POLICY.maxLength}
            autoComplete="new-password"
            required
          />

          {confirmTouched && newPassword && (
            <div className={`password-match ${passwordsMatch ? 'match' : 'no-match'}`} aria-live="polite">
              {passwordsMatch
                ? <span className="match-text">✓ Passwords match</span>
                : <span className="no-match-text">✗ Passwords don&apos;t match</span>}
            </div>
          )}

          <div className="password-requirements">
            <p className="requirements-title">Password must contain:</p>
            <ul>
              {PASSWORD_RULES.map((rule) => (
                <li key={rule.id} className={isPasswordRuleMet(rule.id, newPassword) ? 'valid' : ''}>
                  {rule.label}
                </li>
              ))}
            </ul>
          </div>

          <Button type="submit" disabled={loading} fullWidth>
            {loading ? 'Resetting Password...' : 'Reset Password'}
          </Button>
        </form>
      </Card>
    </div>
  );
}
