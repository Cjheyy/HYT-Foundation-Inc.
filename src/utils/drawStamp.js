/**
 * Burn a stamp into a photo.
 *
 * The layout is deliberately bottom-anchored: a selfie puts the face in the
 * middle of the frame, so the bottom band is the one place a stamp can sit
 * without covering it. A gradient (rather than a solid box) keeps the photo
 * visible underneath while still giving white text something to sit on.
 *
 * Everything is sized from `canvas.width`, so the same code produces a
 * readable stamp on a 640 px webcam grab and on a 3000 px phone photo. Sizes
 * are never smaller than a floor, because a 400 px thumbnail would otherwise
 * come out with 4 px text.
 *
 * This file is intentionally dumb: it draws what `stampLines.js` gives it and
 * derives nothing. The decision of *what* the stamp says lives there, where it
 * can be tested; jsdom has no canvas implementation, so nothing here can be
 * asserted in a unit test.
 */

import { STAMP_ACCENT } from './stampLines';

const FONT_STACK = '"Inter", "Segoe UI", Arial, Helvetica, sans-serif';

const MIN_SIZES = {
  brand: 10,
  action: 18,
  time: 14,
  detail: 11
};

/**
 * Draw the stamp onto a canvas that already holds the photo.
 *
 * Returns `true` when something was drawn. Returns `false` - rather than
 * throwing - for a canvas without a 2D context, because a photo without a
 * stamp is still worth uploading.
 */
export function drawStamp(canvas, stamp) {
  if (!canvas || !stamp || typeof canvas.getContext !== 'function') return false;

  const width = Number(canvas.width);
  const height = Number(canvas.height);
  if (!width || !height) return false;

  const ctx = canvas.getContext('2d');
  if (!ctx) return false;

  // One "unit" is 1/1000 of the width: a 1000 px photo gets exactly the sizes
  // written below, and everything scales from there.
  const unit = width / 1000;

  const padding = Math.max(10, Math.round(26 * unit));
  const accentWidth = Math.max(3, Math.round(6 * unit));
  const textGap = Math.max(8, Math.round(16 * unit));
  const lineGap = Math.max(3, Math.round(8 * unit));

  const rows = [];
  if (stamp.brand) {
    rows.push({
      text: stamp.brand,
      size: Math.max(MIN_SIZES.brand, Math.round(19 * unit)),
      weight: 600,
      color: 'rgba(255, 255, 255, 0.82)'
    });
  }
  if (stamp.action) {
    rows.push({
      text: stamp.action,
      size: Math.max(MIN_SIZES.action, Math.round(46 * unit)),
      weight: 800,
      color: STAMP_ACCENT
    });
  }
  if (stamp.timestamp) {
    rows.push({
      text: stamp.timestamp,
      size: Math.max(MIN_SIZES.time, Math.round(31 * unit)),
      weight: 700,
      color: '#FFFFFF'
    });
  }
  (Array.isArray(stamp.lines) ? stamp.lines : []).forEach((line) => {
    const text = String(line || '').trim();
    if (!text) return;
    rows.push({
      text,
      size: Math.max(MIN_SIZES.detail, Math.round(23 * unit)),
      weight: 500,
      color: 'rgba(255, 255, 255, 0.92)'
    });
  });

  if (!rows.length) return false;

  const blockHeight = rows.reduce((total, row) => total + row.size + lineGap, 0);
  const bandTop = Math.max(0, height - blockHeight - padding * 2);

  ctx.save();

  // A gradient, not a solid block: the photo stays visible, but the bottom
  // third is dark enough for white text to clear 4.5:1.
  const gradient = ctx.createLinearGradient(0, bandTop - padding, 0, height);
  gradient.addColorStop(0, 'rgba(0, 0, 0, 0)');
  gradient.addColorStop(0.45, 'rgba(0, 0, 0, 0.45)');
  gradient.addColorStop(1, 'rgba(0, 0, 0, 0.86)');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, Math.max(0, bandTop - padding), width, height - Math.max(0, bandTop - padding));

  // Accent rule down the left edge, so the stamp reads as HYT's even when the
  // photo behind it is bright.
  ctx.fillStyle = STAMP_ACCENT;
  ctx.fillRect(padding, bandTop, accentWidth, Math.max(0, blockHeight - lineGap));

  const textX = padding + accentWidth + textGap;
  const maxWidth = Math.max(40, width - textX - padding);

  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.65)';
  ctx.shadowBlur = Math.max(2, Math.round(5 * unit));
  ctx.shadowOffsetY = Math.max(1, Math.round(1 * unit));

  let y = bandTop;
  rows.forEach((row) => {
    ctx.font = `${row.weight} ${row.size}px ${FONT_STACK}`;
    ctx.fillStyle = row.color;
    // `maxWidth` condenses an over-long line instead of letting it run off the
    // edge of the photo.
    ctx.fillText(row.text, textX, y, maxWidth);
    y += row.size + lineGap;
  });

  ctx.restore();
  return true;
}

/**
 * Encode a canvas as a JPEG blob.
 *
 * Wrapped in a Promise because `toBlob` is callback-based, and rejects instead
 * of resolving `null` so a caller cannot accidentally upload nothing.
 */
export function canvasToJpegBlob(canvas, quality = 0.86) {
  return new Promise((resolve, reject) => {
    if (!canvas || typeof canvas.toBlob !== 'function') {
      reject(new Error('This browser cannot export the photo.'));
      return;
    }
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('This browser cannot export the photo.'));
    }, 'image/jpeg', quality);
  });
}
