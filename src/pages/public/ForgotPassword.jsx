import { useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { toast } from 'react-toastify';
import hytLogo from '../../assets/HYT.png';
import './Auth.css';

export function ForgotPassword() {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const [errors, setErrors] = useState({});

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    if (!email || !email.includes('@')) {
      setErrors({ email: 'Please enter a valid email address' });
      return;
    }

    try {
      setLoading(true);
      
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`
      });

      if (error) throw error;

      setEmailSent(true);
      toast.success('✅ Password reset link sent! Check your email.');
    } catch (error) {
      console.error('Password reset request error:', error);
      toast.error(error.message || 'Failed to send reset link. Please try again.');
    } finally {
      setLoading(false);
    }
  };

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

        {emailSent ? (
          <div className="auth-form">
            <div className="success-message">
              <div className="success-icon">✅</div>
              <h3>Email Sent!</h3>
              <p>We've sent a password reset link to:</p>
              <strong>{email}</strong>
              <p className="email-instructions">
                Click the link in the email to reset your password. 
                The link will expire in 1 hour.
              </p>
              <p className="email-note">
                Didn't receive the email? Check your spam folder or{' '}
                <button 
                  onClick={() => setEmailSent(false)} 
                  className="auth-link"
                  style={{ display: 'inline' }}
                >
                  try again
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
          <form onSubmit={handleSubmit} className="auth-form">
            <Input
              label="Email Address"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setErrors({ ...errors, email: '' });
              }}
              error={errors.email}
              placeholder="your.email@example.com"
              required
              autoFocus
            />

            <Button type="submit" disabled={loading} fullWidth>
              {loading ? 'Sending...' : 'Send Reset Link'}
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
