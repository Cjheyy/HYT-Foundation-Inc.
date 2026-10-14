import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';
import { Input } from './Input';

/**
 * jsdom has no layout engine, so `offsetParent` is always null.  The focus
 * trap filters candidates on `element.offsetParent !== null` to skip hidden
 * controls, so without this the list degenerates to "whatever already has
 * focus" and the re-focus below becomes a no-op — hiding the very bug under
 * test.  Reporting the parent node is what a real browser does for a visible
 * element, so this makes the harness match the browser the user is typing in.
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
 * The admin create-forms (OJT postings, Dream Academy programs, events) all
 * put a controlled field inside <Modal> and pass `onClose` as an inline arrow.
 * That combination is the whole point of this harness: the field's value lives
 * in the parent, so every keystroke re-renders the parent, and an inline
 * `onClose` gets a fresh identity on each of those renders.
 *
 * If the modal's focus trap treats `onClose` as a dependency it re-runs on
 * every keystroke, and each re-run moves focus back to the first control —
 * so the field silently loses focus after one character.
 */
function Harness() {
  const [open, setOpen] = useState(true);
  const [title, setTitle] = useState('');
  return (
    <Modal isOpen={open} onClose={() => setOpen(false)} title="Create New Program">
      <form>
        <Input label="Title" name="title" value={title} onChange={(event) => setTitle(event.target.value)} />
      </form>
    </Modal>
  );
}

describe('Modal', () => {
  test('keeps focus in a controlled field while the user types', () => {
    render(<Harness />);

    const field = screen.getByLabelText('Title');
    field.focus();
    expect(field).toHaveFocus();

    fireEvent.change(field, { target: { value: 'C' } });

    // Before the fix the focus trap re-ran here and pulled focus back to the
    // first control in the dialog, so the user could only ever type one
    // character per click.
    expect(field).toHaveFocus();
  });

  test('accumulates every character of a multi-keypress entry', () => {
    render(<Harness />);

    const field = screen.getByLabelText('Title');
    field.focus();

    // `fireEvent.change` carries the whole new value, so drive it the way a
    // real typist would: one character at a time, reading the field back.
    let typed = '';
    for (const character of 'Creative') {
      typed += character;
      fireEvent.change(field, { target: { value: typed } });
      expect(field).toHaveFocus();
    }

    expect(field).toHaveValue('Creative');
  });

  test('still closes on Escape after the handler identity has changed', () => {
    render(<Harness />);

    const field = screen.getByLabelText('Title');
    field.focus();
    // Re-render once so the inline `onClose` from the first render is stale.
    fireEvent.change(field, { target: { value: 'C' } });

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('heading', { name: 'Create New Program' })).toBeNull();
  });

  test('still closes on a backdrop click after the handler identity has changed', () => {
    render(<Harness />);

    const field = screen.getByLabelText('Title');
    field.focus();
    fireEvent.change(field, { target: { value: 'C' } });

    // The backdrop carries no ARIA role, so there is no Testing Library query
    // for it; a direct lookup is the only way to exercise the overlay handler.
    // eslint-disable-next-line testing-library/no-node-access
    fireEvent.click(document.querySelector('.modal-overlay'));

    expect(screen.queryByRole('heading', { name: 'Create New Program' })).toBeNull();
  });
});
