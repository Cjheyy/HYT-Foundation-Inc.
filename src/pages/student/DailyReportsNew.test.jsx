import { render, screen } from '@testing-library/react';
import { DailyReportsNew } from './DailyReportsNew';
import { getDailyReports } from '../../services/supabaseService';

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({
    state: { currentUser: { id: 'user-1', fullName: 'Juan Dela Cruz' } },
    dispatch: jest.fn()
  })
}));

jest.mock('../../services/supabaseService', () => ({
  getDailyReports: jest.fn(),
  createDailyReport: jest.fn()
}));

/**
 * This suite verifies a CSS contract, not a user-facing behaviour: DailyReports.css
 * is scoped under `.daily-reports-page`, and twelve class names previously matched
 * no stylesheet at all.  The class string is the subject under test, so there is
 * no ARIA role or text query that can stand in for it — a DOM lookup is the only
 * way to assert it.  The exemption is confined to this one helper.
 */
/* eslint-disable testing-library/no-container, testing-library/no-node-access */
const hasClass = (container, selector) => container.querySelector(selector) !== null;
/* eslint-enable testing-library/no-container, testing-library/no-node-access */

const REPORT = {
  id: 'r1',
  reportDate: '2026-09-29',
  createdAt: '2026-09-29T09:00:00Z',
  status: 'Approved',
  accomplishments: 'Completed the attendance module.',
  adminNote: 'Good work.'
};

describe('DailyReportsNew', () => {
  beforeEach(() => {
    getDailyReports.mockResolvedValue([REPORT]);
  });

  test('carries the scoping class its stylesheet targets', async () => {
    // DailyReports.css is scoped under .daily-reports-page so this page stops
    // inheriting .report-header / .report-content / .report-meta from Admin.css.
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Report History');
    expect(hasClass(container, '.daily-reports-page')).toBe(true);
  });

  test('renders the class names the stylesheet defines', async () => {
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Report History');

    // These twelve previously matched no CSS anywhere.
    [
      '.submit-report-card',
      '.reports-history-card',
      '.reports-list',
      '.report-item',
      '.report-header',
      '.report-date',
      '.report-content',
      '.report-section',
      '.section-label',
      '.section-text',
      '.admin-note',
      '.note-label',
      '.note-text',
      '.report-footer',
      '.report-meta'
    ].forEach((selector) => {
      expect(hasClass(container, selector)).toBe(true);
    });
  });

  test('marks a rejected report and its admin note', async () => {
    getDailyReports.mockResolvedValue([
      { ...REPORT, status: 'Rejected', adminNote: 'Please add more detail.' }
    ]);
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Report History');

    expect(hasClass(container, '.report-item.rejected')).toBe(true);
    expect(hasClass(container, '.admin-note.rejected')).toBe(true);
    expect(hasClass(container, '.admin-note.approved')).toBe(false);
  });

  test('marks an approved admin note', async () => {
    const { container } = render(<DailyReportsNew />);
    await screen.findByText('Report History');

    expect(hasClass(container, '.admin-note.approved')).toBe(true);
    expect(hasClass(container, '.report-item.rejected')).toBe(false);
  });

  test('shows the empty state when there are no reports', async () => {
    getDailyReports.mockResolvedValue([]);
    render(<DailyReportsNew />);
    await screen.findByText('No Reports Yet');
  });
});
