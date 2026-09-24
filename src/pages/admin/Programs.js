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
import { createProgram, cleanupExpiredEvents, isEventActive } from '../../services/supabaseService';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Admin.css';

const emptyForm = {
  title: '',
  description: '',
  category: '',
  schedule: '',
  location: '',
  availableSlots: '',
  applicationDeadline: '',
  status: 'Draft'
};

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
  const activeOpportunities = opportunities.filter((opportunity) => isEventActive(opportunity));

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((previous) => ({ ...previous, [name]: value }));
    setErrors((previous) => ({ ...previous, [name]: '' }));
  };

  const validate = () => {
    const nextErrors = {};
    if (!formData.title.trim()) nextErrors.title = 'Title is required';
    if (!formData.description.trim()) nextErrors.description = 'Description is required';
    if (!formData.category.trim()) nextErrors.category = 'Category is required';
    if (!formData.schedule.trim()) nextErrors.schedule = 'Schedule is required';
    if (!formData.location.trim()) nextErrors.location = 'Location is required';
    if (!formData.availableSlots || Number(formData.availableSlots) < 1) nextErrors.availableSlots = 'At least one slot is required';
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
      const saved = await createProgram({
        ...formData,
        title: formData.title.trim(),
        description: formData.description.trim(),
        availableSlots: Number(formData.availableSlots)
      });
      dispatch({ type: 'ADD_PROGRAM', payload: saved });
      showToast('Program saved to Supabase successfully.', 'success');
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
        <h1 className="page-title">Programs</h1>
        <p className="page-subtitle">Published programs are persisted in Supabase and expire automatically after their deadline.</p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span className="muted-cell">{visiblePrograms.length} listing{visiblePrograms.length === 1 ? '' : 's'}</span>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Program</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {visiblePrograms.length === 0 ? (
          <Card><div style={{ textAlign: 'center', padding: '40px' }}><p className="no-data">No programs found.</p></div></Card>
        ) : visiblePrograms.map((program) => (
          <Card key={program.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{program.title}</h3>
                <p className="no-data" style={{ marginTop: '8px' }}>{(program.description || '').substring(0, 120)}{program.description?.length > 120 ? '...' : ''}</p>
                <div className="admin-card-meta">
                  <span>📅 {program.schedule || '--'}</span>
                  <span>📍 {program.location || '--'}</span>
                  <span>👥 {program.availableSlots || 0} slots</span>
                  <span>⏳ {program.applicationDeadline || 'No deadline'}</span>
                </div>
              </div>
              <Badge status={program.status}>{isEventActive(program) ? program.status : 'Expired'}</Badge>
            </div>
          </Card>
        ))}
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

      <Modal isOpen={showCreateModal} onClose={() => closeModal()} title="Create New Program">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Program Title" name="title" value={formData.title} onChange={handleChange} error={errors.title} required />
          <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} error={errors.description} rows={4} required />
          <Input label="Category" name="category" value={formData.category} onChange={handleChange} error={errors.category} placeholder="e.g., Leadership" required />
          <Input label="Schedule" name="schedule" value={formData.schedule} onChange={handleChange} error={errors.schedule} placeholder="e.g., November 15-17, 2026" required />
          <Input label="Location" name="location" value={formData.location} onChange={handleChange} error={errors.location} required />
          <Input label="Available Slots" type="number" name="availableSlots" value={formData.availableSlots} onChange={handleChange} error={errors.availableSlots} min="1" required />
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
