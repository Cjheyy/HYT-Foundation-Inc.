import { render, screen, waitFor } from '@testing-library/react';
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
    await waitFor(() => expect(screen.getByText('Report History')).toBeInTheDocument());
    expect(container.querySelector('.daily-reports-page')).not.toBeNull();
  });

  test('renders the class names the stylesheet defines', async () => {
    const { container } = render(<DailyReportsNew />);
    await waitFor(() => expect(screen.getByText('Report History')).toBeInTheDocument());

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
      expect(container.querySelector(selector)).not.toBeNull();
    });
  });

  test('marks a rejected report and its admin note', async () => {
    getDailyReports.mockResolvedValue([
      { ...REPORT, status: 'Rejected', adminNote: 'Please add more detail.' }
    ]);
    const { container } = render(<DailyReportsNew />);
    await waitFor(() => expect(screen.getByText('Report History')).toBeInTheDocument());

    expect(container.querySelector('.report-item.rejected')).not.toBeNull();
    expect(container.querySelector('.admin-note.rejected')).not.toBeNull();
    expect(container.querySelector('.admin-note.approved')).toBeNull();
  });

  test('marks an approved admin note', async () => {
    const { container } = render(<DailyReportsNew />);
    await waitFor(() => expect(screen.getByText('Report History')).toBeInTheDocument());

    expect(container.querySelector('.admin-note.approved')).not.toBeNull();
    expect(container.querySelector('.report-item.rejected')).toBeNull();
  });

  test('shows the empty state when there are no reports', async () => {
    getDailyReports.mockResolvedValue([]);
    render(<DailyReportsNew />);
    await waitFor(() => expect(screen.getByText('No Reports Yet')).toBeInTheDocument());
  });
});
