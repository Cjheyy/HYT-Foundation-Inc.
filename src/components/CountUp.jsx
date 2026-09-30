import { useEffect, useRef, useState } from 'react';

/**
 * A number that counts up to `value` the first time it scrolls into view.
 *
 * Three deliberate details:
 *
 * 1. `display` starts at the REAL value, not 0. If JavaScript never runs, or
 *    IntersectionObserver is unavailable, the figure is simply correct — the
 *    animation is an enhancement, never a prerequisite.
 *
 * 2. The observer uses a POSITIVE bottom rootMargin, so it fires while the
 *    element is still ~320px below the fold. Without that, the counter would
 *    visibly snap from the real value down to 0 the instant it became visible.
 *
 * 3. `prefers-reduced-motion: reduce` skips the animation and shows the value.
 *
 * The animation is keyed off `started`, NOT off `display === 0`: if the effect
 * depended on `display`, every animation frame would re-run the effect and its
 * cleanup would cancel the very rAF that just fired.
 */
export function CountUp({
  value,
  suffix = '',
  duration = 1400,
  className,
}) {
  const ref = useRef(null);
  const [display, setDisplay] = useState(value);
  const [started, setStarted] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;

    // No observer support: keep the static value and never animate.
    if (typeof IntersectionObserver === 'undefined') return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          observer.unobserve(entry.target);
          setStarted(true);
        });
      },
      // Fire early — see note 2 above.
      { rootMargin: '0px 0px 320px 0px', threshold: 0 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!started) return undefined;

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (reduceMotion) {
      setDisplay(value);
      return undefined;
    }

    let raf = 0;
    const start = performance.now();

    const tick = (now) => {
      const progress = Math.min(1, (now - start) / duration);
      // Ease-out cubic — matches the page's --e-out feel.
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [started, value, duration]);

  return (
    <span ref={ref} className={className}>
      {display}
      {suffix ? <em>{suffix}</em> : null}
    </span>
  );
}

export default CountUp;
