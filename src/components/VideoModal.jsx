import { useEffect, useRef, useState } from 'react';
import './VideoModal.css';

export function VideoModal({ isOpen, onClose, galleryItem }) {
  const videoRef = useRef(null);
  const [videoError, setVideoError] = useState(false);
  const [isVideoAvailable, setIsVideoAvailable] = useState(true);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
      
      // Check if video source exists
      if (galleryItem?.video) {
        checkVideoAvailability(galleryItem.video);
      }
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, galleryItem]);

  const checkVideoAvailability = async (videoSrc) => {
    try {
      const response = await fetch(videoSrc, { method: 'HEAD' });
      setIsVideoAvailable(response.ok);
    } catch (error) {
      setIsVideoAvailable(false);
    }
  };

  const handleClose = () => {
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
    setVideoError(false);
    onClose();
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      handleClose();
    }
  };

  const handleVideoError = () => {
    setVideoError(true);
  };

  if (!isOpen || !galleryItem) return null;

  return (
    <div className="video-modal-overlay" onClick={handleBackdropClick}>
      <div className="video-modal-container">
        <button 
          className="video-modal-close"
          onClick={handleClose}
          aria-label="Close video modal"
        >
          ✕
        </button>
        
        <div className="video-modal-content">
          <div className="video-modal-header">
            <h3 className="video-modal-title">{galleryItem.title}</h3>
            <p className="video-modal-description">{galleryItem.description}</p>
          </div>

          <div className="video-modal-player">
            {videoError || !isVideoAvailable ? (
              <div className="video-error-state">
                <div className="video-error-icon">🎬</div>
                <h4>Video Coming Soon</h4>
                <p>This video will be available shortly. Check back later!</p>
                <button className="video-error-button" onClick={handleClose}>
                  Close
                </button>
              </div>
            ) : (
              <video
                ref={videoRef}
                controls
                autoPlay
                controlsList="nodownload"
                onError={handleVideoError}
                className="video-player"
              >
                <source src={galleryItem.video} type="video/mp4" />
                Your browser does not support the video tag.
              </video>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
