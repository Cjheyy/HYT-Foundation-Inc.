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
import { createOpportunity, cleanupExpiredEvents, isEventActive, getEventSlotState } from '../../services/supabaseService';
import { PROGRAM_SLOT_OPTIONS, formatScheduleRange } from '../../utils/helpers';
import { PARTNER_ORGANIZATIONS } from '../../data/partnerOrganizations';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Admin.css';

const emptyForm = {
  title: '',
  organization: '',
  description: '',
  location: '',
  setup: 'On-site',
  duration: '',
  scheduleStart: '',
  scheduleEnd: '',
  requiredHours: '',
  totalSlots: '20',
  applicationDeadline: '',
  status: 'Draft'
};

const SLOT_OPTIONS = PROGRAM_SLOT_OPTIONS.map((value) => ({ value: String(value), label: `${value} slots` }));

export function AdminOpportunities() {
  const { state, dispatch, refreshData } = useApp();
  const { opportunities } = state;
  const [searchParams] = useSearchParams();
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cleanupExpiredEvents().catch(() => undefined);
  }, []);

  const visibleOpportunities = useMemo(() => {
    if (searchParams.get('status') === 'active') return opportunities.filter((item) => isEventActive(item));
    return opportunities;
  }, [opportunities, searchParams]);

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
    if (!formData.organization.trim()) nextErrors.organization = 'Organization is required';
    if (!formData.description.trim()) nextErrors.description = 'Description is required';
    if (!formData.location.trim()) nextErrors.location = 'Location is required';
    if (!formData.duration.trim()) nextErrors.duration = 'Duration is required';
    if (!formData.totalSlots || Number(formData.totalSlots) < 1) nextErrors.totalSlots = 'Select at least 1 slot';
    if (!formData.applicationDeadline) nextErrors.applicationDeadline = 'Application deadline is required';
    if (formData.requiredHours && Number(formData.requiredHours) < 0) nextErrors.requiredHours = 'Hours cannot be negative';
    if (formData.scheduleStart && formData.scheduleEnd && formData.scheduleEnd < formData.scheduleStart) {
      nextErrors.scheduleEnd = 'End date must be on or after the start date';
    }
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
      const total = Math.max(1, Number(formData.totalSlots) || 0);
      const saved = await createOpportunity({
        title: formData.title.trim(),
        organization: formData.organization.trim(),
        description: formData.description.trim(),
        category: 'OJT',
        location: formData.location.trim(),
        setup: formData.setup,
        duration: formData.duration.trim(),
        schedule: schedulePreview || undefined,
        requiredHours: Number(formData.requiredHours) || 0,
        totalSlots: total,
        availableSlots: total,
        applicationDeadline: formData.applicationDeadline,
        status: formData.status
      });
      dispatch({ type: 'ADD_OPPORTUNITY', payload: saved });
      showToast('OJT Posting created.', 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      closeModal(true);
    } catch (error) {
      console.error('Create opportunity error:', error);
      showToast(error.message || 'Failed to save opportunity.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">OJT Postings</h1>
        <p className="page-subtitle">Create concise, persistent listings. Expired postings are automatically hidden.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span className="muted-cell">{visibleOpportunities.length} listing{visibleOpportunities.length === 1 ? '' : 's'}</span>
        <Button onClick={() => setShowCreateModal(true)}>Create OJT Posting</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {visibleOpportunities.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '40px' }}><p className="no-data">No OJT postings found.</p></div></Card>
        ) : visibleOpportunities.map((opportunity) => {
          const slots = getEventSlotState(opportunity);
          return (
            <Card key={opportunity.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{opportunity.title}</h3>
                  <p style={{ color: 'var(--primary-orange)', margin: '4px 0 0', fontWeight: '600' }}>{opportunity.organization}</p>
                  <p className="no-data" style={{ marginTop: '8px' }}>{(opportunity.description || '').substring(0, 120)}{opportunity.description?.length > 120 ? '...' : ''}</p>
                  <div className="admin-card-meta">
                    <span><span className="meta-icon-svg"><Icon name="pin" size={15} /></span>{opportunity.location || '--'}</span>
                    <span><span className="meta-icon-svg"><Icon name="users" size={15} /></span>{slots.available} of {slots.total} slots remaining</span>
                    <span><span className="meta-icon-svg"><Icon name="clock" size={15} /></span>{opportunity.duration || opportunity.schedule || '--'}</span>
                  </div>
                </div>
                <Badge status={opportunity.status}>{isEventActive(opportunity) ? opportunity.status : 'Expired'}</Badge>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => closeModal()} title="Create New OJT Posting">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Posting Title" name="title" value={formData.title} onChange={handleChange} error={errors.title} required />
          <Select label="Organization" name="organization" value={formData.organization} onChange={handleChange} error={errors.organization} options={PARTNER_ORGANIZATIONS} placeholder="Select partner organization" required />
          <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} error={errors.description} rows={4} required />
          <Input label="Location" name="location" value={formData.location} onChange={handleChange} error={errors.location} required />
          <Select label="Setup" name="setup" value={formData.setup} onChange={handleChange} options={['On-site', 'Remote', 'Hybrid']} />
          <Input label="Duration" name="duration" value={formData.duration} onChange={handleChange} error={errors.duration} placeholder="e.g., 3 months" required />
          <div>
            <span className="form-label">Schedule Range (optional)</span>
            <div className="schedule-range-grid">
              <Input type="date" name="scheduleStart" value={formData.scheduleStart} onChange={handleChange} error={errors.scheduleStart} aria-label="Schedule start date" />
              <Input type="date" name="scheduleEnd" value={formData.scheduleEnd} onChange={handleChange} error={errors.scheduleEnd} min={formData.scheduleStart || undefined} aria-label="Schedule end date" />
            </div>
            {schedulePreview && (
              <div className="schedule-preview" aria-live="polite" style={{ marginTop: '8px' }}>
                Selected schedule: {schedulePreview}
              </div>
            )}
          </div>
          <Input label="Required Hours (optional)" type="number" name="requiredHours" value={formData.requiredHours} onChange={handleChange} error={errors.requiredHours} min="0" />
          <Select label="Total Slots" name="totalSlots" value={formData.totalSlots} onChange={handleChange} error={errors.totalSlots} options={SLOT_OPTIONS} placeholder="Select total slots" help="Available slots start equal to total slots and decrement automatically on each application." required />
          <Input label="Application Deadline" type="date" name="applicationDeadline" value={formData.applicationDeadline} onChange={handleChange} error={errors.applicationDeadline} min={new Date().toISOString().split('T')[0]} required />
          <Select label="Status" name="status" value={formData.status} onChange={handleChange} options={['Draft', 'Published']} />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" onClick={() => closeModal()} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save OJT Posting'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
