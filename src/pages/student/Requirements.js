import { useMemo, useRef, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { Icon } from '../../components/icons';
import { showToast } from '../../utils/notifications';
import { submitRequirement } from '../../services/requirementService';
import './Requirements.css';

const ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'];
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export function formatFileSize(bytes) {
  const value = Number(bytes);
  if (!Number.isFinite(value) || value <= 0) return '0 KB';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${(value / 1024).toFixed(0)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Reject a file before it reaches the (still local) submit path.
 * Returns '' when the file is acceptable, otherwise the message to show.
 */
export function validateRequirementFile(file) {
  if (!file) return 'Please choose a file.';
  const name = String(file.name || '').toLowerCase();
  const extensionOk = ACCEPTED_EXTENSIONS.some((extension) => name.endsWith(extension));
  const typeOk = ACCEPTED_TYPES.includes(String(file.type || '').toLowerCase());
  if (!extensionOk && !typeOk) return 'Only PDF, JPG or PNG files are accepted.';
  if (file.size === 0) return 'That file is empty.';
  if (file.size > MAX_FILE_BYTES) {
    return `That file is ${formatFileSize(file.size)} — the limit is 10 MB.`;
  }
  return '';
}

export function StudentRequirements() {
  const { state, dispatch } = useApp();
  const { currentUser, requirements, dataLoading } = state;

  const [selectedReq, setSelectedReq] = useState(null);
  const [file, setFile] = useState(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const inputRef = useRef(null);

  const myRequirements = useMemo(
    () => (requirements || []).filter((req) => req.studentId === currentUser?.id),
    [requirements, currentUser?.id]
  );

  const resetForm = () => {
    setSelectedReq(null);
    setFile(null);
    setError('');
    setDragging(false);
    // Clearing the input value lets the same file be re-picked after a remove.
    if (inputRef.current) inputRef.current.value = '';
  };

  const acceptFile = (candidate) => {
    const message = validateRequirementFile(candidate);
    if (message) {
      setError(message);
      setFile(null);
      return;
    }
    setError('');
    setFile(candidate);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    const dropped = event.dataTransfer?.files?.[0];
    if (dropped) acceptFile(dropped);
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    const message = validateRequirementFile(file);
    if (message) {
      setError(message);
      return;
    }
    // `submitRequirement` records the submission; the extra metadata lets an
    // admin see exactly which document was attached.
    const updated = submitRequirement(selectedReq, file.name);
    dispatch({
      type: 'UPDATE_REQUIREMENT',
      payload: {
        ...updated,
        status: 'Submitted',
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type || 'application/octet-stream'
      }
    });
    showToast('Requirement submitted successfully!', 'success');
    resetForm();
  };

  if (dataLoading) {
    return (
      <div className="requirements-page" role="status" aria-label="Loading your requirements">
        <Skeleton width="220px" height={30} style={{ marginBottom: 20 }} />
        <div className="requirements-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <Skeleton width="40%" height={16} style={{ marginBottom: 10 }} />
              <Skeleton width="70%" height={13} style={{ marginBottom: 14 }} />
              <Skeleton width="25%" height={26} radius={13} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="requirements-page">
      <h1 className="page-title">Requirements</h1>

      {myRequirements.length > 0 ? (
        <div className="requirements-list">
          {myRequirements.map((req) => (
            <Card key={req.id}>
              <div className="requirement-card-content">
                <div className="requirement-card-info">
                  <h3 className="requirement-card-title">{req.name}</h3>
                  <p className="requirement-card-description">{req.description}</p>
                  {req.fileName && (
                    <p className="requirement-card-description">
                      Submitted file: <strong>{req.fileName}</strong>
                      {req.fileSize ? ` · ${formatFileSize(req.fileSize)}` : ''}
                    </p>
                  )}
                  {req.adminRemarks && (
                    <p className="requirement-admin-remarks">Admin: {req.adminRemarks}</p>
                  )}
                </div>
                <div className="requirement-card-actions">
                  <Badge status={req.status}>{req.status}</Badge>
                  {['Required', 'Rejected'].includes(req.status) && (
                    <Button size="sm" onClick={() => setSelectedReq(req)}>
                      {req.status === 'Rejected' ? 'Resubmit' : 'Upload'}
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="file"
          title="No Requirements"
          message="Requirements will appear when you apply to opportunities"
        />
      )}

      <Modal
        isOpen={!!selectedReq}
        onClose={resetForm}
        title={selectedReq ? `Upload: ${selectedReq.name}` : 'Upload Requirement'}
        footer={
          <>
            <Button variant="outline" onClick={resetForm}>Cancel</Button>
            <Button onClick={handleSubmit}>Submit</Button>
          </>
        }
      >
        <form onSubmit={handleSubmit}>
          <label
            className={`requirement-dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={handleDrop}
          >
            <input
              ref={inputRef}
              type="file"
              className="requirement-dropzone-input"
              accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
              onChange={(event) => {
                const picked = event.target.files?.[0];
                if (picked) acceptFile(picked);
              }}
            />
            <span className="requirement-dropzone-icon"><Icon name="inbox" size={28} /></span>
            <span className="requirement-dropzone-title">
              Drop your file here, or click to browse
            </span>
            <span className="requirement-dropzone-hint">PDF, JPG or PNG · max 10 MB</span>
          </label>

          {file && (
            <div className="requirement-file-chip">
              <span className="requirement-file-chip-icon"><Icon name="file" size={16} /></span>
              <span className="requirement-file-chip-body">
                <span className="requirement-file-chip-name">{file.name}</span>
                <span className="requirement-file-chip-meta">{formatFileSize(file.size)} · ready to submit</span>
              </span>
              <span className="requirement-file-chip-actions">
                <button
                  type="button"
                  className="requirement-file-link"
                  onClick={() => inputRef.current?.click()}
                >
                  Replace
                </button>
                <button
                  type="button"
                  className="requirement-file-link danger"
                  onClick={() => {
                    setFile(null);
                    setError('');
                    if (inputRef.current) inputRef.current.value = '';
                  }}
                >
                  Remove
                </button>
              </span>
            </div>
          )}

          {error && <p className="requirement-form-error" role="alert">{error}</p>}

          <p className="requirement-form-note">
            The file name and size are saved to your requirement record so an admin can
            see what was attached.
          </p>
        </form>
      </Modal>
    </div>
  );
}
