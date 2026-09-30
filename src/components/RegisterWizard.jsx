import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { register } from '../services/authService';
import { Input } from './Input';
import { PasswordField } from './PasswordField';
import { Button } from './Button';
import { Icon } from './icons';
import { TermsModal } from './TermsModal';
import { ACCOUNT_TYPE_LIST, getAccountType } from '../data/accountTypes';
import { validateEmail } from '../utils/helpers';
import {
  PASSWORD_HELP_TEXT,
  PASSWORD_POLICY,
  calculatePasswordStrength,
  describeAuthError,
  validatePassword
} from '../utils/password';
import { qcSchools } from '../data/qcSchools';
import './RegisterWizard.css';

const PASSWORD_MAX_LENGTH = PASSWORD_POLICY.maxLength;

/**
 * Registration is a multi-step wizard inside a dialog rather than one long page.
 * Each phase is short enough to fit without scrolling, which is the whole point:
 * the previous single-page form ran to several screens on a laptop.
 */
const STEP_LABELS = ['Account Type', 'Your Details', 'Account Setup'];
const PHASE_TO_STEP = { choose: 0, guidance: 0, details: 1, account: 2, success: 3 };

const calculateAge = (birthday) => {
  if (!birthday) return '';
  const birthDate = new Date(`${birthday}T00:00:00`);
  if (Number.isNaN(birthDate.getTime())) return '';
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDifference = today.getMonth() - birthDate.getMonth();
  if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) age -= 1;
  return String(age);
};

