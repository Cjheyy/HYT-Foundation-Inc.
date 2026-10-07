import { render, screen } from '@testing-library/react';
import { ProgressRing } from './ProgressRing';

const ring = (container) => container.querySelector('.progress-ring');
const fill = (container) => container.querySelector('.progress-ring-fill');

/** First number of the "dash gap" pair, i.e. the painted arc length. */
const dashLength = (container) => Number(fill(container).getAttribute('stroke-dasharray').split(' ')[0]);

describe('ProgressRing', () => {
  test('renders the percentage for a normal value', () => {
    const { container } = render(<ProgressRing value={50} max={100} />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(ring(container)).toHaveStyle({ width: '112px', height: '112px' });
  });

  test('paints half the circumference at 50%', () => {
    const { container } = render(<ProgressRing value={50} max={100} size={112} stroke={11} />);
    // radius = (112 - 11) / 2 = 50.5 -> circumference = 2*PI*50.5 = 317.30
    expect(dashLength(container)).toBeCloseTo(Math.PI * 50.5, 1);
  });

  test('clamps a value above max to a full ring', () => {
    const { container } = render(<ProgressRing value={150} max={100} />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(dashLength(container)).toBeCloseTo(2 * Math.PI * 50.5, 1);
  });

  test('clamps a negative value to an empty ring', () => {
    const { container } = render(<ProgressRing value={-20} max={100} />);
    expect(screen.getByText('0.0%')).toBeInTheDocument();
    expect(dashLength(container)).toBe(0);
  });

  test('shows a dash instead of "NaN%" when value is missing', () => {
    const { container } = render(<ProgressRing value={undefined} max={100} />);
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(dashLength(container)).toBe(0);
  });

  test('does not render a full ring when max is zero', () => {
    // Regression mirror of ProgressBar: 0/0 produced Infinity, which clamped to
    // a *full* ring and told the user they had finished for no data at all.
    const { container } = render(<ProgressRing value={0} max={0} />);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(dashLength(container)).toBe(0);
  });

  test('never emits an invalid dash for junk input', () => {
    [undefined, null, NaN, 'abc', Infinity, -Infinity].forEach((value) => {
      const { container } = render(<ProgressRing value={value} max={100} />);
      expect(fill(container).getAttribute('stroke-dasharray')).toMatch(/^\d+(\.\d+)? \d+(\.\d+)?$/);
    });
  });

  test('does not paint a dot at zero progress', () => {
    // A round line cap on a zero-length dash still paints a dot, which reads as
    // "some progress made". The cap must stay flat until there is a dash.
    const { container } = render(<ProgressRing value={0} max={100} />);
    expect(fill(container).getAttribute('stroke-linecap')).toBe('butt');
    render(<ProgressRing value={3.6} max={486} />);
    expect(document.querySelectorAll('.progress-ring-fill')[1].getAttribute('stroke-linecap')).toBe('round');
  });

  test('hides the SVG from assistive tech so the value is read once', () => {
    const { container } = render(<ProgressRing value={50} max={100} />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  test('omits the caption when passed an empty string', () => {
    render(<ProgressRing value={10} max={100} caption="" />);
    expect(document.querySelector('.progress-ring-caption')).toBeNull();
  });
});
