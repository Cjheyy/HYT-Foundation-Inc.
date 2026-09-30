import { render, screen } from '@testing-library/react';
import { AttendanceStepper } from './AttendanceStepper';

// The three pipeline stages render as an ordered list, so the listitem role
// gives us stable handles without reaching into the DOM tree.
const stepEls = () => screen.getAllByRole('listitem');

describe('AttendanceStepper', () => {
  test('renders the three pipeline steps', () => {
    render(<AttendanceStepper submittedAt="2026-10-01T00:58:00Z" stage="CLOCK_IN" />);
    expect(screen.getByText('Clock-in sent')).toBeInTheDocument();
    expect(screen.getByText('Admin review')).toBeInTheDocument();
    expect(screen.getByText('Timer starts')).toBeInTheDocument();
  });

  test('uses clock-out wording for a clock-out request', () => {
    render(<AttendanceStepper submittedAt="2026-10-01T09:00:00Z" stage="CLOCK_OUT" />);
    expect(screen.getByText('Clock-out sent')).toBeInTheDocument();
    expect(screen.getByText('Hours credited')).toBeInTheDocument();
  });

  test('shows the submission time instead of the word "Pending approval"', () => {
    render(<AttendanceStepper submittedAt="2026-10-01T00:58:00Z" />);
    expect(screen.queryByText('Pending approval')).toBeNull();
    // 00:58 UTC renders as a local time; assert on the shape, not the zone.
    expect(screen.getByText(/^\d{1,2}:\d{2}/)).toBeInTheDocument();
  });

  test('reports how long the trainee has been waiting', () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    render(<AttendanceStepper submittedAt={twoHoursAgo} />);
    expect(screen.getByText(/Submitted 2 hours ago/)).toBeInTheDocument();
    expect(screen.getByText(/No action needed from you/)).toBeInTheDocument();
  });

  test('marks the first step done and the second current', () => {
    render(<AttendanceStepper submittedAt="2026-10-01T00:58:00Z" />);
    const steps = stepEls();
    expect(steps).toHaveLength(3);
    expect(steps[0]).toHaveClass('done');
    expect(steps[1]).toHaveClass('current');
    expect(steps[2]).toHaveClass('todo');
  });

  test('omits the elapsed line when there is no timestamp', () => {
    render(<AttendanceStepper submittedAt={null} />);
    expect(screen.queryByText(/No action needed from you/)).toBeNull();
    expect(screen.getByText('Admin review')).toBeInTheDocument();
  });
});
