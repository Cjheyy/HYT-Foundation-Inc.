import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Badge } from '../../components/Badge';
import { EmptyState } from '../../components/EmptyState';
import { formatDate } from '../../utils/helpers';

export function StudentAnnouncements() {
  const { state } = useApp();
  const { announcements } = state;

  const publishedAnnouncements = announcements.filter(a => a.status === 'Published');

  return (
    <div>
      <h1 className="page-title">Announcements</h1>

      {publishedAnnouncements.length > 0 ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          {publishedAnnouncements.map((announcement) => (
            <Card key={announcement.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '12px' }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{announcement.title}</h3>
                <Badge color={announcement.priority === 'High' ? 'red' : 'blue'}>
                  {announcement.category}
                </Badge>
              </div>
              <p style={{ fontSize: '15px', color: 'var(--muted-text)', lineHeight: '1.7', marginBottom: '12px' }}>
                {announcement.content}
              </p>
              <div style={{ fontSize: '13px', color: 'var(--muted-text)' }}>
                📅 {formatDate(announcement.publishedAt)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <EmptyState
          icon="📢"
          title="No Announcements"
          message="No announcements available at this time"
        />
      )}
    </div>
  );
}
