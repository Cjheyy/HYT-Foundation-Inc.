import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../context/AppContext';
import { Icon } from './icons';
import { useAnnouncementReads } from '../utils/announcementReads';
import { buildAttentionItems, getPublishedAnnouncements } from '../utils/attention';
import './AttentionCenter.css';

const pluralize = (count, singular, plural = `${singular}s`) =>
  `${count} ${count === 1 ? singular : plural}`;

/**
 * Bell + count in the portal header, opening a panel of everything that is
 * waiting on the signed-in trainee.
 *
 * Those signals live on four different pages; before this the only way to find
 * a rejected daily report or an un-uploaded requirement was to visit each page
 * in turn.  The item list itself comes from utils/attention so the sidebar
 * badges and this panel can never disagree.
 */
export function AttentionCenter({ basePath = '/student' }) {
  const { state } = useApp();
  const { currentUser } = state;
  const { readIds, markAllRead } = useAnnouncementReads(currentUser?.id);
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef(null);

  const items = useMemo(
    () => buildAttentionItems({ state, userId: currentUser?.id, basePath, readIds }),
    [state, currentUser?.id, basePath, readIds]
  );
  const count = items.length;

  const publishedIds = useMemo(
    () => getPublishedAnnouncements(state).map((announcement) => announcement.id),
    [state]
  );
  const hasUnread = publishedIds.some((id) => !readIds.has(id));

  // Dismiss on outside click or Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target)) setOpen(false);
    };
    const onKeyDown = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const label = count
    ? `Needs attention: ${pluralize(count, 'item')}`
    : 'Nothing needs your attention';

  return (
    <div className="attention-center" ref={wrapperRef}>
      <button
        type="button"
        className={`attention-bell ${open ? 'open' : ''} ${count ? 'has-items' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={label}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={label}
      >
        <Icon name="bell" size={18} />
        {count > 0 && <span className="attention-count">{count > 9 ? '9+' : count}</span>}
      </button>

      {open && (
        <div className="attention-panel" role="dialog" aria-label="Needs your attention">
          <div className="attention-panel-head">
            <span>Needs your attention</span>
            {hasUnread && (
              <button
                type="button"
                className="attention-mark-all"
                onClick={() => markAllRead(publishedIds)}
              >
                Mark all read
              </button>
            )}
          </div>

          {count === 0 ? (
            <div className="attention-empty">
              <Icon name="check" size={20} color="#10B981" />
              <span>You&apos;re all caught up.</span>
            </div>
          ) : (
            <ul className="attention-list">
              {items.map((item) => (
                <li key={item.id}>
                  <Link
                    to={item.to}
                    className={`attention-item tone-${item.tone}`}
                    onClick={() => setOpen(false)}
                  >
                    <span className="attention-item-icon"><Icon name={item.icon} size={16} /></span>
                    <span className="attention-item-body">
                      <span className="attention-item-title">{item.title}</span>
                      <span className="attention-item-detail">{item.detail}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
