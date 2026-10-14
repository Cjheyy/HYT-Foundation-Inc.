import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { DateField } from '../../components/DateField';
import { Icon } from '../../components/icons';
import {
  cleanupExpiredEvents,
  createAnnouncement,
  createEvent,
  deleteEvent,
  getEventSlotState,
  isEventActive
} from '../../services/supabaseService';
import { EVENT_CATEGORIES, PROGRAM_SLOT_OPTIONS, formatDate, formatDateTime, toIsoInstant } from '../../utils/helpers';
import { todayIso } from '../../utils/dateParts';
import { showToast } from '../../utils/notifications';
import { DASHBOARD_DATA_CHANGED_EVENT } from '../../components/AdminDashboardMetrics';
import './Admin.css';

/**
 * Admin → Events.
 *
 * Events live in their own table (`public.events`), separate from the Dream
 * Academy programmes, so they get their own screen.  The only structural
 * difference from the programme form is that the schedule is a real
 * start/end DATE-TIME pair rather than a free-text range — the youth-facing
 * overlap rule needs to compare actual instants.
 */

const emptyForm = {
  title: '',
  description: '',
  category: 'Community Outreach',
  startsAt: '',
  endsAt: '',
  location: '',
  totalSlots: '20',
  applicationDeadline: '',
  status: 'Draft'
};

const SLOT_OPTIONS = PROGRAM_SLOT_OPTIONS.map((value) => ({ value: String(value), label: `${value} slots` }));

