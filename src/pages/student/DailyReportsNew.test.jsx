import { render, screen } from '@testing-library/react';
import { DailyReportsNew } from './DailyReportsNew';
import { getDailyReports, reportSlotsReady } from '../../services/supabaseService';

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({
    state: { currentUser: { id: 'user-1', fullName: 'Juan Dela Cruz' } },
    dispatch: jest.fn()
  })
}));

jest.mock('../../services/supabaseService', () => ({
  getDailyReports: jest.fn(),
  reportSlotsReady: jest.fn(),
  submitReportSlot: jest.fn()
}));

/**
 * This suite verifies a CSS contract, not a user-facing behaviour: DailyReports.css
 * is scoped under `.daily-reports-page`, and a set of class names previously
 * matched no stylesheet at all.  The class string is the subject under test, so
 * there is no ARIA role or text query that can stand in for it — a DOM lookup is
 * the only way to assert it.  The exemption is confined to this one helper.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
const hasClass = (container, selector) => container.querySelector(selector) !== null;
/* eslint-enable testing-library/no-container, testing-library/no-node-access */

/**
 * The page was reworked from a single free-text report into three timed slots
 * (11:00 / 15:00 / 17:00).  The copy is English throughout, and the old
 * assertions — 'Report History', 'No Reports Yet', and the `.report-content` /
 * `.admin-note` / `.section-label` block — described the predecessor UI and had
 * been failing ever since.  These fixtures carry a filed day so both the
 * "has history" and "empty" branches can be exercised.
 */

/** A complete filed day: all three slots carry an entry, so the day is whole. */
const FILED_DAY = {
  id: 'r1',
  userId: 'user-1',
  reportDate: '2026-09-29',
  slotEntries: {
    '11:00': { accomplished: 'Filed the MOA.', inProgress: 'Encoding records.', pending: 'Archive box.' },
    '15:00': { accomplished: 'Scanned documents.', inProgress: 'Indexing files.', pending: 'Sign-off sheet.' },
    '17:00': { accomplished: 'Completed the attendance module.', inProgress: 'Drafting the DTR.', pending: 'Client review.' }
  }
};

describe('DailyReportsNew', () => {
  beforeEach(() => {
    getDailyReports.mockResolvedValue([FILED_DAY]);
    reportSlotsReady.mockResolvedValue(true);
  });

  test('carries the scoping class its stylesheet targets', async () => {
    // DailyReports.css is scoped under .daily-reports-page so this page stops
    // inheriting .report-header / .report-content / .report-meta from Admin.css.
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Previous days');
    expect(hasClass(container, '.daily-reports-page')).toBe(true);
  });

  test('renders the class names the stylesheet defines', async () => {
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Previous days');

    // The live vocabulary of the slot-based page.  The legacy names this list
    // used to carry (.report-content, .report-section, .section-label,
    // .section-text, .admin-note, .note-label, .note-text, .report-footer,
    // .report-meta) are no longer emitted by any element — the JSX stopped
    // producing them.  Asserting them here is what made this suite fail.
    [
      '.submit-report-card',
      '.reports-history-card',
      '.reports-list',
      '.report-item',
      '.report-header',
      '.report-date',
      '.report-slot-list',
      '.report-slot',
      '.report-slot-head',
      '.report-slot-when',
      '.report-slot-window',
      '.report-slot-status',
      '.report-day-grid',
      '.report-day-cell',
      '.report-day-flag'
    ].forEach((selector) => {
      expect(hasClass(container, selector)).toBe(true);
    });
  });

  test('files each day as three slots, not one free-text report', async () => {
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Previous days');

    // One `.report-day-cell` per slot — the structural promise of the rework.
    expect(container.querySelectorAll('.report-day-cell')).toHaveLength(3);
  });

  test('marks a whole day as complete and a day missing its 5 PM as partial', async () => {
    const { container, unmount } = render(<DailyReportsNew />);
    await screen.findByText('Previous days');
    expect(hasClass(container, '.report-day-flag.is-complete')).toBe(true);
    expect(hasClass(container, '.report-day-flag.is-partial')).toBe(false);
    unmount();

    getDailyReports.mockResolvedValue([
      { ...FILED_DAY, slotEntries: { '11:00': FILED_DAY.slotEntries['11:00'] } }
    ]);
    const second = render(<DailyReportsNew />);
    await screen.findByText('Previous days');
    expect(hasClass(second.container, '.report-day-flag.is-partial')).toBe(true);
    expect(hasClass(second.container, '.report-day-flag.is-complete')).toBe(false);
  });

  test('shows the empty state when there are no reports', async () => {
    getDailyReports.mockResolvedValue([]);
    render(<DailyReportsNew />);
    await screen.findByText('No reports yet');
    expect(screen.getByText('The days you submit will appear here.')).toBeInTheDocument();
  });
});
