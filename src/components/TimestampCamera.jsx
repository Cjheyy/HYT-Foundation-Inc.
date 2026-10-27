import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './Modal';
import { Button } from './Button';
import { buildStampLines } from '../utils/stampLines';
import './TimestampCamera.css';

/**
 * The camera step in front of a clock-in / clock-out request.
 *
 * ## Why the photo is taken here and stamped later
 *
 * The frame is captured raw. The stamp is drawn only after `request_clock_in`
 * (or `request_clock_out`) has answered, because the stamp has to carry the
 * server's timestamp and the office the server matched - not the device clock
 * and not the client's own idea of where it is. The overlay shown here is a
 * preview of that stamp; the pixels actually stored are produced by
 * `utils/attendancePhoto.js` at submit time.
 *
 * ## Why there is a way out without a photo
 *
 * A denied permission, a laptop with no webcam, or an in-app browser that
 * blocks `getUserMedia` would otherwise lock a trainee out of attendance
 * entirely. When the camera cannot start, `onSkip` is offered and the request
 * goes through with no photo; the admin queue flags those rows instead. That
 * is a deliberate trade: a missing photo is a smaller problem than a trainee
 * who cannot record a day they actually worked.
 */

const VIDEO_CONSTRAINTS = {
  width: { ideal: 1280 },
  height: { ideal: 960 }
};

/** Human-readable reason for a failed `getUserMedia`. */
function describeCameraError(error) {
  const name = error?.name || '';
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Camera access was blocked. Allow the camera in your browser settings, then try again.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No camera was found on this device.';
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The camera is already in use by another app. Close it and try again.';
  }
  return error?.message || 'The camera could not be started.';
}

