import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Icon } from '../../components/icons';
import { formatDate } from '../../utils/helpers';
import { CERTIFICATE_TYPES, HYT_BRANDING } from '../../utils/helpers';
import {
  buildCertificatePayload,
  buildCertificateHtml,
  buildCertificateEmailBody
} from '../../services/certificateService';
import { getUserByEmail, issueCertificateRecord } from '../../services/supabaseService';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';

const emptyForm = {
  studentName: '',
  recipientEmail: '',
  certificateType: 'OJT Completion with Hours',
  hoursCompleted: '',
  signatoryTwoName: '',
  signatoryTwoTitle: ''
};

export function AdminCertificates() {
  const { state, dispatch, refreshData } = useApp();
  const { certificates, users, currentUser } = state;
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [issuing, setIssuing] = useState(false);
  const [previewCert, setPreviewCert] = useState(null);
  const [emailPreview, setEmailPreview] = useState(null);

  const sortedCertificates = useMemo(
    () => [...(certificates || [])].sort((a, b) => new Date(b.issueDate || b.createdAt || 0) - new Date(a.issueDate || a.createdAt || 0)),
    [certificates]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const closeModal = (force = false) => {
    if (issuing && !force) return;
    setShowModal(false);
    setFormData(emptyForm);
    setErrors({});
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.studentName.trim()) nextErrors.studentName = 'Student name is required';
    if (!formData.recipientEmail.trim()) nextErrors.recipientEmail = 'Registered email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.recipientEmail.trim())) {
      nextErrors.recipientEmail = 'Enter a valid email address';
    }
    if (!formData.certificateType) nextErrors.certificateType = 'Select a certificate type';
    if (formData.certificateType === 'OJT Completion with Hours' && formData.hoursCompleted !== '' && Number(formData.hoursCompleted) < 0) {
      nextErrors.hoursCompleted = 'Hours cannot be negative';
    }
    return nextErrors;
  };

  const handleIssue = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }
    setIssuing(true);
    try {
      const email = formData.recipientEmail.trim();
      let student = null;
      try {
        student = await getUserByEmail(email);
      } catch (lookupError) {
        console.warn('Certificate recipient lookup failed, issuing by email only.', lookupError);
      }
      const payload = buildCertificatePayload({
        student: student || { fullName: formData.studentName.trim(), email },
        email,
        certificateType: formData.certificateType,
        hoursCompleted: formData.hoursCompleted === '' ? null : Number(formData.hoursCompleted),
        signatoryTwoName: formData.signatoryTwoName.trim(),
        signatoryTwoTitle: formData.signatoryTwoTitle.trim(),
        issuedBy: currentUser?.id || null
      });
      // Prefer the official registered name when the admin typed a variant.
      if (student?.fullName && !formData.studentName) payload.studentName = student.fullName;
      payload.studentName = formData.studentName.trim() || student?.fullName || payload.studentName;

      const saved = await issueCertificateRecord(payload);
      dispatch({ type: 'ADD_CERTIFICATE', payload: saved });
      showToast(`Certificate issued to ${payload.studentName} and added to their dashboard.`, 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      setPreviewCert({ ...payload, ...saved });
      setEmailPreview(buildCertificateEmailBody(payload));
      closeModal(true);
      setFormData(emptyForm);
    } catch (error) {
      console.error('Issue certificate failed:', error);
      showToast(error.message || 'Failed to issue certificate.', 'error');
    } finally {
      setIssuing(false);
    }
  };

  const handleView = (cert) => {
    const student = users.find((u) => u.id === (cert.studentId || cert.student_id));
    const payload = {
      studentName: cert.recipientName || cert.recipient_name || student?.fullName || cert.studentName || 'Recipient',
      schoolName: student?.school || cert.school || '',
      recipientEmail: cert.recipientEmail || cert.recipient_email || student?.email || '',
      certificateType: cert.certificateType || cert.certificate_type || cert.type || cert.templateUsed || 'Completion',
      certificateNumber: cert.certificateNumber || cert.certificate_number || cert.certificateId || cert.id,
      issueDate: cert.issueDate || cert.issue_date || cert.createdAt,
      hoursCompleted: cert.hoursCompleted ?? cert.hours_completed ?? student?.renderedHours ?? null,
      signatoryTwoName: cert.signatoryTwoName || cert.signatory_two_name || '',
      signatoryTwoTitle: cert.signatoryTwoTitle || cert.signatory_two_title || ''
    };
    setPreviewCert({ ...payload, ...cert });
    setEmailPreview(buildCertificateEmailBody(payload));
  };

  const handleDownload = (cert) => {
    const student = users.find((u) => u.id === (cert.studentId || cert.student_id));
    const html = buildCertificateHtml({
      studentName: cert.studentName || cert.recipientName || cert.recipient_name || '',
      schoolName: student?.school || cert.school || '',
      recipientEmail: cert.recipientEmail || cert.recipient_email || cert.recipientEmail || '',
      certificateType: cert.certificateType || cert.certificate_type || cert.type || '',
      certificateNumber: cert.certificateNumber || cert.certificate_number || cert.certificateId || '',
      issueDate: cert.issueDate || cert.issue_date || '',
      hoursCompleted: cert.hoursCompleted ?? cert.hours_completed ?? student?.renderedHours ?? null,
      signatoryTwoName: cert.signatoryTwoName || cert.signatory_two_name || '',
      signatoryTwoTitle: cert.signatoryTwoTitle || cert.signatory_two_title || ''
    });
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(cert.certificateNumber || cert.certificate_number || 'certificate')}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 className="page-title">Certificates</h1>
          <p className="page-subtitle">Issue branded {HYT_BRANDING.organization} certificates by registered email. They appear instantly on the recipient dashboard.</p>
        </div>
        <Button onClick={() => setShowModal(true)}>Issue Certificate</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {sortedCertificates.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '32px' }}><p className="no-data">No certificates issued yet.</p></div></Card>
        ) : sortedCertificates.map((cert) => {
          const student = users.find((u) => u.id === (cert.studentId || cert.student_id));
          const displayName = cert.recipientName || cert.recipient_name || student?.fullName || cert.studentName || 'Recipient';
          const displayEmail = cert.recipientEmail || cert.recipient_email || student?.email || '';
          return (
            <Card key={cert.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{displayName}</h3>
                  <p style={{ color: 'var(--muted-text)', marginTop: '4px' }}>{cert.title || cert.programTitle}</p>
                  <p style={{ fontSize: '13px', color: 'var(--muted-text)', marginTop: '4px' }}>
                    {displayEmail} · ID: {cert.certificateNumber || cert.certificate_number || cert.certificateId}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--muted-text)' }}>
                    Issued: {formatDate(cert.issueDate || cert.issue_date || cert.issuedDate)} · {cert.certificateType || cert.certificate_type || cert.type}
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                  <Badge status="Available">Issued</Badge>
                  <Button size="sm" variant="outline" onClick={() => handleView(cert)}>View</Button>
                  <Button size="sm" onClick={() => handleDownload(cert)}>Download</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={showModal} onClose={() => closeModal()} title="Issue Formal Certificate">
        <form onSubmit={handleIssue} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input label="Student Name" name="studentName" value={formData.studentName} onChange={handleChange} error={errors.studentName} placeholder="e.g., Juan D. Cruz" required />
          <Input label="Registered Email Address" name="recipientEmail" type="email" value={formData.recipientEmail} onChange={handleChange} error={errors.recipientEmail} placeholder="student@example.com" required />
          <Select label="Certificate Type" name="certificateType" value={formData.certificateType} onChange={handleChange} error={errors.certificateType} options={CERTIFICATE_TYPES} required />
          {formData.certificateType === 'OJT Completion with Hours' && (
            <Input label="Verified Hours (optional)" name="hoursCompleted" type="number" min="0" value={formData.hoursCompleted} onChange={handleChange} error={errors.hoursCompleted} placeholder="e.g., 486" />
          )}
          <Input label="Second Signatory Name (optional)" name="signatoryTwoName" value={formData.signatoryTwoName} onChange={handleChange} placeholder="e.g., Program Director Name" help="Leave blank to use the default HYT Foundation signatory block." />
          <Input label="Second Signatory Title (optional)" name="signatoryTwoTitle" value={formData.signatoryTwoTitle} onChange={handleChange} placeholder="e.g., Program Director / Supervisor" />
          <div className="schedule-preview">
            Official sign-off: {HYT_BRANDING.founder}, {HYT_BRANDING.founderTitle}, {HYT_BRANDING.organization}.
          </div>
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" onClick={() => closeModal()} disabled={issuing}>Cancel</Button>
            <Button type="submit" disabled={issuing}>{issuing ? 'Issuing...' : 'Issue Certificate'}</Button>
          </div>
        </form>
      </Modal>

      <Modal isOpen={Boolean(previewCert)} onClose={() => { setPreviewCert(null); setEmailPreview(null); }} title="Certificate Preview" size="lg">
        {previewCert && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div
              className="certificate-preview-frame"
              // The HTML is generated locally by buildCertificateHtml with escaped
              // recipient values, so there is no untrusted markup to inject.
              dangerouslySetInnerHTML={{
                __html: buildCertificateHtml({
                  studentName: previewCert.studentName || previewCert.recipientName || previewCert.recipient_name || '',
                  schoolName: previewCert.school || '',
                  recipientEmail: previewCert.recipientEmail || previewCert.recipient_email || '',
                  certificateType: previewCert.certificateType || previewCert.certificate_type || previewCert.type || '',
                  certificateNumber: previewCert.certificateNumber || previewCert.certificate_number || previewCert.certificateId || '',
                  issueDate: previewCert.issueDate || previewCert.issue_date || '',
                  hoursCompleted: previewCert.hoursCompleted ?? previewCert.hours_completed ?? null,
                  signatoryTwoName: previewCert.signatoryTwoName || previewCert.signatory_two_name || '',
                  signatoryTwoTitle: previewCert.signatoryTwoTitle || previewCert.signatory_two_title || ''
                })
              }}
            />
            {emailPreview && (
              <div>
                <h4 style={{ fontSize: '14px', marginBottom: '8px' }}>Recipient email body</h4>
                <div className="certificate-preview-frame" dangerouslySetInnerHTML={{ __html: emailPreview }} />
              </div>
            )}
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
              <Button variant="outline" onClick={() => handleDownload(previewCert)}>
                <Icon name="award" size={15} /> Download
              </Button>
              <Button onClick={() => { setPreviewCert(null); setEmailPreview(null); }}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
