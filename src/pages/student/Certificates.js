import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { getCertificateByStudent } from '../../services/certificateService';
import { formatDate } from '../../utils/helpers';

export function StudentCertificates() {
  const { state } = useApp();
  const { currentUser, certificates } = state;
  
  const myCertificates = getCertificateByStudent(certificates, currentUser?.id);

  const handleView = (cert) => {
    alert(`Certificate ID: ${cert.certificateId}\nThis would open a certificate preview`);
  };

  const handleDownload = (cert) => {
    alert('This would download the certificate as PDF');
  };

  return (
    <div>
      <h1 className="page-title">Certificates</h1>

      {myCertificates.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {myCertificates.map((cert) => (
            <Card key={cert.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start' }}>
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>
                    {cert.programTitle || 'OJT Completion Certificate'}
                  </h3>
                  <div style={{ display: 'grid', gap: '6px', fontSize: '14px', color: 'var(--muted-text)', marginBottom: '12px' }}>
                    <div><strong>Certificate ID:</strong> {cert.certificateId}</div>
                    <div><strong>Company:</strong> {cert.company}</div>
                    <div><strong>Issued:</strong> {formatDate(cert.issuedDate)}</div>
                    <div><strong>Completion Date:</strong> {formatDate(cert.completionDate)}</div>
                  </div>
                  <Badge status="Available">Available</Badge>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Button size="sm" onClick={() => handleView(cert)}>
                    View Certificate
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => handleDownload(cert)}>
                    Download
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="🏆"
          title="No Certificates Yet"
          message="Certificates will be available after completing your OJT program"
        />
      )}
    </div>
  );
}
