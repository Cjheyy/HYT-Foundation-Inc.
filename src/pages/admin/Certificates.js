import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { formatDate } from '../../utils/helpers';

export function AdminCertificates() {
  const { state } = useApp();
  const { certificates, users } = state;

  return (
    <div>
      <h1 className="page-title">Certificates</h1>

      <div style={{ display: 'grid', gap: '16px' }}>
        {certificates.map((cert) => {
          const student = users.find(u => u.id === cert.studentId);
          return (
            <Card key={cert.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{student?.fullName}</h3>
                  <p style={{ color: 'var(--muted-text)', marginTop: '4px' }}>{cert.programTitle}</p>
                  <p style={{ fontSize: '13px', color: 'var(--muted-text)', marginTop: '4px' }}>
                    ID: {cert.certificateId}
                  </p>
                  <p style={{ fontSize: '13px', color: 'var(--muted-text)' }}>
                    Issued: {formatDate(cert.issuedDate)}
                  </p>
                </div>
                <Badge status="Available">Available</Badge>
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
