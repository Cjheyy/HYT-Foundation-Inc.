import { useNavigate } from 'react-router-dom';
import { Modal } from './Modal';
import { Button } from './Button';
import './SignInWall.css';

export function SignInWall({ isOpen, onClose, targetAction = 'apply' }) {
  const navigate = useNavigate();

  const handleLogin = () => {
    onClose();
    navigate('/login');
  };

  const handleRegister = () => {
    onClose();
    navigate('/register');
  };

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title="Sign In Required"
      className="signin-wall-modal"
    >
      <div className="signin-wall-content">
        <div className="signin-wall-icon">🔒</div>
        
        <h3 className="signin-wall-title">
          {targetAction === 'apply' 
            ? 'Login to Apply' 
            : 'Login to Access'}
        </h3>
        
        <p className="signin-wall-message">
          {targetAction === 'apply' 
            ? 'You need to be logged in to apply for this opportunity. Please sign in or create a free account to continue.' 
            : 'You need to be logged in to access this feature. Please sign in or create a free account to continue.'}
        </p>

        <div className="signin-wall-actions">
          <Button onClick={handleLogin} fullWidth>
            Sign In
          </Button>
          <Button variant="outline" onClick={handleRegister} fullWidth>
            Create Account
          </Button>
        </div>

        <div className="signin-wall-benefits">
          <p className="benefits-title">Why create an account?</p>
          <ul className="benefits-list">
            <li>✓ Apply to multiple opportunities</li>
            <li>✓ Track your applications and progress</li>
            <li>✓ Get personalized recommendations</li>
            <li>✓ Connect with mentors and peers</li>
            <li>✓ Earn certificates upon completion</li>
          </ul>
        </div>
      </div>
    </Modal>
  );
}
