import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { Icon } from '../../components/icons';
import { getCertificatesForUser, buildCertificateHtml } from '../../services/certificateService';
import { formatDate } from '../../utils/helpers';
import { printHtmlDocument } from '../../utils/printDocument';
import { showToast } from '../../utils/notifications';
import './Certificates.css';

/** Every field is read from whichever column spelling the row actually has. */
function buildPayload(cert, currentUser) {
  return {
    studentName: cert.recipientName || cert.recipient_name || cert.studentName || currentUser?.fullName || '',
    recipientEmail: cert.recipientEmail || cert.recipient_email || currentUser?.email || '',
    certificateType: cert.certificateType || cert.certificate_type || cert.type || cert.templateUsed || '',
    certificateNumber: cert.certificateNumber || cert.certificate_number || cert.certificateId || cert.id || '',
    issueDate: cert.issueDate || cert.issue_date || cert.createdAt || '',
    hoursCompleted: cert.hoursCompleted ?? cert.hours_completed ?? null,
    signatoryTwoName: cert.signatoryTwoName || cert.signatory_two_name || '',
    signatoryTwoTitle: cert.signatoryTwoTitle || cert.signatory_two_title || ''
  };
}

const certificateFileName = (cert) =>
  `${cert.certificateNumber || cert.certificate_number || cert.certificateId || 'certificate'}`;

export function StudentCertificates() {
  const { state } = useApp();
  const { currentUser, certificates, dataLoading } = state;
  const [previewCert, setPreviewCert] = useState(null);

  const myCertificates = useMemo(
    () => getCertificatesForUser(certificates, currentUser),
    [certificates, currentUser]
  );

  const htmlFor = (cert) => buildCertificateHtml(buildPayload(cert, currentUser));

  /**
   * "Save as PDF" — renders the certificate into an off-screen iframe and opens
   * the browser's print dialog, where the destination can be set to
   * "Save as PDF".  That produces a real, printable PDF; the previous behaviour
   * only ever downloaded a `.html` file, which is not a certificate you can send
   * to an employer.
   */
  const handleSavePdf = (cert) => {
    const opened = printHtmlDocument(htmlFor(cert), {
      title: `Certificate ${certificateFileName(cert)}`
    });
    if (!opened) {
      showToast('Could not open the print dialog. Please allow pop-ups and try again.', 'error');
    }
  };

  const handleDownloadHtml = (cert) => {
    const blob = new Blob([htmlFor(cert)], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${certificateFileName(cert)}.html`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const handleCopyId = async (cert) => {
    const id = certificateFileName(cert);
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(id);
      } else {
        throw new Error('Clipboard unavailable');
      }
      showToast('Certificate ID copied.', 'success');
    } catch {
      showToast(`Certificate ID: ${id}`, 'info');
    }
  };

  if (dataLoading) {
    return (
      <div className="certificates-page">
        <Skeleton width="220px" height={30} style={{ marginBottom: 10 }} />
        <Skeleton width="60%" height={14} style={{ marginBottom: 20 }} />
        <div className="certificates-list">
          {Array.from({ length: 2 }).map((_, index) => (
            <Card key={index}>
              <Skeleton width="40%" height={20} style={{ marginBottom: 14 }} />
              <Skeleton width="80%" height={13} style={{ marginBottom: 7 }} />
              <Skeleton width="65%" height={13} style={{ marginBottom: 7 }} />
              <Skeleton width="50%" height={13} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="certificates-page">
      <h1 className="page-title">Certificates</h1>
      <p className="page-subtitle">
        Official certificates issued to {currentUser?.email || 'your registered email'} appear here automatically.
      </p>

      {myCertificates.length > 0 ? (
        <div className="certificates-list">
          {myCertificates.map((cert) => (
            <Card key={cert.id}>
              <div className="certificate-card-content">
                <div className="certificate-card-info">
                  <h3 className="certificate-card-title">
                    {cert.title || cert.programTitle || 'Completion Certificate'}
                  </h3>
                  <div className="certificate-card-details">
                    <div className="certificate-id-row">
                      <span><strong>Certificate ID:</strong> {certificateFileName(cert)}</span>
                      <button
                        type="button"
                        className="certificate-copy-id"
                        onClick={() => handleCopyId(cert)}
                      >
                        copy
                      </button>
                    </div>
                    <div><strong>Type:</strong> {cert.certificateType || cert.certificate_type || cert.type}</div>
                    <div><strong>Issued:</strong> {formatDate(cert.issueDate || cert.issue_date || cert.issuedDate)}</div>
                    {(cert.hoursCompleted ?? cert.hours_completed) && (
                      <div><strong>Verified Hours:</strong> {cert.hoursCompleted ?? cert.hours_completed}</div>
                    )}
                  </div>
                  <Badge status="Available">Available</Badge>
                </div>
                <div className="certificate-card-actions">
                  <Button size="sm" onClick={() => setPreviewCert(cert)}>
                    <Icon name="award" size={15} /> View Certificate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleSavePdf(cert)}>
                    Save as PDF
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownloadHtml(cert)}>
                    Download HTML
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="award"
          title="No Certificates Yet"
          message="Certificates will appear here automatically after an admin issues one to your registered email."
        />
      )}

      {myCertificates.length > 0 && (
        <p className="certificate-download-note">
          &ldquo;Save as PDF&rdquo; opens your browser&rsquo;s print dialog — choose
          &ldquo;Save as PDF&rdquo; as the destination. The HTML download keeps a
          self-contained copy that opens in any browser.
        </p>
      )}

      <Modal isOpen={Boolean(previewCert)} onClose={() => setPreviewCert(null)} title="Certificate" size="lg">
        {previewCert && (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div
              className="certificate-preview-frame"
              dangerouslySetInnerHTML={{ __html: htmlFor(previewCert) }}
            />
            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              <Button variant="outline" onClick={() => handleDownloadHtml(previewCert)}>Download HTML</Button>
              <Button variant="outline" onClick={() => handleSavePdf(previewCert)}>Save as PDF</Button>
              <Button onClick={() => setPreviewCert(null)}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
