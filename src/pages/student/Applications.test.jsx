import { render, screen } from '@testing-library/react';
import { StudentApplications } from './Applications';

/**
 * The My Applications card, for an EVENT.
 *
 * An event is a diary entry, not an engagement. Two things therefore have to be
 * true and both were wrong at once:
 *
 *   1. The card must NOT print Hours / Remaining. `required_hours` lives on the
 *      user and on ojt_records - no event row carries one - so an event card
 *      used to invent a requirement by reusing the student's OJT total.
 *   2. The Schedule must carry the clock time. "October 20, 2026" alone does
 *      not tell anyone when to turn up, and the time is the only thing that
 *      distinguishes a one-day event.
 */

let mockState = {};

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({ state: mockState })
}));

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn()
}));

const student = { id: 'u1', requiredHours: 486, renderedHours: 120 };

const baseState = (overrides) => ({
  currentUser: student,
  applications: [],
  opportunities: [],
  programs: [],
  events: [],
  ...overrides
});

const renderPage = (state) => {
  mockState = baseState(state);
  return render(<StudentApplications />);
};

describe('an event application card', () => {
  const eventApplication = {
    id: 'a1',
    userId: 'u1',
    status: 'APPROVED',
    eventId: 'e1',
    appliedAt: '2026-10-01T09:00:00'
  };

  test('prints the schedule with the clock time, not just the date', () => {
    renderPage({
      applications: [eventApplication],
      events: [
        {
          id: 'e1',
          title: 'Coastal Cleanup',
          startsAt: '2026-10-20T08:00:00',
          endsAt: '2026-10-20T17:00:00'
        }
      ]
    });

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    const value = screen.getByText(/08:00 AM/);
    expect(value).toHaveTextContent('05:00 PM');
    expect(value).toHaveTextContent('October 20, 2026');
  });

  test('does not claim the student owes OJT hours for it', () => {
    renderPage({
      applications: [eventApplication],
      events: [
        {
          id: 'e1',
          title: 'Coastal Cleanup',
          startsAt: '2026-10-20T08:00:00',
          endsAt: '2026-10-20T17:00:00'
        }
      ]
    });

    expect(screen.queryByText('Hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Remaining')).not.toBeInTheDocument();
    expect(screen.queryByText('120 / 486')).not.toBeInTheDocument();
  });

  test('a start-only event still shows a time and stays Ongoing today', () => {
    const today = new Date();
    const soon = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    const start = `${soon.getFullYear()}-${String(soon.getMonth() + 1).padStart(2, '0')}-${String(
      soon.getDate()
    ).padStart(2, '0')}T08:00:00`;

    renderPage({
      applications: [eventApplication],
      events: [{ id: 'e1', title: 'Coastal Cleanup', startsAt: start }]
    });

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.getByText(/08:00 AM/)).toBeInTheDocument();
    // The card's own notice, not the section heading, which also says "Ongoing".
    expect(screen.getByText(/this experience is now ongoing/i)).toBeInTheDocument();
  });
});

describe('a training programme application card', () => {
  test('does not show an hours requirement it does not have', () => {
    renderPage({
      applications: [{ id: 'a5', userId: 'u1', status: 'APPROVED', programId: 'p1' }],
      programs: [{ id: 'p1', title: 'Leadership Camp', scheduleStart: '2026-11-01', scheduleEnd: '2026-11-05' }]
    });

    expect(screen.getByText('Schedule')).toBeInTheDocument();
    expect(screen.queryByText('Hours')).not.toBeInTheDocument();
    expect(screen.queryByText('Remaining')).not.toBeInTheDocument();
  });
});

describe('an event beside an OJT posting', () => {
  test('only the posting reports hours, and it still completes on them', () => {
    mockState = baseState({
      currentUser: { id: 'u1', requiredHours: 486, renderedHours: 486 },
      applications: [
        { id: 'a6', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' },
        { id: 'a7', userId: 'u1', status: 'APPROVED', eventId: 'e9' }
      ],
      opportunities: [{ id: 'o1', title: 'Software Intern', scheduleStart: '2026-09-01' }],
      events: [{ id: 'e9', title: 'Future Cleanup', startsAt: '2099-01-01T00:00:00' }]
    });
    render(<StudentApplications />);

    // Exactly one card carries the hours rows: the posting.
    expect(screen.getAllByText('Hours')).toHaveLength(1);
    expect(screen.getByText('486 / 486')).toBeInTheDocument();

    // The posting is finished on hours; the event is untouched by that balance.
    expect(screen.getByText(/this experience is complete/i)).toBeInTheDocument();
    expect(screen.getByText(/this experience is now ongoing/i)).toBeInTheDocument();
  });
});

describe('a whole-day event card', () => {
  test('reads as a whole day, not a midnight-to-midnight clock range', () => {
    renderPage({
      applications: [{ id: 'a8', userId: 'u1', status: 'APPROVED', eventId: 'e10' }],
      events: [
        {
          id: 'e10',
          title: 'Coastal Cleanup',
          startsAt: '2099-04-22T00:00:00',
          endsAt: '2099-04-22T23:59:00'
        }
      ]
    });

    expect(screen.getByText('April 22, 2099 · Whole day')).toBeInTheDocument();
    expect(screen.queryByText(/12:00 AM/)).not.toBeInTheDocument();
  });
});

describe('an OJT posting application card', () => {
  test('still reports rendered against required hours', () => {
    renderPage({
      applications: [{ id: 'a2', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' }],
      opportunities: [
        {
          id: 'o1',
          title: 'Software Intern',
          scheduleStart: '2026-09-01',
          scheduleEnd: '2026-12-20'
        }
      ]
    });

    expect(screen.getByText('Hours')).toBeInTheDocument();
    expect(screen.getByText('120 / 486')).toBeInTheDocument();
    expect(screen.getByText('Remaining')).toBeInTheDocument();
    expect(screen.getByText('366 hrs')).toBeInTheDocument();
  });

  test('does not print a clock time for a multi-week schedule', () => {
    renderPage({
      applications: [{ id: 'a2', userId: 'u1', status: 'APPROVED', opportunityId: 'o1' }],
      opportunities: [
        {
          id: 'o1',
          title: 'Software Intern',
          scheduleStart: '2026-09-01',
          scheduleEnd: '2026-12-20'
        }
      ]
    });

    expect(screen.getByText('September 1, 2026 - December 20, 2026')).toBeInTheDocument();
  });
});

describe('a finished event', () => {
  test('moves to the Done section with a Finished date', () => {
    renderPage({
      applications: [{ id: 'a3', userId: 'u1', status: 'APPROVED', eventId: 'e1' }],
      events: [
        {
          id: 'e1',
          title: 'Past Cleanup',
          startsAt: '2020-03-01T08:00:00',
          endsAt: '2020-03-01T17:00:00'
        }
      ]
    });

    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getByText('March 1, 2020')).toBeInTheDocument();
    expect(screen.getByText(/this experience is complete/i)).toBeInTheDocument();
  });

  test('a start-only past event is Done too, not stuck on Ongoing', () => {
    renderPage({
      applications: [{ id: 'a4', userId: 'u1', status: 'APPROVED', eventId: 'e2' }],
      events: [{ id: 'e2', title: 'Start Only', startsAt: '2020-05-04T08:00:00' }]
    });

    expect(screen.getByRole('heading', { name: 'Done' })).toBeInTheDocument();
    expect(screen.getByText('Finished')).toBeInTheDocument();
    expect(screen.getByText('May 4, 2020')).toBeInTheDocument();
    expect(screen.getByText(/this experience is complete/i)).toBeInTheDocument();
  });
});
