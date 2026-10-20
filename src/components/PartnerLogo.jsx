import { useState } from 'react';
import { partnerMonogram } from '../data/partnerOrganizations';

/**
 * A partner's brand mark.
 *
 * If the logo file ever fails to load this degrades to the company's initials
 * rather than leaving an empty plate - which is why `partnerMonogram` is still
 * exported by the data module even though the tiles now show real logos.
 *
 * `alt` is empty on purpose: the company name is always rendered alongside the
 * mark, so announcing the logo too would just repeat the name to a screen
 * reader.
 *
 * `eager` is for the dialog, where the mark is the focal point and a lazy load
 * would flash an empty plate on open.
 */
export function PartnerLogo({ partner, className = '', eager = false }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <span className={`partner-monogram ${className}`.trim()} aria-hidden="true">
        {partnerMonogram(partner.name)}
      </span>
    );
  }

  return (
    <img
      className={`partner-logo ${className}`.trim()}
      src={partner.logo}
      alt=""
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
