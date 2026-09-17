import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Badge } from '../../components/Badge';
import { 
  getAttendanceLogs, 
  clockIn, 
  clockOut, 
  getTodayAttendance,
  getOtRequests,
  createOtRequest
} from '../../services/supabaseService';
import { formatDate, formatTime } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './Attendance.css';

export function AttendanceNew() {
  const { state } = useApp();
  const { currentUser } = state;
  
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [attendanceHistory, setAttendanceHistory] = useState([]);
  const [otRequests, setOtRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // OT Request Form
  const [showOtForm, setShowOtForm] = useState(false);
  const [otFormData, setOtFormData] = useState({
    requestedHours: '',
    reason: ''
  });
  const [otErrors, setOtErrors] = useState({});

  useEffect(() => {
    if (currentUser) {
      loadAttendanceData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadAttendanceData = async () => {
    try {
      setLoading(true);
      const [today, history, requests] = await Promise.all([
        getTodayAttendance(currentUser.id),
        getAttendanceLogs(currentUser.id),
        getOtRequests(currentUser.id)
      ]);
      
      setTodayAttendance(today);
      setAttendanceHistory(history || []);
      setOtRequests(requests || []);
    } catch (error) {
      console.error('Error loading attendance:', error);
      toast.error('Failed to load attendance data');
    } finally {
      setLoading(false);
    }
  };

  const handleClockIn = async () => {
    try {
      setActionLoading(true);
      const result = await clockIn(currentUser.id);
      setTodayAttendance(result);
      toast.success('✅ Clocked in successfully!');
      await loadAttendanceData();
    } catch (error) {
      console.error('Clock in error:', error);
      toast.error(error.message || 'Failed to clock in');
    } finally {
      setActionLoading(false);
    }
  };

  const handleClockOut = async () => {
    try {
      setActionLoading(true);
      const result = await clockOut(currentUser.id);
      setTodayAttendance(result);
      toast.success('✅ Clocked out successfully!');
      await loadAttendanceData();
    } catch (error) {
      console.error('Clock out error:', error);
      toast.error(error.message || 'Failed to clock out');
    } finally {
      setActionLoading(false);
    }
  };

  const validateOtForm = () => {
    const errors = {};
    
    if (!otFormData.requestedHours) {
      errors.requestedHours = 'Required hours is required';
    } else if (otFormData.requestedHours < 0.5 || otFormData.requestedHours > 8) {
      errors.requestedHours = 'Hours must be between 0.5 and 8';
    }
    
    if (!otFormData.reason || otFormData.reason.trim().length < 10) {
      errors.reason = 'Please provide a detailed reason (at least 10 characters)';
    }
    
    return errors;
  };

  const handleOtSubmit = async (e) => {
    e.preventDefault();
    
    const errors = validateOtForm();
    if (Object.keys(errors).length > 0) {
      setOtErrors(errors);
      return;
    }
    
    try {
      setActionLoading(true);
      
      await createOtRequest({
        userId: currentUser.id,
        attendanceId: todayAttendance?.id || null,
        requestedHours: parseFloat(otFormData.requestedHours),
        reason: otFormData.reason.trim()
      });
      
      toast.success('✅ OT request submitted successfully!');
      setShowOtForm(false);
      setOtFormData({ requestedHours: '', reason: '' });
      setOtErrors({});
      await loadAttendanceData();
    } catch (error) {
      console.error('OT request error:', error);
      toast.error(error.message || 'Failed to submit OT request');
    } finally {
      setActionLoading(false);
    }
  };

  const calculateProgress = () => {
    const required = currentUser.requiredHours || 0;
    const rendered = currentUser.renderedHours || 0;
    const remaining = Math.max(0, required - rendered);
    const percentage = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
    
    return { required, rendered, remaining, percentage };
  };

  const progress = calculateProgress();

  if (loading) {
    return (
      <div className="page-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <h1 className="page-title">Attendance & DTR</h1>
        <p className="page-subtitle">Track your daily time and hours</p>
      </div>

      {/* Today's Attendance Card */}
      <Card className="today-attendance-card">
        <div className="card-header">
          <h2 className="card-title">Today's Attendance</h2>
          <span className="card-date">{formatDate(new Date())}</span>
        </div>
        
        <div className="attendance-status">
          {todayAttendance ? (
            <div className="status-grid">
              <div className="status-item">
                <span className="status-label">Time In:</span>
                <span className="status-value">
                  {todayAttendance.timeIn ? formatTime(todayAttendance.timeIn) : '--:--'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Time Out:</span>
                <span className="status-value">
                  {todayAttendance.timeOut ? formatTime(todayAttendance.timeOut) : '--:--'}
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Hours Rendered:</span>
                <span className="status-value highlight">
                  {todayAttendance.renderedHours?.toFixed(2) || '0.00'} hrs
                </span>
              </div>
              <div className="status-item">
                <span className="status-label">Status:</span>
                <Badge status={todayAttendance.status}>{todayAttendance.status}</Badge>
              </div>
            </div>
          ) : (
            <p className="no-attendance">No attendance recorded today</p>
          )}
        </div>

        <div className="attendance-actions">
          {!todayAttendance?.timeIn ? (
            <Button 
              onClick={handleClockIn} 
              disabled={actionLoading}
              size="lg"
              style={{ minWidth: '200px' }}
            >
              🕐 Clock In
            </Button>
          ) : !todayAttendance?.timeOut ? (
            <Button 
              onClick={handleClockOut} 
              disabled={actionLoading}
              variant="success"
              size="lg"
              style={{ minWidth: '200px' }}
            >
              🕐 Clock Out
            </Button>
          ) : (
            <div className="completed-badge">
              ✅ Attendance Complete for Today
            </div>
          )}
        </div>
      </Card>

      {/* Hours Progress Card */}
      <Card className="hours-progress-card">
        <div className="card-header">
          <h2 className="card-title">OJT Hours Progress</h2>
        </div>
        
        <div className="progress-stats">
          <div className="stat-item">
            <span className="stat-label">Required Hours:</span>
            <span className="stat-value">{progress.required.toFixed(0)} hrs</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Rendered Hours:</span>
            <span className="stat-value success">{progress.rendered.toFixed(2)} hrs</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">Remaining Hours:</span>
            <span className="stat-value warning">{progress.remaining.toFixed(2)} hrs</span>
          </div>
        </div>

        <div className="progress-bar-container">
          <div 
            className="progress-bar" 
            style={{ width: `${progress.percentage}%` }}
          >
            <span className="progress-text">{progress.percentage.toFixed(1)}%</span>
          </div>
        </div>
      </Card>

      {/* OT/Extension Request Section */}
      <Card className="ot-request-card">
        <div className="card-header">
          <h2 className="card-title">Overtime / Extension Request</h2>
          {!showOtForm && (
            <Button onClick={() => setShowOtForm(true)} size="sm">
              + Request OT
            </Button>
          )}
        </div>

        {showOtForm && (
          <form onSubmit={handleOtSubmit} className="ot-form">
            <Input
              label="Requested Hours"
              type="number"
              step="0.5"
              min="0.5"
              max="8"
              value={otFormData.requestedHours}
              onChange={(e) => {
                setOtFormData({ ...otFormData, requestedHours: e.target.value });
                setOtErrors({ ...otErrors, requestedHours: '' });
              }}
              error={otErrors.requestedHours}
              placeholder="e.g., 2.0"
              help="Enter additional hours needed (0.5 - 8 hours)"
              required
            />

            <div className="form-group">
              <label className="form-label">Reason for Extension *</label>
              <textarea
                className={`form-textarea ${otErrors.reason ? 'error' : ''}`}
                value={otFormData.reason}
                onChange={(e) => {
                  setOtFormData({ ...otFormData, reason: e.target.value });
                  setOtErrors({ ...otErrors, reason: '' });
                }}
                placeholder="Explain why you need additional hours..."
                rows="4"
                required
              />
              {otErrors.reason && (
                <div className="form-error">{otErrors.reason}</div>
              )}
            </div>

            <div className="form-actions">
              <Button type="submit" disabled={actionLoading}>
                Submit Request
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  setShowOtForm(false);
                  setOtFormData({ requestedHours: '', reason: '' });
                  setOtErrors({});
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* OT Request History */}
        <div className="ot-history">
          <h3 className="section-subtitle">Request History</h3>
          {otRequests.length > 0 ? (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Hours Requested</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Admin Note</th>
                  </tr>
                </thead>
                <tbody>
                  {otRequests.map((request) => (
                    <tr 
                      key={request.id}
                      className={request.status === 'Rejected' ? 'rejected-row' : ''}
                    >
                      <td>{formatDate(request.createdAt)}</td>
                      <td>+{request.requestedHours} hrs</td>
                      <td className="reason-cell">{request.reason}</td>
                      <td><Badge status={request.status}>{request.status}</Badge></td>
                      <td className="admin-note-cell">
                        {request.adminNote || '--'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <p className="empty-state">No OT requests yet</p>
          )}
        </div>
      </Card>

      {/* Attendance History */}
      <Card className="attendance-history-card">
        <div className="card-header">
          <h2 className="card-title">Attendance History</h2>
        </div>

        {attendanceHistory.length > 0 ? (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Time In</th>
                  <th>Time Out</th>
                  <th>Hours</th>
                  <th>Status</th>
                  <th>Admin Note</th>
                </tr>
              </thead>
              <tbody>
                {attendanceHistory.map((log) => (
                  <tr key={log.id}>
                    <td>{formatDate(log.date)}</td>
                    <td>{log.timeIn ? formatTime(log.timeIn) : '--:--'}</td>
                    <td>{log.timeOut ? formatTime(log.timeOut) : '--:--'}</td>
                    <td>{log.renderedHours?.toFixed(2) || '0.00'} hrs</td>
                    <td><Badge status={log.status}>{log.status}</Badge></td>
                    <td className="admin-note-cell">{log.adminNote || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-state">No attendance records yet</p>
        )}
      </Card>
    </div>
  );
}
