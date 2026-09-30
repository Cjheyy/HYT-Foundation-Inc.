import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Icon } from '../../components/icons';
import { OPPORTUNITY_CATEGORIES } from '../../utils/helpers';
import { isEventActive, getEventSlotState, applicationReleasesSlot } from '../../services/supabaseService';
import './Opportunities.css';

export function StudentOpportunities() {
  const { state } = useApp();
  const { opportunities, currentUser, applications } = state;
  const navigate = useNavigate();

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');

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

  // An OJT/Intern may hold only ONE OJT posting application at a time — they
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

  const handleApply = (oppId) => {
    navigate('/opportunities/' + oppId);
  };

  return (
    <div className="student-opportunities-page">
      <h1 className="page-title">OJT Postings</h1>
      <p className="page-subtitle">OJT Postings are available to OJT / Internship applicants only.</p>

      {blockingOpportunityId && !isTrainee && (
        <Card>
          <p className="no-data">
            You already have an active OJT application. Only one OJT posting application is allowed per
            intern — withdraw or wait for a decision before applying to another posting.
          </p>
        </Card>
      )}

      {isTrainee && (
        <Card>
          <p className="no-data">OJT Postings are available to OJT / Internship applicants only. Please explore Trainee Programs & Events.</p>
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
            return (
              <Card key={opp.id}>
                <div className="opportunity-card-badges">
                  <Badge color="blue">{opp.category}</Badge>
                  <Badge color={slots.isFull ? 'red' : 'green'} className="px-2 py-0.5 text-xs rounded-full">
                    {slots.isFull ? 'No Slots Available' : `${slots.available} of ${slots.total} slots remaining`}
                  </Badge>
                </div>
                <h3 className="opportunity-card-title">{opp.title}</h3>
                <p className="opportunity-card-org">{opp.organization}</p>
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
                  <Button size="sm" onClick={() => handleApply(opp.id)} className="opportunity-apply-button">
                    View & Apply
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
    </div>
  );
}
