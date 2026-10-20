import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons';
import { getRoleTerms } from '../../utils/roleTerms';
import { formatListingSchedule } from '../../utils/experience';
import { showToast } from '../../utils/notifications';
import {
  applyToEventPosting,
  applicationReleasesSlot,
  eventWindowsOverlap,
  getEventSlotState,
  isEventActive,
  MAX_ACTIVE_EVENT_APPLICATIONS
} from '../../services/supabaseService';
import './Events.css';

/**
 * Events - the third listing kind, shared by BOTH portals.
 *
 * An OJT/Intern sees "Events Postings"; a Trainee sees "Events".  The page is
 * the same component for both (the label comes from getRoleTerms), exactly the
 * way student/Opportunities.js already serves /student and /trainee.
 *
 * The three application rules are enforced here as well as in
 * supabaseService.applyToEvent, so the button is disabled rather than failing
 * after the click:
 *   - one application per event        (already applied)
 *   - at most 3 live event applications
 *   - no two live applications may overlap in time
 *
 * The count and the overlap test are computed from the rows already in state,
 * so opening this page costs no extra query per card.
 */

/**
 * The event's occupied window, in words.
 *
 * Delegates to the shared formatter so the listing page, My Applications, the
 * dashboard and the landing page cannot word the same event differently. A
 * whole-day event reads "October 20, 2026 · Whole day" instead of the
 * meaningless "12:00 AM - 11:59 PM".
 */
export const formatEventWindow = (event) =>
  formatListingSchedule(event, { isEvent: true }) ||
  event?.schedule ||
  'Schedule to be announced';

