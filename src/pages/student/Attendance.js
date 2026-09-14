import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { showToast } from '../../utils/notifications';
import { createAttendance, verifyLocation, verifySchedule } from '../../services/attendanceService';
import { getOJTByStudent } from '../../services/ojtService';
import { formatDate, formatTime } from '../../utils/helpers';

export function StudentAttendance() {
  const { state, dispatch } = useApp();
  const { currentUser, attendance, opportunities, ojtRecords } = state;
  const [checking, setChecking] = useState(false);

  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);
  const myAttendance = attendance.filter(att => att.studentId === currentUser?.id);
  const todayAttendance = myAttendance.filter(att => 
    new Date(att.date).toDateString() === new Date().toDateString()
  )[0];

  const opportunity = opportunities.find(o => o.id === myOJT?.opportunityId);

  const handleTimeIn = () => {
    if (!opportunity?.workplace) {
      showToast('Workplace not configured', 'error');
      return;
    }

    setChecking(true);

    // Request geolocation
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          
          // Verify location
          const locationValid = verifyLocation(
            latitude,
            longitude,
            opportunity.workplace.latitude,
            opportunity.workplace.longitude,
            opportunity.workplace.radius
          );

          // Verify schedule
          const scheduleCheck = verifySchedule(new Date().toISOString(), opportunity.workSchedule);

          const newAttendance = createAttendance({
            studentId: currentUser.id,
            ojtRecordId: myOJT.id,
            date: new Date().toISOString(),
            timeIn: new Date().toISOString(),
            workplace: opportunity.workplace.name,
            locationValid,
            scheduleValid: scheduleCheck.valid,
            latitude,
            longitude
          });

          dispatch({ type: 'ADD_ATTENDANCE', payload: newAttendance });

          if (locationValid && scheduleCheck.valid) {
            showToast('Time in recorded! Waiting for admin verification.', 'success');
          } else {
            showToast('Time in recorded with issues. Admin review required.', 'warning');
          }
          setChecking(false);
        },
        (error) => {
          showToast('Location access denied. Cannot verify attendance.', 'error');
          setChecking(false);
        }
      );
    } else {
      showToast('Geolocation not supported', 'error');
      setChecking(false);
    }
  };

  const handleTimeOut = () => {
    if (todayAttendance) {
      const updated = {
        ...todayAttendance,
        timeOut: new Date().toISOString(),
        status: 'Pending Review'
      };
      dispatch({ type: 'UPDATE_ATTENDANCE', payload: updated });
      showToast('Time out recorded successfully!', 'success');
    }
  };

  if (!myOJT) {
    return (
      <div>
        <h1 className="page-title">Attendance</h1>
        <EmptyState
          icon="✓"
          title="No Active OJT"
          message="You need an active OJT program to record attendance"
        />
      </div>
    );
  }

  return (
    <div>
      <h1 className="page-title">Attendance</h1>

      <Card style={{ marginBottom: '24px' }}>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Today's Attendance</h3>
        
        {todayAttendance ? (
          <div>
            <div style={{ display: 'grid', gap: '12px', marginBottom: '16px' }}>
              <div><strong>Date:</strong> {formatDate(todayAttendance.date)}</div>
              <div><strong>Time In:</strong> {formatTime(todayAttendance.timeIn)}</div>
              {todayAttendance.timeOut && (
                <div><strong>Time Out:</strong> {formatTime(todayAttendance.timeOut)}</div>
              )}
              <div><strong>Location Check:</strong> {todayAttendance.locationValid ? '✓ Valid' : '⚠ Outside area'}</div>
              <div><strong>Schedule Check:</strong> {todayAttendance.scheduleValid ? '✓ Valid' : '⚠ Outside schedule'}</div>
              <div><Badge status={todayAttendance.status}>{todayAttendance.status}</Badge></div>
            </div>

            {todayAttendance.status === 'Verified' && !todayAttendance.timeOut && (
              <Button onClick={handleTimeOut}>Time Out</Button>
            )}
          </div>
        ) : (
          <div>
            <p style={{ marginBottom: '16px', color: 'var(--muted-text)' }}>
              No attendance recorded today. Click Time In to start.
            </p>
            <Button onClick={handleTimeIn} disabled={checking}>
              {checking ? 'Checking Location...' : 'Time In'}
            </Button>
          </div>
        )}
      </Card>

      <Card>
        <h3 style={{ fontSize: '20px', fontWeight: '600', marginBottom: '16px' }}>Attendance History</h3>
        {myAttendance.length > 0 ? (
          <div style={{ display: 'grid', gap: '12px' }}>
            {myAttendance.slice(0, 10).map((att) => (
              <div key={att.id} style={{ padding: '12px', background: 'var(--background)', borderRadius: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontWeight: '600' }}>{formatDate(att.date)}</div>
                    <div style={{ fontSize: '14px', color: 'var(--muted-text)' }}>
                      {formatTime(att.timeIn)} - {att.timeOut ? formatTime(att.timeOut) : 'In Progress'}
                    </div>
                  </div>
                  <Badge status={att.status}>{att.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--muted-text)' }}>No attendance records yet</p>
        )}
      </Card>
    </div>
  );
}
