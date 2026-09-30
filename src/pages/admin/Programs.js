import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { Icon } from '../../components/icons';
import { createProgram, cleanupExpiredEvents, isEventActive, getEventSlotState } from '../../services/supabaseService';
import { PROGRAM_CATEGORIES, PROGRAM_SLOT_OPTIONS, formatScheduleRange } from '../../utils/helpers';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Admin.css';

const emptyForm = {
  title: '',
  description: '',
  category: 'General',
  scheduleStart: '',
  scheduleEnd: '',
  location: '',
  totalSlots: '20',
  applicationDeadline: '',
  status: 'Draft'
};

const SLOT_OPTIONS = PROGRAM_SLOT_OPTIONS.map((value) => ({ value: String(value), label: `${value} slots` }));

export function AdminPrograms() {
  const { state, dispatch, refreshData } = useApp();
  const { programs, opportunities } = state;
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cleanupExpiredEvents().catch(() => undefined);
  }, []);

  const visiblePrograms = useMemo(() => {
    const query = searchParams.get('status');
    if (query === 'active') return programs.filter((program) => isEventActive(program));
    return programs;
  }, [programs, searchParams]);
  const activeOpportunities = useMemo(
    () => opportunities.filter((opportunity) => isEventActive(opportunity)),
    [opportunities]
  );

  const schedulePreview = useMemo(
    () => formatScheduleRange(formData.scheduleStart, formData.scheduleEnd),
    [formData.scheduleStart, formData.scheduleEnd]
  );

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.title.trim()) nextErrors.title = 'Title is required';
    if (!formData.description.trim()) nextErrors.description = 'Description is required';
    if (!formData.category) nextErrors.category = 'Select a category';
    if (!formData.scheduleStart) nextErrors.scheduleStart = 'Start date is required';
    if (!formData.scheduleEnd) nextErrors.scheduleEnd = 'End date is required';
    if (formData.scheduleStart && formData.scheduleEnd && formData.scheduleEnd < formData.scheduleStart) {
      nextErrors.scheduleEnd = 'End date must be on or after the start date';
    }
    if (!formData.location.trim()) nextErrors.location = 'Location is required';
    if (!formData.totalSlots || Number(formData.totalSlots) < 1) nextErrors.totalSlots = 'Select at least 1 slot';
    if (!formData.applicationDeadline) nextErrors.applicationDeadline = 'Application deadline is required';
    return nextErrors;
  };

  const closeModal = (force = false) => {
    if (saving && !force) return;
    setShowCreateModal(false);
    setFormData(emptyForm);
    setErrors({});
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const nextErrors = validate();
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    try {
      setSaving(true);
      const schedule = schedulePreview || `${formData.scheduleStart} to ${formData.scheduleEnd}`;
      const total = Math.max(1, Number(formData.totalSlots) || 0);
      const saved = await createProgram({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        schedule,
        location: formData.location.trim(),
        totalSlots: total,
        availableSlots: total,
        applicationDeadline: formData.applicationDeadline,
        status: formData.status
      });
      dispatch({ type: 'ADD_PROGRAM', payload: saved });
      showToast('Program created.', 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      closeModal(true);
    } catch (error) {
      console.error('Create program error:', error);
      showToast(error.message || 'Failed to save program.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Trainee Programs & Events</h1>
        <p className="page-subtitle">Published programs and events expire automatically after their deadline.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span className="muted-cell">{visiblePrograms.length} listing{visiblePrograms.length === 1 ? '' : 's'}</span>
        <Button onClick={() => setShowCreateModal(true)}>Create Program</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {visiblePrograms.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '40px' }}><p className="no-data">No programs or events found.</p></div></Card>
        ) : visiblePrograms.map((program) => {
          const slots = getEventSlotState(program);
          return (
            <Card key={program.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{program.title}</h3>
                  <p className="no-data" style={{ marginTop: '8px' }}>{(program.description || '').substring(0, 120)}{program.description?.length > 120 ? '...' : ''}</p>
                  <div className="admin-card-meta">
                    <span><span className="meta-icon-svg"><Icon name="calendar" size={15} /></span>{program.schedule || '--'}</span>
                    <span><span className="meta-icon-svg"><Icon name="pin" size={15} /></span>{program.location || '--'}</span>
                    <span><span className="meta-icon-svg"><Icon name="users" size={15} /></span>{slots.available} of {slots.total} slots remaining</span>
                    <span><span className="meta-icon-svg"><Icon name="clock" size={15} /></span>{program.applicationDeadline || 'No deadline'}</span>
                  </div>
                </div>
                <Badge status={program.status}>{isEventActive(program) ? program.status : 'Expired'}</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      {searchParams.get('status') === 'active' && (
        <Card style={{ marginTop: '24px' }}>
          <h2 className="admin-section-title">Active Opportunities ({activeOpportunities.length})</h2>
          {activeOpportunities.length > 0 ? activeOpportunities.map((opportunity) => (
            <div key={opportunity.id} className="admin-item">
              <div className="admin-item-header">
                <div><strong>{opportunity.title}</strong><div className="admin-item-date">{opportunity.organization} · {opportunity.location || 'Location TBD'}</div></div>
                <Badge status={opportunity.status}>Active</Badge>
              </div>
            </div>
          )) : <p className="no-data">No active opportunities.</p>}
        </Card>
      )}

      <Modal isOpen={showCreateModal} onClose={() => closeModal()} title="Create New Program or Event">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Program or Event Title" name="title" value={formData.title} onChange={handleChange} error={errors.title} required />
          <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} error={errors.description} rows={4} required />
          <Select label="Category" name="category" value={formData.category} onChange={handleChange} error={errors.category} options={PROGRAM_CATEGORIES} placeholder="Select a category" required />
          <div>
            <span className="form-label">Schedule Range <span style={{ color: 'red' }}> *</span></span>
            <div className="schedule-range-grid">
              <Input type="date" name="scheduleStart" value={formData.scheduleStart} onChange={handleChange} error={errors.scheduleStart} aria-label="Schedule start date" required />
              <Input type="date" name="scheduleEnd" value={formData.scheduleEnd} onChange={handleChange} error={errors.scheduleEnd} min={formData.scheduleStart || undefined} aria-label="Schedule end date" required />
            </div>
            <div className="schedule-preview" aria-live="polite" style={{ marginTop: '8px' }}>
              {schedulePreview ? `Selected schedule: ${schedulePreview}` : 'Select a start and end date to preview the schedule.'}
            </div>
          </div>
          <Input label="Location" name="location" value={formData.location} onChange={handleChange} error={errors.location} required />
          <Select label="Total Slots" name="totalSlots" value={formData.totalSlots} onChange={handleChange} error={errors.totalSlots} options={SLOT_OPTIONS} placeholder="Select total slots" help="Available slots start equal to total slots and decrement automatically on each application." required />
          <Input label="Application Deadline" type="date" name="applicationDeadline" value={formData.applicationDeadline} onChange={handleChange} error={errors.applicationDeadline} min={new Date().toISOString().split('T')[0]} required />
          <Select label="Status" name="status" value={formData.status} onChange={handleChange} options={['Draft', 'Published']} />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" onClick={() => closeModal()} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Program'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