export function TimestampCamera({
  isOpen,
  action = 'clockIn',
  stampBase = {},
  submitting = false,
  onCancel,
  onSubmit,
  onSkip
}) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const openRef = useRef(false);
  const shotUrlRef = useRef(null);
  // `getUserMedia` resolves asynchronously, and the dialog can be closed - or
  // the camera switched - while the permission prompt is still up. Every start
  // takes a ticket, and a stream that comes back holding an old ticket is
  // stopped instead of attached. Without this, StrictMode's double mount (and
  // a fast Retake) leaves an orphaned camera running.
  const requestRef = useRef(0);

  // 'starting' | 'live' | 'review' | 'unavailable'
  const [phase, setPhase] = useState('starting');
  const [errorMessage, setErrorMessage] = useState('');
  const [facing, setFacing] = useState('user');
  const [shot, setShot] = useState(null);
  const [capturedAt, setCapturedAt] = useState(null);
  const [now, setNow] = useState(() => new Date());

  const isClockOut = String(action).toLowerCase().includes('out');

  const stopStream = useCallback(() => {
    const stream = streamRef.current;
    streamRef.current = null;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const releaseShot = useCallback(() => {
    if (shotUrlRef.current) {
      URL.revokeObjectURL(shotUrlRef.current);
      shotUrlRef.current = null;
    }
    setShot(null);
    setCapturedAt(null);
  }, []);

  const startStream = useCallback(async (mode) => {
    const ticket = requestRef.current + 1;
    requestRef.current = ticket;

    stopStream();
    setPhase('starting');
    setErrorMessage('');

    if (!navigator?.mediaDevices?.getUserMedia) {
      setPhase('unavailable');
      setErrorMessage('This browser cannot open a camera.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { ...VIDEO_CONSTRAINTS, facingMode: mode === 'user' ? 'user' : 'environment' },
        audio: false
      });

      // The dialog may have been closed - or another start may have overtaken
      // this one - while the permission prompt was open.
      if (!openRef.current || ticket !== requestRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (error) {
          /* autoplay rejection is harmless: the poster frame still shows */
        }
      }
      setPhase('live');
    } catch (error) {
      if (!openRef.current || ticket !== requestRef.current) return;
      stopStream();
      setPhase('unavailable');
      setErrorMessage(describeCameraError(error));
    }
  }, [stopStream]);

  useEffect(() => {
    openRef.current = isOpen;

    if (!isOpen) {
      stopStream();
      releaseShot();
      setPhase('starting');
      setErrorMessage('');
      return undefined;
    }

    setFacing('user');
    startStream('user');

    return () => {
      openRef.current = false;
      stopStream();
    };
  }, [isOpen, startStream, stopStream, releaseShot]);

  // A clock that ticks while the preview is open, so the overlay reads like a
  // viewfinder rather than a frozen label. The stored photo still uses the
  // server's time.
  useEffect(() => {
    if (!isOpen || phase !== 'live') return undefined;
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, [isOpen, phase]);

  const capture = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth || !video.videoHeight) return;

    const width = video.videoWidth;
    const height = video.videoHeight;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      setPhase('unavailable');
      setErrorMessage('This browser cannot capture a photo.');
      return;
    }

    // Mirror the front camera so the saved photo matches what the trainee saw.
    // The stamp is drawn later, on an unmirrored canvas, so the text is not
    // reversed.
    if (facing === 'user') {
      ctx.translate(width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, width, height);

    canvas.toBlob((blob) => {
      if (!blob) {
        setPhase('unavailable');
        setErrorMessage('The photo could not be captured. Try again.');
        return;
      }
      if (shotUrlRef.current) URL.revokeObjectURL(shotUrlRef.current);
      const url = URL.createObjectURL(blob);
      shotUrlRef.current = url;
      setShot({ blob, url });
      setCapturedAt(new Date());
      setPhase('review');
      stopStream();
    }, 'image/jpeg', 0.9);
  };

  const retake = () => {
    releaseShot();
    startStream(facing);
  };

  const switchCamera = () => {
    const next = facing === 'user' ? 'environment' : 'user';
    setFacing(next);
    startStream(next);
  };

  const previewStamp = buildStampLines({
    ...stampBase,
    action,
    at: phase === 'review' ? capturedAt : now
  });

  const title = isClockOut ? 'Clock-out photo' : 'Clock-in photo';

  return (
    <Modal isOpen={isOpen} onClose={onCancel} title={title} size="lg">
      <div className="tc-body">
        <p className="tc-lead">
          {isClockOut
            ? 'Take a photo to close your shift. It is stamped with the server time and the office it matched.'
            : 'Take a photo to start your shift. Your timer still begins only after an administrator accepts the request.'}
        </p>

        <div className="tc-stage">
          {phase === 'review' && shot ? (
            <img
              className={`tc-media${facing === 'user' ? ' is-mirrored' : ''}`}
              src={shot.url}
              alt="Captured frame, ready to submit"
            />
          ) : (
            <video
              ref={videoRef}
              className={`tc-media${facing === 'user' ? ' is-mirrored' : ''}`}
              autoPlay
              playsInline
              muted
            />
          )}

          {phase === 'starting' && <div className="tc-status">Starting the camera...</div>}

          {phase === 'unavailable' && (
            <div className="tc-status tc-status-error">
              <strong>Camera unavailable</strong>
              <span>{errorMessage}</span>
            </div>
          )}

          {phase !== 'unavailable' && (
            <div className="tc-stamp" aria-hidden="true">
              <span className="tc-stamp-brand">{previewStamp.brand}</span>
              <span className="tc-stamp-action">{previewStamp.action}</span>
              {previewStamp.timestamp && <span className="tc-stamp-time">{previewStamp.timestamp}</span>}
              {previewStamp.lines.map((line, index) => (
                <span className="tc-stamp-line" key={`${index}-${line}`}>{line}</span>
              ))}
            </div>
          )}
        </div>

        {phase === 'review' ? (
          <p className="tc-hint">
            The time and location on the saved photo are filled in by the server when you submit, so they cannot be
            changed from this device.
          </p>
        ) : (
          <p className="tc-hint">
            {isClockOut
              ? 'Your timer freezes as soon as this is accepted by the server.'
              : 'Stay inside the office fence until the request is accepted.'}
          </p>
        )}

        <div className="tc-actions">
          {phase === 'unavailable' ? (
            <>
              {onSkip && (
                <Button variant="primary" onClick={onSkip} disabled={submitting}>
                  {submitting ? 'Submitting...' : 'Continue without a photo'}
                </Button>
              )}
              <Button variant="ghost" onClick={() => startStream(facing)} disabled={submitting}>
                Try camera again
              </Button>
              <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
            </>
          ) : phase === 'review' ? (
            <>
              <Button onClick={() => onSubmit(shot?.blob)} disabled={submitting || !shot}>
                {submitting ? 'Submitting...' : isClockOut ? 'Submit clock-out' : 'Submit clock-in'}
              </Button>
              <Button variant="ghost" onClick={retake} disabled={submitting}>Retake</Button>
              <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
            </>
          ) : (
            <>
              <Button onClick={capture} disabled={submitting || phase !== 'live'}>Capture</Button>
              <Button variant="ghost" onClick={switchCamera} disabled={submitting || phase !== 'live'}>
                Switch camera
              </Button>
              <Button variant="ghost" onClick={onCancel} disabled={submitting}>Cancel</Button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

export default TimestampCamera;
