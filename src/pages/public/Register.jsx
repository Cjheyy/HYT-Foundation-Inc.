import { useMemo, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { register } from '../../services/authService';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { TermsModal } from '../../components/TermsModal';
import { RoleSelectionModal } from '../../components/RoleSelectionModal';
import { validateEmail } from '../../utils/helpers';
import hytLogo from '../../assets/HYT.png';
import { qcSchools } from '../../data/qcSchools';
import './Auth.css';
import '../../components/Logo.css';

const PASSWORD_MIN_LENGTH = 8;
const PASSWORD_MAX_LENGTH = 72;

const calculatePasswordStrength = (password) => {
  if (!password) return { key: '', label: '', score: 0, color: '' };

  const criteria = [
    password.length >= PASSWORD_MIN_LENGTH,
    /[A-Z]/.test(password),
    /[0-9]/.test(password),
    /[^A-Za-z0-9]/.test(password)
  ];
  const score = criteria.filter(Boolean).length;
  if (password.length < PASSWORD_MIN_LENGTH || score <= 1) {
    return { key: 'weak', label: 'Weak password', score: 1, color: '#EF4444' };
  }
  if (score < 4) {
    return { key: 'medium', label: 'Medium password', score: 2, color: '#3B82F6' };
  }
  return { key: 'strong', label: 'Strong password', score: 3, color: '#10B981' };
};

export function Register() {
  const navigate = useNavigate();
  const [showRoleSelection, setShowRoleSelection] = useState(true);
  const [pendingApproval, setPendingApproval] = useState(null);
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
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const passwordStrength = useMemo(
    () => calculatePasswordStrength(formData.password),
    [formData.password]
  );

  const handleRoleSelect = (role) => {
    setFormData((previous) => ({ ...previous, accountType: role }));
    setShowRoleSelection(false);
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    const nextValue = type === 'checkbox' ? checked : value;
    setFormData((previous) => ({ ...previous, [name]: nextValue }));

    if (name === 'school') {
      setSelectedSchool(qcSchools.find((school) => school.id === value) || null);
    }

    if (name === 'birthday' && value) {
      const birthDate = new Date(`${value}T00:00:00`);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();
      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) age -= 1;
      setFormData((previous) => ({ ...previous, age: String(age) }));
    }

    if (errors[name]) setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.accountType) nextErrors.accountType = 'Please select account type';
    if (!formData.fullName.trim()) nextErrors.fullName = 'Full name is required';

    if (formData.accountType === 'ojt-student') {
      if (!formData.school) nextErrors.school = 'Please select your school';
      if (!formData.requiredHours) {
        nextErrors.requiredHours = 'Required OJT hours is required';
      } else if (Number(formData.requiredHours) < 1 || Number(formData.requiredHours) > 2000) {
        nextErrors.requiredHours = 'Hours must be between 1 and 2000';
      }
    }

    if (!formData.birthday) {
      nextErrors.birthday = 'Birthday is required';
    } else {
      const birthDate = new Date(`${formData.birthday}T00:00:00`);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDifference = today.getMonth() - birthDate.getMonth();
      if (monthDifference < 0 || (monthDifference === 0 && today.getDate() < birthDate.getDate())) age -= 1;
      if (age < 15) nextErrors.birthday = 'You must be at least 15 years old';
    }

    if (!formData.address.trim()) nextErrors.address = 'Address is required';
    if (!formData.email.trim()) {
      nextErrors.email = 'Email is required';
    } else if (!formData.email.toLowerCase().endsWith('@gmail.com')) {
      nextErrors.email = 'Email must be a Gmail address (@gmail.com)';
    } else if (!validateEmail(formData.email)) {
      nextErrors.email = 'Invalid email format';
    }

    if (!formData.password) {
      nextErrors.password = 'Password is required';
    } else if (
      formData.password.length < PASSWORD_MIN_LENGTH ||
      formData.password.length > PASSWORD_MAX_LENGTH ||
      !/[A-Z]/.test(formData.password) ||
      !/[0-9]/.test(formData.password) ||
      !/[^A-Za-z0-9]/.test(formData.password)
    ) {
      nextErrors.password = `Password must be ${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters and include 1 uppercase letter, 1 number, and 1 special character`;
    }

    if (!formData.confirmPassword) nextErrors.confirmPassword = 'Please confirm your password';
    else if (formData.password !== formData.confirmPassword) nextErrors.confirmPassword = 'Passwords do not match';
    if (!formData.agreeToTerms) nextErrors.agreeToTerms = 'You must agree to the terms and conditions';
    return nextErrors;
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setLoading(true);
    setErrors({});
    try {
      const names = formData.fullName.trim().split(/\s+/);
      const result = await register({
        email: formData.email.trim(),
        password: formData.password,
        fullName: formData.fullName.trim(),
        firstName: names[0],
        lastName: names.slice(1).join(' ') || names[0],
        accountType: formData.accountType,
        school: formData.accountType === 'ojt-student' ? (selectedSchool?.name || formData.school) : null,
        requiredHours: formData.accountType === 'ojt-student' ? Number(formData.requiredHours) : 0,
        birthday: formData.birthday,
        age: Number(formData.age),
        address: formData.address.trim(),
        course: '',
        yearLevel: '',
        contactNumber: ''
      });

      setShowRoleSelection(false);
      setPendingApproval({
        email: formData.email.trim(),
        needsEmailConfirmation: result.needsEmailConfirmation
      });
      setFormData((previous) => ({ ...previous, password: '', confirmPassword: '' }));
    } catch (error) {
      setErrors({ general: error.message || 'Registration failed. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const closePendingModal = () => {
    setPendingApproval(null);
    navigate('/login', { replace: true });
  };

  return (
    <>
      {showRoleSelection && (
        <RoleSelectionModal
          onRoleSelect={handleRoleSelect}
          onClose={() => navigate('/login')}
        />
      )}

      <div className="auth-page">
        <div className="container">
          <div className="auth-container">
            <Card className="auth-card">
              <div className="auth-header">
                <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
                <h2 className="auth-title">Create Account</h2>
                <p className="auth-subtitle">
                  {formData.accountType === 'ojt-student'
                    ? 'OJT / Intern Registration'
                    : formData.accountType === 'trainee'
                      ? 'Trainee Registration'
                      : 'Join the HYT Foundation community'}
                </p>
              </div>

              {errors.general && <div className="alert alert-error">{errors.general}</div>}

              <form onSubmit={handleSubmit} className="auth-form">
                <div className="selected-role-badge">
                  <span className="role-badge-icon">{formData.accountType === 'ojt-student' ? '💼' : '🎓'}</span>
                  <span className="role-badge-text">
                    {formData.accountType === 'ojt-student' ? 'OJT / Intern' : 'Trainee'}
                  </span>
                  <button type="button" className="role-change-button" onClick={() => setShowRoleSelection(true)}>
                    Change
                  </button>
                </div>

                <Input
                  label="Full Name"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  error={errors.fullName}
                  autoComplete="name"
                  required
                />

                {formData.accountType === 'ojt-student' && (
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
                        {qcSchools.map((school) => <option key={school.id} value={school.id}>{school.name}</option>)}
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
                <Input
                  label="Address"
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  error={errors.address}
                  autoComplete="street-address"
                  required
                />
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

                <div className="password-input-wrapper">
                  <Input
                    label="Password"
                    type={showPassword ? 'text' : 'password'}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    onPaste={(e) => e.preventDefault()}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    error={errors.password}
                    help={`${PASSWORD_MIN_LENGTH}-${PASSWORD_MAX_LENGTH} characters, uppercase, number, and special character`}
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowPassword((value) => !value)} aria-label="Toggle password visibility">
                    {showPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                  {formData.password && (
                    <div className={`password-strength strength-${passwordStrength.key}`} aria-live="polite">
                      <div className="strength-track"><div className="strength-bar" style={{ width: `${passwordStrength.score * 33.333}%`, background: passwordStrength.color }} /></div>
                      <span className="strength-text" style={{ color: passwordStrength.color }}>{passwordStrength.label}</span>
                    </div>
                  )}
                </div>

                <div className="password-input-wrapper">
                  <Input
                    label="Confirm Password"
                    type={showConfirmPassword ? 'text' : 'password'}
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    onPaste={(e) => e.preventDefault()}
                    onCopy={(e) => e.preventDefault()}
                    onCut={(e) => e.preventDefault()}
                    error={errors.confirmPassword}
                    minLength={PASSWORD_MIN_LENGTH}
                    maxLength={PASSWORD_MAX_LENGTH}
                    autoComplete="new-password"
                    required
                  />
                  <button type="button" className="password-toggle" onClick={() => setShowConfirmPassword((value) => !value)} aria-label="Toggle confirm password visibility">
                    {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                  </button>
                  {formData.confirmPassword && formData.password && (
                    <div className={`password-match ${formData.password === formData.confirmPassword ? 'match' : 'no-match'}`}>
                      {formData.password === formData.confirmPassword ? <span className="match-text">✓ Passwords match</span> : <span className="no-match-text">✗ Passwords don&apos;t match</span>}
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="checkbox-label">
                    <input type="checkbox" name="agreeToTerms" checked={formData.agreeToTerms} onChange={handleChange} />
                    <span>
                      I agree to the{' '}
                      <button type="button" className="terms-link" onClick={() => setShowTermsModal(true)}>Terms and Conditions</button>
                    </span>
                  </label>
                  {errors.agreeToTerms && <div className="form-error">{errors.agreeToTerms}</div>}
                </div>

                <Button type="submit" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Submitting Application...' : 'Submit Application'}
                </Button>
              </form>

              <div className="auth-footer">
                Already have an account? <Link to="/login" className="link-primary">Login</Link>
              </div>
            </Card>
          </div>
        </div>
      </div>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />

      <Modal
        isOpen={Boolean(pendingApproval)}
        onClose={closePendingModal}
        title="Application received"
      >
        <div className="pending-approval-modal">
          <div className="pending-approval-icon">⏳</div>
          <h3>Please wait for the admin to confirm your account.</h3>
          <p>
            Your application for <strong>{pendingApproval?.email}</strong> has been sent to the HYT admin team.
            {pendingApproval?.needsEmailConfirmation
              ? ' Please confirm your email first, then wait for approval.'
              : ' You will be able to sign in after approval.'}
          </p>
          <p className="pending-approval-note">For your security, you have not been logged in automatically.</p>
          <Button onClick={closePendingModal} style={{ width: '100%' }}>Go to Login</Button>
        </div>
      </Modal>
    </>
  );
}
