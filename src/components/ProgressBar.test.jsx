import { render, screen } from '@testing-library/react';
import { ProgressBar } from './ProgressBar';

const fill = (container) => container.querySelector('.progress-bar-fill');

describe('ProgressBar', () => {
  test('renders the percentage for a normal value', () => {
    const { container } = render(<ProgressBar value={50} max={100} />);
    expect(screen.getByText('50.0%')).toBeInTheDocument();
    expect(fill(container)).toHaveStyle({ width: '50%' });
  });

  test('clamps a value above max', () => {
    const { container } = render(<ProgressBar value={150} max={100} />);
    expect(screen.getByText('100.0%')).toBeInTheDocument();
    expect(fill(container)).toHaveStyle({ width: '100%' });
  });

  test('clamps a negative value to zero', () => {
    const { container } = render(<ProgressBar value={-20} max={100} />);
    expect(fill(container)).toHaveStyle({ width: '0%' });
  });

  test('shows a dash instead of "NaN%" when value is missing', () => {
    // Regression: an absent `progress` on the row used to render "NaN%" beside
    // an empty bar, because `width: NaN%` is invalid CSS.
    const { container } = render(<ProgressBar value={undefined} max={100} />);
    expect(screen.queryByText(/NaN/)).toBeNull();
    expect(screen.getByText('—')).toBeInTheDocument();
    expect(fill(container)).toHaveStyle({ width: '0%' });
  });

  test('does not render a full bar when max is zero', () => {
    // Regression: 0/0 produced Infinity, which clamped to a full bar for no data.
    const { container } = render(<ProgressBar value={0} max={0} />);
    expect(screen.queryByText(/NaN|Infinity/)).toBeNull();
    expect(fill(container)).toHaveStyle({ width: '0%' });
  });

  test('never emits an invalid width for junk input', () => {
    [undefined, null, NaN, 'abc', Infinity, -Infinity].forEach((value) => {
      const { container } = render(<ProgressBar value={value} max={100} />);
      expect(fill(container).style.width).toMatch(/^\d+(\.\d+)?%$/);
    });
  });

  test('hides the label when showLabel is false', () => {
    render(<ProgressBar value={10} max={100} showLabel={false} />);
    expect(screen.queryByText('Progress')).toBeNull();
  });
});
