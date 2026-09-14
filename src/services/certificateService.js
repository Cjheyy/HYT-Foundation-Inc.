export function createCertificate(data) {
  const certificateId = `CERT-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  
  return {
    id: `certificate-${Date.now()}`,
    certificateId,
    ...data,
    status: 'Available',
    issuedDate: new Date().toISOString(),
    createdAt: new Date().toISOString()
  };
}

export function getCertificateByStudent(certificates, studentId) {
  return certificates.filter(cert => cert.studentId === studentId);
}

export function canGenerateCertificate(ojtRecord) {
  return ojtRecord?.status === 'Completed';
}
