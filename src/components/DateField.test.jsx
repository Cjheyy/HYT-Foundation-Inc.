import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { DateField } from './DateField';
import { Modal } from './Modal';

/**
 * `offsetParent` is always null in jsdom, so the Modal's focus trap cannot see
 * any focusable control and would never move focus.  Reporting the parent node
 * is what a real browser does for a visible element.
 */
beforeAll(() => {
  Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
    configurable: true,
    get() {
      return this.parentNode;
    }
  });
});

/**
 * Every test that CLICKS A DAY pins the field to 14 October 2026 first, because
 * the picker opens on the month of its current value.  Without the pin these
 * tests would quietly start failing on 1 November.  Tests that only open the
 * popover can stay empty and assert against the real current month.
 */
const PINNED = '2026-10-14';
const PINNED_MONTH = 'October 2026';

const pad = (value) => String(value).padStart(2, '0');
const now = new Date();
const TODAY_ISO = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
const THIS_MONTH = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

/** The portalled popover lives on <body>, so a class lookup is the only handle
 *  Testing Library offers for "is the calendar open". */
const popover = () => document.querySelector('.date-field-popover');
const trigger = () => document.querySelector('.date-field-trigger');
const dayButton = (label) => screen.getByRole('button', { name: new RegExp(`^${label}$`) });

function Harness({ initial = '', ...rest }) {
  const [value, setValue] = useState(initial);
  return (
    <DateField
      label="Application Deadline"
      name="applicationDeadline"
      value={value}
      onChange={(event) => setValue(event.target.value)}
      {...rest}
    />
  );
}

describe('DateField — trigger', () => {
  test('shows a placeholder while empty and the formatted date once set', () => {
    const { rerender } = render(<Harness />);
    expect(trigger()).toHaveTextContent('Select a date');

    rerender(
      <DateField label="Application Deadline" name="d" value={PINNED} onChange={() => {}} />
    );
    expect(trigger()).toHaveTextContent('October 14, 2026');
  });

  test('appends the time for a datetime-local field', () => {
    render(
      <DateField label="Start" name="d" type="datetime-local" value="2026-10-14T09:05" onChange={() => {}} />
    );
    expect(trigger()).toHaveTextContent('October 14, 2026 · 9:05 AM');
  });

  test('draws the required marker but keeps it out of the accessible name', () => {
    render(<Harness required />);
    expect(screen.getByText('*')).toBeInTheDocument();
    expect(trigger()).toHaveAttribute('aria-required', 'true');
  });

  test('marks the field invalid and wires the message when there is an error', () => {
    render(<Harness error="Application deadline is required" />);
    expect(trigger()).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('alert')).toHaveTextContent('Application deadline is required');
  });

  test('clears the value without opening the picker', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear date' }));
    expect(trigger()).toHaveTextContent('Select a date');
    expect(popover()).toBeNull();
  });
});

describe('DateField — the picker closes', () => {
  test('opens on the trigger and shows the month of its value', () => {
    render(<Harness initial={PINNED} />);
    expect(popover()).toBeNull();
    fireEvent.click(trigger());
    expect(popover()).not.toBeNull();
    expect(popover()).toHaveTextContent(PINNED_MONTH);
  });

  test('opens on the current month when the field is empty', () => {
    render(<Harness />);
    fireEvent.click(trigger());
    expect(popover()).toHaveTextContent(THIS_MONTH);
  });

  test('CLOSES the moment a day is picked (a date-only field)', () => {
    // This is the whole reason the component exists: the browser's own popup
    // had no way to be dismissed, so it sat open over the form.
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    fireEvent.click(dayButton('October 20, 2026'));
    expect(popover()).toBeNull();
  });

  test('emits the value in the native wire format, with the field name', () => {
    const seen = [];
    render(
      <DateField
        label="Application Deadline"
        name="applicationDeadline"
        value={PINNED}
        onChange={(event) => seen.push({ name: event.target.name, value: event.target.value })}
      />
    );
    fireEvent.click(trigger());
    fireEvent.click(dayButton('October 20, 2026'));
    expect(seen).toEqual([{ name: 'applicationDeadline', value: '2026-10-20' }]);
  });

  test('closes on Escape', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    fireEvent.keyDown(document.activeElement || document, { key: 'Escape' });
    expect(popover()).toBeNull();
  });

  test('closes on a click outside', () => {
    render(
      <div>
        <Harness initial={PINNED} />
        <button type="button">Elsewhere</button>
      </div>
    );
    fireEvent.click(trigger());
    expect(popover()).not.toBeNull();

    fireEvent.mouseDown(screen.getByRole('button', { name: 'Elsewhere' }), { bubbles: true });
    expect(popover()).toBeNull();
  });

  test('toggles shut when the trigger itself is clicked again', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    fireEvent.click(trigger());
    expect(popover()).toBeNull();
  });
});

