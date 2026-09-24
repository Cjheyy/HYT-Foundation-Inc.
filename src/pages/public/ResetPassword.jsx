import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../config/supabase';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Card } from '../../components/Card';
import { toast } from 'react-toastify';
import hytLogo from '../../assets/HYT.png';
import './Auth.css';

export function ResetPassword() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});
  const [isValidSession, setIsValidSession] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    // Check if user has a valid recovery session
    const checkSession = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error || !session) {
          toast.error('Invalid or expired reset link. Please request a new one.');
          setTimeout(() => navigate('/forgot-password'), 2000);
          return;
        }

        setIsValidSession(true);
      } catch (error) {
        console.error('Session check error:', error);
        toast.error('Session verification failed');
        setTimeout(() => navigate('/forgot-password'), 2000);
      } finally {
        setCheckingSession(false);
      }
    };

    checkSession();
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrors({});

    const validationErrors = {};
    
    if (!newPassword || newPassword.length < 8 || newPassword.length > 72 || !/[A-Z]/.test(newPassword) || !/[0-9]/.test(newPassword) || !/[^A-Za-z0-9]/.test(newPassword)) {
      validationErrors.newPassword = 'Password must be 8-72 characters with 1 uppercase letter, 1 number, and 1 special character';
    }

    if (newPassword !== confirmPassword) {
      validationErrors.confirmPassword = 'Passwords do not match';
    }

    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setLoading(true);

      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      toast.success('✅ Password reset successfully! Redirecting to login...');
      
      // Sign out to ensure clean state
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error) {
      console.error('Password reset error:', error);
      toast.error(error.message || 'Failed to reset password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (checkingSession) {
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

  if (!isValidSession) {
    return null; // Will redirect
  }

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-header">
          <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
          <h1 className="auth-title">Create New Password</h1>
          <p className="auth-subtitle">
            Choose a strong password for your account
          </p>
        </div>

        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            label="New Password"
            type="password"
            value={newPassword}
            onChange={(e) => {
              setNewPassword(e.target.value);
              setErrors({ ...errors, newPassword: '' });
            }}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            error={errors.newPassword}
            placeholder="8-72 characters"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
            autoFocus
          />

          <Input
            label="Confirm New Password"
            type="password"
            value={confirmPassword}
            onChange={(e) => {
              setConfirmPassword(e.target.value);
              setErrors({ ...errors, confirmPassword: '' });
            }}
            onPaste={(e) => e.preventDefault()}
            onCopy={(e) => e.preventDefault()}
            onCut={(e) => e.preventDefault()}
            error={errors.confirmPassword}
            placeholder="Re-enter your password"
            minLength={8}
            maxLength={72}
            autoComplete="new-password"
            required
          />

          <div className="password-requirements">
            <p className="requirements-title">Password must contain:</p>
            <ul>
              <li className={newPassword.length >= 8 ? 'valid' : ''}>
                At least 8 characters
              </li>
              <li className={/[A-Z]/.test(newPassword) ? 'valid' : ''}>
                One uppercase letter
              </li>
              <li className={/[^A-Za-z0-9]/.test(newPassword) ? 'valid' : ''}>
                One special character
              </li>
              <li className={/[0-9]/.test(newPassword) ? 'valid' : ''}>
                One number
              </li>
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
