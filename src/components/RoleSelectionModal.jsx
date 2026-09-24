import { useState } from 'react';
import { Card } from './Card';
import { Button } from './Button';
import './RoleSelectionModal.css';

export function RoleSelectionModal({ onRoleSelect, onClose }) {
  const [selectedRole, setSelectedRole] = useState(null);
  const [showGuidance, setShowGuidance] = useState(false);

  const roles = {
    'ojt-student': {
      title: 'OJT / Intern',
      icon: '💼',
      color: '#667eea',
      description: 'For students fulfilling required internship hours',
      requirements: [
        '✓ Must complete 486 required hours',
        '✓ School Endorsement Letter required',
        '✓ Daily attendance logs (Clock-in/Clock-out)',
        '✓ Daily logbook/report submissions',
        '✓ Strict 8:55 AM - 6:05 PM attendance window',
        '✓ Subject to school and HYT Foundation guidelines',
        '✓ Certificate of Completion upon fulfillment'
      ],
      commitment: 'Full commitment to complete internship requirements as mandated by your educational institution.'
    },
    'trainee': {
      title: 'Trainee',
      icon: '🎓',
      color: '#764ba2',
      description: 'For community skill development and growth',
      requirements: [
        '✓ Flexible participation schedule',
        '✓ Access to skill development programs',
        '✓ Event and workshop participation',
        '✓ Community engagement opportunities',
        '✓ Mentorship and guidance programs',
        '✓ Portfolio building support',
        '✓ Certificate of Participation available'
      ],
      commitment: 'Active participation in community programs and continuous learning mindset.'
    }
  };

  const handleRoleClick = (roleKey) => {
    setSelectedRole(roleKey);
    setShowGuidance(true);
  };

  const handleBack = () => {
    setShowGuidance(false);
    setSelectedRole(null);
  };

  const handleConfirm = () => {
    if (selectedRole) {
      onRoleSelect(selectedRole);
    }
  };

  if (!showGuidance) {
    return (
      <div className="role-modal-overlay">
        <Card className="role-modal-card">
          <div className="role-modal-header">
            <h2 className="role-modal-title">Choose Your Path</h2>
            <p className="role-modal-subtitle">
              Select the type of account that best describes your purpose
            </p>
          </div>

          <div className="role-selection-grid">
            {Object.entries(roles).map(([key, role]) => (
              <button
                key={key}
                className="role-option-card"
                onClick={() => handleRoleClick(key)}
                style={{ '--role-color': role.color }}
              >
                <div className="role-option-icon">{role.icon}</div>
                <h3 className="role-option-title">{role.title}</h3>
                <p className="role-option-description">{role.description}</p>
                <div className="role-option-arrow">→</div>
              </button>
            ))}
          </div>

          {onClose && (
            <div className="role-modal-footer">
              <button onClick={onClose} className="role-modal-link">
                ← Back to Login
              </button>
            </div>
          )}
        </Card>
      </div>
    );
  }

  const role = roles[selectedRole];

  return (
    <div className="role-modal-overlay">
      <Card className="role-modal-card guidance-card">
        <div className="role-modal-header">
          <div className="guidance-icon" style={{ background: role.color }}>
            {role.icon}
          </div>
          <h2 className="role-modal-title">{role.title}</h2>
          <p className="role-modal-subtitle">{role.description}</p>
        </div>

        <div className="guidance-content">
          <div className="guidance-section">
            <h3 className="guidance-section-title">Requirements & Expectations</h3>
            <ul className="guidance-requirements">
              {role.requirements.map((req, index) => (
                <li key={index}>{req}</li>
              ))}
            </ul>
          </div>

          <div className="guidance-commitment">
            <div className="commitment-icon">⚠️</div>
            <div className="commitment-text">
              <strong>Commitment Required:</strong>
              <p>{role.commitment}</p>
            </div>
          </div>

          <div className="guidance-notice">
            <p>
              By proceeding, you acknowledge that you have read and understood the requirements above
              and agree to fulfill all expectations as a <strong>{role.title}</strong> at HYT Foundation.
            </p>
          </div>
        </div>

        <div className="guidance-actions">
          <Button
            variant="secondary"
            onClick={handleBack}
            style={{ flex: 1 }}
          >
            ← Back
          </Button>
          <Button
            onClick={handleConfirm}
            style={{ 
              flex: 2,
              background: role.color
            }}
          >
            I Understand & Agree
          </Button>
        </div>
      </Card>
    </div>
  );
}
