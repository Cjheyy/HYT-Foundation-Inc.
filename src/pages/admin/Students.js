import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { isTraineeRole, normalizeStatus } from '../../services/supabaseService';
import './Students.css';
import './Admin.css';

export function AdminStudents() {
  const { state } = useApp();
  const { users } = state;
  const [searchParams] = useSearchParams();
  const [searchTerm, setSearchTerm] = useState('');
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
              <thead><tr><th>Student</th><th>Role</th><th>School</th><th>OJT progress</th><th>Application</th><th>Account</th></tr></thead>
              <tbody>
                {filteredStudents.map((student) => {
                  const required = Number(student.requiredHours || 0);
                  const rendered = Number(student.renderedHours || 0);
                  const progress = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
                  const status = normalizeStatus(student.applicationStatus) || 'UNKNOWN';
                  return (
                    <tr key={student.id}>
                      <td><div className="student-info"><div className="student-name">{student.fullName}</div><div className="student-email">{student.email}</div></div></td>
                      <td>{student.role}</td>
                      <td>{student.school || '--'}</td>
                      <td><div className="progress-cell"><div className="progress-track"><div className="progress-fill" style={{ width: `${progress}%` }} /></div><span>{rendered.toFixed(2)} / {required.toFixed(2)} hrs ({progress.toFixed(1)}%)</span></div></td>
                      <td><Badge status={status}>{status}</Badge></td>
                      <td><Badge color={student.isActive === false ? 'red' : 'green'}>{student.isActive === false ? 'Inactive' : 'Active'}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : <div className="empty-state"><div className="empty-icon">👥</div><h3>No students found</h3><p>Try a different search or role filter.</p></div>}
      </Card>
    </div>
  );
}
