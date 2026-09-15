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

export function AdminOpportunities() {
  const { state, dispatch } = useApp();
  const { opportunities } = state;
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [formData, setFormData] = useState({
    title: '',
    organization: '',
    description: '',
    type: 'Internship',
    workplace: '',
    workSchedule: '',
    location: '',
    setup: 'On-site',
    requirements: '',
    skills: '',
    compensation: '',
    duration: '',
    availableSlots: '',
    applicationDeadline: '',
    contactEmail: '',
    contactPhone: '',
    status: 'Draft'
  });
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title) newErrors.title = 'Title is required';
    if (!formData.organization) newErrors.organization = 'Organization is required';
    if (!formData.description) newErrors.description = 'Description is required';
    if (!formData.workplace) newErrors.workplace = 'Workplace is required';
    if (!formData.workSchedule) newErrors.workSchedule = 'Work schedule is required';
    if (!formData.location) newErrors.location = 'Location is required';
    if (!formData.requirements) newErrors.requirements = 'Requirements are required';
    if (!formData.skills) newErrors.skills = 'Skills are required';
    if (!formData.duration) newErrors.duration = 'Duration is required';
    if (!formData.availableSlots || formData.availableSlots < 1) newErrors.availableSlots = 'Available slots must be at least 1';
    if (!formData.applicationDeadline) newErrors.applicationDeadline = 'Application deadline is required';
    if (!formData.contactEmail) newErrors.contactEmail = 'Contact email is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validateForm();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    const newOpportunity = {
      id: `opp-${Date.now()}`,
      ...formData,
      requirements: formData.requirements.split('\n').filter(r => r.trim()),
      skills: formData.skills.split(',').map(s => s.trim()).filter(s => s),
      availableSlots: parseInt(formData.availableSlots),
      createdAt: new Date().toISOString()
    };

    dispatch({ type: 'ADD_OPPORTUNITY', payload: newOpportunity });
    showToast('Opportunity created successfully!', 'success');
    handleCancel();
  };

  const handleCancel = () => {
    setShowCreateModal(false);
    setFormData({
      title: '',
      organization: '',
      description: '',
      type: 'Internship',
      workplace: '',
      workSchedule: '',
      location: '',
      setup: 'On-site',
      requirements: '',
      skills: '',
      compensation: '',
      duration: '',
      availableSlots: '',
      applicationDeadline: '',
      contactEmail: '',
      contactPhone: '',
      status: 'Draft'
    });
    setErrors({});
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <h1 className="page-title">Opportunities</h1>
        <Button onClick={() => setShowCreateModal(true)}>+ Create Opportunity</Button>
      </div>

      <div style={{ display: 'grid', gap: '16px' }}>
        {opportunities.length === 0 ? (
          <Card>
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <p style={{ color: 'var(--muted-text)' }}>No opportunities yet. Create your first opportunity!</p>
            </div>
          </Card>
        ) : (
          opportunities.map((opp) => (
            <Card key={opp.id}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div>
                  <h3 style={{ fontSize: '18px', fontWeight: '600' }}>{opp.title}</h3>
                  <p style={{ color: 'var(--primary-orange)', marginBottom: '4px', fontWeight: '500' }}>{opp.organization}</p>
                  <p style={{ color: 'var(--muted-text)', marginTop: '8px' }}>{opp.description.substring(0, 100)}...</p>
                  <div style={{ marginTop: '12px', display: 'flex', gap: '16px', fontSize: '14px', color: 'var(--muted-text)' }}>
                    <span>💼 {opp.type}</span>
                    <span>📍 {opp.location}</span>
                    <span>👥 {opp.availableSlots} slots</span>
                    <span>⏱️ {opp.duration}</span>
                  </div>
                </div>
                <Badge status={opp.status}>{opp.status}</Badge>
              </div>
            </Card>
          ))
        )}
      </div>

      <Modal isOpen={showCreateModal} onClose={handleCancel} title="Create New Opportunity">
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '70vh', overflowY: 'auto', padding: '4px' }}>
          <Input
            label="Opportunity Title"
            name="title"
            value={formData.title}
            onChange={handleChange}
            error={errors.title}
            placeholder="e.g., Software Development Intern"
            required
          />

          <Input
            label="Organization/Company"
            name="organization"
            value={formData.organization}
            onChange={handleChange}
            error={errors.organization}
            required
          />

          <Textarea
            label="Description"
            name="description"
            value={formData.description}
            onChange={handleChange}
            error={errors.description}
            rows={4}
            placeholder="Describe the opportunity, responsibilities, and what the participant will learn"
            required
          />

          <Select
            label="Opportunity Type"
            name="type"
            value={formData.type}
            onChange={handleChange}
          >
            <option value="Internship">Internship</option>
            <option value="OJT">OJT (On-the-Job Training)</option>
            <option value="Part-time">Part-time</option>
            <option value="Volunteer">Volunteer</option>
            <option value="Project-based">Project-based</option>
          </Select>

          <Input
            label="Workplace/Department"
            name="workplace"
            value={formData.workplace}
            onChange={handleChange}
            error={errors.workplace}
            placeholder="e.g., IT Department, Marketing Team"
            required
          />

          <Input
            label="Work Schedule"
            name="workSchedule"
            value={formData.workSchedule}
            onChange={handleChange}
            error={errors.workSchedule}
            placeholder="e.g., Monday-Friday, 9:00 AM - 5:00 PM"
            required
          />

          <Input
            label="Location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            error={errors.location}
            placeholder="e.g., Quezon City, Metro Manila"
            required
          />

          <Select
            label="Setup"
            name="setup"
            value={formData.setup}
            onChange={handleChange}
          >
            <option value="On-site">On-site</option>
            <option value="Remote">Remote</option>
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

          <Textarea
            label="Required Skills (comma-separated)"
            name="skills"
            value={formData.skills}
            onChange={handleChange}
            error={errors.skills}
            rows={2}
            placeholder="e.g., JavaScript, React, Communication, Teamwork"
            required
          />

          <Input
            label="Compensation/Allowance"
            name="compensation"
            value={formData.compensation}
            onChange={handleChange}
            placeholder="e.g., ₱5,000/month or Unpaid with certificate"
          />

          <Input
            label="Duration"
            name="duration"
            value={formData.duration}
            onChange={handleChange}
            error={errors.duration}
            placeholder="e.g., 3 months, 486 hours"
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

          <Input
            label="Contact Email"
            type="email"
            name="contactEmail"
            value={formData.contactEmail}
            onChange={handleChange}
            error={errors.contactEmail}
            required
          />

          <Input
            label="Contact Phone"
            type="tel"
            name="contactPhone"
            value={formData.contactPhone}
            onChange={handleChange}
            placeholder="Optional"
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
            <Button type="submit">Create Opportunity</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
