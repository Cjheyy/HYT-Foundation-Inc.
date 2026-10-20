import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/helpers';
import { getApplicationsByStudent } from '../../services/applicationService';
import {
  ALREADY_DONE_LABEL,
  ONGOING_LABEL,
  findApplicationListing,
  formatListingSchedule,
  getApplicationExperienceState,
  getApplicationListingKind,
  getApplicationListingTypeLabel,
  getListingEndDate,
  isApplicationApproved,
  isApplicationPending,
  isApplicationRejected,
  isHoursAttributable
} from '../../utils/experience';
import './Applications.css';

const pluralize = (count, noun) => `${count} ${noun}${count === 1 ? '' : 's'}`;

export function StudentApplications() {
  const { state } = useApp();
  const { currentUser, applications, opportunities, programs, events } = state;
  const navigate = useNavigate();

  const myApplications = useMemo(
    () => getApplicationsByStudent(applications, currentUser?.id),
    [applications, currentUser?.id]
  );

  /**
   * Hours live on the user, not on the application, so they can only be
   * attributed to a single experience. When more than one is still running the
   * cards show the schedule only and let the date decide what is Done.
   */
  const hours = useMemo(() => {
    const required = Number(currentUser?.requiredHours || 0);
    const rendered = Number(currentUser?.renderedHours || 0);
    return {
      required,
      rendered,
      remaining: Math.max(0, Math.round((required - rendered) * 100) / 100),
      hasHours: required > 0
    };
  }, [currentUser?.requiredHours, currentUser?.renderedHours]);

  /**
   * Resolve each application against its listing once, then split by the state
   * that resolution produced. This is what keeps the Ongoing and Completed
   * sections honest: both come from the same date-aware call.
   */
  const resolved = useMemo(() => {
    const listings = { opportunities, programs, events };

    const withListing = myApplications.map((application) => ({
      application,
      listing: findApplicationListing(application, listings)
    }));

    // Only an OJT posting carries an hours requirement, so only those compete
    // for the student's single hours balance. Counting an event here would stop
    // the placement from ever completing on hours.
    const hoursAttributable = isHoursAttributable(
      withListing.filter(({ application }) => isApplicationApproved(application))
    );

    return withListing.map(({ application, listing }) => {
      const kind = getApplicationListingKind(application);
      return {
        application,
        listing,
        kind,
        hoursAttributable,
        isEvent: kind === 'event',
        // Hours belong to the OJT engagement. `required_hours` lives on the
        // user and on ojt_records; no event or programme row carries one, so
        // printing "120 / 500" there would invent a requirement.
        showsHours: kind === 'opportunity' && hours.hasHours,
        experienceState: getApplicationExperienceState(application, {
          listing,
          requiredHours: hours.required,
          renderedHours: hours.rendered,
          hoursAttributable
        })
      };
    });
  }, [myApplications, opportunities, programs, events, hours.required, hours.rendered, hours.hasHours]);

  const groups = useMemo(() => {
    const ongoing = [];
    const completed = [];
    const pending = [];
    const rejected = [];

    resolved.forEach((item) => {
      const { application, experienceState } = item;
      if (isApplicationRejected(application)) rejected.push(item);
      else if (isApplicationPending(application)) pending.push(item);
      else if (experienceState === ALREADY_DONE_LABEL) completed.push(item);
      else if (experienceState === ONGOING_LABEL) ongoing.push(item);
    });

    return { ongoing, completed, pending, rejected };
  }, [resolved]);

  /**
   * The listing's schedule, in words.
   *
   * An event is a diary entry, so the clock time IS the schedule - "20 October
   * 2026" on its own does not say when to turn up. A posting runs over weeks,
   * where the dates are what matter and the times would only add noise.
   */
  const renderWindow = (listing, isEvent) => formatListingSchedule(listing, { isEvent });

  const renderInfoRows = ({ listing, experienceState, isEvent, showsHours }) => {
    const schedule = renderWindow(listing, isEvent);
    const endDate = getListingEndDate(listing, { isEvent });
    const isDone = experienceState === ALREADY_DONE_LABEL;

    const rows = [];
    if (schedule) rows.push({ label: 'Schedule', value: schedule });

    if (showsHours) {
      rows.push({ label: 'Hours', value: `${hours.rendered} / ${hours.required}` });
      if (!isDone) rows.push({ label: 'Remaining', value: `${hours.remaining} hrs` });
    }

    if (isDone) {
      rows.push({ label: 'Finished', value: endDate ? formatDate(endDate) : 'Completed' });
    }

    if (!rows.length) return null;

    return (
      <dl className="application-facts">
        {rows.map((row) => (
          <div className="application-fact" key={row.label}>
            <dt>{row.label}</dt>
            <dd>{row.value}</dd>
          </div>
        ))}
      </dl>
    );
  };

  const renderCard = ({ application, listing, experienceState, isEvent, showsHours }) => {
    const isDone = experienceState === ALREADY_DONE_LABEL;
    const typeLabel = getApplicationListingTypeLabel(application);
    const location = listing?.location || listing?.organization || null;
    const badgeLabel = experienceState || 'Pending';

    return (
      <Card key={application.id}>
        <div className="application-card-header">
          <div className="application-card-info">
            <h3 className="application-card-title">
              {listing?.title || typeLabel}
            </h3>
            <p className="application-card-date">
              {typeLabel}
              {location ? ` · ${location}` : ''}
            </p>
            <p className="application-card-date">
              Applied on {formatDate(application.appliedAt || application.createdAt)}
            </p>
          </div>
          <Badge status={badgeLabel}>{badgeLabel}</Badge>
        </div>

        {renderInfoRows({ listing, experienceState, isEvent, showsHours })}

        {experienceState && (
          <div
            className={`application-accepted-notice${isDone ? ' is-done' : ''}`}
          >
            <strong>{experienceState}</strong>
            <p>
              {isDone
                ? 'This experience is complete. Your certificate is available on the Certificates page.'
                : 'Your application was approved and this experience is now ongoing. Track the dates and hours on your dashboard.'}
            </p>
          </div>
        )}
        {!experienceState && isApplicationRejected(application) && (
          <div className="application-declined-notice">
            <strong>Declined</strong>
            <p>Your application was not approved. Please contact support.</p>
          </div>
        )}
      </Card>
    );
  };

  const renderGroup = (title, rows, emptyHint, hint = null) => (
    <section className="applications-group">
      <div className="applications-group-header">
        <h2 className="applications-group-title">{title}</h2>
        <span className="applications-group-count">{rows.length}</span>
      </div>
      {hint && <p className="applications-group-hint">{hint}</p>}
      {rows.length > 0 ? (
        <div className="applications-list">{rows.map(renderCard)}</div>
      ) : (
        <p className="applications-group-empty">{emptyHint}</p>
      )}
    </section>
  );

  return (
    <div className="applications-page">
      <h1 className="page-title">My Applications</h1>
      <p className="applications-intro">All your applications, grouped by status.</p>

      {myApplications.length > 0 ? (
        <>
          {renderGroup(
            'Pending',
            groups.pending,
            'No applications are waiting for review.'
          )}
          {renderGroup(
            'Ongoing',
            groups.ongoing,
            'Nothing running right now.'
          )}
          {renderGroup(
            'Completed',
            groups.completed,
            'Nothing has finished yet.',
            groups.completed.length > 0
              ? `${pluralize(groups.completed.length, 'experience')} finished. These stay here for your records.`
              : null
          )}
          {groups.rejected.length > 0 &&
            renderGroup('Not approved', groups.rejected, '')}
        </>
      ) : (
        <EmptyState
          icon="file"
          title="No Applications Yet"
          message="Browse postings and apply to get started"
          action={true}
          actionText="Browse OJT Postings"
          onAction={() => navigate('/student/opportunities')}
        />
      )}
    </div>
  );
}
