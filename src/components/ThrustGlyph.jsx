/**
 * Line glyphs for the 8 HYT Thrusts.
 *
 * The Home page previously rendered each thrust as a 42px emoji inside a
 * coloured circle. Emoji carry no institutional weight and render differently
 * on every OS, so they were replaced with 24×24 stroke glyphs that inherit
 * `currentColor` and scale cleanly.
 *
 * Keyed by thrust name to match HYT_THRUSTS in src/data/hytThrusts.js. The
 * `icon` emoji field is deliberately left in place — the About page and any
 * other consumer keep working unchanged.
 */
const GLYPHS = {
  Education: (
    <>
      <path d="M3 6.5c3-1.5 6-1.5 9 0 3-1.5 6-1.5 9 0v11c-3-1.5-6-1.5-9 0-3-1.5-6-1.5-9 0z" />
      <path d="M12 6.5v11" />
    </>
  ),
  Enhancement: <path d="M13 3 5.5 13H11l-1 8 7.5-10H12z" />,
  Experience: (
    <>
      <rect x="3.5" y="7.5" width="17" height="12" rx="2" />
      <path d="M9 7.5V6a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v1.5" />
      <path d="M3.5 12.5h17" />
    </>
  ),
  Entrepreneurship: (
    <>
      <path d="M12 3a6 6 0 0 0-3.5 10.9V18h7v-4.1A6 6 0 0 0 12 3z" />
      <path d="M9.5 18.5h5" />
      <path d="M10.5 21h3" />
    </>
  ),
  Endurance: (
    <>
      <path d="M12 3l7.5 3v6c0 4.2-3.1 7.4-7.5 9-4.4-1.6-7.5-4.8-7.5-9V6z" />
      <path d="M9 12l2.2 2.2L15.5 10" />
    </>
  ),
  Exploration: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m15.5 8.5-2 5-5 2 2-5z" />
    </>
  ),
  Empowerment: (
    <path d="M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
  ),
  Enlightenment: (
    <>
      <path d="M12 3v5" />
      <path d="M12 16v5" />
      <path d="M3 12h5" />
      <path d="M16 12h5" />
      <path d="m6.2 6.2 3.2 3.2" />
      <path d="m14.6 14.6 3.2 3.2" />
      <path d="m17.8 6.2-3.2 3.2" />
      <path d="m9.4 14.6-3.2 3.2" />
    </>
  ),
};

export function ThrustGlyph({ name, size = 24, strokeWidth = 1.6, className }) {
  const paths = GLYPHS[name];

  // Unknown name renders nothing rather than throwing, so a future thrust added
  // to the data file can never break the page.
  if (!paths) return null;

  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths}
    </svg>
  );
}

export default ThrustGlyph;
