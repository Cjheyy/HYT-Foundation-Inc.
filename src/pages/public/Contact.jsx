import { useState } from 'react';
import { Card } from '../../components/Card';
import { Input } from '../../components/Input';
import { Textarea } from '../../components/Textarea';
import { Button } from '../../components/Button';
import { showToast } from '../../utils/notifications';
import { validateEmail } from '../../utils/helpers';
import './Contact.css';

export function Contact() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validate = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Name is required';
    if (!formData.email) {
      newErrors.email = 'Email is required';
    } else if (!validateEmail(formData.email)) {
      newErrors.email = 'Invalid email format';
    }
    if (!formData.subject) newErrors.subject = 'Subject is required';
    if (!formData.message) newErrors.message = 'Message is required';
    return newErrors;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const newErrors = validate();
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    // Simulate API call
    setTimeout(() => {
      showToast('Inquiry submitted successfully!', 'success');
      setFormData({ name: '', email: '', subject: '', message: '' });
      setLoading(false);
    }, 1000);
  };

  return (
    <div className="contact-page">
      <section className="page-hero">
        <div className="container">
          <h1 className="page-title">Contact Us</h1>
          <p className="page-subtitle">
            Get in touch with us. We're here to help and answer your questions
          </p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="contact-grid">
            <div className="contact-info">
              <h2 className="section-title">Get in Touch</h2>
              <p className="section-text">
                Have questions about our programs, opportunities, or platform? 
                We'd love to hear from you. Fill out the form and we'll get back to you as soon as possible.
              </p>

              <div className="contact-details">
                <Card className="contact-detail-card">
                  <div className="detail-icon">📧</div>
                  <h3 className="detail-title">Email</h3>
                  <p className="detail-text">info@hyt-foundation.org</p>
                </Card>

                <Card className="contact-detail-card">
                  <div className="detail-icon">📞</div>
                  <h3 className="detail-title">Phone</h3>
                  <p className="detail-text">+63 2 1234 5678</p>
                </Card>

                <Card className="contact-detail-card">
                  <div className="detail-icon">📍</div>
                  <h3 className="detail-title">Address</h3>
                  <p className="detail-text">Quezon City, Metro Manila, Philippines</p>
                </Card>

                <Card className="contact-detail-card">
                  <div className="detail-icon">⏰</div>
                  <h3 className="detail-title">Office Hours</h3>
                  <p className="detail-text">Monday - Friday: 9:00 AM - 5:00 PM</p>
                </Card>
              </div>
            </div>

            <Card className="contact-form-card">
              <h3 className="form-title">Send us a Message</h3>
              <form onSubmit={handleSubmit} className="contact-form">
                <Input
                  label="Your Name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  error={errors.name}
                  required
                />

                <Input
                  label="Email Address"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  error={errors.email}
                  required
                />

                <Input
                  label="Subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  error={errors.subject}
                  required
                />

                <Textarea
                  label="Message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  error={errors.message}
                  rows={6}
                  required
                />

                <Button type="submit" disabled={loading} style={{ width: '100%' }}>
                  {loading ? 'Sending...' : 'Send Message'}
                </Button>
              </form>
            </Card>
          </div>
        </div>
      </section>
    </div>
  );
}
