import { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { 
  getDailyReports, 
  createDailyReport
} from '../../services/supabaseService';
import { formatDate } from '../../utils/helpers';
import { toast } from 'react-toastify';
import './DailyReports.css';

export function DailyReportsNew() {
  const { state } = useApp();
  const { currentUser } = state;
  
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Report Form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    reportDate: new Date().toISOString().split('T')[0],
    accomplishments: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (currentUser) {
      loadReports();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser]);

  const loadReports = async () => {
    try {
      setLoading(true);
      const data = await getDailyReports(currentUser.id);
      setReports(data || []);
    } catch (error) {
      console.error('Error loading reports:', error);
      toast.error('Failed to load daily reports');
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    if (!formData.reportDate) {
      newErrors.reportDate = 'Report date is required';
    }
    
    if (!formData.accomplishments || formData.accomplishments.trim().length < 20) {
      newErrors.accomplishments = 'Please provide detailed accomplishments (at least 20 characters)';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    try {
      setActionLoading(true);
      
      await createDailyReport({
        userId: currentUser.id,
        reportDate: formData.reportDate,
        accomplishments: formData.accomplishments.trim()
      });
      
      toast.success('✅ Daily report submitted successfully!');
      setShowForm(false);
      setFormData({
        reportDate: new Date().toISOString().split('T')[0],
        accomplishments: ''
      });
      setErrors({});
      await loadReports();
    } catch (error) {
      console.error('Submit report error:', error);
      toast.error(error.message || 'Failed to submit report');
    } finally {
      setActionLoading(false);
    }
  };

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
        <h1 className="page-title">Daily Accomplishment Reports</h1>
        <p className="page-subtitle">Submit and track your daily work summaries</p>
      </div>

      {/* Submit Report Card */}
      <Card className="submit-report-card">
        <div className="card-header">
          <h2 className="card-title">Submit Daily Report</h2>
          {!showForm && (
            <Button onClick={() => setShowForm(true)}>
              + New Report
            </Button>
          )}
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="report-form">
            <div className="form-group">
              <label className="form-label">Report Date *</label>
              <input
                type="date"
                className={`form-input ${errors.reportDate ? 'error' : ''}`}
                value={formData.reportDate}
                onChange={(e) => {
                  setFormData({ ...formData, reportDate: e.target.value });
                  setErrors({ ...errors, reportDate: '' });
                }}
                max={new Date().toISOString().split('T')[0]}
                required
              />
              {errors.reportDate && (
                <div className="form-error">{errors.reportDate}</div>
              )}
            </div>

            <div className="form-group">
              <label className="form-label">Daily Accomplishments *</label>
              <textarea
                className={`form-textarea ${errors.accomplishments ? 'error' : ''}`}
                value={formData.accomplishments}
                onChange={(e) => {
                  setFormData({ ...formData, accomplishments: e.target.value });
                  setErrors({ ...errors, accomplishments: '' });
                }}
                placeholder="Describe what you accomplished today...&#10;&#10;Examples:&#10;- Completed feature X development&#10;- Fixed bugs in module Y&#10;- Attended training on Z&#10;- Learned new skill/technology"
                rows="8"
                required
              />
              {errors.accomplishments && (
                <div className="form-error">{errors.accomplishments}</div>
              )}
              <div className="form-help">
                Be specific about tasks completed, skills learned, and progress made
              </div>
            </div>

            <div className="form-actions">
              <Button type="submit" disabled={actionLoading}>
                Submit Report
              </Button>
              <Button 
                type="button" 
                variant="ghost" 
                onClick={() => {
                  setShowForm(false);
                  setFormData({
                    reportDate: new Date().toISOString().split('T')[0],
                    accomplishments: ''
                  });
                  setErrors({});
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </Card>

      {/* Reports History */}
      <Card className="reports-history-card">
        <div className="card-header">
          <h2 className="card-title">Report History</h2>
        </div>

        {reports.length > 0 ? (
          <div className="reports-list">
            {reports.map((report) => (
              <div 
                key={report.id} 
                className={`report-item ${report.status === 'Rejected' ? 'rejected' : ''}`}
              >
                <div className="report-header">
                  <div className="report-date">
                    <strong>{formatDate(report.reportDate)}</strong>
                  </div>
                  <Badge status={report.status}>{report.status}</Badge>
                </div>

                <div className="report-content">
                  <div className="report-section">
                    <span className="section-label">Accomplishments:</span>
                    <p className="section-text">{report.accomplishments}</p>
                  </div>

                  {report.adminNote && (
                    <div className={`admin-note ${report.status === 'Rejected' ? 'rejected' : 'approved'}`}>
                      <span className="note-label">
                        {report.status === 'Rejected' ? '❌ Admin Rejection Note:' : '✅ Admin Note:'}
                      </span>
                      <p className="note-text">{report.adminNote}</p>
                    </div>
                  )}
                </div>

                <div className="report-footer">
                  <span className="report-meta">
                    Submitted: {formatDate(report.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No Reports Yet</h3>
            <p>Submit your first daily report to track your progress</p>
          </div>
        )}
      </Card>
    </div>
  );
}
