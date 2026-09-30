import { HYT_BRANDING } from '../utils/helpers';

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
  if (!studentId) return [];
  return (certificates || []).filter((cert) => cert.studentId === studentId || cert.student_id === studentId);
}

export function getCertificatesForUser(certificates, user) {
  if (!user) return [];
  const email = String(user.email || '').trim().toLowerCase();
  const id = user.id;
  return (certificates || []).filter((cert) => {
    const certEmail = String(cert.recipientEmail || cert.recipient_email || cert.email || '').trim().toLowerCase();
    if (id && (cert.studentId === id || cert.student_id === id)) return true;
    if (email && certEmail === email) return true;
    return false;
  });
}

export function canGenerateCertificate(ojtRecord) {
  return ojtRecord?.status === 'Completed';
}

export function buildCertificateNumber() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `HYT-${year}-${random}`;
}

export function buildCertificatePayload({ student, email, certificateType, hoursCompleted, signatoryTwoName, signatoryTwoTitle, issuedBy }) {
  const name = student?.fullName || student?.full_name || '';
  const school = student?.school || student?.university || '';
  const normalizedEmail = String(email || student?.email || '').trim();
  const hours = Number(hoursCompleted);
  const title = certificateType === 'OJT Completion with Hours'
    ? `OJT Completion Certificate — ${Number.isFinite(hours) && hours > 0 ? `${hours} Hours` : 'Verified Hours'}`
    : 'Trainee Skills Completion Certificate';
  const description = [
    `Recipient: ${name} <${normalizedEmail}>`,
    school ? `School: ${school}` : null,
    `Type: ${certificateType}`,
    Number.isFinite(hours) && hours > 0 ? `Verified hours: ${hours}` : null,
    `Issued by ${HYT_BRANDING.organization} — ${HYT_BRANDING.founder}, ${HYT_BRANDING.founderTitle}.`
  ].filter(Boolean).join(' | ');
  return {
    studentId: student?.id || null,
    studentName: name,
    school,
    recipientEmail: normalizedEmail,
    certificateType,
    title,
    description,
    certificateNumber: buildCertificateNumber(),
    issueDate: new Date().toISOString().slice(0, 10),
    hoursCompleted: Number.isFinite(hours) && hours > 0 ? hours : null,
    signatoryOneName: HYT_BRANDING.founder,
    signatoryOneTitle: HYT_BRANDING.founderTitle,
    signatoryTwoName: String(signatoryTwoName || '').trim() || null,
    signatoryTwoTitle: String(signatoryTwoTitle || '').trim() || null,
    issuedBy: issuedBy || null
  };
}

