import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { register } from '../../services/authService';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Button } from '../../components/Button';
import { TermsModal } from '../../components/TermsModal';
import { showToast } from '../../utils/notifications';
import { validateEmail } from '../../utils/helpers';
import hytLogo from '../../assets/HYT.png';
import { qcSchools, validateStudentId } from '../../data/qcSchools';
import './Register.css';
import '../../components/Logo.css';

export function Register() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    fullName: '',
    school: '',
    studentId: '',
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
  const [passwordStrength, setPasswordStrength] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [showTermsModal, setShowTermsModal] = useState(false);

  const calculatePasswordStrength = (password) => {
    if (!password) return '';
    
    let strength = 0;
    if (password.length >= 8) strength++;
    if (/[A-Z]/.test(password)) strength++;
    if (/[0-9]/.test(password)) strength++;
    if (/[^A-Za-z0-9]/.test(password)) strength++;
    
    if (strength <= 1) return 'weak';
    if (strength === 2) return 'medium';
    if (strength === 3) return 'good';
    return 'strong';
  };

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    const newValue = type === 'checkbox' ? checked : value;
    
    setFormData(prev => ({ 
      ...prev, 
      [name]: newValue
    }));
    
    // Handle school selection
    if (name === 'school') {
      const school = qcSchools.find(s => s.id === value);
      setSelectedSchool(school);
      setFormData(prev => ({ ...prev, school: value, studentId: '' }));
    }
    
    // Auto-calculate age from birthday
    if (name === 'birthday' && value) {
      const birthDate = new Date(value);
      const today = new Date();
      let age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();
      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }
      setFormData(prev => ({ ...prev, age: age.toString(), birthday: value }));
    }
    
    if (name === 'password') {
      setPasswordStrength(calculatePasswordStrength(value));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    
    if (!formData.fullName) newErrors.fullName = 'Full name is required';
    
    if (!formData.school) newErrors.school = 'Please select your school';
    
    if (!formData.studentId) {
      newErrors.studentId = 'Student ID is required';
    } else if (formData.school && !validateStudentId(formData.school, formData.studentId)) {
      newErrors.studentId = `Invalid ID format. Expected: ${selectedSchool?.description || 'Valid student ID'}`;
    }
    
    if (!formData.birthday) {
      newErrors.birthday = 'Birthday is required';
    } else {
      const birthDate = new Date(formData.birthday);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      if (age < 15) {
        newErrors.birthday = 'You must be at least 15 years old';
      }
    }
    
    if (!formData.address) newErrors.address = 'Address is required';
    
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!formData.email.includes('@gmail.com')) {
      newErrors.email = 'Email must be a Gmail address (@gmail.com)';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    
    if (!formData.password) {
      newErrors.password = 'Password is required';
    } else {
      const issues = [];
      if (formData.password.length < 8) issues.push('at least 8 characters');
      if (!/[A-Z]/.test(formData.password)) issues.push('1 uppercase letter');
      if (!/[0-9]/.test(formData.password)) issues.push('1 number');
      if (!/[^A-Za-z0-9]/.test(formData.password)) issues.push('1 special character');
      
      if (issues.length > 0) {
        newErrors.password = `Password must have ${issues.join(', ')}`;
      }
    }
    
    if (!formData.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your password';
    } else if (formData.password !== formData.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (!formData.agreeToTerms) {
      newErrors.agreeToTerms = 'You must agree to the terms and conditions';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const newErrors = validate();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      const names = formData.fullName.split(' ');
      const userData = {
        email: formData.email,
        password: formData.password,
        fullName: formData.fullName,
        firstName: names[0],
        lastName: names.slice(1).join(' ') || names[0],
        school: selectedSchool?.name || formData.school,
        studentId: formData.studentId,
        birthday: formData.birthday,
        age: formData.age,
        address: formData.address,
        course: '',
        yearLevel: '',
        contactNumber: ''
      };

      const newUser = register(userData, state.users);
      dispatch({ type: 'ADD_USER', payload: newUser });
      
      // Auto login
      const { password, ...userWithoutPassword } = newUser;
      dispatch({ type: 'SET_CURRENT_USER', payload: userWithoutPassword });
      
      showToast('Account created successfully!', 'success');
      navigate('/student');
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page">
      <div className="container">
        <div className="auth-container">
          <Card className="auth-card">
            <div className="auth-header">
              <img src={hytLogo} alt="HYT Foundation" className="auth-logo-image" />
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">Join the HYT Foundation community</p>
            </div>

            {errors.general && (
              <div className="alert alert-error">{errors.general}</div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <Input
                label="Full Name"
                name="fullName"
                value={formData.fullName}
                onChange={handleChange}
                error={errors.fullName}
                required
              />

              <Select
                label="School"
                name="school"
                value={formData.school}
                onChange={handleChange}
                error={errors.school}
                required
              >
                <option value="">Select your school</option>
                {qcSchools.map(school => (
                  <option key={school.id} value={school.id}>
                    {school.name}
                  </option>
                ))}
              </Select>

              {selectedSchool && (
                <div className="id-format-info">
                  <strong>Student ID Format:</strong> {selectedSchool.idFormat}
                  <br />
                  <small>Example: {selectedSchool.example}</small>
                </div>
              )}

              <Input
                label="Student ID"
                name="studentId"
                value={formData.studentId}
                onChange={handleChange}
                error={errors.studentId}
                placeholder={selectedSchool ? selectedSchool.example : "Enter your student ID"}
                disabled={!formData.school}
                help={selectedSchool ? selectedSchool.description : "Please select your school first"}
                required
              />

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

              <Input
                label="Age"
                type="number"
                name="age"
                value={formData.age}
                disabled
                help="Auto-calculated from birthday"
              />

              <Input
                label="Address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                error={errors.address}
                placeholder="Complete address"
                required
              />

              <Input
                label="Email Address (Gmail only)"
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                error={errors.email}
                placeholder="yourname@gmail.com"
                required
              />

              <div className="password-input-wrapper">
                <Input
                  label="Password"
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  error={errors.password}
                  help="Must be 8+ chars, 1 uppercase, 1 number, 1 special character"
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
                {formData.password && (
                  <div className={`password-strength strength-${passwordStrength}`}>
                    <div className="strength-bar"></div>
                    <span className="strength-text">
                      {passwordStrength === 'weak' && 'Weak password'}
                      {passwordStrength === 'medium' && 'Medium password'}
                      {passwordStrength === 'good' && 'Good password'}
                      {passwordStrength === 'strong' && 'Strong password'}
                    </span>
                  </div>
                )}
              </div>

              <div className="password-input-wrapper">
                <Input
                  label="Confirm Password"
                  type={showConfirmPassword ? "text" : "password"}
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  error={errors.confirmPassword}
                  required
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? '👁️' : '👁️‍🗨️'}
                </button>
                {formData.confirmPassword && formData.password && (
                  <div className={`password-match ${formData.password === formData.confirmPassword ? 'match' : 'no-match'}`}>
                    {formData.password === formData.confirmPassword ? (
                      <span className="match-text">✓ Passwords match</span>
                    ) : (
                      <span className="no-match-text">✗ Passwords don't match</span>
                    )}
                  </div>
                )}
              </div>

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
                    <button
                      type="button"
                      className="terms-link"
                      onClick={() => setShowTermsModal(true)}
                    >
                      Terms and Conditions
                    </button>
                  </span>
                </label>
                {errors.agreeToTerms && (
                  <div className="form-error">{errors.agreeToTerms}</div>
                )}
              </div>

              <Button type="submit" disabled={loading} style={{ width: '100%' }}>
                {loading ? 'Creating Account...' : 'Create Account'}
              </Button>
            </form>

            <div className="auth-footer">
              Already have an account? <Link to="/login" className="link-primary">Login</Link>
            </div>
          </Card>
        </div>
      </div>

      <TermsModal isOpen={showTermsModal} onClose={() => setShowTermsModal(false)} />
    </div>
  );
}
