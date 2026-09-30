import { useCallback } from 'react';

/**
 * 3D tilt: rotates the element toward the cursor and exposes the pointer
 * position as `--tx` / `--ty` so CSS can paint a spotlight and a gradient
 * border ring that track the cursor.
 *
 * Requires the parent to establish perspective (`perspective: 900px`), so every
 * card shares one vanishing point instead of each card inventing its own.
 *
 * CURRENTLY UNUSED. It drove the old `.thrusts-grid` cards, which were replaced
 * by the ribbon marquees in the Thrusts section — that grid, and the perspective
 * rule that went with it, no longer exist. Kept as a working hook in case the
 * tilt is wanted again; it is not wired up anywhere.
 *
 * Disabled for coarse pointers (touch) and for `prefers-reduced-motion`.
 */
const COARSE_POINTER =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(hover: none), (pointer: coarse)').matches;

const REDUCED_MOTION =
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useTilt({ max = 11, lift = 8 } = {}) {
  const onMouseMove = useCallback(
    (event) => {
      if (COARSE_POINTER || REDUCED_MOTION) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;

      const px = (event.clientX - rect.left) / rect.width;
      const py = (event.clientY - rect.top) / rect.height;

      el.style.setProperty('--tx', `${(px * 100).toFixed(1)}%`);
      el.style.setProperty('--ty', `${(py * 100).toFixed(1)}%`);
      el.style.transform =
        `rotateX(${((0.5 - py) * max).toFixed(2)}deg) ` +
        `rotateY(${((px - 0.5) * max * 1.15).toFixed(2)}deg) ` +
        `translateY(-${lift}px)`;
    },
    [max, lift]
  );

  const onMouseLeave = useCallback((event) => {
    // Leave `--tx` / `--ty` in place so the spotlight fades out from wherever
    // the cursor last was, instead of snapping back to the centre.
    event.currentTarget.style.transform = '';
  }, []);

  return { onMouseMove, onMouseLeave };
}

export default useTilt;