export function StudentEvents() {
  const { state, dispatch, refreshData } = useApp();
  const { events, applications, currentUser } = state;
  const terms = getRoleTerms(currentUser?.role);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [detail, setDetail] = useState(null);
  const [applying, setApplying] = useState(false);

  const publishedEvents = useMemo(
    () => (events || []).filter(
      (item) => String(item.status).toLowerCase() === 'published' && isEventActive(item)
    ),
    [events]
  );

  const categoryOptions = useMemo(() => {
    const seen = new Set(publishedEvents.map((item) => item.category).filter(Boolean));
    return Array.from(seen).sort();
  }, [publishedEvents]);

  /** Every event application this user owns, released ones included. */
  const myEventApplications = useMemo(() => (applications || []).filter((app) => {
    if ((app.studentId || app.userId) !== currentUser?.id) return false;
    return Boolean(app.eventId || app.event_id);
  }), [applications, currentUser]);

  const appliedIds = useMemo(
    () => new Set(myEventApplications.map((app) => app.eventId || app.event_id)),
    [myEventApplications]
  );

  /**
   * The events still holding a slot.  A rejected or withdrawn application frees
   * both the count and its window - which is what lets a student apply again
   * once one of their applications ends.
   */
  const heldEvents = useMemo(() => myEventApplications
    .filter((app) => !applicationReleasesSlot(app.status))
    .map((app) => (events || []).find((item) => item.id === (app.eventId || app.event_id)))
    .filter(Boolean), [myEventApplications, events]);

  const atLimit = heldEvents.length >= MAX_ACTIVE_EVENT_APPLICATIONS;

  const clashFor = (event) =>
    heldEvents.find((held) => held.id !== event.id && eventWindowsOverlap(event, held)) || null;

  const filteredEvents = publishedEvents.filter((item) => {
    const haystack = `${item.title || ''} ${item.location || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const handleApply = async (event) => {
    if (!currentUser) return;
    if (atLimit) {
      showToast(`You can apply to at most ${MAX_ACTIVE_EVENT_APPLICATIONS} events at a time.`, 'error');
      return;
    }
    const clash = clashFor(event);
    if (clash) {
      showToast(`This event overlaps "${clash.title || 'another event'}" you already applied to.`, 'error');
      return;
    }

    setApplying(true);
    try {
      const created = await applyToEventPosting(event.id, currentUser.id);
      dispatch({ type: 'ADD_APPLICATION', payload: created });
      showToast('Application submitted. It is now visible under Application Review.', 'success');
      await refreshData().catch(() => undefined);
      setDetail(null);
    } catch (error) {
      console.error('Apply to event failed:', error);
      showToast(error.message || 'Failed to submit application.', 'error');
      await refreshData().catch(() => undefined);
    } finally {
      setApplying(false);
    }
  };

  /** The single reason Apply is unavailable, or null when it is available. */
  const blockReason = (event) => {
    if (appliedIds.has(event.id)) return 'Already Applied';
    if (atLimit) return `Limit of ${MAX_ACTIVE_EVENT_APPLICATIONS} Events Reached`;
    if (clashFor(event)) return 'Conflicts With Your Other Event';
    if (getEventSlotState(event).isFull) return 'No Slots Available';
    return null;
  };

  const detailReason = detail ? blockReason(detail) : null;

  return (
    <div className="student-events-page">
      <h1 className="page-title">{terms.eventsLabel}</h1>
      <p className="page-subtitle">
        Up to {MAX_ACTIVE_EVENT_APPLICATIONS} events at a time. Events that overlap in date and
        time cannot be applied for together.
      </p>

      <div className="events-filters">
        <Input
          placeholder="Search events..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search events"
        />
        <Select
          placeholder="All Categories"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          options={categoryOptions}
          aria-label="Filter by category"
        />
      </div>

      {filteredEvents.length > 0 ? (
        <div className="events-grid">
          {filteredEvents.map((event) => {
            const slots = getEventSlotState(event);
            const reason = blockReason(event);
            return (
              <Card key={event.id} className="card--posting reveal-card">
                <span className="reveal-wipe" aria-hidden="true" />
                <div className="event-card-badges">
                  {event.category ? <Badge color="blue">{event.category}</Badge> : null}
                  <Badge color={slots.isFull ? 'red' : 'green'}>
                    {slots.isFull
                      ? 'No Slots Available'
                      : `${slots.available} of ${slots.total} slots remaining`}
                  </Badge>
                </div>
                <h3 className="event-card-title">{event.title}</h3>
                <p className="event-card-description">
                  {String(event.description || '').substring(0, 100)}
                  {event.description?.length > 100 ? '...' : ''}
                </p>
                <div className="event-card-meta">
                  <div><span className="meta-icon-svg"><Icon name="calendar" size={14} /></span>{formatEventWindow(event)}</div>
                  {event.location ? (
                    <div><span className="meta-icon-svg"><Icon name="pin" size={14} /></span>{event.location}</div>
                  ) : null}
                </div>
                {reason ? (
                  <Button size="sm" disabled className="event-apply-button">{reason}</Button>
                ) : (
                  <Button size="sm" onClick={() => setDetail(event)} className="event-apply-button">
                    View &amp; Apply
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="calendar"
          title="No Events Found"
          message="Try adjusting your search"
        />
      )}

      <Modal
        isOpen={Boolean(detail)}
        onClose={() => (applying ? undefined : setDetail(null))}
        title={detail?.title || 'Event'}
      >
        {detail ? (
          <div className="event-detail">
            <div className="event-card-badges">
              {detail.category ? <Badge color="blue">{detail.category}</Badge> : null}
              <Badge color={getEventSlotState(detail).isFull ? 'red' : 'green'}>
                {getEventSlotState(detail).isFull
                  ? 'No Slots Available'
                  : `${getEventSlotState(detail).available} of ${getEventSlotState(detail).total} slots remaining`}
              </Badge>
            </div>

            <div className="event-detail-row">
              <span className="event-detail-label">Schedule</span>
              <span className="event-detail-value">{formatEventWindow(detail)}</span>
            </div>
            {detail.location ? (
              <div className="event-detail-row">
                <span className="event-detail-label">Location</span>
                <span className="event-detail-value">{detail.location}</span>
              </div>
            ) : null}
            <div className="event-detail-row">
              <span className="event-detail-label">Apply before</span>
              <span className="event-detail-value">{detail.applicationDeadline || 'No deadline'}</span>
            </div>

            {detail.description ? (
              <p className="event-detail-description">{detail.description}</p>
            ) : null}

            {detailReason ? (
              <p className="event-detail-blocked">{detailReason}</p>
            ) : (
              <div className="event-detail-actions">
                <Button variant="outline" onClick={() => setDetail(null)} disabled={applying}>
                  Cancel
                </Button>
                <Button onClick={() => handleApply(detail)} disabled={applying}>
                  {applying ? 'Submitting...' : 'Apply'}
                </Button>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}

export default StudentEvents;
