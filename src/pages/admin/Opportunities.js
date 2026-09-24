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
import { createOpportunity, cleanupExpiredEvents, isEventActive } from '../../services/supabaseService';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Admin.css';

const emptyForm = {
  title: '',
  organization: '',
  description: '',
  category: 'Internship',
  location: '',
  setup: 'On-site',
  duration: '',
  requiredHours: '',
  availableSlots: '',
  applicationDeadline: '',
  status: 'Draft'
};

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
    if (!formData.availableSlots || Number(formData.availableSlots) < 1) nextErrors.availableSlots = 'At least one slot is required';
    if (!formData.applicationDeadline) nextErrors.applicationDeadline = 'Application deadline is required';
    if (formData.requiredHours && Number(formData.requiredHours) < 0) nextErrors.requiredHours = 'Hours cannot be negative';
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
      const saved = await createOpportunity({
        ...formData,
        title: formData.title.trim(),
        organization: formData.organization.trim(),
        description: formData.description.trim(),
        duration: formData.duration.trim(),
        requiredHours: Number(formData.requiredHours) || 0,
        availableSlots: Number(formData.availableSlots)
      });
      dispatch({ type: 'ADD_OPPORTUNITY', payload: saved });
      showToast('Opportunity saved to Supabase successfully.', 'success');
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
        <h1 className="page-title">Opportunities</h1>
        <p className="page-subtitle">Create concise, persistent listings. Expired opportunities are automatically hidden.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span className="muted-cell">{visibleOpportunities.length} listing{visibleOpportunities.length === 1 ? '' : 's'}</span>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Opportunity</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {visibleOpportunities.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '40px' }}><p className="no-data">No opportunities found.</p></div></Card>
        ) : visibleOpportunities.map((opportunity) => (
          <Card key={opportunity.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{opportunity.title}</h3>
                <p style={{ color: 'var(--primary-orange)', margin: '4px 0 0', fontWeight: '600' }}>{opportunity.organization}</p>
                <p className="no-data" style={{ marginTop: '8px' }}>{(opportunity.description || '').substring(0, 120)}{opportunity.description?.length > 120 ? '...' : ''}</p>
                <div className="admin-card-meta">
                  <span>💼 {opportunity.category || opportunity.type || '--'}</span>
                  <span>📍 {opportunity.location || '--'}</span>
                  <span>👥 {opportunity.availableSlots || 0} slots</span>
                  <span>⏱️ {opportunity.duration || '--'}</span>
                </div>
              </div>
              <Badge status={opportunity.status}>{isEventActive(opportunity) ? opportunity.status : 'Expired'}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => closeModal()} title="Create New Opportunity">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Opportunity Title" name="title" value={formData.title} onChange={handleChange} error={errors.title} required />
          <Input label="Organization" name="organization" value={formData.organization} onChange={handleChange} error={errors.organization} required />
          <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} error={errors.description} rows={4} required />
          <Select label="Category" name="category" value={formData.category} onChange={handleChange} options={['Internship', 'OJT', 'Training', 'Workshop', 'Youth Program', 'Community Activity']} required />
          <Input label="Location" name="location" value={formData.location} onChange={handleChange} error={errors.location} required />
          <Select label="Setup" name="setup" value={formData.setup} onChange={handleChange} options={['On-site', 'Remote', 'Hybrid']} />
          <Input label="Duration" name="duration" value={formData.duration} onChange={handleChange} error={errors.duration} placeholder="e.g., 3 months" required />
          <Input label="Required Hours (optional)" type="number" name="requiredHours" value={formData.requiredHours} onChange={handleChange} error={errors.requiredHours} min="0" />
          <Input label="Available Slots" type="number" name="availableSlots" value={formData.availableSlots} onChange={handleChange} error={errors.availableSlots} min="1" required />
          <Input label="Application Deadline" type="date" name="applicationDeadline" value={formData.applicationDeadline} onChange={handleChange} error={errors.applicationDeadline} min={new Date().toISOString().split('T')[0]} required />
          <Select label="Status" name="status" value={formData.status} onChange={handleChange} options={['Draft', 'Published']} />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" onClick={() => closeModal()} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Opportunity'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
