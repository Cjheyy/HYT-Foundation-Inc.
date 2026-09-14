import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { Input } from '../../components/Input';
import { useState } from 'react';
import './Students.css';
import './Admin.css';

export function AdminStudents() {
  const { state } = useApp();
  const { users } = state;
  const [searchTerm, setSearchTerm] = useState('');

  const students = users.filter(u => u.role === 'STUDENT');
  const filteredStudents = students.filter(s => 
    s.fullName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.studentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    s.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="admin-students-page">
      <h1 className="page-title">Students</h1>

      <Input
        placeholder="Search students..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="students-search"
      />

      <div className="students-list">
        {filteredStudents.map((student) => (
          <Card key={student.id}>
            <div className="student-card-content">
              <div className="student-card-info">
                <h3 className="student-card-name">{student.fullName}</h3>
                <div className="student-card-details">
                  <div>📧 {student.email}</div>
                  <div>🆔 {student.studentId}</div>
                  {student.course && <div>📚 {student.course} - {student.yearLevel}</div>}
                </div>
              </div>
              <Badge color="blue">Active</Badge>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
