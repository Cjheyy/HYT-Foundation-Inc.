import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase, SUPABASE_CONFIG_ERROR } from '../../config/supabase';
import { describeAuthError } from '../../utils/password';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import hytLogo from '../../assets/HYT.png';
import './Auth.css';
import '../../components/Logo.css';

/**
 * Callback endpoint for Supabase's `{{ .TokenHash }}` recovery template.
 *
 * The app also supports the legacy implicit (fragment) reset link, which the
 * Supabase client consumes automatically and reports through the
 * `PASSWORD_RECOVERY` event.  Handling `token_hash` here means the project works
 * with either email template instead of silently failing on the newer default.
 */
export function AuthConfirm() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [error, setError] = useState(null);
  const startedRef = useRef(false);

  const tokenHash = searchParams.get('token_hash') || searchParams.get('token');
  const type = searchParams.get('type') || 'recovery';
  const next = searchParams.get('next') || '/reset-password';

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    const run = async () => {
      if (!supabase) {
        setError(SUPABASE_CONFIG_ERROR || 'Email confirmation is unavailable right now.');
        return;
      }
      if (!tokenHash) {
        setError('This confirmation link is missing its token. Please request a new one.');
        return;
      }
      if (type !== 'recovery' && type !== 'email') {
        setError(`Unsupported link type "${type}".`);
        return;
      }

      const { error: verifyError } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type === 'email' ? 'email' : 'recovery'
      });

      if (verifyError) {
        setError(describeAuthError(verifyError));
        return;
      }

      navigate(type === 'recovery' ? next : '/login', { replace: true });
    };

    run().catch((verifyError) => {
      console.error('Auth confirmation failed.', verifyError);
      setError(describeAuthError(verifyError));
    });
  }, [tokenHash, type, next, navigate]);

  return (
    <div className="auth-page">
      <Card className="auth-card">
        <div className="auth-header">
          <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
          <h1 className="auth-title">
            {error ? 'We could not use this link' : 'Confirming your email...'}
          </h1>
          <p className="auth-subtitle">
            {error ? 'The link may have expired or already been used.' : 'Please wait a moment.'}
          </p>
        </div>

        {error ? (
          <div className="auth-form">
            <div className="alert alert-error" role="alert">{error}</div>
            <Link to="/forgot-password" className="btn btn-primary" style={{ display: 'block', textAlign: 'center' }}>
              Request a new reset link
            </Link>
            <div className="auth-footer">
              <Link to="/login" className="auth-link">← Back to Login</Link>
            </div>
          </div>
        ) : (
          <div className="auth-form">
            <Button type="button" disabled fullWidth>Verifying link...</Button>
          </div>
        )}
      </Card>
    </div>
  );
}
