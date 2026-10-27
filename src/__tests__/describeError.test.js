import { describeError } from '../utils/helpers';

/**
 * Supabase rejects with a plain object, not an Error. Handed straight to
 * `console.error` it prints as the word "Object" - which is exactly how a real
 * failure reached the browser console as
 * `Error loading absence requests: Object` and told nobody anything.
 */
describe('describeError', () => {
  it('reads a PostgREST error object', () => {
    const error = {
      code: 'PGRST201',
      message: "Could not embed because more than one relationship was found for 'absence_requests' and 'users'"
    };
    expect(describeError(error)).toBe(
      "Could not embed because more than one relationship was found for 'absence_requests' and 'users' [PGRST201]"
    );
  });

  it('appends details and hint when they add information', () => {
    expect(describeError({ message: 'Permission denied', details: 'RLS blocks this row', code: '42501' }))
      .toBe('Permission denied (RLS blocks this row) [42501]');
  });

  it('does not repeat details that duplicate the message', () => {
    expect(describeError({ message: 'Boom', details: 'Boom' })).toBe('Boom');
  });

  it('falls back to details when there is no message', () => {
    expect(describeError({ details: 'row level security' })).toBe('row level security');
  });

  it('handles a real Error', () => {
    expect(describeError(new Error('Network request failed'))).toBe('Network request failed');
  });

  it('handles strings, null and undefined', () => {
    expect(describeError('plain failure')).toBe('plain failure');
    expect(describeError(null)).toBe('Unknown error');
    expect(describeError(undefined)).toBe('Unknown error');
    expect(describeError({})).toBe('Unknown error');
  });

  it('never returns the word "Object"', () => {
    // The whole point: `String({})` is "[object Object]".
    expect(describeError({ message: 'x' })).not.toMatch(/object/i);
    expect(describeError({ code: 'PGRST201', message: 'y' })).not.toMatch(/object/i);
  });
});
