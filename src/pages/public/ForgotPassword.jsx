import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, SUPABASE_CONFIG_ERROR } from '../../config/supabase';
import { describeAuthError } from '../../utils/password';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { toast } from 'react-toastify';
import hytLogo from '../../assets/HYT.png';
import './Auth.css';
import '../../components/Logo.css';

const RESEND_COOLDOWN_SECONDS = 45;

const maskEmail = (value) => {
  const [local, domain] = String(value).split('@');
  if (!domain) return value;
  const visible = local.slice(0, Math.min(2, local.length));
  return `${visible}${'*'.repeat(Math.max(local.length - 2, 1))}@${domain}`;
};

export function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState({});
  const [cooldown, setCooldown] = useState(0);
  const cooldownTimer = useRef(null);

  useEffect(() => () => {
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
  }, []);

  const startCooldown = () => {
    setCooldown(RESEND_COOLDOWN_SECONDS);
    if (cooldownTimer.current) clearInterval(cooldownTimer.current);
    cooldownTimer.current = setInterval(() => {
      setCooldown((previous) => {
        if (previous <= 1) {
          clearInterval(cooldownTimer.current);
          return 0;
        }
        return previous - 1;
      });
    }, 1000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading || cooldown > 0) return;
    setErrors({});

    const address = email.trim();
    if (!address || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    if (!supabase) {
      setErrors({ general: SUPABASE_CONFIG_ERROR || 'Password reset is unavailable right now.' });
      return;
    }

    try {
      setLoading(true);

      // redirectTo must be allow-listed in Supabase -> Auth -> URL
      // Configuration, otherwise Supabase falls back to the Site URL and the
      // user never reaches /reset-password.
      const siteUrl = (process.env.REACT_APP_SITE_URL || window.location.origin).replace(/\/$/, '');
      const { error } = await supabase.auth.resetPasswordForEmail(address, {
        redirectTo: `${siteUrl}/reset-password`
      });

      if (error) throw error;

      setEmailSent(true);
      startCooldown();
      toast.success('Password reset link sent. Please check your inbox.');
    } catch (error) {
      console.error('Password reset request error:', error);
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

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-header">
          <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
          <h1 className="auth-title">Reset Your Password</h1>
          <p className="auth-subtitle">
            {emailSent 
              ? "Check your email for the password reset link"
              : "Enter your email address and we'll send you a link to reset your password"}
          </p>
        </div>

        {errors.general && <div className="alert alert-error" role="alert">{errors.general}</div>}

        {emailSent ? (
          <div className="auth-form">
            <div className="success-message">
              <div className="success-icon"></div>
              <h3>Email Sent!</h3>
              <p>If an account exists, we sent a password reset link to:</p>
              <strong>{maskEmail(email)}</strong>
              <p className="email-instructions">
                Open the link on this device to choose a new password. Reset links
                expire, so use it as soon as you can.
              </p>
              <p className="email-note">
                Didn't receive the email? Check your spam folder or{' '}
                <button
                  type="button"
                  onClick={() => setEmailSent(false)}
                  className="auth-link"
                  style={{ display: 'inline' }}
                  disabled={cooldown > 0}
                >
                  {cooldown > 0 ? `try again in ${cooldown}s` : 'try again'}
                </button>
              </p>
            </div>

            <div className="auth-footer">
              <Link to="/login" className="auth-link">
                ← Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form" noValidate>
            <Input
              label="Email Address"
              type="email"
              name="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors((previous) => ({ ...previous, email: '' }));
              }}
              error={errors.email}
              placeholder="your.email@example.com"
              required
              autoComplete="email"
              autoFocus
            />

            <Button type="submit" disabled={loading || cooldown > 0} fullWidth>
              {loading ? 'Sending...' : cooldown > 0 ? `Please wait ${cooldown}s` : 'Send Reset Link'}
            </Button>

            <div className="auth-footer">
              <Link to="/login" className="auth-link">
                ← Back to Login
              </Link>
            </div>
          </form>
        )}
      </Card>
    </div>
  );
}
