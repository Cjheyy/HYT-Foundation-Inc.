import { useState, useRef, useEffect } from 'react';
import './GalleryCard.css';

export function GalleryCard({ item, onClick, userHasInteracted }) {
  const [imageError, setImageError] = useState(false);
  const [hasHovered, setHasHovered] = useState(false);
  const audioRef = useRef(null);
  const cardRef = useRef(null);

  useEffect(() => {
    // Try to preload hover sound, but use Web Audio API as fallback
    const audio = new Audio('/sounds/gallery-hover.mp3');
    audio.volume = 0.15;
    audio.load();

    audio.addEventListener('error', () => {
      // Sound file doesn't exist - we'll use Web Audio API fallback
      audioRef.current = null;
    });

    audio.addEventListener('canplaythrough', () => {
      // Sound file loaded successfully
      audioRef.current = audio;
    });

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const handleMouseEnter = () => {
    // Play sound only once per hover and only if user has interacted
    if (!hasHovered && userHasInteracted) {
      setHasHovered(true);
      
      if (audioRef.current) {
        // Use preloaded audio file
        audioRef.current.currentTime = 0;
        audioRef.current.play().catch(() => {
          // Playback failed - ignore silently
        });
      } else {
        // Fallback: Use Web Audio API to generate a subtle beep
        try {
          const audioContext = new (window.AudioContext || window.webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800; // Frequency in Hz
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.05, audioContext.currentTime); // Very quiet
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1); // 100ms duration
        } catch (e) {
          // Web Audio API not supported or failed - silent fallback
        }
      }
    }
  };

  const handleMouseLeave = () => {
    setHasHovered(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(item);
    }
  };

  const handleImageError = () => {
    setImageError(true);
  };

  return (
    <div 
      ref={cardRef}
      className="gallery-card"
      onClick={() => onClick(item)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`Play video: ${item.title}`}
    >
      <div className="gallery-card-image-container">
        {imageError ? (
          <div 
            className="gallery-card-placeholder"
            style={{ background: item.fallbackImage }}
          >
            <span className="gallery-card-placeholder-icon">🎬</span>
          </div>
        ) : (
          <>
            <img 
              src={item.image} 
              alt={item.title}
              className="gallery-card-image"
              onError={handleImageError}
            />
            <div className="gallery-card-overlay">
              <div className="gallery-card-play-button">
                <svg 
                  width="64" 
                  height="64" 
                  viewBox="0 0 64 64" 
                  fill="none"
                  className="play-icon"
                >
                  <circle cx="32" cy="32" r="32" fill="white" fillOpacity="0.95"/>
                  <path 
                    d="M26 20L44 32L26 44V20Z" 
                    fill="#279EB6"
                  />
                </svg>
              </div>
              <div className="gallery-card-play-label">Watch Video</div>
            </div>
          </>
        )}
      </div>
      
      <div className="gallery-card-content">
        <h4 className="gallery-card-title">{item.title}</h4>
        <p className="gallery-card-description">{item.description}</p>
      </div>
    </div>
  );
}
