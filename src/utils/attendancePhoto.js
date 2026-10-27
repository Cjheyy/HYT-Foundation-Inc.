/**
 * Turn a captured frame into the photo that gets stored.
 *
 * The camera gives us a raw JPEG. By the time we have one, the clock-in
 * request has already been accepted by the database and we know the server's
 * timestamp, the office it matched, and how far away the fix was - so the
 * stamp can carry facts instead of guesses. That ordering is the whole point:
 * if the stamp were drawn at capture time it would show the device clock, and
 * the device clock is the one thing a trainee can change.
 */

import { canvasToJpegBlob, drawStamp } from './drawStamp';

/**
 * Decode a Blob into something `drawImage` accepts.
 *
 * `createImageBitmap` is the fast path and is available everywhere this app
 * runs, but it is not guaranteed (older Safari, some WebViews), so the object
 * URL route stays as a fallback rather than leaving those users with no photo.
 */
async function decodeImage(blob) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(blob);
    } catch (error) {
      /* fall through to the <img> path */
    }
  }

  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('The captured photo could not be read.'));
    };
    image.src = url;
  });
}

/**
 * Draw `stamp` over `blob` and return a new JPEG.
 *
 * Rejects only when the photo genuinely cannot be produced. The caller treats
 * that as "no photo" rather than as a failed clock-in - attendance is already
 * recorded by this point, and losing the photo is the lesser problem.
 */
export async function stampPhotoBlob(blob, stamp) {
  if (!blob) throw new Error('No photo was captured.');

  const source = await decodeImage(blob);
  const width = source.width || source.naturalWidth || 0;
  const height = source.height || source.naturalHeight || 0;
  if (!width || !height) throw new Error('The captured photo has no size.');

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot draw on a canvas.');

  ctx.drawImage(source, 0, 0, width, height);
  drawStamp(canvas, stamp);

  if (typeof source.close === 'function') source.close();

  return canvasToJpegBlob(canvas);
}
