import { Modal } from './Modal';
import { Button } from './Button';
import './OnboardingModal.css';

export function OnboardingModal({ isOpen, onClose, onProceed, type }) {
  const content = {
    'OJT/Intern': {
      title: 'OJT / Intern Program',
      icon: 'OJT',
      description: 'Academic Requirements & What You Need to Know',
      requirements: [
        {
          title: 'School Endorsement',
          description: 'You must have an official endorsement letter from your school or university.',
          icon: 'SE'
        },
        {
          title: 'Hour Tracking',
          description: 'You are required to complete a specific number of hours (e.g., 486 hours). We track your daily attendance with clock in/out.',
          icon: 'HT'
        },
        {
          title: 'Logbook Submissions',
          description: 'Daily accomplishment reports are mandatory. You must document your tasks, learnings, and progress.',
          icon: 'LB'
        },
        {
          title: 'Performance Evaluation',
          description: 'Your work will be reviewed by our admin team. Approvals are required for attendance, overtime, and reports.',
          icon: 'PE'
        },
        {
          title: 'Certificate Upon Completion',
          description: 'After completing your required hours and meeting all requirements, you will receive an official certificate.',
          icon: 'CT'
        }
      ],
      footer: 'By proceeding, you confirm that you meet these academic requirements and understand the commitment involved.'
    },
    'Trainee': {
      title: 'Trainee Program',
      icon: 'TRN',
      description: 'Community Learning & Skill Development',
      requirements: [
        {
          title: 'Open to Community',
          description: 'This program is designed for community members seeking skill development and professional growth.',
          icon: 'OC'
        },
        {
          title: 'Flexible Learning',
          description: 'No strict hour requirements, but attendance tracking helps monitor your participation and commitment.',
          icon: 'FL'
        },
        {
          title: 'Hands-On Experience',
          description: 'Learn by doing. Participate in real projects and gain practical skills under HYT Foundation mentorship.',
          icon: 'HE'
        },
        {
          title: 'Progress Tracking',
          description: 'Submit daily reports to track your learning journey and document your skill development.',
          icon: 'PT'
        },
        {
          title: 'Community Impact',
          description: 'Contribute to meaningful projects that benefit the community while building your portfolio.',
          icon: 'CI'
        }
      ],
      footer: 'By proceeding, you commit to active participation and continuous learning throughout the program.'
    }
  };

  const data = content[type] || content['OJT/Intern'];

  return (
    <Modal 
      isOpen={isOpen} 
      onClose={onClose} 
      title={data.title}
      size="lg"
      className="onboarding-modal"
    >
      <div className="onboarding-content">
        <div className="onboarding-header">
          <div className="onboarding-icon">{data.icon}</div>
          <h3 className="onboarding-description">{data.description}</h3>
        </div>

        <div className="onboarding-requirements">
          {data.requirements.map((req, index) => (
            <div key={index} className="requirement-item">
              <div className="requirement-icon">{req.icon}</div>
              <div className="requirement-content">
                <h4 className="requirement-title">{req.title}</h4>
                <p className="requirement-description">{req.description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="onboarding-footer">
          <p className="onboarding-notice">{data.footer}</p>
          
          <div className="onboarding-actions">
            <Button variant="outline" onClick={onClose}>
              Go Back
            </Button>
            <Button onClick={onProceed}>
              I Understand, Proceed to Registration
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
