import { useEffect, useState } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { login } from '../../services/authService';
import { normalizeRole } from '../../services/supabaseService';
import { describeAuthError } from '../../utils/password';
import { Input } from '../../components/Input';
import { PasswordField } from '../../components/PasswordField';
import { Button } from '../../components/Button';
import { Icon } from '../../components/icons';
import { AuthBrandRail } from '../../components/AuthBrandRail';
import './Auth.css';

const DASHBOARD_BY_ROLE = {
  ADMIN: '/admin/dashboard',
  'OJT/INTERN': '/student/dashboard',
  TRAINEE: '/trainee/dashboard'
};

const BRAND_POINTS = [
  'Apply for OJT postings and trainee programs',
  'Clock in and out with verified attendance',
  'Track your rendered hours and certificates'
];

export function Login() {
  const { state, authStatus } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const [formData, setFormData] = useState({
    // 'trainee' | 'ojt-student' | '' — optional on the form: an admin never
    // picks one, and authService requires it only once it knows the role.
    accountType: '',
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  // A persisted session should not land on the login form.  Authenticated
  // users are sent to their dashboard (or back to the page they requested).
  useEffect(() => {
    if (authStatus !== 'authenticated' || !state.currentUser) return;
    const from = location.state?.from;
    if (from && typeof from === 'string' && from.startsWith('/')) {
      navigate(from, { replace: true });
      return;
    }
    navigate(DASHBOARD_BY_ROLE[normalizeRole(state.currentUser.role)] || '/', { replace: true });
  }, [authStatus, state.currentUser, location.state, navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  /* The account type is deliberately NOT validated here.  An admin signs in
     through this same form and never picks a type — the role on their profile is
     authoritative, and `login()` returns before the account-type gate for them.
     OJT and Trainee must still declare theirs, but that gate can only run once
     the role is known, which is *after* authentication.  So a Trainee who leaves
     this blank gets the precise "choose OJT Student or Trainee" message from
     authService, instead of a client-side block that an admin could never pass. */
  const validate = () => {
    const newErrors = {};
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;

    // Clear any previous errors
    setErrors({});

    // Custom validation is the single source of truth (noValidate on <form>).
    const newErrors = validate();

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Authenticate with Supabase (credentials only).
      // Step 2: authService validates the profile, the approval state and that
      // the chosen account type matches the role on the profile.  Admins skip
      // the account-type gate.  AppContext's listener commits the session.
      const user = await login(formData.email, formData.password, formData.accountType);

      if (user) {
        const from = location.state?.from;
        const target = from && typeof from === 'string' && from.startsWith('/')
          ? from
          : DASHBOARD_BY_ROLE[normalizeRole(user.role)] || '/';
        navigate(target, { replace: true });
      }
    } catch (error) {
      console.error('Login error:', error);
      const message = describeAuthError(error);
      /* The two account-type failures belong UNDER the picker, not in the
         top-of-form alert — that is where the user has to act.  Both are thrown
         by authService only after it has read the profile, which is why the
         form itself cannot pre-empt them. */
      if (error?.code === 'ACCOUNT_TYPE_REQUIRED' || error?.code === 'ROLE_MISMATCH') {
        setErrors({ accountType: message });
      } else {
        setErrors({ general: message });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-shell">
        {/* Brand rail — carries the HYT identity into the sign-in experience */}
        <AuthBrandRail
          description="Your portal for OJT placements, trainee programs, verified attendance and certificates — all in one place."
          points={BRAND_POINTS}
        />

        {/* Form rail */}
        <main className="auth-panel">
          <div className="auth-panel-inner">
            <div className="auth-header">
              <h2 className="auth-title">Welcome Back</h2>
              <p className="auth-subtitle">Sign in to continue to your dashboard</p>
            </div>

            {errors.general && (
              <div className="alert alert-error" role="alert">{errors.general}</div>
            )}

            <form onSubmit={handleSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <span className="form-label">
                  Sign in as
                  <span className="form-label-note">
                    OJT and Trainee only — admins are detected automatically
                  </span>
                </span>
                <div className="account-type-selection">
                  <label className="account-type-card">
                    <input
                      type="radio"
                      name="accountType"
                      value="ojt-student"
                      checked={formData.accountType === 'ojt-student'}
                      onChange={handleChange}
                    />
                    <span className="account-type-content">
                      <span className="account-type-icon"><Icon name="briefcase" size={22} /></span>
                      <span className="account-type-label">OJT Student</span>
                      <span className="account-type-note">Internship hours</span>
                    </span>
                  </label>
                  <label className="account-type-card">
                    <input
                      type="radio"
                      name="accountType"
                      value="trainee"
                      checked={formData.accountType === 'trainee'}
                      onChange={handleChange}
                    />
                    <span className="account-type-content">
                      <span className="account-type-icon"><Icon name="award" size={22} /></span>
                      <span className="account-type-label">Trainee</span>
                      <span className="account-type-note">Programs &amp; events</span>
                    </span>
                  </label>
                </div>
                {errors.accountType && <div className="form-error">{errors.accountType}</div>}
              </div>

              <Input
                label="Email Address"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="yourname@gmail.com"
                autoComplete="email"
                required
              />

              <PasswordField
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                autoComplete="current-password"
                required
              />

              <div className="form-footer">
                <Link to="/forgot-password" className="link">Forgot password?</Link>
              </div>

              <Button type="submit" disabled={loading} className="auth-submit">
                {loading ? 'Signing in...' : 'Sign In'}
              </Button>
            </form>

            <div className="auth-footer">
              Don&apos;t have an account? <Link to="/register" className="link-primary">Create Account</Link>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
