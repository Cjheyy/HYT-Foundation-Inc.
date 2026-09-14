import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { showToast } from '../../utils/notifications';
import { formatDate } from '../../utils/helpers';

export function AdminAnnouncements() {
  const { state, dispatch } = useApp();
  const { announcements } = state;
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    category: 'General',
    priority: 'Medium'
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    const newAnnouncement = {
      id: `ann-${Date.now()}`,
      ...formData,
      status: 'Published',
      publishedAt: new Date().toISOString(),
      createdBy: state.currentUser?.id,
      createdAt: new Date().toISOString()
    };
    dispatch({ type: 'ADD_ANNOUNCEMENT', payload: newAnnouncement });
    showToast('Announcement published successfully!', 'success');
    setShowForm(false);
    setFormData({ title: '', content: '', category: 'General', priority: 'Medium' });
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Announcements</h1>
        <Button onClick={() => setShowForm(true)}>Create Announcement</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {announcements.map((ann) => (
          <Card key={ann.id}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <div style={{ flex: 1 }}>
                <h3 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '8px' }}>{ann.title}</h3>
                <p style={{ color: 'var(--muted-text)', marginBottom: '8px' }}>{ann.content}</p>
                <p style={{ fontSize: '13px', color: 'var(--muted-text)' }}>{formatDate(ann.publishedAt)}</p>
              </div>
              <Badge status={ann.status}>{ann.status}</Badge>
            </div>
          </Card>
        ))}
      </div>

      <Modal isOpen={showForm} onClose={() => setShowForm(false)} title="Create Announcement" size="lg">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gap: '16px' }}>
            <Input
              label="Title"
              value={formData.title}
              onChange={(e) => setFormData({...formData, title: e.target.value})}
              required
            />
            <Textarea
              label="Content"
              value={formData.content}
              onChange={(e) => setFormData({...formData, content: e.target.value})}
              rows={6}
              required
            />
            <Select
              label="Category"
              value={formData.category}
              onChange={(e) => setFormData({...formData, category: e.target.value})}
              options={['General', 'Opportunities', 'Programs', 'Events']}
            />
            <Select
              label="Priority"
              value={formData.priority}
              onChange={(e) => setFormData({...formData, priority: e.target.value})}
              options={['Low', 'Medium', 'High']}
            />
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button type="button" variant="outline" onClick={() => setShowForm(false)}>Cancel</Button>
              <Button type="submit">Publish Announcement</Button>
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
