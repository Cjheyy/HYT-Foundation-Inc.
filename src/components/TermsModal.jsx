import { Modal } from './Modal';
import './TermsModal.css';

export function TermsModal({ isOpen, onClose }) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Terms and Conditions">
      <div className="terms-content">
        <p className="terms-intro">
          Please read these Terms and Conditions carefully before using the HYT Foundation platform.
        </p>

        <section className="terms-section">
          <h3>1. Acceptance of Terms</h3>
          <p>
            By accessing and using this platform, you accept and agree to be bound by the terms and provision of this agreement. 
            If you do not agree to abide by the above, please do not use this service.
          </p>
        </section>

        <section className="terms-section">
          <h3>2. Use License</h3>
          <p>
            Permission is granted to temporarily access the materials (information or software) on HYT Foundation's platform 
            for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.
          </p>
          <p>Under this license you may not:</p>
          <ul>
            <li>Modify or copy the materials</li>
            <li>Use the materials for any commercial purpose or for any public display</li>
            <li>Attempt to reverse engineer any software contained on the platform</li>
            <li>Remove any copyright or other proprietary notations from the materials</li>
            <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>3. User Account and Registration</h3>
          <p>
            To access certain features of the platform, you must register for an account. You agree to:
          </p>
          <ul>
            <li>Provide accurate, current, and complete information during registration</li>
            <li>Maintain and promptly update your account information</li>
            <li>Maintain the security and confidentiality of your password</li>
            <li>Notify us immediately of any unauthorized use of your account</li>
            <li>Accept responsibility for all activities that occur under your account</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>4. Data Privacy and Protection</h3>
          <p>
            We collect and process your personal information in accordance with the Data Privacy Act of 2012. 
            Your information will be used solely for program management, communication, and improvement of our services.
          </p>
          <p>We collect the following information:</p>
          <ul>
            <li>Personal details (name, birthday, age, address)</li>
            <li>Academic information (school, student ID, course, year level)</li>
            <li>Contact information (email, phone number)</li>
            <li>Program participation data (applications, attendance, reports)</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>5. Program Participation</h3>
          <p>
            As a participant in HYT Foundation programs, you agree to:
          </p>
          <ul>
            <li>Attend all required sessions and activities</li>
            <li>Submit accurate and timely reports and requirements</li>
            <li>Maintain professional conduct and respect for others</li>
            <li>Follow the rules and guidelines of partner organizations</li>
            <li>Complete the full duration of programs you commit to</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>6. Code of Conduct</h3>
          <p>
            Users must conduct themselves in a professional and respectful manner. Prohibited activities include:
          </p>
          <ul>
            <li>Harassment, discrimination, or bullying of any kind</li>
            <li>Misrepresentation of information or credentials</li>
            <li>Sharing of false or misleading information</li>
            <li>Violation of intellectual property rights</li>
            <li>Any illegal activities or violations of applicable laws</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>7. Attendance and Time Tracking</h3>
          <p>
            For OJT and internship programs, accurate attendance tracking is required. You consent to:
          </p>
          <ul>
            <li>Location-based attendance verification using device geolocation</li>
            <li>Time-stamped check-in and check-out records</li>
            <li>Submission of daily reports and activity logs</li>
            <li>Verification of attendance by program supervisors</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>8. Intellectual Property</h3>
          <p>
            All content, materials, and intellectual property created during program participation may be subject 
            to joint ownership between you, HYT Foundation, and partner organizations, as specified in individual program agreements.
          </p>
        </section>

        <section className="terms-section">
          <h3>9. Limitation of Liability</h3>
          <p>
            HYT Foundation shall not be liable for any damages arising from the use of this platform or participation 
            in programs, except as required by law. This includes but is not limited to direct, indirect, incidental, 
            punitive, and consequential damages.
          </p>
        </section>

        <section className="terms-section">
          <h3>10. Program Termination</h3>
          <p>
            HYT Foundation reserves the right to terminate your access to the platform or participation in programs if:
          </p>
          <ul>
            <li>You violate these Terms and Conditions</li>
            <li>You fail to meet program requirements</li>
            <li>Your conduct is detrimental to the program or other participants</li>
            <li>You provide false or misleading information</li>
          </ul>
        </section>

        <section className="terms-section">
          <h3>11. Modifications</h3>
          <p>
            HYT Foundation may revise these Terms and Conditions at any time without notice. By using this platform, 
            you agree to be bound by the current version of these Terms and Conditions.
          </p>
        </section>

        <section className="terms-section">
          <h3>12. Governing Law</h3>
          <p>
            These Terms and Conditions are governed by and construed in accordance with the laws of the Republic of the Philippines, 
            and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
          </p>
        </section>

        <section className="terms-section">
          <h3>13. Contact Information</h3>
          <p>
            If you have any questions about these Terms and Conditions, please contact us at:
          </p>
          <p>
            <strong>Email:</strong> info@hyt-foundation.org<br />
            <strong>Phone:</strong> +63 2 1234 5678<br />
            <strong>Address:</strong> Quezon City, Metro Manila, Philippines
          </p>
        </section>

        <section className="terms-section">
          <h3>14. Acknowledgment</h3>
          <p>
            By checking the "I agree to the Terms and Conditions" box during registration, you acknowledge that you have read, 
            understood, and agree to be bound by these Terms and Conditions.
          </p>
        </section>

        <p className="terms-footer">
          <strong>Last Updated:</strong> September 15, 2026<br />
          <strong>Effective Date:</strong> September 15, 2026
        </p>
      </div>
    </Modal>
  );
}
