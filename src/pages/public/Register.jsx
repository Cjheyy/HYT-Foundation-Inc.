import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/Button';
import { AuthBrandRail } from '../../components/AuthBrandRail';
import { RegisterWizard } from '../../components/RegisterWizard';
import './Auth.css';

/**
 * Registration happens inside a stepped dialog (see RegisterWizard) rather than
 * on one long scrolling page.  The branded shell stays behind it as a backdrop,
 * and gives anyone who dismisses the dialog a way back in instead of a dead end.
 */
export function Register() {
  const [wizardOpen, setWizardOpen] = useState(true);

  return (
    <div className="auth-page">
      <div className="auth-shell">
        <AuthBrandRail
          description="Create your account to apply for OJT postings, join trainee programs, and track your rendered hours."
          points={[
            'Free to register — approval is only needed to apply',
            'One account for programs, attendance and certificates',
            'Gmail address required for verification'
          ]}
        />

        <main className="auth-panel">
          <div className="auth-panel-inner">
            <div className="auth-header">
              <h2 className="auth-title">Create Account</h2>
              <p className="auth-subtitle">
                Registration takes about two minutes and is split into three short steps.
              </p>
            </div>

            <Button onClick={() => setWizardOpen(true)} className="auth-submit">
              Start Registration
            </Button>

            <div className="auth-footer">
              Already have an account? <Link to="/login" className="link-primary">Login</Link>
            </div>
          </div>
        </main>
      </div>

      {wizardOpen && <RegisterWizard onClose={() => setWizardOpen(false)} />}
    </div>
  );
}