export function RegisterWizard({ onClose }) {
  const navigate = useNavigate();
  const dialogRef = useRef(null);

  const [phase, setPhase] = useState('choose');
  const [formData, setFormData] = useState({
    accountType: '',
    fullName: '',
    school: '',
    requiredHours: '',
    email: '',
    birthday: '',
    age: '',
    address: '',
    password: '',
    confirmPassword: '',
    agreeToTerms: false
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const accountType = getAccountType(formData.accountType);
  const isOjt = formData.accountType === 'ojt-student';
  const currentStep = PHASE_TO_STEP[phase] ?? 0;

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  // Lock the page behind the dialog and let Escape dismiss it.
  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  // Each phase opens scrolled to the top, otherwise a long "Details" step
  // would inherit the previous step's scroll offset.
  useEffect(() => {
    if (dialogRef.current) dialogRef.current.scrollTop = 0;
  }, [phase]);

  const closeAndGoToLogin = () => {
    onClose();
    navigate('/login', { replace: true });
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData((previous) => ({ ...previous, [name]: nextValue }));

    if (name === 'school') {
      setSelectedSchool(qcSchools.find((school) => school.id === value) || null);
    }
    if (name === 'birthday') {
      setFormData((previous) => ({ ...previous, birthday: value, age: calculateAge(value) }));
    }
    if (errors[name] || errors.general) {
      setErrors((previous) => ({ ...previous, [name]: '', general: '' }));
    }
  };

  /** Validates only the phase being submitted, so errors never appear "ahead". */
  const validatePhase = (target) => {
    const nextErrors = {};

    if (target === 'details') {
      if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required';
      if (isOjt) {
        if (!formData.school) nextErrors.school = 'Please select your school';
        if (!formData.requiredHours) {
          nextErrors.requiredHours = 'Required OJT hours is required';
        } else if (Number(formData.requiredHours) < 1 || Number(formData.requiredHours) > 2000) {
          nextErrors.requiredHours = 'Hours must be between 1 and 2000';
        }
      }
      if (!formData.birthday) {
        nextErrors.birthday = 'Birthday is required';
      } else if (Number(calculateAge(formData.birthday)) < 15) {
        nextErrors.birthday = 'You must be at least 15 years old';
      }
      if (!formData.address.trim()) nextErrors.address = 'Address is required';
    }

    if (target === 'account') {
      if (!formData.email.trim()) {
        nextErrors.email = 'Email is required';
      } else if (!formData.email.toLowerCase().endsWith('@gmail.com')) {
        nextErrors.email = 'Email must be a Gmail address (@gmail.com)';
      } else if (!validateEmail(formData.email)) {
        nextErrors.email = 'Invalid email format';
      }

      if (!formData.password) {
        nextErrors.password = 'Password is required';
      } else {
        const passwordCheck = validatePassword(formData.password);
        if (!passwordCheck.valid) nextErrors.password = passwordCheck.message;
      }

      if (!formData.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password';
      else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';

      if (!formData.agreeToTerms) nextErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    return nextErrors;
  };

  const goTo = (nextPhase) => setPhase(nextPhase);

  const handleContinue = () => {
    const nextErrors = validatePhase('details');
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setErrors({});
    goTo('account');
  };

  const handleSubmit = async () => {
    if (loading) return;
    const nextErrors = validatePhase('account');
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const names = formData.fullName.trim().split(/\s+/);
      await register({
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        firstName: names[0],
        lastName: names.slice(1).join(' ') || names[0],
        accountType: formData.accountType,
        school: isOjt ? (selectedSchool?.name || formData.school) : null,
        requiredHours: isOjt ? Number(formData.requiredHours) : 0,
        birthday: formData.birthday,
        age: Number(formData.age),
        address: formData.address.trim(),
        course: '',
        yearLevel: '',
        contactNumber: ''
      });

      setFormData((previous) => ({ ...previous, password: '', confirmPassword: '' }));
      goTo('success');
    } catch (error) {
      setErrors({ general: describeAuthError(error) });
    } finally {
      setLoading(false);
    }
  };

  const handleOverlayMouseDown = (event) => {
    if (event.target === event.currentTarget) onClose();
  };

  const title = phase === 'success'
    ? 'You are all set'
    : phase === 'choose'
      ? 'Choose your path'
      : phase === 'guidance'
        ? accountType?.title || 'Before you continue'
        : phase === 'details'
          ? 'Tell us about you'
          : 'Secure your account';

  const subtitle = phase === 'success'
    ? 'Your HYT Foundation account has been created.'
    : phase === 'choose'
      ? 'Pick the account type that matches your goal.'
      : phase === 'guidance'
        ? accountType?.description
        : phase === 'details'
          ? isOjt
            ? 'These details appear on your OJT records and certificate.'
            : 'These details appear on your trainee profile.'
          : 'Choose the credentials you will use to sign in.';

  return (
    <div
      className="rw-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rw-title"
      onMouseDown={handleOverlayMouseDown}
    >
      <div className="rw-dialog" ref={dialogRef}>
        <header className="rw-head">
          <div className="rw-head-top">
            <span className="rw-brand">HYT Foundation Inc.</span>
            <button type="button" className="rw-close" onClick={onClose} aria-label="Close registration">
              ×
            </button>
          </div>

          <h2 id="rw-title" className="rw-title">{title}</h2>
          {subtitle && <p className="rw-subtitle">{subtitle}</p>}

          {phase !== 'success' && (
            <ol className="rw-steps">
              {STEP_LABELS.map((label, index) => {
                const state = index === currentStep ? 'is-active' : index < currentStep ? 'is-done' : '';
                return (
                  <li key={label} className={`rw-step ${state}`}>
                    <span className="rw-step-dot" aria-hidden="true">
                      {index < currentStep ? <Icon name="check" size={12} /> : index + 1}
                    </span>
                    <span className="rw-step-label">{label}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </header>

        <div className="rw-body">
          {errors.general && <div className="alert alert-error">{errors.general}</div>}

          {phase === 'choose' && (
            <div className="rw-roles">
              {ACCOUNT_TYPE_LIST.map((role) => (
                <button
                  key={role.key}
                  type="button"
                  className="rw-role"
                  style={{ '--role-color': role.color, '--role-tint': role.tint }}
                  onClick={() => {
                    setFormData((previous) => ({ ...previous, accountType: role.key }));
                    goTo('guidance');
                  }}
                >
                  <span className="rw-role-icon"><Icon name={role.icon} size={28} /></span>
                  <span className="rw-role-title">{role.title}</span>
                  <span className="rw-role-desc">{role.description}</span>
                  <span className="rw-role-arrow" aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          )}

          {phase === 'guidance' && accountType && (
            <div className="rw-guidance">
              <div className="rw-guidance-head" style={{ '--role-color': accountType.color }}>
                <span className="rw-guidance-icon">
                  <Icon name={accountType.icon} size={26} />
                </span>
                <div>
                  <p className="rw-guidance-kicker">Requirements &amp; expectations</p>
                  <p className="rw-guidance-role">{accountType.title}</p>
                </div>
              </div>

              <ul className="rw-requirements">
                {accountType.requirements.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              <div className="rw-commitment">
                <strong>Commitment required</strong>
                <p>{accountType.commitment}</p>
              </div>

              <div className="rw-notice">
                By continuing you acknowledge that you have read and understood the requirements above and
                agree to fulfil all expectations as a <strong>{accountType.title}</strong> at HYT Foundation.
              </div>
            </div>
          )}

          {phase === 'details' && (
            <div className="rw-fields">
              <Input
                label="Full Name"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                error={errors.fullName}
                autoComplete="name"
                required
              />

              {isOjt && (
                <>
                  <div className="form-group">
                    <label className="form-label" htmlFor="school">School <span className="required">*</span></label>
                    <select
                      id="school"
                      name="school"
                      value={formData.school}
                      onChange={handleChange}
                      className={`form-select ${errors.school ? 'error' : ''}`}
                      required
                    >
                      <option value="">Select your school</option>
                      {qcSchools.map((school) => (
                        <option key={school.id} value={school.id}>{school.name}</option>
                      ))}
                    </select>
                    {errors.school && <div className="form-error">{errors.school}</div>}
                  </div>

                  <Input
                    label="Required OJT Hours"
                    type="number"
                    name="requiredHours"
                    value={formData.requiredHours}
                    onChange={handleChange}
                    error={errors.requiredHours}
                    placeholder="e.g., 486"
                    min="1"
                    max="2000"
                    required
                  />
                </>
              )}

              <div className="rw-field-pair">
                <Input
                  label="Birthday"
                  type="date"
                  name="birthday"
                  value={formData.birthday}
                  onChange={handleChange}
                  error={errors.birthday}
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
                <Input label="Age" type="number" name="age" value={formData.age} disabled readOnly />
              </div>

              <Input
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                error={errors.address}
                autoComplete="street-address"
                required
              />
            </div>
          )}

          {phase === 'account' && (
            <div className="rw-fields">
              <Input
                label="Email Address (Gmail only)"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                autoComplete="email"
                required
              />

              <PasswordField
                label="Password"
                name="password"
                value={formData.password}
                onChange={handleChange}
                error={errors.password}
                help={PASSWORD_HELP_TEXT}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                required
              />
              {formData.password && (
                <div className={`password-strength strength-${passwordStrength.key}`} aria-live="polite">
                  <div className="strength-track">
                    <div
                      className="strength-bar strength-bar-animated"
                      style={{
                        width: `${Math.min(100, passwordStrength.score * 33.34)}%`,
                        background: passwordStrength.color,
                        transition: 'width 0.3s ease, background 0.3s ease'
                      }}
                    />
                  </div>
                  <span className="strength-text" style={{ color: passwordStrength.color }}>
                    {passwordStrength.label}
                  </span>
                </div>
              )}

              <PasswordField
                label="Confirm Password"
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                error={errors.confirmPassword}
                maxLength={PASSWORD_MAX_LENGTH}
                autoComplete="new-password"
                required
              />
              {formData.confirmPassword && formData.password && (
                <div className={`password-match ${formData.password === formData.confirmPassword ? 'match' : 'no-match'}`}>
                  {formData.password === formData.confirmPassword
                    ? <span className="match-text">Passwords match</span>
                    : <span className="no-match-text">Passwords don&apos;t match</span>}
                </div>
              )}

              <div className="form-group">
                <label className="checkbox-label">
                  <input
                    type="checkbox"
                    name="agreeToTerms"
                    checked={formData.agreeToTerms}
                    onChange={handleChange}
                  />
                  <span>
                    I agree to the{' '}
                    <button type="button" className="terms-link" onClick={() => setShowTermsModal(true)}>
                      Terms and Conditions
                    </button>
                  </span>
                </label>
                {errors.agreeToTerms && <div className="form-error">{errors.agreeToTerms}</div>}
              </div>
            </div>
          )}

          {phase === 'success' && (
            <div className="rw-success">
              <span className="rw-success-badge"><Icon name="check" size={30} /></span>
              <h3>Registration successful</h3>
              <p>
                Your account for <strong>{formData.email}</strong> has been created. You can now log in
                directly to your dashboard.
              </p>
              <p className="rw-success-note">
                Admin approval is required when you apply for an OJT Posting or Program.
              </p>
            </div>
          )}
        </div>

        <footer className="rw-foot">
          {phase === 'choose' && (
            <span className="rw-foot-note">
              Already have an account? <Link to="/login" className="link-primary">Login</Link>
            </span>
          )}

          {phase === 'guidance' && (
            <>
              <Button variant="secondary" onClick={() => goTo('choose')} style={{ flex: 1 }}>
                ← Back
              </Button>
              <Button
                onClick={() => goTo('details')}
                style={{ flex: 2, background: accountType?.color }}
              >
                I Understand &amp; Agree
              </Button>
            </>
          )}

          {phase === 'details' && (
            <>
              <Button variant="secondary" onClick={() => goTo('guidance')} style={{ flex: 1 }}>
                ← Back
              </Button>
              <Button onClick={handleContinue} style={{ flex: 2 }}>
                Continue
              </Button>
            </>
          )}

          {phase === 'account' && (
            <>
              <Button variant="secondary" onClick={() => goTo('details')} style={{ flex: 1 }} disabled={loading}>
                ← Back
              </Button>
              <Button onClick={handleSubmit} style={{ flex: 2 }} disabled={loading}>
                {loading ? 'Submitting...' : 'Create Account'}
              </Button>
            </>
          )}

          {phase === 'success' && (
            <Button onClick={closeAndGoToLogin} style={{ width: '100%' }}>
              Go to Login
            </Button>
          )}
        </footer>
      </div>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
}
