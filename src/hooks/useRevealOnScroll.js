import { useEffect } from 'react';

/**
 * Page-wide scroll reveal.
 *
 * Any descendant marked `data-reveal` fades and rises into place the first time
 * it enters the viewport, with a small stagger between siblings so a grid
 * resolves in sequence rather than all at once.
 *
 * Three safety properties, all deliberate:
 *
 * 1. The hook adds `has-reveal` to the root itself, and the CSS only hides
 *    `[data-reveal]` elements UNDER `.has-reveal`. If JavaScript never runs the
 *    content is simply visible — it can never be left stuck at opacity 0.
 *
 * 2. Under `prefers-reduced-motion: reduce` (or without IntersectionObserver)
 *    `has-reveal` is never added at all. Nothing is hidden without it, so this
 *    is the most robust "show everything" path there is — and unlike a one-off
 *    pass over the DOM it also covers content that mounts later.
 *
 * 3. The revealed state is recorded as the `data-reveal-in` ATTRIBUTE rather
 *    than a class. Several reveal targets (.journey-step, for one) have a
 *    `className` that React rewrites during re-render, which silently wipes any
 *    imperatively added class and drops the element back to opacity 0. React
 *    never manages `data-reveal-in`, so it survives.
 */
export function useRevealOnScroll(rootRef) {
  useEffect(() => {
    const root = rootRef && rootRef.current;
    if (!root) return undefined;

    const reduceMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // See note 2 — never hide anything in this branch.
    if (reduceMotion || typeof IntersectionObserver === 'undefined') {
      return undefined;
    }

    // Only start hiding once we know the observer is live.
    root.classList.add('has-reveal');

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const el = entry.target;
          const siblings = el.parentElement
            ? Array.from(el.parentElement.querySelectorAll('[data-reveal]'))
            : [el];
          const order = Math.max(0, siblings.indexOf(el));

          el.style.transitionDelay = `${Math.min(order, 8) * 55}ms`;
          el.setAttribute('data-reveal-in', '');
          observer.unobserve(el);
        });
      },
      { threshold: 0.14, rootMargin: '0px 0px -40px 0px' }
    );

    // `seen` keeps the observer from being handed the same node twice, which
    // matters now that the scan can run more than once.
    const seen = new WeakSet();
    const scan = () => {
      root.querySelectorAll('[data-reveal]').forEach((el) => {
        if (seen.has(el)) return;
        seen.add(el);
        observer.observe(el);
      });
    };

    scan();

    // "Featured OJT Postings" and "Featured Trainee Programs & Events" only
    // render once their Supabase data arrives — long after this effect runs.
    // Without a re-scan they would never be observed, and because `has-reveal`
    // is already on the root the CSS would hold them at opacity 0 forever.
    const mutations = new MutationObserver(scan);
    mutations.observe(root, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      mutations.disconnect();
    };
  }, [rootRef]);
}

export default useRevealOnScroll;
