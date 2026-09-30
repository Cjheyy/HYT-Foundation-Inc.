import { act, renderHook } from '@testing-library/react';
import {
  clearAnnouncementReads,
  getReadAnnouncementIds,
  markAnnouncementRead,
  markAnnouncementsRead,
  useAnnouncementReads
} from './announcementReads';

const USER = 'user-1';
const OTHER = 'user-2';

describe('announcement read store', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('starts empty', () => {
    expect(getReadAnnouncementIds(USER)).toEqual([]);
  });

  test('records and returns ids', () => {
    markAnnouncementRead(USER, 'a1');
    markAnnouncementRead(USER, 'a2');
    expect(getReadAnnouncementIds(USER)).toEqual(['a1', 'a2']);
  });

  test('does not duplicate an id read twice', () => {
    markAnnouncementRead(USER, 'a1');
    markAnnouncementRead(USER, 'a1');
    expect(getReadAnnouncementIds(USER)).toEqual(['a1']);
  });

  test('marks many at once', () => {
    markAnnouncementsRead(USER, ['a1', 'a2', 'a3']);
    expect(getReadAnnouncementIds(USER)).toEqual(['a1', 'a2', 'a3']);
  });

  test('ignores an empty id', () => {
    markAnnouncementRead(USER, '');
    expect(getReadAnnouncementIds(USER)).toEqual([]);
  });

  test('keeps each user separate', () => {
    markAnnouncementRead(USER, 'a1');
    markAnnouncementRead(OTHER, 'b1');
    expect(getReadAnnouncementIds(USER)).toEqual(['a1']);
    expect(getReadAnnouncementIds(OTHER)).toEqual(['b1']);
  });

  test('clears for one user only', () => {
    markAnnouncementRead(USER, 'a1');
    markAnnouncementRead(OTHER, 'b1');
    clearAnnouncementReads(USER);
    expect(getReadAnnouncementIds(USER)).toEqual([]);
    expect(getReadAnnouncementIds(OTHER)).toEqual(['b1']);
  });

  test('survives corrupt storage instead of throwing', () => {
    window.localStorage.setItem('hyt:announcement-reads:user-1', 'not json');
    expect(getReadAnnouncementIds(USER)).toEqual([]);

    window.localStorage.setItem('hyt:announcement-reads:user-1', '{"nope":true}');
    expect(getReadAnnouncementIds(USER)).toEqual([]);
  });

  test('falls back to memory when localStorage throws', () => {
    // Swap in a storage object whose every method throws — the shape a browser
    // presents when storage is blocked (private mode, third-party cookie
    // blocking, exhausted quota).
    const descriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    const thrower = () => { throw new Error('SecurityError: storage is disabled'); };
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      value: { getItem: thrower, setItem: thrower, removeItem: thrower }
    });

    try {
      expect(() => markAnnouncementRead('memory-user', 'a1')).not.toThrow();
      expect(getReadAnnouncementIds('memory-user')).toEqual(['a1']);
    } finally {
      if (descriptor) Object.defineProperty(window, 'localStorage', descriptor);
      else delete window.localStorage;
    }
  });
});

describe('useAnnouncementReads', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  test('re-renders when another component marks an announcement read', () => {
    // The sidebar badge and the Announcements page are on screen together, so a
    // write in one must reach the other.
    const { result } = renderHook(() => useAnnouncementReads(USER));
    expect(result.current.readIds.size).toBe(0);

    act(() => {
      markAnnouncementRead(USER, 'a1');
    });

    expect(result.current.readIds.has('a1')).toBe(true);
  });

  test('ignores writes for a different user', () => {
    const { result } = renderHook(() => useAnnouncementReads(USER));
    act(() => {
      markAnnouncementRead(OTHER, 'b1');
    });
    expect(result.current.readIds.size).toBe(0);
  });

  test('markRead and markAllRead update the hook state', () => {
    const { result } = renderHook(() => useAnnouncementReads(USER));

    act(() => {
      result.current.markRead('a1');
    });
    expect(result.current.readIds.has('a1')).toBe(true);

    act(() => {
      result.current.markAllRead(['a2', 'a3']);
    });
    expect(Array.from(result.current.readIds).sort()).toEqual(['a1', 'a2', 'a3']);
  });
});
