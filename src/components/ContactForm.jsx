import { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { Card } from './Card';
import { toast } from 'react-toastify';
import emailjs from '@emailjs/browser';
import './ContactForm.css';

// Initialize EmailJS with your public key
// Get your keys from https://dashboard.emailjs.com/
emailjs.init('TTj5Qz8wRgU4ouTVWfZ0O'); 

export function ContactForm() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    if (!formData.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!formData.subject.trim()) {
      newErrors.subject = 'Subject is required';
    }

    if (!formData.message.trim()) {
      newErrors.message = 'Message is required';
    } else if (formData.message.trim().length < 10) {
      newErrors.message = 'Message must be at least 10 characters';
    }

    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }

    try {
      setLoading(true);

      // EmailJS configuration
      // Replace these with your actual EmailJS service ID and template ID
      const serviceId = 'YOUR_SERVICE_ID'; // From EmailJS dashboard
      const templateId = 'YOUR_TEMPLATE_ID'; // From EmailJS dashboard

      const templateParams = {
        from_name: formData.name,
        from_email: formData.email,
        subject: formData.subject,
        message: formData.message,
        to_email: 'augosteeval@gmail.com',
        reply_to: formData.email
      };

      await emailjs.send(serviceId, templateId, templateParams);

      toast.success('Message sent successfully. We will get back to you soon.');
      
      // Clear form
      setFormData({
        name: '',
        email: '',
        subject: '',
        message: ''
      });
      setErrors({});
    } catch (error) {
      console.error('Email send error:', error);
      toast.error('Failed to send message. Please try again or email us directly at augosteeval@gmail.com');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: '' });
    }
  };

  return (
    <Card className="contact-form-card">
      <div className="contact-form-header">
        <h3 className="contact-form-title">Send Us a Message</h3>
        <p className="contact-form-subtitle">
          Have questions? We'd love to hear from you. Send us a message and we'll respond as soon as possible.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="contact-form">
        <Input
          label="Your Name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          error={errors.name}
          placeholder="John Doe"
          required
        />

        <Input
          label="Email Address"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          error={errors.email}
          placeholder="your.email@example.com"
          required
        />

        <Input
          label="Subject"
          type="text"
          value={formData.subject}
          onChange={(e) => handleChange('subject', e.target.value)}
          error={errors.subject}
          placeholder="How can we help you?"
          required
        />

        <div className="form-group">
          <label className="form-label">
            Message <span className="required">*</span>
          </label>
          <textarea
            className={`form-textarea ${errors.message ? 'error' : ''}`}
            value={formData.message}
            onChange={(e) => handleChange('message', e.target.value)}
            placeholder="Tell us more about your inquiry..."
            rows="5"
            required
          />
          {errors.message && <div className="form-error">{errors.message}</div>}
        </div>

        <Button type="submit" disabled={loading} fullWidth>
          {loading ? 'Sending...' : 'Send Message'}
        </Button>

        <div className="contact-alternative">
          <p>Or email us directly at:</p>
          <a href="mailto:augosteeval@gmail.com" className="email-link">
            augosteeval@gmail.com
          </a>
        </div>
      </form>
    </Card>
  );
}