export function buildCertificateHtml({ studentName, schoolName, recipientEmail, certificateType, certificateNumber, issueDate, hoursCompleted, signatoryTwoName, signatoryTwoTitle }) {
  const formattedDate = issueDate
    ? new Date(`${String(issueDate).slice(0, 10)}T00:00:00`).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
    : new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const hoursText = Number(hoursCompleted) > 0 ? `Completed ${Number(hoursCompleted).toFixed(2)} Hours of On-the-Job Training` : null;
  const schoolLine = schoolName ? ` from <strong>${escapeHtml(schoolName)}</strong>` : '';
  const secondSignatory = signatoryTwoName
    ? `<div class="hyt-cert-sign"><div class="hyt-cert-sign-name">${escapeHtml(signatoryTwoName)}</div><div class="hyt-cert-sign-title">${escapeHtml(signatoryTwoTitle || 'Program Director')}</div></div>`
    : `<div class="hyt-cert-sign"><div class="hyt-cert-sign-name">Program Director</div><div class="hyt-cert-sign-title">HYT Foundation Inc.</div></div>`;
  return `<!doctype html><html><head><meta charset="utf-8" /><title>${escapeHtml(certificateNumber || 'Certificate')}</title><style>
    @page{size:A4 landscape;margin:10mm;}
    body{font-family:Georgia,'Times New Roman',serif;background:#f3f4f6;margin:0;padding:24px;}
    .hyt-cert{max-width:760px;margin:0 auto;background:#fff;border:10px double #D57156;border-radius:8px;padding:48px 44px;text-align:center;color:#1f2937;}
    .hyt-cert-org{font-size:13px;letter-spacing:3px;text-transform:uppercase;color:#D57156;font-weight:700;}
    .hyt-cert-title{font-size:40px;margin:12px 0 4px;}
    .hyt-cert-sub{font-size:14px;color:#6b7280;}
    .hyt-cert-name{font-size:32px;margin:24px 0 8px;font-style:italic;}
    .hyt-cert-body{font-size:15px;line-height:1.7;max-width:560px;margin:0 auto;}
    .hyt-cert-meta{margin-top:18px;font-size:12px;color:#6b7280;}
    .hyt-cert-signs{display:flex;justify-content:space-between;gap:24px;margin-top:44px;text-align:center;}
    .hyt-cert-sign{flex:1;border-top:2px solid #1f2937;padding-top:8px;}
    .hyt-cert-sign-name{font-weight:700;}
    .hyt-cert-sign-title{font-size:12px;color:#6b7280;}
    /* Printing (Print / Save as PDF) drops the grey page backdrop so the
       certificate fills the sheet instead of sitting on a grey rectangle. */
    @media print{
      body{background:#fff;padding:0;}
      .hyt-cert{max-width:none;margin:0;border-width:8px;box-shadow:none;padding:40px 36px;}
    }
  </style></head><body><div class="hyt-cert">
    <div class="hyt-cert-org">${escapeHtml(HYT_BRANDING.organization)} — ${escapeHtml(HYT_BRANDING.tagline)}</div>
    <div class="hyt-cert-title">Certificate of Completion</div>
    <div class="hyt-cert-sub">${escapeHtml(certificateType || 'Program Completion')} · No. ${escapeHtml(certificateNumber || '')}</div>
    <div class="hyt-cert-name">${escapeHtml(studentName || '')}</div>
    <div class="hyt-cert-body">This certificate is proudly presented to <strong>${escapeHtml(studentName || '')}</strong>${schoolLine} for successfully completing ${hoursText ? `<strong>${escapeHtml(hoursText)}</strong>` : 'the program requirements'} requirements under ${escapeHtml(HYT_BRANDING.organization)}.</div>
    <div class="hyt-cert-meta">Issued on ${escapeHtml(formattedDate)}</div>
    <div class="hyt-cert-signs">
      <div class="hyt-cert-sign"><div class="hyt-cert-sign-name">${escapeHtml(HYT_BRANDING.founder)}</div><div class="hyt-cert-sign-title">${escapeHtml(HYT_BRANDING.founderTitle)}</div></div>
      ${secondSignatory}
    </div>
  </div></body></html>`;
}

export function buildCertificateEmailBody({ studentName, certificateType, certificateNumber, issueDate }) {
  return `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;color:#1f2937;">`
    + `<div style="background:linear-gradient(135deg,#D57156,#279EB6);padding:20px;color:#fff;border-radius:12px 12px 0 0;">`
    + `<h2 style="margin:0;">${escapeHtml(HYT_BRANDING.organization)}</h2>`
    + `<p style="margin:4px 0 0;font-size:13px;">${escapeHtml(HYT_BRANDING.tagline)}</p></div>`
    + `<div style="border:1px solid #e5e7eb;border-top:none;padding:24px;border-radius:0 0 12px 12px;">`
    + `<p>Dear ${escapeHtml(studentName || 'Trainee')},</p>`
    + `<p>Congratulations. Your <strong>${escapeHtml(certificateType || 'completion')}</strong> certificate has been issued.</p>`
    + `<p style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:12px;">Certificate No.: <strong>${escapeHtml(certificateNumber || '')}</strong><br/>Issued: ${escapeHtml(issueDate || '')}</p>`
    + `<p>You can now view and download it from your dashboard under <strong>Certificates</strong>.</p>`
    + `<p style="margin-top:20px;">Respectfully,<br/><strong>${escapeHtml(HYT_BRANDING.founder)}</strong><br/>${escapeHtml(HYT_BRANDING.founderTitle)}, ${escapeHtml(HYT_BRANDING.organization)}</p>`
    + `</div></div>`;
}

function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
}