export function AdminEvents() {
  const { state, dispatch, refreshData } = useApp();
  const { events } = state;

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    cleanupExpiredEvents().catch(() => undefined);
  }, []);

  const sortedEvents = useMemo(
    () => (events || []).slice().sort((a, b) => {
      const left = new Date(a.startsAt || a.starts_at || 0).getTime() || 0;
      const right = new Date(b.startsAt || b.starts_at || 0).getTime() || 0;
      return right - left;
    }),
    [events]
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
    if (!formData.startsAt) nextErrors.startsAt = 'Start date and time is required';
    if (!formData.endsAt) nextErrors.endsAt = 'End date and time is required';
    if (formData.startsAt && formData.endsAt && formData.endsAt < formData.startsAt) {
      nextErrors.endsAt = 'End must be on or after the start';
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
      const total = Math.max(1, Number(formData.totalSlots) || 0);
      const schedule = `${formatDateTime(formData.startsAt)} – ${formatDateTime(formData.endsAt)}`;
      const saved = await createEvent({
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        // A `datetime-local` value is the ADMIN's wall-clock time.  Convert it to
        // a real instant here: a raw 'YYYY-MM-DDTHH:mm' handed to a timestamptz
        // column is read in the SESSION zone (UTC on Supabase), which would
        // shift 09:00 Manila to 17:00 Manila on the way back out.
        startsAt: toIsoInstant(formData.startsAt),
        endsAt: toIsoInstant(formData.endsAt),
        schedule,
        location: formData.location.trim(),
        totalSlots: total,
        availableSlots: total,
        applicationDeadline: formData.applicationDeadline,
        status: formData.status
      });
      dispatch({ type: 'ADD_EVENT', payload: saved });

      /**
       * Posting an event also raises a notice, so the portals see it on the
       * Announcements page and the bell counts it as unread.
       *
       * Only a PUBLISHED event announces itself: an announcement is readable by
       * everyone, so auto-publishing one for a draft would leak the draft.
       * A failure here must never lose the event, hence the local catch.
       */
      let announcementFailed = false;
      if (String(saved.status || '').toLowerCase() === 'published') {
        try {
          const announcement = await createAnnouncement({
            title: `New event: ${saved.title}`,
            content: `${saved.title} — ${schedule} at ${saved.location}. `
              + `${total} slot${total === 1 ? '' : 's'} available; apply on or before ${formatDate(saved.applicationDeadline) || saved.applicationDeadline}.`,
            category: 'Events',
            priority: 'High',
            status: 'Published',
            createdBy: state.currentUser?.id
          });
          dispatch({ type: 'ADD_ANNOUNCEMENT', payload: announcement });
        } catch (announcementError) {
          console.error('Event announcement error:', announcementError);
          announcementFailed = true;
        }
      }

      showToast(
        announcementFailed
          ? 'Event created, but the announcement could not be posted.'
          : 'Event created.',
        announcementFailed ? 'error' : 'success'
      );
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
      closeModal(true);
    } catch (error) {
      console.error('Create event error:', error);
      showToast(error.message || 'Failed to save event.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (eventId) => {
    try {
      await deleteEvent(eventId);
      dispatch({ type: 'DELETE_EVENT', payload: eventId });
      showToast('Event deleted.', 'success');
      await refreshData().catch(() => undefined);
      window.dispatchEvent(new Event(DASHBOARD_DATA_CHANGED_EVENT));
    } catch (error) {
      console.error('Delete event error:', error);
      showToast(error.message || 'Failed to delete event.', 'error');
    }
  };

  return (
    <div className="admin-page">
      <div className="page-header">
        <h1 className="page-title">Events</h1>
        <p className="page-subtitle">
          One-off events. Published events expire automatically after their deadline.
        </p>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <span className="muted-cell">{sortedEvents.length} event{sortedEvents.length === 1 ? '' : 's'}</span>
        <Button onClick={() => setShowCreateModal(true)}>Create Event</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {sortedEvents.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p className="no-data">No events yet.</p>
            </div>
          </Card>
        ) : sortedEvents.map((item) => {
          const slots = getEventSlotState(item);
          return (
            <Card key={item.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{item.title}</h3>
                  <p className="no-data" style={{ marginTop: '8px' }}>
                    {(item.description || '').substring(0, 120)}
                    {item.description?.length > 120 ? '...' : ''}
                  </p>
                  <div className="admin-card-meta">
                    <span><span className="meta-icon-svg"><Icon name="calendar" size={15} /></span>{item.schedule || '--'}</span>
                    <span><span className="meta-icon-svg"><Icon name="pin" size={15} /></span>{item.location || '--'}</span>
                    <span><span className="meta-icon-svg"><Icon name="users" size={15} /></span>{slots.available} of {slots.total} slots remaining</span>
                    <span><span className="meta-icon-svg"><Icon name="clock" size={15} /></span>{item.applicationDeadline || 'No deadline'}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
                  <Badge status={item.status}>{isEventActive(item) ? item.status : 'Expired'}</Badge>
                  <Button size="sm" variant="outline" onClick={() => handleDelete(item.id)}>Delete</Button>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <Modal isOpen={showCreateModal} onClose={() => closeModal()} title="Create New Event">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input label="Event Title" name="title" value={formData.title} onChange={handleChange} error={errors.title} required />
          <Textarea label="Description" name="description" value={formData.description} onChange={handleChange} error={errors.description} rows={4} required />
          <Select label="Category" name="category" value={formData.category} onChange={handleChange} error={errors.category} options={EVENT_CATEGORIES} placeholder="Select a category" required />
          <div>
            <span className="form-label">Event Schedule <span className="required-marker" aria-hidden="true"> *</span></span>
            <div className="schedule-range-grid">
              <DateField type="datetime-local" name="startsAt" value={formData.startsAt} onChange={handleChange} error={errors.startsAt} aria-label="Event start date and time" required />
              <DateField type="datetime-local" name="endsAt" value={formData.endsAt} onChange={handleChange} error={errors.endsAt} min={formData.startsAt || undefined} aria-label="Event end date and time" required />
            </div>
            <div className="schedule-preview" aria-live="polite" style={{ marginTop: '8px' }}>
              {formData.startsAt && formData.endsAt
                ? `Selected schedule: ${formatDateTime(formData.startsAt)} – ${formatDateTime(formData.endsAt)}`
                : 'Select a start and end date and time. This is what the overlap rule compares.'}
            </div>
          </div>
          <Input label="Location" name="location" value={formData.location} onChange={handleChange} error={errors.location} required />
          <Select label="Total Slots" name="totalSlots" value={formData.totalSlots} onChange={handleChange} error={errors.totalSlots} options={SLOT_OPTIONS} placeholder="Select total slots" help="Available slots start equal to total slots and decrement automatically on each approval." required />
          <DateField label="Application Deadline" name="applicationDeadline" value={formData.applicationDeadline} onChange={handleChange} error={errors.applicationDeadline} min={todayIso()} required />
          <Select label="Status" name="status" value={formData.status} onChange={handleChange} options={['Draft', 'Published']} />
          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
            <Button type="button" variant="outline" onClick={() => closeModal()} disabled={saving}>Cancel</Button>
            <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Event'}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default AdminEvents;
