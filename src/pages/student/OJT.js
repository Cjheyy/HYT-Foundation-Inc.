import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { ProgressBar } from '../../components/ProgressBar';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { getOJTByStudent } from '../../services/ojtService';
import { normalizeStatus } from '../../services/supabaseService';
import { formatDate, calculateDaysCompleted } from '../../utils/helpers';
import { getRoleTerms } from '../../utils/roleTerms';
import { computeExperienceSchedule } from '../../utils/experience';
import './OJT.css';

/** Ring geometry, shared by the SVG attributes and the CSS custom properties. */
const RING_RADIUS = 52;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;
const MS_PER_DAY = 86400000;

export function StudentOJT() {
  const { state } = useApp();
  const { currentUser, ojtRecords, applications, opportunities, dataLoading } = state;

  // Shared by the OJT/Intern and Trainee portals — the Trainee used to read
  // "OJT / Experience" and "Apply to postings to start your OJT journey".
  const terms = getRoleTerms(currentUser?.role);

  const myOJT = getOJTByStudent(ojtRecords, currentUser?.id);

  const activePosting = useMemo(() => {
    const approved = (applications || []).find((app) => {
      const owner = app.userId || app.studentId;
      if (owner && owner !== currentUser?.id) return false;
      const isPosting = Boolean(app.opportunityId || app.opportunity_id || String(app.type || '').toUpperCase() === 'OPPORTUNITY');
      if (!isPosting) return false;
      return ['APPROVED', 'ACCEPTED', 'ACTIVE'].includes(normalizeStatus(app.status));
    });
    if (!approved) return null;
    const postingId = approved.opportunityId || approved.opportunity_id;
    const posting = (opportunities || []).find((o) => o.id === postingId) || null;
    return { application: approved, posting };
  }, [applications, opportunities, currentUser?.id]);

  const progress = useMemo(() => {
    const required = Number(currentUser?.requiredHours || myOJT?.requiredHours || 0);
    const rendered = Number(currentUser?.renderedHours || myOJT?.verifiedHours || 0);
    const percent = required > 0 ? Math.min(100, (rendered / required) * 100) : 0;
    return { required, rendered, percent };
  }, [currentUser, myOJT]);

  /**
   * Start date comes from the record (or the moment the application was
   * approved); the end date is derived from the hours still to be rendered, so
   * it moves forward as attendance is approved.
   */
  const schedule = useMemo(
    () => computeExperienceSchedule({
      startDate: myOJT?.startDate || activePosting?.application?.reviewedAt || activePosting?.application?.createdAt || null,
      requiredHours: progress.required,
      renderedHours: progress.rendered,
      completedAt: myOJT?.completionDate || null
    }),
    [myOJT, activePosting, progress]
  );

  /**
   * How much of the placement *window* has gone by, as opposed to how much of
   * the required hours have been rendered.
   *
   * These are different numbers and the gap between them is the honest signal:
   * the projected end date is derived from the hours still owed, so a trainee
   * who is behind sees the calendar running ahead of the hours. Null when there
   * is no usable window, in which case the measure is simply not offered.
   */
  const calendarProgress = useMemo(() => {
    const start = schedule.startDate ? new Date(schedule.startDate).getTime() : NaN;
    const end = schedule.endDate ? new Date(schedule.endDate).getTime() : NaN;
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
    const span = end - start;
    const elapsed = Math.min(span, Math.max(0, Date.now() - start));
    return {
      percent: (elapsed / span) * 100,
      daysElapsed: Math.floor(elapsed / MS_PER_DAY),
      daysTotal: Math.round(span / MS_PER_DAY)
    };
  }, [schedule.startDate, schedule.endDate]);

  const measures = useMemo(() => {
    const list = [{
      key: 'hours',
      label: 'Hours rendered',
      // "complete" rather than "rendered" once the hours are in, so a finished
      // placement says so on the card instead of just going quiet.
      caption: schedule.isComplete ? 'complete' : 'rendered',
      hasData: progress.required > 0,
      percent: progress.percent,
      ariaLabel: `Hours rendered: ${progress.rendered.toFixed(2)} of ${progress.required.toFixed(2)} hours, ${progress.percent.toFixed(1)} percent`
    }];
    if (calendarProgress) {
      list.push({
        key: 'calendar',
        label: 'Calendar',
        caption: 'of window',
        hasData: true,
        percent: calendarProgress.percent,
        ariaLabel: `Calendar elapsed: day ${calendarProgress.daysElapsed} of ${calendarProgress.daysTotal}, ${calendarProgress.percent.toFixed(1)} percent`
      });
    }
    return list;
  }, [progress, calendarProgress, schedule.isComplete]);

  const [measureKey, setMeasureKey] = useState('hours');
  // Falls back to the first measure when the selected one is no longer offered
  // (e.g. the calendar window disappeared after a data refresh).
  const activeMeasure = measures.find((m) => m.key === measureKey) || measures[0];

  if (dataLoading) {
    return (
      <div className="ojt-page">
        <Skeleton width="220px" height={30} style={{ marginBottom: 20 }} />
        <div className="ojt-content">
          <Card>
            <Skeleton width="45%" height={20} style={{ marginBottom: 16 }} />
            <Skeleton width="90%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="70%" height={14} style={{ marginBottom: 8 }} />
            <Skeleton width="55%" height={14} />
          </Card>
          <Card>
            <Skeleton width="35%" height={20} style={{ marginBottom: 16 }} />
            <Skeleton width="100%" height={96} radius={12} />
          </Card>
        </div>
      </div>
    );
  }

  if (!myOJT && !activePosting) {
    return (
      <div className="ojt-page">
        <h1 className="page-title">{terms.experienceLabel}</h1>
        <EmptyState
          icon="briefcase"
          title="No Active OJT Program"
          message={terms.journeyEmptyMessage}
        />
      </div>
    );
  }

  if (!myOJT && activePosting) {
    const { application, posting } = activePosting;
    const approvedDate = application.reviewedAt || application.updatedAt || application.createdAt;

    const ringOffset = RING_CIRCUMFERENCE * (1 - (activeMeasure.hasData ? activeMeasure.percent : 0) / 100);
    const showRail = Boolean(schedule.startDate && schedule.endDate);
    const railPercent = schedule.isComplete ? 100 : (calendarProgress ? calendarProgress.percent : 0);

    return (
      <div className="ojt-page">
        <h1 className="page-title">{terms.experienceLabel}</h1>
        <div className="ojt-content">
          <Card className="ojt-details-section ojt-placement-card">
            <div className="ojt-placement-head">
              <h3>Active Placement</h3>
              <Badge status="Accepted">Accepted</Badge>
            </div>

            <div className="ojt-placement-split">
              <div className="ojt-placement-main">
                <dl className="ojt-facts">
                  <div className="ojt-fact ojt-fact--hero">
                    <dt>Position Title</dt>
                    <dd>{posting?.title || terms.postingLabel}</dd>
                  </div>
                  <div className="ojt-fact">
                    <dt>Company / Foundation Branch</dt>
                    <dd>{posting?.organization || posting?.location || 'HYT Foundation Inc.'}</dd>
                  </div>
                  <div className="ojt-fact">
                    <dt>Approved Date</dt>
                    <dd>{approvedDate ? formatDate(approvedDate) : '--'}</dd>
                  </div>
                  <div className="ojt-fact">
                    <dt>Start Date</dt>
                    <dd>{schedule.startDate ? formatDate(schedule.startDate) : '--'}</dd>
                  </div>
                  <div className="ojt-fact">
                    <dt>{schedule.isComplete ? 'End Date' : 'Projected End Date'}</dt>
                    <dd>{schedule.endDate ? formatDate(schedule.endDate) : '--'}</dd>
                  </div>
                </dl>

                {showRail && (
                  <div
                    className="ojt-rail"
                    role="img"
                    aria-label={
                      schedule.isComplete
                        ? `Placement timeline: ${formatDate(schedule.startDate)} to ${formatDate(schedule.endDate)}, complete.`
                        : `Placement timeline: started ${formatDate(schedule.startDate)}, today ${formatDate(new Date())}, projected to end ${formatDate(schedule.endDate)}.`
                    }
                    style={{ '--ojt-rail-pct': `${railPercent}%` }}
                  >
                    <div className="ojt-rail-track">
                      <span className="ojt-rail-elapsed" />
                      {!schedule.isComplete && (
                        <>
                          <span className="ojt-rail-today" />
                          {/* Sits ON the marker. A centred "Today" label in the row
                              below read as "today is halfway through the window"
                              whenever the elapsed fraction was small. */}
                          <span className="ojt-rail-flag">Today</span>
                        </>
                      )}
                    </div>
                    <div className="ojt-rail-labels">
                      <div className="ojt-rail-node">
                        <b>Approved &amp; Started</b>
                        <span>{formatDate(schedule.startDate)}</span>
                      </div>
                      <div className="ojt-rail-node ojt-rail-node--end">
                        <b>{schedule.isComplete ? 'End Date' : 'Projected End'}</b>
                        <span>{formatDate(schedule.endDate)}</span>
                      </div>
                    </div>
                  </div>
                )}

                <dl className="ojt-hours">
                  <div>
                    <dt>Rendered</dt>
                    <dd>{progress.rendered.toFixed(2)} hrs</dd>
                  </div>
                  <div>
                    <dt>Remaining</dt>
                    <dd>{schedule.remainingHours.toFixed(2)} hrs</dd>
                  </div>
                  {schedule.hasSchedule && !schedule.isComplete && (
                    <div>
                      <dt>Working Days Remaining</dt>
                      <dd>
                        {schedule.workDaysRemaining}{' '}
                        <span className="ojt-hours-hint">
                          ({schedule.remainingHours.toFixed(2)} hrs at {schedule.hoursPerDay} hrs/day)
                        </span>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>

              <aside className="ojt-panel">
                <div className="ojt-panel-top">
                  <span className="ojt-eyebrow">Progress</span>
                  {measures.length > 1 && (
                    <div className="ojt-seg" role="group" aria-label="Which progress measure to show">
                      {measures.map((measure) => (
                        <button
                          key={measure.key}
                          type="button"
                          aria-pressed={measure.key === activeMeasure.key}
                          onClick={() => setMeasureKey(measure.key)}
                        >
                          {measure.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ojt-ring-wrap" role="img" aria-label={activeMeasure.ariaLabel}>
                  <svg className="ojt-ring" viewBox="0 0 120 120" aria-hidden="true" focusable="false">
                    <circle className="ojt-ring-track" cx="60" cy="60" r={RING_RADIUS} />
                    <circle
                      className="ojt-ring-fill"
                      cx="60"
                      cy="60"
                      r={RING_RADIUS}
                      style={{
                        '--ojt-ring-circumference': `${RING_CIRCUMFERENCE}px`,
                        '--ojt-ring-offset': `${ringOffset}px`
                      }}
                    />
                  </svg>
                  <div className="ojt-ring-center">
                    <b>{activeMeasure.hasData ? `${activeMeasure.percent.toFixed(1)}%` : '—'}</b>
                    <span>{activeMeasure.caption}</span>
                  </div>
                </div>

                <p className="ojt-panel-line">
                  Rendered: <b>{progress.rendered.toFixed(2)} / {progress.required.toFixed(2)} hrs</b>
                </p>

                {/* The ring already announces this figure to assistive tech, so
                    the bar and its scale marks stay decorative. */}
                <div className="ojt-bar" aria-hidden="true">
                  <ProgressBar value={activeMeasure.percent} max={100} showLabel={false} className="ojt-bar-inner" />
                </div>
                <div className="ojt-ticks" aria-hidden="true">
                  {[25, 50, 75].map((at) => (
                    <span key={at} style={{ left: `${at}%` }}>{at}%</span>
                  ))}
                </div>
              </aside>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="ojt-page">
      <h1 className="page-title">{terms.experienceLabel}</h1>

      <div className="ojt-content">
        <Card className="ojt-details-section">
          <h3>Program Details</h3>
          <div className="ojt-details-grid">
            <div><strong>Company:</strong> {myOJT.company}</div>
            <div><strong>Supervisor:</strong> {myOJT.supervisor}</div>
            <div><strong>Start Date:</strong> {schedule.startDate ? formatDate(schedule.startDate) : formatDate(myOJT.startDate)}</div>
            <div>
              <strong>{schedule.isComplete ? 'End Date:' : 'Projected End Date:'}</strong>{' '}
              {schedule.endDate ? formatDate(schedule.endDate) : '--'}
            </div>
            {schedule.hasSchedule && !schedule.isComplete && (
              <div>
                <strong>Working Days Remaining:</strong> {schedule.workDaysRemaining}{' '}
                <span className="ojt-detail-hint">
                  ({schedule.remainingHours.toFixed(2)} hrs at {schedule.hoursPerDay} hrs/day)
                </span>
              </div>
            )}
            <div><strong>Days Completed:</strong> {calculateDaysCompleted(myOJT.startDate)}</div>
            <div><Badge status={myOJT.status}>{myOJT.status}</Badge></div>
          </div>
        </Card>

        <Card className="ojt-details-section">
          <h3>Hours Tracking</h3>
          <div className="ojt-hours-grid">
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value">{myOJT.requiredHours}</div>
              <div className="ojt-hour-label">Required</div>
            </div>
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value verified">{myOJT.verifiedHours}</div>
              <div className="ojt-hour-label">Verified</div>
            </div>
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value pending">{myOJT.pendingHours || 0}</div>
              <div className="ojt-hour-label">Pending</div>
            </div>
            <div className="ojt-hour-stat">
              <div className="ojt-hour-value remaining">{myOJT.remainingHours}</div>
              <div className="ojt-hour-label">Remaining</div>
            </div>
          </div>
          <ProgressBar value={myOJT.progress} max={100} showLabel={true} />
        </Card>

        {myOJT.status === 'Completed' && (
          <Card className="ojt-completion-notice">
            <h3 className="ojt-completion-title">{terms.completionTitle}</h3>
            <p className="ojt-completion-text">{terms.completionNotice}</p>
          </Card>
        )}
      </div>
    </div>
  );
}
