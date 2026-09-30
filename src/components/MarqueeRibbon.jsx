import './MarqueeRibbon.css';

/**
 * Diagonal scrolling ribbon used as a breather between sections.
 *
 * The track renders its items twice and travels exactly -50%, which is what
 * makes the loop seamless: at -50% the second copy sits precisely where the
 * first one started.
 *
 * Purely decorative, so it is hidden from assistive tech — the same wording
 * already exists in real headings elsewhere on the page.
 */
export function MarqueeRibbon({
  items = [],
  tone = 'ink',
  reverse = false,
  speed = 34,
}) {
  const doubled = [...items, ...items];

  return (
    <div className="ribbon-zone" aria-hidden="true">
      <div
        className={[
          'ribbon',
          `ribbon-${tone}`,
          reverse ? 'ribbon-reverse' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        <div
          className="ribbon-track"
          style={{ animationDuration: `${speed}s` }}
        >
          {doubled.map((item, index) => (
            <span key={`${item}-${index}`}>
              <i />
              {item}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export default MarqueeRibbon;
