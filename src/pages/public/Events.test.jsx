import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { Events } from './Events';

let mockState = {};

jest.mock('../../context/AppContext', () => ({
  useApp: () => ({ state: mockState, dispatch: jest.fn() })
}));

/**
 * Rows arrive from supabaseService already camelCased, so the fixtures use the
 * same shape the page will actually receive.
 */
const PUBLISHED = {
  id: 'e1',
  title: 'Coastal Clean-Up',
  description: 'A morning of shoreline clean-up with the community.',
  category: 'Community Outreach',
  status: 'Published',
  applicationDeadline: '2099-01-01',
  totalSlots: 20,
  availableSlots: 20,
  location: 'Manila Bay',
  startsAt: '2099-02-01T01:00:00.000Z'
};

const DRAFT = { ...PUBLISHED, id: 'e2', title: 'Unreleased Summit', status: 'Draft' };
const EXPIRED = { ...PUBLISHED, id: 'e3', title: 'Last Year Drive', applicationDeadline: '2020-01-01' };

const renderPage = (state = {}) => {
  mockState = { currentUser: null, events: [], ...state };
  return render(
    <MemoryRouter>
      <Events />
    </MemoryRouter>
  );
};

describe('public Events page', () => {
  test('renders a published event', () => {
    renderPage({ events: [PUBLISHED] });

    expect(screen.getByRole('heading', { name: 'Coastal Clean-Up' })).toBeInTheDocument();
    expect(screen.getByText('Manila Bay')).toBeInTheDocument();
  });

  /**
   * The whole reason this page exists in the shape it does: an event left in
   * Draft must not surface, which is what a guest saw when an event was created
   * without switching the status to Published.
   */
  test('hides an event that is still a draft', () => {
    renderPage({ events: [PUBLISHED, DRAFT] });

    expect(screen.queryByText('Unreleased Summit')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Coastal Clean-Up' })).toBeInTheDocument();
  });

  test('hides a published event whose deadline has already passed', () => {
    renderPage({ events: [EXPIRED] });

    expect(screen.queryByText('Last Year Drive')).toBeNull();
    expect(screen.getByRole('heading', { name: 'No Events Found' })).toBeInTheDocument();
  });

  test('offers a guest the sign-in call to action', () => {
    renderPage({ events: [PUBLISHED], currentUser: null });

    expect(screen.getByRole('button', { name: 'Log In to Apply' })).toBeInTheDocument();
  });

  test('hands a signed-in trainee off to the trainee events listing', () => {
    renderPage({ events: [PUBLISHED], currentUser: { id: 'u1', role: 'Trainee' } });

    expect(screen.getByRole('button', { name: 'View & Apply' })).toBeInTheDocument();
  });

  test('filters by search term', () => {
    renderPage({ events: [PUBLISHED] });

    fireEvent.change(screen.getByLabelText('Search events'), { target: { value: 'zzz' } });

    expect(screen.queryByText('Coastal Clean-Up')).toBeNull();
  });
});
