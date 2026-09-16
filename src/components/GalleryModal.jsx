import { useEffect } from 'react';
import './GalleryModal.css';

export function GalleryModal({ isOpen, onClose, galleryItem }) {
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose]);

  if (!isOpen || !galleryItem) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="gallery-modal-overlay" onClick={handleBackdropClick}>
      <div className="gallery-modal-container">
        <button 
          className="gallery-modal-close"
          onClick={onClose}
          aria-label="Close modal"
        >
          ✕
        </button>
        
        <div className="gallery-modal-content">
          <div className="gallery-modal-image">
            <img src={galleryItem.image} alt={galleryItem.title} />
          </div>

          <div className="gallery-modal-info">
            <h2 className="gallery-modal-title">{galleryItem.title}</h2>
            <p className="gallery-modal-description">{galleryItem.description}</p>
            
            {galleryItem.details && (
              <div className="gallery-modal-details">
                <h3>Event Details</h3>
                {galleryItem.details.date && (
                  <p><strong>Date:</strong> {galleryItem.details.date}</p>
                )}
                {galleryItem.details.location && (
                  <p><strong>Location:</strong> {galleryItem.details.location}</p>
                )}
                {galleryItem.details.participants && (
                  <p><strong>Participants:</strong> {galleryItem.details.participants}</p>
                )}
                {galleryItem.details.highlights && (
                  <div>
                    <strong>Highlights:</strong>
                    <ul>
                      {galleryItem.details.highlights.map((highlight, index) => (
                        <li key={index}>{highlight}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {galleryItem.details.description && (
                  <p className="full-description">{galleryItem.details.description}</p>
                )}
              </div>
            )}

            {galleryItem.gallery && galleryItem.gallery.length > 0 && (
              <div className="gallery-modal-images">
                <h3>More Photos</h3>
                <div className="gallery-modal-images-grid">
                  {galleryItem.gallery.map((image, index) => (
                    <img key={index} src={image} alt={`${galleryItem.title} ${index + 1}`} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
