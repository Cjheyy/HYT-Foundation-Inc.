import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * Scrolls to the top on a route change — but when the URL carries a hash
 * (e.g. Home's thrust tiles linking to /about#thrusts) it scrolls to that
 * element instead, so a deep link lands on the right section.
 *
 * `scroll-margin-top` on the target handles the fixed header offset.
 */
export function ScrollToTop() {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return undefined;
    }

    const id = decodeURIComponent(hash.slice(1));
    let retry = null;

    // Wait a frame so the destination route has committed its DOM, then fall
    // back to a short retry in case late layout (fonts, images) moved things.
    const frame = window.requestAnimationFrame(() => {
      const target = document.getElementById(id);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      retry = window.setTimeout(() => {
        const late = document.getElementById(id);
        if (late) late.scrollIntoView({ behavior: 'smooth', block: 'start' });
        else window.scrollTo(0, 0);
      }, 160);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (retry) window.clearTimeout(retry);
    };
  }, [pathname, hash]);

  return null;
}