describe('DateField — datetime-local', () => {
  test('keeps the popover open after a day so the time can still be set', () => {
    render(<Harness initial={PINNED} type="datetime-local" />);
    fireEvent.click(trigger());
    fireEvent.click(dayButton('October 20, 2026'));
    expect(popover()).not.toBeNull();
  });

  test('defaults a freshly picked day to a working hour, never midnight', () => {
    const seen = [];
    render(
      <DateField
        label="Starts at"
        name="startsAt"
        type="datetime-local"
        value=""
        onChange={(event) => seen.push(event.target.value)}
      />
    );
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(seen[0]).toBe(`${TODAY_ISO}T09:00`);
  });

  test('keeps the time already chosen when a different day is picked', () => {
    const seen = [];
    render(
      <DateField
        label="Starts at"
        name="startsAt"
        type="datetime-local"
        value="2026-10-14T14:30"
        onChange={(event) => seen.push(event.target.value)}
      />
    );
    fireEvent.click(trigger());
    fireEvent.click(dayButton('October 20, 2026'));
    expect(seen[0]).toBe('2026-10-20T14:30');
  });

  test('closes on Done', () => {
    render(<Harness initial={PINNED} type="datetime-local" />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    expect(popover()).toBeNull();
  });

  test('switches between AM and PM without changing the hour on the dial', () => {
    const seen = [];
    render(
      <DateField
        label="Starts at"
        name="startsAt"
        type="datetime-local"
        value="2026-10-14T09:00"
        onChange={(event) => seen.push(event.target.value)}
      />
    );
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'PM' }));
    expect(seen[0]).toBe('2026-10-14T21:00');
  });

  test('changes the minute on the dial', () => {
    const seen = [];
    render(
      <DateField
        label="Starts at"
        name="startsAt"
        type="datetime-local"
        value="2026-10-14T09:00"
        onChange={(event) => seen.push(event.target.value)}
      />
    );
    fireEvent.click(trigger());
    fireEvent.change(screen.getByLabelText('Minute'), { target: { value: '45' } });
    expect(seen[0]).toBe('2026-10-14T09:45');
  });

  test('shows no Done button on a date-only field', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    expect(screen.queryByRole('button', { name: 'Done' })).toBeNull();
  });
});

describe('DateField — navigation and limits', () => {
  test('steps to the next and previous month', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(popover()).toHaveTextContent('November 2026');
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    expect(popover()).toHaveTextContent(PINNED_MONTH);
  });

  test('Today selects today', () => {
    const seen = [];
    render(
      <DateField
        label="Application Deadline"
        name="applicationDeadline"
        value=""
        onChange={(event) => seen.push(event.target.value)}
      />
    );
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Today' }));
    expect(seen[0]).toBe(TODAY_ISO);
  });

  test('disables days before `min`', () => {
    render(<Harness initial={PINNED} min="2026-10-15" />);
    fireEvent.click(trigger());
    expect(dayButton('October 10, 2026')).toBeDisabled();
    expect(dayButton('October 20, 2026')).not.toBeDisabled();
  });

  test('treats `min` as a date even when it carries a time', () => {
    // `endsAt` is bounded by `startsAt`, a full datetime.  Comparing the raw
    // strings would make the SAME day look like it comes before the bound.
    render(<Harness initial="2026-10-14T09:00" type="datetime-local" min="2026-10-15T09:00" />);
    fireEvent.click(trigger());
    expect(dayButton('October 15, 2026')).not.toBeDisabled();
  });

  test('Clear in the footer empties the field and closes', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(trigger()).toHaveTextContent('Select a date');
    expect(popover()).toBeNull();
  });

  test('arrow keys move the roving tab stop', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    expect(dayButton('October 14, 2026')).toHaveAttribute('tabindex', '0');

    fireEvent.keyDown(dayButton('October 14, 2026'), { key: 'ArrowRight' });
    expect(dayButton('October 15, 2026')).toHaveAttribute('tabindex', '0');
  });

  test('the month arrows do not steal focus into the grid', () => {
    render(<Harness initial={PINNED} />);
    fireEvent.click(trigger());
    const next = screen.getByRole('button', { name: 'Next month' });
    next.focus();
    fireEvent.click(next);
    expect(next).toHaveFocus();
  });
});

describe('DateField — inside a Modal', () => {
  function ModalHarness() {
    const [open, setOpen] = useState(true);
    return (
      <Modal isOpen={open} onClose={() => setOpen(false)} title="Create New Event">
        <Harness initial={PINNED} />
      </Modal>
    );
  }

  test('Escape closes the calendar and leaves the form open', () => {
    // The bug this guards: the modal listens for Escape on `document` in the
    // capture phase, so without the deferral one Escape tore down the whole
    // form — and everything typed into it — just to dismiss a calendar.
    render(<ModalHarness />);
    fireEvent.click(trigger());
    expect(popover()).not.toBeNull();

    fireEvent.keyDown(document.activeElement || document, { key: 'Escape' });

    expect(popover()).toBeNull();
    expect(screen.getByRole('heading', { name: 'Create New Event' })).toBeInTheDocument();
  });

  test('a second Escape then closes the form', () => {
    render(<ModalHarness />);
    fireEvent.click(trigger());
    fireEvent.keyDown(document.activeElement || document, { key: 'Escape' });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('heading', { name: 'Create New Event' })).toBeNull();
  });
});
