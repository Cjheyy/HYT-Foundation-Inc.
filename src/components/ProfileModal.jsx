import { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { Input } from './Input';
import { Button } from './Button';
import { updateProfile } from '../services/authService';
import { useApp } from '../context/AppContext';
import { toast } from 'react-toastify';

/**
 * Profile Settings modal opened directly from the navbar avatar / name badge.
 * Updates personal details and avatar image, then refreshes the navbar instantly.
 */
export function ProfileModal({ isOpen, onClose }) {
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  const [formData, setFormData] = useState({
    fullName: '',
    contactNumber: '',
    address: '',
    school: '',
    course: '',
    yearLevel: '',
    profilePicture: ''
  });
  const [preview, setPreview] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen && currentUser) {
      setFormData({
        fullName: currentUser.fullName || '',
        contactNumber: currentUser.contactNumber || '',
        address: currentUser.address || '',
        school: currentUser.school || '',
        course: currentUser.course || '',
        yearLevel: currentUser.yearLevel || '',
        profilePicture: currentUser.profilePicture || ''
      });
      setPreview(currentUser.profilePicture || '');
    }
  }, [isOpen, currentUser]);

  if (!isOpen) return null;

  const handleChange = (event) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAvatarFile = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      setPreview(dataUrl);
      setFormData((prev) => ({ ...prev, profilePicture: dataUrl }));
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!currentUser?.id) return;
    const names = String(formData.fullName || '').trim().split(/\s+/).filter(Boolean);
    if (!names.length) {
      toast.error('Full name is required.');
      return;
    }
    setSaving(true);
    try {
      const updated = await updateProfile(currentUser.id, {
        fullName: formData.fullName.trim(),
        firstName: names[0],
        lastName: names.slice(1).join(' ') || names[0],
        contactNumber: formData.contactNumber,
        address: formData.address,
        school: formData.school,
        course: formData.course,
        yearLevel: formData.yearLevel,
        profilePicture: formData.profilePicture
      });
      dispatch({ type: 'UPDATE_USER', payload: updated });
      toast.success('Profile updated successfully.');
      onClose();
    } catch (error) {
      toast.error(error.message || 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const initial = String(formData.fullName || 'U').trim().charAt(0).toUpperCase() || 'U';

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Profile Settings">
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            className="user-avatar"
            style={{ width: 56, height: 56, fontSize: 22, overflow: 'hidden', flexShrink: 0 }}
            aria-label="Profile avatar preview"
          >
            {preview ? (
              <img src={preview} alt="Avatar preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              initial
            )}
          </div>
          <div>
            <label className="form-label" htmlFor="profile-avatar-file">Profile photo</label>
            <input id="profile-avatar-file" type="file" accept="image/*" onChange={handleAvatarFile} />
            <div className="form-help">Upload an image to update the navbar avatar instantly.</div>
          </div>
        </div>
        <Input label="Full Name" name="fullName" value={formData.fullName} onChange={handleChange} required />
        <Input label="Contact Number" name="contactNumber" value={formData.contactNumber} onChange={handleChange} autoComplete="tel" />
        <Input label="Address" name="address" value={formData.address} onChange={handleChange} autoComplete="street-address" />
        <Input label="School" name="school" value={formData.school} onChange={handleChange} />
        <Input label="Course" name="course" value={formData.course} onChange={handleChange} />
        <Input label="Year Level" name="yearLevel" value={formData.yearLevel} onChange={handleChange} />
        <Input label="Avatar Image URL (optional)" name="profilePicture" value={formData.profilePicture} onChange={handleChange} placeholder="https://..." />
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <Button type="button" variant="outline" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" disabled={saving}>{saving ? 'Saving...' : 'Save Changes'}</Button>
        </div>
      </form>
    </Modal>
  );
}
