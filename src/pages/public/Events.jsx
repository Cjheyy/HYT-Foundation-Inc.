import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { EmptyState } from '../../components/EmptyState';
import { Badge } from '../../components/Badge';
import { Icon } from '../../components/icons';
import { EVENT_CATEGORIES, formatDate } from '../../utils/helpers';
import { getEventSlotState, isEventActive, normalizeRole } from '../../services/supabaseService';
import { formatEventWindow } from '../student/Events';
import './Programs.css';

/**
 * Public Events listing.
 *
 * Events are their own listing kind - separate from the Dream Academy training
 * programmes - so the landing page links to them separately (see PublicHeader).
 * Only PUBLISHED events are shown: the row is also filtered by RLS, so an event
 * left in Draft is invisible to a guest no matter what this page does.
 *
 * Guests browse freely; the call to action sends them to sign in. A signed-in
 * visitor is handed off to the events listing inside their own portal, because
 * the application flow needs a session and the three rules that guard it
 * (one per event, at most three live, no overlap) live there.
 *
 * The markup and the stylesheet are the ones the public Programmes page already
 * uses, so the two listings read as one family without a second stylesheet.
 */
export function Events() {
  const { state } = useApp();
  const { events, currentUser } = state;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

  const publishedEvents = useMemo(
    () => (events || []).filter(
      (item) => String(item.status).toLowerCase() === 'published' && isEventActive(item)
    ),
    [events]
  );

  const filteredEvents = publishedEvents.filter((event) => {
    const haystack = `${event.title || ''} ${event.description || ''}`.toLowerCase();
    const matchesSearch = haystack.includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || event.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  /** Guests sign in first; a signed-in visitor continues in their own portal. */
  const action = useMemo(() => {
    if (!currentUser) return { label: 'Log In to Apply', path: '/login' };
    const role = normalizeRole(currentUser.role);
    // An admin does not apply to events, so the label must not promise it -
    // they land on the management page, where the only actions are edit,
    // publish and review.
    if (role === 'ADMIN') return { label: 'Manage Events', path: '/admin/events' };
    if (role === 'TRAINEE') return { label: 'View & Apply', path: '/trainee/events' };
    if (role === 'OJT/INTERN') return { label: 'View & Apply', path: '/student/events' };
    return { label: 'Log In to Apply', path: '/login' };
  }, [currentUser]);

  return (
    <div className="programs-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Events</h1>
          <p className="page-subtitle">
            Join the activities the foundation runs for the youth it serves
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="filters-section">
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
              options={EVENT_CATEGORIES}
              aria-label="Filter by category"
            />
          </div>

          {filteredEvents.length > 0 ? (
            <div className="programs-grid">
              {filteredEvents.map((event) => {
                const slots = getEventSlotState(event);
                return (
                  <Card key={event.id} className="program-card reveal-card">
                    <span className="reveal-wipe" aria-hidden="true" />
                    <div className="program-header">
                      {/* Same reasoning as the Programmes page: the slots pill
                          is green (red when full), so the category pill must
                          never also be green or the two read as one lozenge. */}
                      {event.category ? <Badge color="blue">{event.category}</Badge> : null}
                      <Badge color={slots.isFull ? 'red' : 'green'}>
                        {slots.isFull ? 'Full' : `${slots.available} slots remaining`}
                      </Badge>
                    </div>
                    <h3 className="program-title">{event.title}</h3>
                    <p className="program-description">
                      {String(event.description || '').substring(0, 150)}
                      {event.description?.length > 150 ? '...' : ''}
                    </p>
                    <div className="program-meta">
                      <div className="meta-item">
                        <span className="meta-icon"><Icon name="calendar" size={15} /></span>
                        <span>{formatEventWindow(event)}</span>
                      </div>
                      {event.location ? (
                        <div className="meta-item">
                          <span className="meta-icon"><Icon name="pin" size={15} /></span>
                          <span>{event.location}</span>
                        </div>
                      ) : null}
                      {event.applicationDeadline ? (
                        <div className="meta-item">
                          <span className="meta-icon"><Icon name="clock" size={15} /></span>
                          <span>Apply before {formatDate(event.applicationDeadline) || '-'}</span>
                        </div>
                      ) : null}
                    </div>
                    {/* No inline marginTop: the card is a flex column and the
                        shared rule pins this last child to the foot, so every
                        card in the row shares one button baseline. */}
                    <Button
                      size="sm"
                      style={{ width: '100%' }}
                      onClick={() => navigate(action.path)}
                    >
                      {action.label}
                    </Button>
                  </Card>
                );
              })}
            </div>
          ) : (
            <EmptyState
              icon="calendar"
              title="No Events Found"
              message="Try adjusting your filters or search terms"
            />
          )}
        </div>
      </section>
    </div>
  );
}
