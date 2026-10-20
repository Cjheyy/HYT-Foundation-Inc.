import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { AdminEvents } from './Events';

/**
 * The multi-day hint on the admin event form.
 *
 * An event is stored as ONE continuous `starts_at` -> `ends_at` window, not as
 * a row per day. That is the right shape for an event that genuinely fills each
 * day, but it over-blocks when the event only runs a few hours a day: the whole
 * night in between counts as occupied, and the student is barred from any other
 * event for the span. The form therefore warns.
 *
 * Two things have to hold, and the second matters more than the first:
 *
 *   1. The hint appears exactly when the two timestamps fall on different days.
 *   2. It is a HINT. It must never stop the save, because a genuinely all-day
 *      multi-day event is legitimate and the admin is the one who knows.
 *
 * `DateField` is stubbed down to a plain input. This file is about the warning
 * wiring, not about the calendar popup, which has its own tests; driving the
 * real picker here would make the test about clicking day cells.
 */

// CRA's Jest config turns on `resetMocks`, which strips every mock's
// implementation before each test. Anything that has to RETURN something is
// therefore given its implementation in `beforeEach` below, never inline in the
// factory - an inline implementation works for the first test in the file and
// silently returns `undefined` for every one after it.
const mockCreateEvent = jest.fn();
const mockCleanupExpiredEvents = jest.fn();
const mockDispatch = jest.fn();
const mockRefreshData = jest.fn();

jest.mock('../../services/supabaseService', () => ({
  cleanupExpiredEvents: (...args) => mockCleanupExpiredEvents(...args),
  createEvent: (...args) => mockCreateEvent(...args),
  createAnnouncement: jest.fn(),
  deleteEvent: jest.fn(),
  getEventSlotState: jest.fn(),
  isEventActive: jest.fn()
}));

jest.mock('../../utils/notifications', () => ({
  showToast: jest.fn()
}));

// The start/end fields are labelled with `aria-label` rather than `label`, so
// the stub has to honour both forms or the fields are unfindable.
jest.mock('../../components/DateField', () => ({
  DateField: ({ label, name, value, onChange, error, ...rest }) => {
    const accessibleName = rest['aria-label'] || label;
    return (
      <div>
        <label htmlFor={name}>{accessibleName}</label>
        <input
          id={name}
          name={name}
          value={value}
          aria-label={accessibleName}
          aria-invalid={error ? 'true' : undefined}
          onChange={(event) => onChange(event)}
        />
      </div>
    );
  }
}));

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({
    state: { events: [], currentUser: { id: 'admin1' } },
    dispatch: (...args) => mockDispatch(...args),
    refreshData: (...args) => mockRefreshData(...args)
  })
}));

const service = jest.requireMock('../../services/supabaseService');

const WARNING = /runs across more than one day/i;

const openForm = () => {
  render(<AdminEvents />);
  fireEvent.click(screen.getByRole('button', { name: /create event/i }));
};

// Required fields render their label as "Event Title *", with the asterisk
// aria-hidden but still part of the label's text content, so an exact string
// match misses. Match the prefix instead.
const setField = (label, value) => {
  fireEvent.change(screen.getByLabelText(new RegExp(`^${label}`)), {
    target: { value }
  });
};

const setWindow = (startsAt, endsAt) => {
  fireEvent.change(screen.getByLabelText('Event start date and time'), {
    target: { value: startsAt }
  });
  fireEvent.change(screen.getByLabelText('Event end date and time'), {
    target: { value: endsAt }
  });
};

beforeEach(() => {
  mockCreateEvent.mockReset();
  mockCreateEvent.mockResolvedValue({ id: 'e1', title: 'Cleanup Drive', status: 'Draft' });
  mockCleanupExpiredEvents.mockReset();
  mockCleanupExpiredEvents.mockResolvedValue(undefined);
  mockDispatch.mockClear();
  mockRefreshData.mockReset();
  mockRefreshData.mockResolvedValue(undefined);

  service.createAnnouncement.mockReset();
  service.createAnnouncement.mockResolvedValue({ id: 'a1' });
  service.deleteEvent.mockReset();
  service.deleteEvent.mockResolvedValue(undefined);
  service.getEventSlotState.mockReset();
  service.getEventSlotState.mockReturnValue({ total: 20, available: 20 });
  service.isEventActive.mockReset();
  service.isEventActive.mockReturnValue(true);
});

describe('admin event form - multi-day hint', () => {
  it('stays quiet for a same-day event', () => {
    openForm();
    setWindow('2026-11-05T09:00', '2026-11-05T17:00');

    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('stays quiet for a whole-day event on a single day', () => {
    openForm();
    setWindow('2026-11-05T00:00', '2026-11-05T23:59');

    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('warns when the window crosses into the next day', () => {
    openForm();
    setWindow('2026-11-05T09:00', '2026-11-06T17:00');

    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('warns even for a short window that only crosses midnight', () => {
    // 22:00 -> 01:00 is three hours, but it is still stored as one window that
    // swallows both nights. The admin should know.
    openForm();
    setWindow('2026-11-05T22:00', '2026-11-06T01:00');

    expect(screen.getByText(WARNING)).toBeInTheDocument();
  });

  it('exposes the hint as a status, so it is announced without stealing focus', () => {
    openForm();
    setWindow('2026-11-05T09:00', '2026-11-06T17:00');

    expect(screen.getByRole('status')).toHaveTextContent(WARNING);
  });

  it('withdraws the hint once the end is pulled back to the same day', () => {
    openForm();
    setWindow('2026-11-05T09:00', '2026-11-06T17:00');
    expect(screen.getByText(WARNING)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Event end date and time'), {
      target: { value: '2026-11-05T17:00' }
    });

    expect(screen.queryByText(WARNING)).not.toBeInTheDocument();
  });

  it('does not block the save - a multi-day event still goes through', async () => {
    openForm();

    setField('Event Title', 'Two-Day Relief Drive');
    setField('Description', 'Relief packing across two days.');
    setWindow('2026-11-05T09:00', '2026-11-06T17:00');
    setField('Location', 'HYT Hall');
    setField('Application Deadline', '2026-10-30');

    expect(screen.getByText(WARNING)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /save event/i }));

    await waitFor(() => expect(mockCreateEvent).toHaveBeenCalledTimes(1));

    const payload = mockCreateEvent.mock.calls[0][0];
    expect(payload.title).toBe('Two-Day Relief Drive');
    // One continuous window, not two sessions.
    expect(new Date(payload.startsAt).getTime()).toBeLessThan(new Date(payload.endsAt).getTime());
  });
});
