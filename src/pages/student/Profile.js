import { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { updateProfile } from '../../services/authService';
import { showToast } from '../../utils/notifications';
import './Profile.css';

export function StudentProfile() {
  const { state, dispatch } = useApp();
  const { currentUser } = state;
  
  const [formData, setFormData] = useState({
    fullName: currentUser?.fullName || '',
    studentId: currentUser?.studentId || '',
    email: currentUser?.email || '',
    school: currentUser?.school || '',
    course: currentUser?.course || '',
    yearLevel: currentUser?.yearLevel || '',
    contactNumber: currentUser?.contactNumber || '',
    address: currentUser?.address || ''
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [errors, setErrors] = useState({});

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    try {
      const names = formData.fullName.split(' ');
      const updates = {
        ...formData,
        firstName: names[0],
        lastName: names.slice(1).join(' ') || names[0]
      };
      
      const updatedUser = updateProfile(currentUser.id, updates, state.users);
      dispatch({ type: 'UPDATE_USER', payload: updatedUser });
      
      showToast('Profile updated successfully!', 'success');
      setIsEditing(false);
    } catch (error) {
      showToast(error.message, 'error');
    }
  };

  return (
    <div className="profile-page">
      <h1 className="page-title">My Profile</h1>
      
      <Card>
        <div className="profile-header">
          <h2 className="section-title">Personal Information</h2>
          {!isEditing && (
            <Button onClick={() => setIsEditing(true)}>Edit Profile</Button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="profile-form">
          <Input
            label="Full Name"
            name="fullName"
            value={formData.fullName}
            onChange={handleChange}
            disabled={!isEditing}
            required
          />

          <Input
            label="Student ID"
            name="studentId"
            value={formData.studentId}
            onChange={handleChange}
            disabled={!isEditing}
            placeholder="Enter your student ID"
            required
          />

          <Input
            label="Email"
            type="email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            disabled={!isEditing}
            required
          />

          <Input
            label="School"
            name="school"
            value={formData.school}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <div className="profile-form-row">
            <Input
              label="Course"
              name="course"
              value={formData.course}
              onChange={handleChange}
              disabled={!isEditing}
            />

            <Input
              label="Year Level"
              name="yearLevel"
              value={formData.yearLevel}
              onChange={handleChange}
              disabled={!isEditing}
            />
          </div>

          <Input
            label="Contact Number"
            name="contactNumber"
            value={formData.contactNumber}
            onChange={handleChange}
            disabled={!isEditing}
          />

          <Input
            label="Address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            disabled={!isEditing}
          />

          {isEditing && (
            <div className="profile-actions">
              <Button type="submit">Save Changes</Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    fullName: currentUser?.fullName || '',
                    studentId: currentUser?.studentId || '',
                    email: currentUser?.email || '',
                    school: currentUser?.school || '',
                    course: currentUser?.course || '',
                    yearLevel: currentUser?.yearLevel || '',
                    contactNumber: currentUser?.contactNumber || '',
                    address: currentUser?.address || ''
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          )}
        </form>
      </Card>
    </div>
  );
}
