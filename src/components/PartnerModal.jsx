import { useEffect, useRef } from 'react';
import { Modal } from './Modal';
import { PartnerLogo } from './PartnerLogo';
import { partnerAccentVars } from '../data/partnerOrganizations';

const FOCUSABLE =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

/**
 * One "Products" / "Services" column.
 *
 * Rendered only when the list actually has entries: a holding group such as the
 * Klassic Group of Companies has services but no products, and the homegrown
 * brands have one and not the other.  An empty column would otherwise leave a
 * blank panel next to a populated one.
 */
function DetailSection({ id, heading, items }) {
  if (!items || items.length === 0) return null;
  return (
    <section className="partner-detail-section" aria-labelledby={id}>
      <h4 className="partner-detail-heading" id={id}>{heading}</h4>
      <ul className="partner-detail-list">
        {items.map((item) => (
          <li key={item} className="partner-detail-item">{item}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Partner detail dialog.
 *
 * Wraps the shared <Modal> (which owns the backdrop-click close and the
 * body-scroll lock) and adds the keyboard behaviour a dialog needs: focus
 * moves into the dialog when it opens, Tab is trapped inside it, Escape
 * closes it, and focus returns to the tile that opened it when it closes.
 *
 * The visual classes are the `partner-` ones declared in About.css — every
 * partner style is prefixed so nothing leaks into CRA's single global bundle.
 * The brand accent reaches the dialog as CSS custom properties via <Modal>'s
 * `style` prop, which is what tints the header band per partner.
 */
export function PartnerModal({ partner, onClose }) {
  const isOpen = Boolean(partner);
  const returnFocusRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    returnFocusRef.current = document.activeElement;
    const dialog = document.querySelector('.modal');
    const focusables = () =>
      dialog ? Array.from(dialog.querySelectorAll(FOCUSABLE)) : [];

    const firstFocusable = focusables()[0];
    if (firstFocusable) firstFocusable.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;

      const items = focusables();
      if (items.length === 0) return;
      const firstItem = items[0];
      const lastItem = items[items.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      const previous = returnFocusRef.current;
      if (previous && typeof previous.focus === 'function') previous.focus();
    };
  }, [isOpen, onClose]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={partner ? partner.name : ''}
      size="lg"
      className="partner-modal"
      style={partner ? partnerAccentVars(partner.accent, partner.accentDeep) : undefined}
    >
      {partner && (
        <div className="partner-detail">
          <div className="partner-detail-head">
            <PartnerLogo partner={partner} eager />
            <div className="partner-detail-meta">
              <p className="partner-detail-tagline">{partner.tagline}</p>
              <p className="partner-detail-industry">{partner.industry}</p>
            </div>
          </div>

          <p className="partner-detail-about">{partner.about}</p>

          <div className="partner-detail-columns">
            <DetailSection
              id="partner-products-heading"
              heading="Products"
              items={partner.products}
            />
            <DetailSection
              id="partner-services-heading"
              heading="Services"
              items={partner.services}
            />
          </div>
        </div>
      )}
    </Modal>
  );
}
