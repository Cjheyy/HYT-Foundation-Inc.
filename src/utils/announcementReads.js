/**
 * Per-user "read" state for announcements.
 *
 * The database has no read-receipt table, so the flag lives in localStorage.
 * Everything is wrapped so a browser that blocks storage (private mode, quota
 * errors) degrades to an in-memory store for the session instead of throwing.
 *
 * Cross-component sync: the sidebar badge (AttentionCenter, mounted in the
 * layout) and the Announcements page are on screen at the same time, so a write
 * broadcasts on a window event to re-render both.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';

const STORAGE_PREFIX = 'hyt:announcement-reads:';
const CHANGE_EVENT = 'hyt:announcement-reads-changed';
// Announcements are a small, slowly-growing set; a cap keeps a long-lived
// browser profile from accumulating an unbounded id list.
const MAX_STORED_IDS = 500;

const subscribers = new Set();
let memoryStore = {};

const storageKey = (userId) => `${STORAGE_PREFIX}${userId || 'anonymous'}`;

const hasLocalStorage = () => {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return false;
    const probe = '__hyt_reads_probe__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return true;
  } catch {
    return false;
  }
};

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

/** Ids the user has already opened.  Never throws. */
export function getReadAnnouncementIds(userId) {
  const raw = readRaw(userId);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((id) => typeof id === 'string' && id);
  } catch {
    return [];
  }
}

const notify = (userId) => {
  subscribers.forEach((listener) => {
    try {
      listener({ userId });
    } catch {
      /* one bad subscriber must not block the write */
    }
  });
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { userId } }));
  }
};

const persist = (userId, ids) => {
  const unique = Array.from(new Set((ids || []).filter(Boolean))).slice(-MAX_STORED_IDS);
  writeRaw(userId, JSON.stringify(unique));
  notify(userId);
  return unique;
};

export function markAnnouncementRead(userId, announcementId) {
  if (!announcementId) return getReadAnnouncementIds(userId);
  return persist(userId, [...getReadAnnouncementIds(userId), announcementId]);
}

export function markAnnouncementsRead(userId, announcementIds) {
  return persist(userId, [...getReadAnnouncementIds(userId), ...(announcementIds || [])]);
}

export function clearAnnouncementReads(userId) {
  return persist(userId, []);
}

/**
 * Subscribe a component to the read set for `userId`.
 * Returns { readIds: Set, markRead, markAllRead }.
 */
export function useAnnouncementReads(userId) {
  const [ids, setIds] = useState(() => getReadAnnouncementIds(userId));

  useEffect(() => {
    setIds(getReadAnnouncementIds(userId));

    const sync = (detail) => {
      if (detail?.userId && userId && detail.userId !== userId) return;
      setIds(getReadAnnouncementIds(userId));
    };
    const onWindowEvent = (event) => sync(event?.detail);

    subscribers.add(sync);
    if (typeof window !== 'undefined') window.addEventListener(CHANGE_EVENT, onWindowEvent);

    return () => {
      subscribers.delete(sync);
      if (typeof window !== 'undefined') window.removeEventListener(CHANGE_EVENT, onWindowEvent);
    };
  }, [userId]);

  const readIds = useMemo(() => new Set(ids), [ids]);

  const markRead = useCallback((id) => {
    markAnnouncementRead(userId, id);
  }, [userId]);

  const markAllRead = useCallback((allIds) => {
    markAnnouncementsRead(userId, allIds);
  }, [userId]);

  return { readIds, markRead, markAllRead };
}
