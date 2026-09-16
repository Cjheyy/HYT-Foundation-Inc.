import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { login } from '../../services/authService';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { showToast } from '../../utils/notifications';
import hytLogo from '../../assets/HYT.png';
import './Login.css';
import '../../components/Logo.css';

export function Login() {
  const { state, dispatch } = useApp();
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
    if (!formData.accountType) newErrors.accountType = 'Please select account type';
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
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
      const user = login(formData.email, formData.password, state.users);
      
      if (user) {
        dispatch({ type: 'SET_CURRENT_USER', payload: user });
        showToast('Login successful!', 'success');
        
        // Redirect based on role
        if (user.role === 'STUDENT') {
          navigate('/student');
        } else if (user.role === 'ADMIN') {
          navigate('/admin');
        }
      } else {
        setErrors({ general: 'Invalid email or password' });
      }
    } catch (error) {
      setErrors({ general: error.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role) => {
    const demoCredentials = {
      STUDENT: { email: 'christian.jay@hyt-demo.com', password: 'demo123' },
      ADMIN: { email: 'admin@hyt-foundation.org', password: 'admin123' }
    };

    const creds = demoCredentials[role];
    setFormData(creds);
    
    const user = login(creds.email, creds.password, state.users);
    if (user) {
      dispatch({ type: 'SET_CURRENT_USER', payload: user });
      showToast('Demo login successful!', 'success');
      navigate(role === 'STUDENT' ? '/student' : '/admin');
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
                <label className="form-label">Login as *</label>
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
                {errors.accountType && (
                  <div className="form-error">{errors.accountType}</div>
                )}
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

            <div className="auth-divider">
              <span>Demo Accounts</span>
            </div>

            <div className="demo-buttons">
              <Button 
                variant="outline" 
                onClick={() => handleDemoLogin('STUDENT')}
                style={{ width: '100%' }}
              >
                Login as Student (Demo)
              </Button>
              <Button 
                variant="outline" 
                onClick={() => handleDemoLogin('ADMIN')}
                style={{ width: '100%' }}
              >
                Login as Admin (Demo)
              </Button>
            </div>

            <div className="auth-footer">
              Don't have an account? <Link to="/register" className="link-primary">Create Account</Link>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
