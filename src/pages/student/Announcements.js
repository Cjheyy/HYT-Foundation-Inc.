import { useMemo, useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { Skeleton } from '../../components/Skeleton';
import { Icon } from '../../components/icons';
import { normalizeStatus } from '../../services/supabaseService';
import { formatDate } from '../../utils/helpers';
import { useAnnouncementReads } from '../../utils/announcementReads';
import './Announcements.css';

const ALL_TAB = 'All';
const UNREAD_TAB = 'Unread';

export function StudentAnnouncements() {
  const { state } = useApp();
  const { announcements, currentUser, dataLoading } = state;
  const { readIds, markRead } = useAnnouncementReads(currentUser?.id);

  const [search, setSearch] = useState('');
  const [tab, setTab] = useState(ALL_TAB);

  // The old filter was `a.status === 'Published'` — case-sensitive — while the
  // public Home page already compared lower-cased values.  A casing change in
  // the database would have silently emptied this page.
  const published = useMemo(
    () => (announcements || []).filter((item) => normalizeStatus(item.status) === 'PUBLISHED'),
    [announcements]
  );

  const unreadCount = useMemo(
    () => published.filter((item) => !readIds.has(item.id)).length,
    [published, readIds]
  );

  const categories = useMemo(() => {
    const seen = [];
    published.forEach((item) => {
      const category = String(item.category || '').trim();
      if (category && !seen.includes(category)) seen.push(category);
    });
    return seen;
  }, [published]);

  const tabs = useMemo(() => [ALL_TAB, UNREAD_TAB, ...categories], [categories]);

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return published.filter((item) => {
      if (tab === UNREAD_TAB && readIds.has(item.id)) return false;
      if (tab !== ALL_TAB && tab !== UNREAD_TAB && String(item.category || '').trim() !== tab) return false;
      if (!query) return true;
      return `${item.title || ''} ${item.content || ''}`.toLowerCase().includes(query);
    });
  }, [published, tab, search, readIds]);

  if (dataLoading) {
    return (
      <div className="announcements-page">
        <Skeleton width="260px" height={30} style={{ marginBottom: 16 }} />
        <Skeleton width="100%" height={42} radius={10} style={{ marginBottom: 20 }} />
        <div className="announcements-list">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index}>
              <Skeleton width="45%" height={18} style={{ marginBottom: 12 }} />
              <Skeleton width="95%" height={13} style={{ marginBottom: 6 }} />
              <Skeleton width="70%" height={13} style={{ marginBottom: 14 }} />
              <Skeleton width="30%" height={12} />
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="announcements-page">
      <h1 className="page-title">Announcements</h1>

      {published.length > 0 && (
        <div className="announcements-toolbar">
          <div className="announcements-search">
            <Icon name="search" size={16} />
            <input
              type="search"
              className="announcements-search-input"
              placeholder="Search announcements..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search announcements"
            />
          </div>
          <div className="announcements-tabs" role="tablist" aria-label="Filter announcements">
            {tabs.map((name) => (
              <button
                key={name}
                type="button"
                role="tab"
                aria-selected={tab === name}
                className={`announcements-tab ${tab === name ? 'active' : ''}`}
                onClick={() => setTab(name)}
              >
                {name}
                {name === UNREAD_TAB && unreadCount > 0 && (
                  <span className="announcements-tab-count">{unreadCount}</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {published.length === 0 ? (
        <EmptyState
          icon="bell"
          title="No Announcements"
          message="No announcements available at this time"
        />
      ) : visible.length === 0 ? (
        <EmptyState
          icon="search"
          title="No matches"
          message="No announcement matches your search or filter."
        />
      ) : (
        <>
          <p className="announcements-result-count">
            Showing {visible.length} of {published.length}
          </p>
          <div className="announcements-list">
            {visible.map((announcement) => {
              const isUnread = !readIds.has(announcement.id);
              return (
                <Card
                  key={announcement.id}
                  className={`announcement-card ${isUnread ? 'unread' : ''}`}
                >
                  <div className="announcement-card-header">
                    <div className="announcement-card-heading">
                      {isUnread && <span className="announcement-unread-dot" aria-hidden="true" />}
                      <h3 className="announcement-card-title">{announcement.title}</h3>
                    </div>
                    <Badge color={announcement.priority === 'High' ? 'red' : 'blue'}>
                      {announcement.category}
                    </Badge>
                  </div>
                  <p className="announcement-card-content">{announcement.content}</p>
                  <div className={`announcement-card-date ${isUnread ? 'unread-label' : ''}`}>
                    <Icon name="calendar" size={14} />
                    <span>{formatDate(announcement.publishedAt) || '—'}</span>
                    {isUnread && <span>· Unread</span>}
                  </div>
                  {isUnread && (
                    <button
                      type="button"
                      className="announcement-mark-read"
                      onClick={() => markRead(announcement.id)}
                    >
                      Mark as read
                    </button>
                  )}
                </Card>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
