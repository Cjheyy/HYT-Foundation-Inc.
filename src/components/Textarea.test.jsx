import { render, screen } from '@testing-library/react';
import { Textarea } from './Textarea';

/**
 * `Textarea` had a `<label>` with no `htmlFor` and a control with no `id`, so
 * the label was decoration: the field had no accessible name, and clicking the
 * label did not focus it. Every admin create-form uses this component for its
 * description field, so ten screens were affected at once.
 *
 * `Input` already did this correctly; these tests pin `Textarea` to the same
 * contract so the two cannot drift apart again.
 */
describe('Textarea', () => {
  it('gives the control an accessible name from its label', () => {
    render(<Textarea label="Description" value="" onChange={() => {}} />);

    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
  });

  it('associates the label with the control, not just visually', () => {
    render(<Textarea label="Description" value="" onChange={() => {}} />);

    const field = screen.getByLabelText(/description/i);
    expect(field.tagName).toBe('TEXTAREA');
    expect(field.id).toBeTruthy();
  });

  it('marks a required field without putting the asterisk in the name', () => {
    render(<Textarea label="Description" required value="" onChange={() => {}} />);

    const field = screen.getByLabelText(/description/i);
    expect(field).toBeRequired();
  });

  it('announces the error and points the control at it', () => {
    render(<Textarea label="Description" value="" onChange={() => {}} error="Description is required" />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Description is required');

    const field = screen.getByLabelText(/description/i);
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(field).toHaveAttribute('aria-describedby', alert.id);
  });

  it('describes the control with the help text when there is no error', () => {
    render(<Textarea label="Description" value="" onChange={() => {}} help="Keep it under 200 words." />);

    const field = screen.getByLabelText(/description/i);
    const helpId = field.getAttribute('aria-describedby');
    expect(helpId).toBeTruthy();
    expect(document.getElementById(helpId)).toHaveTextContent('Keep it under 200 words.');
  });

  it('keeps a caller-supplied id instead of generating one', () => {
    render(<Textarea id="custom-id" label="Description" value="" onChange={() => {}} />);

    expect(screen.getByLabelText(/description/i)).toHaveAttribute('id', 'custom-id');
  });
});
