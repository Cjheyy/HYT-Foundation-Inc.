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
import { OPPORTUNITY_CATEGORIES } from '../../utils/helpers';
import { formatDate } from '../../utils/helpers';
import { formatListingSchedule, getListingPosition, getListingSummary } from '../../utils/experience';
import {
  applyToOpportunity,
  applicationReleasesSlot,
  getEventSlotState,
  isEventActive
} from '../../services/supabaseService';
import { toast } from 'react-toastify';
import './Opportunities.css';

/**
 * OJT Postings catalogue.
 *
 * "View & Apply" used to navigate to `/opportunities/:id` - the PUBLIC landing
 * page. That threw the signed-in intern out of their portal into the marketing
 * site, where the apply button either asked them to sign in again or was not
 * there at all, and the only way back was the browser's Back button.
 *
 * The posting now opens in place, as a modal over the catalogue, and the
 * application is submitted from the portal itself. Nothing leaves `/student`.
 */
export function StudentOpportunities() {
  const { state, refreshData } = useApp();
  const { opportunities, currentUser, applications } = state;

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [activePosting, setActivePosting] = useState(null);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');

  const userRole = String(currentUser?.role || '').trim().toUpperCase().replace(/[\s-]+/g, '_');
  const isTrainee = userRole === 'TRAINEE' || userRole === 'STUDENT';

  // OJT Postings are visible ONLY to OJT/Internship applicants.
  const accountTypeFilteredOpps = useMemo(() => {
    if (!currentUser) return [];
    if (isTrainee) return [];
    return (opportunities || []).filter(() => true);
  }, [opportunities, currentUser, isTrainee]);

  const publishedOpportunities = accountTypeFilteredOpps.filter((opportunity) =>
    String(opportunity.status).toLowerCase() === 'published' && isEventActive(opportunity)
  );
  const myApplicationIds = useMemo(() => (applications || [])
    .filter((app) => (app.studentId || app.userId) === currentUser?.id)
    .map((app) => app.opportunityId || app.opportunity_id)
    .filter(Boolean), [applications, currentUser]);

  // An OJT/Intern may hold only ONE OJT posting application at a time - they
  // cannot be placed at two companies at once. Rejected/withdrawn applications
  // release the hold. This mirrors applyToEvent()'s server-side guard so the UI
  // never dangles an action the server would reject.
  const blockingOpportunityId = useMemo(() => {
    const blocking = (applications || []).find((app) => {
      if ((app.studentId || app.userId) !== currentUser?.id) return false;
      const oppId = app.opportunityId || app.opportunity_id;
      if (!oppId) return false;
      return !applicationReleasesSlot(app.status);
    });
    return blocking ? (blocking.opportunityId || blocking.opportunity_id) : null;
  }, [applications, currentUser]);

  const filteredOpportunities = publishedOpportunities.filter(opp => {
    const matchesSearch = String(opp.title || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
                         String(opp.organization || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = !selectedCategory || opp.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const openPosting = (opp) => {
    setActivePosting(opp);
    setApplyError('');
  };

  const closePosting = () => {
    if (applying) return;
    setActivePosting(null);
    setApplyError('');
  };

  const handleApply = async () => {
    if (!activePosting || !currentUser?.id) return;
    try {
      setApplying(true);
      setApplyError('');
      await applyToOpportunity(activePosting.id, currentUser.id);
      toast.success(`Application sent for ${activePosting.title}.`);
      setActivePosting(null);
      await refreshData().catch(() => undefined);
    } catch (error) {
      // Slot-full, "one application only" and the approval gate all arrive here
      // with a readable message from the service. Shown inside the modal so the
      // posting stays open for a retry.
      console.error('Apply to posting error:', error);
      setApplyError(error.message || 'The application could not be sent.');
    } finally {
      setApplying(false);
    }
  };

  const activeSlots = activePosting ? getEventSlotState(activePosting) : null;
  const activeAlreadyApplied = Boolean(activePosting) && myApplicationIds.includes(activePosting.id);
  const activeBlocked = Boolean(blockingOpportunityId) && blockingOpportunityId !== activePosting?.id;

  return (
    <div className="student-opportunities-page">
      <h1 className="page-title">OJT Postings</h1>
      <p className="page-subtitle">OJT Postings are available to OJT / Internship applicants only.</p>

      {blockingOpportunityId && !isTrainee && (
        <Card>
          <p className="no-data">
            You already have an active OJT application. Only one OJT posting application is allowed per
            intern - withdraw or wait for a decision before applying to another posting.
          </p>
        </Card>
      )}

      {isTrainee && (
        <Card>
          <p className="no-data">OJT Postings are available to OJT / Internship applicants only. Please explore Events instead.</p>
        </Card>
      )}

      {!isTrainee && (
      <>
      <div className="opportunities-filters">
        <Input
          placeholder="Search opportunities..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <Select
          placeholder="All Categories"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          options={OPPORTUNITY_CATEGORIES}
        />
      </div>

      {filteredOpportunities.length > 0 ? (
        <div className="opportunities-grid">
          {filteredOpportunities.map((opp) => {
            const slots = getEventSlotState(opp);
            const alreadyApplied = myApplicationIds.includes(opp.id);
            const blockedByOther = Boolean(blockingOpportunityId) && blockingOpportunityId !== opp.id;
            const position = getListingPosition(opp);
            return (
              <Card
                key={opp.id}
                className="card--posting reveal-card posting-card-clickable"
                onClick={() => openPosting(opp)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openPosting(opp);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label={`Open ${opp.title}`}
              >
                {/* Same clip-path circle reveal as the Home rails. */}
                <span className="reveal-wipe" aria-hidden="true" />
                <div className="opportunity-card-badges">
                  <Badge color="blue">{opp.category}</Badge>
                  <Badge color={slots.isFull ? 'red' : 'green'}>
                    {slots.isFull ? 'No Slots Available' : `${slots.available} of ${slots.total} slots remaining`}
                  </Badge>
                </div>
                <h3 className="opportunity-card-title">{opp.title}</h3>
                <p className="opportunity-card-org">{opp.organization}</p>
                {position && <p className="opportunity-card-position">{position}</p>}
                <p className="opportunity-card-description">
                  {String(opp.description || '').substring(0, 100)}{opp.description?.length > 100 ? '...' : ''}
                </p>
                <div className="opportunity-card-meta">
                  <div><span className="meta-icon-svg"><Icon name="pin" size={14} /></span>{opp.location}</div>
                  <div><span className="meta-icon-svg"><Icon name="clock" size={14} /></span>{opp.requiredHours} hours</div>
                </div>
                {alreadyApplied ? (
                  <Badge color="green">Already Applied</Badge>
                ) : blockedByOther ? (
                  <Button size="sm" disabled className="opportunity-apply-button">
                    One OJT Application Only
                  </Button>
                ) : slots.isFull ? (
                  <Button size="sm" disabled className="opportunity-apply-button">
                    No Slots Available
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    className="opportunity-apply-button"
                    onClick={(event) => {
                      // The card itself opens the posting; the button opens the
                      // same modal without firing the card handler twice.
                      event.stopPropagation();
                      openPosting(opp);
                    }}
                  >
                    View &amp; Apply
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon="target"
          title="No OJT Postings Found"
          message="Try adjusting your search"
        />
      )}
      </>
      )}

      <Modal
        isOpen={Boolean(activePosting)}
        onClose={closePosting}
        title={activePosting?.title || 'OJT Posting'}
      >
        {activePosting && (
          <div className="posting-modal">
            <div className="posting-modal-head">
              <p className="posting-modal-org">{activePosting.organization}</p>
              <div className="opportunity-card-badges">
                <Badge color="blue">{activePosting.category}</Badge>
                <Badge color={activeSlots.isFull ? 'red' : 'green'}>
                  {activeSlots.isFull
                    ? 'No Slots Available'
                    : `${activeSlots.available} of ${activeSlots.total} slots remaining`}
                </Badge>
              </div>
            </div>

            <dl className="posting-modal-facts">
              {getListingPosition(activePosting) && (
                <>
                  <dt>Position</dt>
                  <dd>{getListingPosition(activePosting)}</dd>
                </>
              )}
              <dt>Location</dt>
              <dd>{activePosting.location || '--'}</dd>
              <dt>Required hours</dt>
              <dd>{activePosting.requiredHours ? `${activePosting.requiredHours} hours` : '--'}</dd>
              <dt>Schedule</dt>
              <dd>{formatListingSchedule(activePosting) || 'Not specified'}</dd>
              {activePosting.applicationDeadline && (
                <>
                  <dt>Apply by</dt>
                  <dd>{formatDate(activePosting.applicationDeadline)}</dd>
                </>
              )}
            </dl>

            <div className="posting-modal-body">
              <h4>About this posting</h4>
              <p>{getListingSummary(activePosting, 1200) || 'No description was provided.'}</p>
            </div>

            {applyError && (
              <div className="form-error posting-modal-error" role="alert">{applyError}</div>
            )}

            <div className="modal-actions posting-modal-actions">
              {activeAlreadyApplied ? (
                <Badge color="green">Already Applied</Badge>
              ) : activeBlocked ? (
                <Button disabled>One OJT Application Only</Button>
              ) : activeSlots.isFull ? (
                <Button disabled>No Slots Available</Button>
              ) : (
                <Button onClick={handleApply} disabled={applying}>
                  {applying ? 'Sending...' : 'Submit Application'}
                </Button>
              )}
              <Button variant="ghost" onClick={closePosting} disabled={applying}>Close</Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
