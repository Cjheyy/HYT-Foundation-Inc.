/**
 * A generic per-user "I have already seen these ids" store.
 *
 * The database has no read-receipt table for anything the portal shows, so the
 * flag lives in localStorage.  Everything is wrapped so a browser that blocks
 * storage (private mode, quota errors) degrades to an in-memory store for the
 * session instead of throwing - a notification list is not worth an exception.
 *
 * Cross-component sync: the bell (AttentionCenter, mounted in the layout) and
 * the page it links to are on screen at the same time, so a write broadcasts on
 * a window event to re-render both.
 *
 * `announcementReads.js` predates this and keeps its own copy; it is left alone
 * rather than rewritten, because it is covered by tests and works.  New stores
 * should be built with `createSeenStore`.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

const subscribersByEvent = new Map();
let memoryStore = {};

const hasLocalStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__hyt_seen_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

export function createSeenStore({
  prefix,
  changeEvent,
  max = 500
}) {
  const storageKey = (userId) => `${prefix}${userId || 'anonymous'}`;

  const readRaw = (userId) => {
    const key = storageKey(userId);
    try {
      if (hasLocalStorage()) return window.localStorage.getItem(key);
    } catch {
      /* fall through to the in-memory copy */
    }
    return Object.prototype.hasOwnProperty.call(memoryStore, key) ? memoryStore[key] : null;
  };

  const writeRaw = (userId, value) => {
    const key = storageKey(userId);
    try {
      if (hasLocalStorage()) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      /* fall through to the in-memory copy */
    }
    memoryStore = { ...memoryStore, [key]: value };
  };

  /** Ids the user has already seen.  Never throws. */
  const getSeenIds = (userId) => {
    const raw = readRaw(userId);
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((id) => typeof id === 'string' && id);
    } catch {
      return [];
    }
  };

  const notify = (userId) => {
    const subscribers = subscribersByEvent.get(changeEvent);
    if (subscribers) {
      subscribers.forEach((listener) => {
        try {
          listener({ userId });
        } catch {
          /* one bad subscriber must not block the write */
        }
      });
    }
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(changeEvent, { detail: { userId } }));
    }
  };

  const persist = (userId, ids) => {
    const unique = Array.from(new Set((ids || []).filter(Boolean))).slice(-max);
    writeRaw(userId, JSON.stringify(unique));
    notify(userId);
    return unique;
  };

  const markSeen = (userId, id) => {
    if (!id) return getSeenIds(userId);
    return persist(userId, [...getSeenIds(userId), id]);
  };

  const markManySeen = (userId, ids) => persist(userId, [...getSeenIds(userId), ...(ids || [])]);

  const clearSeen = (userId) => persist(userId, []);

  /**
   * Subscribe a component to the seen set for `userId`.
   * Returns { seenIds: Set, markSeen, markAllSeen }.
   */
  function useSeenIds(userId) {
    const [ids, setIds] = useState(() => getSeenIds(userId));

    useEffect(() => {
      setIds(getSeenIds(userId));

      const sync = (detail) => {
        if (detail?.userId && userId && detail.userId !== userId) return;
        setIds(getSeenIds(userId));
      };
      const onWindowEvent = (event) => sync(event?.detail);

      if (!subscribersByEvent.has(changeEvent)) subscribersByEvent.set(changeEvent, new Set());
      subscribersByEvent.get(changeEvent).add(sync);
      if (typeof window !== 'undefined') window.addEventListener(changeEvent, onWindowEvent);

      return () => {
        subscribersByEvent.get(changeEvent)?.delete(sync);
        if (typeof window !== 'undefined') window.removeEventListener(changeEvent, onWindowEvent);
      };
    }, [userId]);

    const seenIds = useMemo(() => new Set(ids), [ids]);

    const markOne = useCallback((id) => markSeen(userId, id), [userId]);
    const markAll = useCallback((allIds) => markManySeen(userId, allIds), [userId]);

    return { seenIds, markSeen: markOne, markAllSeen: markAll };
  }

  return { getSeenIds, markSeen, markManySeen, clearSeen, useSeenIds };
}
