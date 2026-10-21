import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { ConfirmationModal } from '../../components/ConfirmationModal';
import { Icon } from '../../components/icons';
import { isTraineeRole, normalizeStatus, setUserActiveStatus, deleteUserAccount } from '../../services/supabaseService';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Students.css';
import './Admin.css';

/**
 * Friendly wording for the application column.
 *
 * The column used to print the raw database value, so the table read
 * "PENDING_APPROVAL" - a token from the schema, shown to a person.  The status
 * itself is not changed: only how it is said.  Anything unrecognised falls back
 * to the raw value in title case rather than being hidden, so a new state can
 * never silently disappear from the table.
 */
const APPLICATION_STATUS_LABELS = {
  PENDING_APPROVAL: { label: 'Under review', tone: 'PENDING' },
  PENDING_APPLICATION: { label: 'Under review', tone: 'PENDING' },
  PENDING: { label: 'Under review', tone: 'PENDING' },
  SUBMITTED: { label: 'Under review', tone: 'PENDING' },
  APPLIED: { label: 'Under review', tone: 'PENDING' },
  UNDER_REVIEW: { label: 'Under review', tone: 'PENDING' },
  APPROVED: { label: 'Approved', tone: 'APPROVED' },
  ACCEPTED: { label: 'Approved', tone: 'APPROVED' },
  ACTIVE: { label: 'Approved', tone: 'APPROVED' },
  VERIFIED: { label: 'Approved', tone: 'APPROVED' },
  REJECTED: { label: 'Not approved', tone: 'REJECTED' },
  DECLINED: { label: 'Not approved', tone: 'REJECTED' },
  DENIED: { label: 'Not approved', tone: 'REJECTED' }
};

const describeApplicationStatus = (status) => {
  const normalized = normalizeStatus(status);
  if (!normalized) return { label: 'No application', tone: 'PENDING' };
  const known = APPLICATION_STATUS_LABELS[normalized];
  if (known) return known;
  const readable = normalized
    .toLowerCase()
    .split('_')
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
  return { label: readable || normalized, tone: normalized };
};

export function AdminStudents() {
  const { state, dispatch, refreshData } = useApp();
  const { users } = state;
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
  const [actionLoadingId, setActionLoadingId] = useState(null);
  const [pendingDelete, setPendingDelete] = useState(null);
  const roleFilter = searchParams.get('role');
  const statusFilter = searchParams.get('status');
  const progressFilter = searchParams.get('progress');
  const selectedUser = searchParams.get('user');

  const students = useMemo(() => users.filter((user) => {
    if (!isTraineeRole(user.role)) return false;
    if (roleFilter === 'trainee' && String(user.role).toLowerCase() !== 'trainee') return false;
    if (roleFilter === 'ojt' && String(user.role).toLowerCase() !== 'ojt/intern') return false;
    if (statusFilter && normalizeStatus(user.applicationStatus) !== normalizeStatus(statusFilter)) return false;
    if (progressFilter === 'completed' && !(Number(user.requiredHours || 0) > 0 && Number(user.renderedHours || 0) >= Number(user.requiredHours || 0))) return false;
    return true;
  }), [progressFilter, roleFilter, statusFilter, users]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return students.filter((student) => {
      if (selectedUser && student.id !== selectedUser) return false;
      if (!query) return true;
      return [student.fullName, student.email, student.school, student.studentId]
        .some((value) => String(value || '').toLowerCase().includes(query));
    });
  }, [searchTerm, selectedUser, students]);

  const handleToggleActive = async (student) => {
    const nextActive = student.isActive === false;
    setActionLoadingId(student.id);
    try {
      const updated = await setUserActiveStatus(student.id, nextActive);
      dispatch({ type: 'UPDATE_USER', payload: updated });
      showToast(`Account ${nextActive ? 'activated' : 'deactivated'} for ${student.fullName}.`, 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Toggle account status failed:', error);
      showToast(error.message || 'Failed to update account status.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setActionLoadingId(pendingDelete.id);
    try {
      await deleteUserAccount(pendingDelete.id);
      dispatch({ type: 'SET_USERS', payload: users.filter((user) => user.id !== pendingDelete.id) });
      showToast(`Account deleted for ${pendingDelete.fullName}.`, 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      setPendingDelete(null);
    } catch (error) {
      console.error('Delete account failed:', error);
      showToast(error.message || 'Failed to delete account.', 'error');
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header"><h1 className="page-title">Students</h1><p className="page-subtitle">Approved and pending trainee profiles with live OJT progress.</p></div>
      <Card>
        <div className="table-toolbar">
          <Input placeholder="Search students..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} className="students-search" />
          <span className="muted-cell">{filteredStudents.length} student{filteredStudents.length === 1 ? '' : 's'}</span>
        </div>
        {filteredStudents.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead><tr><th>Student</th><th>Role</th><th>School</th><th>OJT progress</th><th>Application</th><th>Account</th><th>Actions</th></tr></thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const required = Number(student.requiredHours || 0);
                  const rendered = Number(student.renderedHours || 0);
                  const progress = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
                  const application = describeApplicationStatus(student.applicationStatus);
                  const isActive = student.isActive !== false;
                  const busy = actionLoadingId === student.id;
                  return (
                    <tr key={student.id}>
                      <td><div className="student-info"><div className="student-name">{student.fullName}</div><div className="student-email">{student.email}</div></div></td>
                      <td>{student.role}</td>
                      <td>{student.school || '--'}</td>
                      <td><div className="progress-cell"><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><span>{rendered.toFixed(2)} / {required.toFixed(2)} hrs ({progress.toFixed(1)}%)</span></div></td>
                      <td><Badge status={application.tone}>{application.label}</Badge></td>
                      <td>
                        <Badge color={isActive ? 'green' : 'red'}>{isActive ? 'Active' : 'Deactivated'}</Badge>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                          <Button
                            size="sm"
                            variant={isActive ? 'outline' : 'success'}
                            disabled={busy}
                            onClick={() => handleToggleActive(student)}
                            title={isActive ? 'Deactivate account' : 'Activate account'}
                          >
                            {busy ? 'Saving...' : isActive ? 'Deactivate' : 'Activate'}
                          </Button>
                          <Button
                            size="sm"
                            variant="danger"
                            disabled={busy}
                            onClick={() => setPendingDelete(student)}
                            title="Delete account permanently"
                          >
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon"><Icon name="users" size={40} color="#9CA3AF" /></div>
            <h3>No students found</h3>
            <p>Try a different search or role filter.</p>
          </div>
        )}
      </Card>

      <ConfirmationModal
        isOpen={Boolean(pendingDelete)}
        onClose={() => (actionLoadingId ? undefined : setPendingDelete(null))}
        onConfirm={handleConfirmDelete}
        title="Delete user account"
        message={pendingDelete ? `Are you sure you want to delete the account for ${pendingDelete.fullName} (${pendingDelete.email})? This action is permanent and cannot be undone.` : ''}
        confirmText="Delete Account"
        cancelText="Cancel"
        type="danger"
        loading={Boolean(actionLoadingId)}
      />
    </div>
  );
}
