import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { StudentLayout } from './StudentLayout';
import { TraineeLayout } from './TraineeLayout';

let mockState = {};

jest.mock('../context/AppContext', () => ({
  useApp: () => ({ state: mockState, signOut: jest.fn() })
}));

jest.mock('../components/ProfileModal', () => ({
  ProfileModal: () => null
}));

const studentState = () => ({
  currentUser: { id: 'user-1', fullName: 'Juan Dela Cruz', role: 'OJT/Intern', email: 'juan@example.com' },
  requirements: [],
  dailyReports: [],
  attendance: [],
  announcements: [],
  certificates: []
});

const renderAt = (Layout, path) => render(
  <MemoryRouter initialEntries={[path]}>
    <Layout><div>page content</div></Layout>
  </MemoryRouter>
);

// The active sidebar entry is the only link marked aria-current="page", so this
// also proves the "exactly one active item" guarantee without touching the DOM
// tree directly. Header links ("Home", "Dashboard") carry no marker.
const currentLabels = () => screen
  .getAllByRole('link')
  .filter((link) => link.getAttribute('aria-current') === 'page')
  .map((link) => link.textContent.trim());

const navHrefs = () => screen
  .getAllByRole('link')
  .map((link) => link.getAttribute('href'));

describe('StudentLayout sidebar', () => {
  beforeEach(() => {
    mockState = studentState();
  });

  test('highlights exactly one entry, not Dashboard plus the current page', () => {
    // Regression: isActive('/student') matched every /student/* route, so
    // Dashboard stayed lit on Attendance and two items looked active.
    renderAt(StudentLayout, '/student/attendance');
    expect(currentLabels()).toEqual(['Attendance']);
  });

  test('is correct on every student route', () => {
    const expected = {
      '/student/attendance': 'Attendance',
      '/student/certificates': 'Certificates',
      '/student/daily-reports': 'Daily Reports',
      '/student/requirements': 'Requirements',
      '/student/ojt': 'OJT / Experience',
      '/student/applications': 'My Applications',
      '/student/announcements': 'Announcements',
      '/student/opportunities': 'OJT Postings',
      '/student/programs': 'Programs & Events'
    };
    Object.entries(expected).forEach(([path, label]) => {
      const { unmount } = renderAt(StudentLayout, path);
      expect(currentLabels()).toEqual([label]);
      unmount();
    });
  });

  test('lights Dashboard on the bare portal root and on /student/dashboard', () => {
    ['/student', '/student/dashboard'].forEach((path) => {
      const { unmount } = renderAt(StudentLayout, path);
      expect(currentLabels()).toEqual(['Dashboard']);
      unmount();
    });
  });

  test('reaches every page that a dashboard button links to', () => {
    // Requirements existed as a route with no sidebar entry, so it was a dead
    // end once you left it.
    renderAt(StudentLayout, '/student');
    const hrefs = navHrefs();
    [
      '/student/dashboard',
      '/student/programs',
      '/student/opportunities',
      '/student/applications',
      '/student/requirements',
      '/student/ojt',
      '/student/attendance',
      '/student/daily-reports',
      '/student/certificates',
      '/student/announcements'
    ].forEach((href) => expect(hrefs).toContain(href));
  });

  test('renders the three section headings', () => {
    renderAt(StudentLayout, '/student');
    expect(screen.getByText('Main')).toBeInTheDocument();
    expect(screen.getByText('My Work')).toBeInTheDocument();
    expect(screen.getByText('Results')).toBeInTheDocument();
  });

  test('uses the OJT role label and portal name', () => {
    renderAt(StudentLayout, '/student');
    expect(screen.getByText('OJT Portal')).toBeInTheDocument();
    expect(screen.getByText('OJT / Intern')).toBeInTheDocument();
  });

  test('shows the attention bell', () => {
    renderAt(StudentLayout, '/student');
    expect(screen.getByRole('button', { name: /needs your attention/i })).toBeInTheDocument();
  });

  test('badges the sidebar with the pending requirement count', () => {
    mockState = {
      ...studentState(),
      requirements: [
        { id: 'r1', studentId: 'user-1', status: 'Required' },
        { id: 'r2', studentId: 'user-1', status: 'Rejected' },
        { id: 'r3', studentId: 'user-1', status: 'Approved' }
      ]
    };
    renderAt(StudentLayout, '/student');
    expect(screen.getAllByLabelText(/\d+ pending/)).toHaveLength(1);
    expect(screen.getByLabelText('2 pending')).toBeInTheDocument();
  });

  test('renders no badge when nothing is pending', () => {
    renderAt(StudentLayout, '/student');
    expect(screen.queryByLabelText(/\d+ pending/)).toBeNull();
  });
});

describe('TraineeLayout sidebar', () => {
  beforeEach(() => {
    mockState = {
      ...studentState(),
      currentUser: { id: 'user-2', fullName: 'Maria Santos', role: 'Trainee', email: 'maria@example.com' }
    };
  });

  test('says Trainee, not Student', () => {
    renderAt(TraineeLayout, '/trainee/dashboard');
    expect(screen.getByText('Trainee Portal')).toBeInTheDocument();
    expect(screen.getByText('Trainee')).toBeInTheDocument();
    expect(screen.queryByText('OJT Portal')).toBeNull();
  });

  test('reaches Requirements and Daily Reports', () => {
    renderAt(TraineeLayout, '/trainee/dashboard');
    const hrefs = navHrefs();
    expect(hrefs).toContain('/trainee/requirements');
    expect(hrefs).toContain('/trainee/daily-reports');
  });

  test('does not link to the intentionally empty OJT Postings page', () => {
    renderAt(TraineeLayout, '/trainee/dashboard');
    expect(navHrefs()).not.toContain('/trainee/opportunities');
  });

  test('highlights exactly one entry', () => {
    renderAt(TraineeLayout, '/trainee/attendance');
    expect(currentLabels()).toEqual(['Attendance']);
  });
});
