import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Button } from '../../components/Button';
import { Badge } from '../../components/Badge';
import { Modal } from '../../components/Modal';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Select } from '../../components/Select';
import { showToast } from '../../utils/notifications';

export function AdminPrograms() {
  const { state, dispatch } = useApp();
  const { programs } = state;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: '',
    objectives: '',
    thrusts: [],
    schedule: '',
    location: '',
    setup: 'On-site',
    requirements: '',
    availableSlots: '',
    applicationDeadline: '',
    status: 'Draft'
  });
  const [errors, setErrors] = useState({});

  const thrustsOptions = [
    'Education', 'Enhancement', 'Experience', 'Entrepreneurship',
    'Endurance', 'Exploration', 'Empowerment', 'Enlightenment'
  ];

  const handleChange = (e) => {
    const { name, value, checked } = e.target;
    
    if (name === 'thrusts') {
      const currentThrusts = formData.thrusts;
      if (checked) {
        setFormData(prev => ({ ...prev, thrusts: [...currentThrusts, value] }));
      } else {
        setFormData(prev => ({ ...prev, thrusts: currentThrusts.filter(t => t !== value) }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.description) newErrors.description = 'Description is required';
    if (!formData.category) newErrors.category = 'Category is required';
    if (!formData.objectives) newErrors.objectives = 'Objectives are required';
    if (formData.thrusts.length === 0) newErrors.thrusts = 'Select at least one thrust';
    if (!formData.schedule) newErrors.schedule = 'Schedule is required';
    if (!formData.location) newErrors.location = 'Location is required';
    if (!formData.requirements) newErrors.requirements = 'Requirements are required';
    if (!formData.availableSlots || formData.availableSlots < 1) newErrors.availableSlots = 'Available slots must be at least 1';
    if (!formData.applicationDeadline) newErrors.applicationDeadline = 'Application deadline is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newProgram = {
      id: `prog-${Date.now()}`,
      ...formData,
      objectives: formData.objectives.split('\n').filter(o => o.trim()),
      requirements: formData.requirements.split('\n').filter(r => r.trim()),
      availableSlots: parseInt(formData.availableSlots),
      createdAt: new Date().toISOString(),
      image: null
    };

    dispatch({ type: 'ADD_PROGRAM', payload: newProgram });
    showToast('Program created successfully!', 'success');
    handleCancel();
  };

  const handleCancel = () => {
    setShowCreateModal(false);
    setFormData({
      title: '',
      description: '',
      category: '',
      objectives: '',
      thrusts: [],
      schedule: '',
      location: '',
      setup: 'On-site',
      requirements: '',
      availableSlots: '',
      applicationDeadline: '',
      status: 'Draft'
    });
    setErrors({});
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Programs</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Program</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {programs.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--muted-text)' }}>No programs yet. Create your first program!</p>
            </div>
          </Card>
        ) : (
          programs.map((program) => (
            <Card key={program.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{program.title}</h3>
                  <p style={{ color: 'var(--muted-text)', marginTop: '8px' }}>{program.description.substring(0, 100)}...</p>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '14px', color: 'var(--muted-text)' }}>
                    <span>📅 {program.schedule}</span>
                    <span>📍 {program.location}</span>
                    <span>👥 {program.availableSlots} slots</span>
                  </div>
                </div>
                <Badge status={program.status}>{program.status}</Badge>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={handleCancel} title="Create New Program">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <Input
            label="Program Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            error={errors.title}
            required
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            error={errors.description}
            rows={4}
            required
          />

          <Input
            label="Category"
            name="category"
            value={formData.category}
            onChange={handleChange}
            error={errors.category}
            placeholder="e.g., Leadership, Training, Workshop"
            required
          />

          <Textarea
            label="Objectives (one per line)"
            name="objectives"
            value={formData.objectives}
            onChange={handleChange}
            error={errors.objectives}
            rows={4}
            placeholder="Enter each objective on a new line"
            required
          />

          <div>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '500' }}>
              HYT Thrusts *
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px' }}>
              {thrustsOptions.map(thrust => (
                <label key={thrust} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    name="thrusts"
                    value={thrust}
                    checked={formData.thrusts.includes(thrust)}
                    onChange={handleChange}
                  />
                  <span>{thrust}</span>
                </label>
              ))}
            </div>
            {errors.thrusts && <div style={{ color: '#DC2626', fontSize: '14px', marginTop: '4px' }}>{errors.thrusts}</div>}
          </div>

          <Input
            label="Schedule"
            name="schedule"
            value={formData.schedule}
            onChange={handleChange}
            error={errors.schedule}
            placeholder="e.g., November 15-17, 2026"
            required
          />

          <Input
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            error={errors.location}
            required
          />

          <Select
            label="Setup"
            name="setup"
            value={formData.setup}
            onChange={handleChange}
          >
            <option value="On-site">On-site</option>
            <option value="Online">Online</option>
            <option value="Hybrid">Hybrid</option>
          </Select>

          <Textarea
            label="Requirements (one per line)"
            name="requirements"
            value={formData.requirements}
            onChange={handleChange}
            error={errors.requirements}
            rows={4}
            placeholder="Enter each requirement on a new line"
            required
          />

          <Input
            label="Available Slots"
            type="number"
            name="availableSlots"
            value={formData.availableSlots}
            onChange={handleChange}
            error={errors.availableSlots}
            min="1"
            required
          />

          <Input
            label="Application Deadline"
            type="date"
            name="applicationDeadline"
            value={formData.applicationDeadline}
            onChange={handleChange}
            error={errors.applicationDeadline}
            min={new Date().toISOString().split('T')[0]}
            required
          />

          <Select
            label="Status"
            name="status"
            value={formData.status}
            onChange={handleChange}
          >
            <option value="Draft">Draft</option>
            <option value="Published">Published</option>
          </Select>

          <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
            <Button type="button" variant="outline" onClick={handleCancel}>
              Cancel
            </Button>
            <Button type="submit">Create Program</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
