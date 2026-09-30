import { useCallback } from 'react';

/**
 * Magnetic hover: the element leans toward the cursor and springs back on
 * leave. Pointer-only by construction — `mousemove` never fires on touch, so
 * no device sniffing is needed.
 *
 * Returns handlers to spread onto the element. The transform is written
 * directly to `event.currentTarget`, so no ref is required and the hook works
 * with any component that forwards `onMouseMove` / `onMouseLeave`
 * (our `Button` spreads `...props` onto the <button>).
 */
function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

export function useMagnetic({ strength = 0.26, verticalBoost = 1.4 } = {}) {
  const onMouseMove = useCallback(
    (event) => {
      if (prefersReducedMotion()) return;
      const el = event.currentTarget;
      const rect = el.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const dx = event.clientX - rect.left - rect.width / 2;
      const dy = event.clientY - rect.top - rect.height / 2;
      el.style.transform = `translate(${(dx * strength).toFixed(2)}px, ${(
        dy *
        strength *
        verticalBoost
      ).toFixed(2)}px)`;
    },
    [strength, verticalBoost]
  );

  const onMouseLeave = useCallback((event) => {
    event.currentTarget.style.transform = '';
  }, []);

  return { onMouseMove, onMouseLeave };
}

export default useMagnetic;
