import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { login } from '../../services/authService';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import hytLogo from '../../assets/HYT.png';
import './Login.css';
import '../../components/Logo.css';

export function Login() {
  const { dispatch } = useApp();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    accountType: '', // 'trainee' or 'ojt-student'
    email: '',
    password: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    // Only validate email and password - accountType is optional for ADMIN
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Clear any previous errors
    setErrors({});
    
    // Validate only email and password
    const newErrors = validate();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    try {
      // Step 1: Authenticate with Supabase (credentials only)
      // Step 2: authService will fetch user role and handle bypass logic
      const user = await login(formData.email, formData.password, formData.accountType);
      
      if (user) {
        dispatch({ type: 'SET_CURRENT_USER', payload: user });
        
        // Automatic dashboard redirection based on role
        if (user.role === 'ADMIN') {
          navigate('/admin/dashboard');
        } else if (user.role === 'OJT/Intern') {
          navigate('/student/dashboard');
        } else if (user.role === 'Trainee') {
          navigate('/trainee/dashboard');
        } else {
          // Fallback for unknown roles
          navigate('/');
        }
      }
    } catch (error) {
      console.error('Login error:', error);
      setErrors({ general: error.message || 'Login failed. Please check your credentials.' });
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
              <h2 className="auth-title">Welcome Back</h2>
              <p className="auth-subtitle">Login to your HYT Foundation account</p>
            </div>

            {errors.general && (
              <div className="alert alert-error">{errors.general}</div>
            )}

            <form onSubmit={handleSubmit} className="auth-form">
              <div className="form-group">
                <label className="form-label">Login as (Optional for Admin)</label>
                <div className="account-type-selection">
                  <label className="account-type-card">
                    <input
                      type="radio"
                      name="accountType"
                      value="trainee"
                      checked={formData.accountType === 'trainee'}
                      onChange={handleChange}
                    />
                    <div className="account-type-content">
                      <div className="account-type-icon">🎓</div>
                      <div className="account-type-label">Trainee</div>
                    </div>
                  </label>
                  <label className="account-type-card">
                    <input
                      type="radio"
                      name="accountType"
                      value="ojt-student"
                      checked={formData.accountType === 'ojt-student'}
                      onChange={handleChange}
                    />
                    <div className="account-type-content">
                      <div className="account-type-icon">💼</div>
                      <div className="account-type-label">OJT Student</div>
                    </div>
                  </label>
                </div>
                <p className="form-hint" style={{ fontSize: '12px', color: '#666', marginTop: '8px' }}>
                  Admin users can login without selecting an account type
                </p>
              </div>

              <Input
                label="Email Address"
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
              </div>

              <div className="form-footer">
                <Link to="/forgot-password" className="link">Forgot password?</Link>
              </div>

              <Button 
                type="submit" 
                disabled={loading} 
                className="login-submit-button"
                style={{ width: '100%', fontSize: '18px', padding: '16px', fontWeight: '700' }}
              >
                {loading ? 'Logging in...' : 'Login'}
              </Button>
            </form>

            <div className="auth-footer">
              Don't have an account? <Link to="/register" className="link-primary">Create Account</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
