import { useCallback, useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { PartnerModal } from './PartnerModal';

const PARTNER = {
  key: 'brains',
  name: 'Brains',
  tagline: 'Progressive technology for a better world',
  about: 'Brains Infinite Innovations Inc. is a Filipino technology company.',
  products: ['Connector ERP system', 'ASAP! all-services app'],
  services: ['Software & mobile app development', 'IoT & smart-building systems'],
  industry: 'Software & IT Services'
};

// Mirrors how the About page uses the dialog: a tile button sets the active
// partner and the modal reads it back.  `partner` is overridable so a test can
// hand in a partner with no logo, or with an empty product list.
function Harness({ partner: opened = PARTNER }) {
  const [partner, setPartner] = useState(null);
  const close = useCallback(() => setPartner(null), []);
  return (
    <>
      <button type="button" onClick={() => setPartner(opened)}>Open Brains</button>
      <PartnerModal partner={partner} onClose={close} />
    </>
  );
}

// The brand mark carries alt="" on purpose — the company name is rendered
// beside it, so announcing the logo too would just repeat the name.  That
// leaves it with no accessible role to query, so a direct lookup is the only
// way to reach it.
/* eslint-disable testing-library/no-node-access */
const logoIn = (scope) => scope.querySelector('img.partner-logo');
/* eslint-enable testing-library/no-node-access */

const openPartner = () => {
  const trigger = screen.getByRole('button', { name: 'Open Brains' });
  trigger.focus();
  fireEvent.click(trigger);
  return trigger;
};

describe('PartnerModal', () => {
  test('is not rendered until a partner is opened', () => {
    render(<Harness />);
    expect(screen.queryByRole('heading', { name: 'Brains' })).toBeNull();
  });

  test('opens on click and shows the partner detail', () => {
    render(<Harness />);
    openPartner();

    expect(screen.getByRole('heading', { name: 'Brains' })).toBeInTheDocument();
    expect(screen.getByText(PARTNER.tagline)).toBeInTheDocument();
    expect(screen.getByText(PARTNER.industry)).toBeInTheDocument();
    expect(screen.getByText(PARTNER.about)).toBeInTheDocument();
    PARTNER.products.forEach((item) => expect(screen.getByText(item)).toBeInTheDocument());
    PARTNER.services.forEach((item) => expect(screen.getByText(item)).toBeInTheDocument());
    expect(screen.getByRole('heading', { name: 'Products' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument();
  });

  test('closes on Escape', () => {
    render(<Harness />);
    openPartner();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('heading', { name: 'Brains' })).toBeNull();
  });

  test('closes on a backdrop click', () => {
    render(<Harness />);
    openPartner();

    // The backdrop carries no ARIA role, so there is no Testing Library query
    // for it; a direct lookup is the only way to exercise the overlay handler.
    // eslint-disable-next-line testing-library/no-node-access
    fireEvent.click(document.querySelector('.modal-overlay'));

    expect(screen.queryByRole('heading', { name: 'Brains' })).toBeNull();
  });

  test('moves focus into the dialog when it opens', () => {
    render(<Harness />);
    openPartner();

    // Queried by its accessible name, not the glyph: the close control now
    // carries aria-label="Close dialog" because "×" is announced as
    // "multiplication sign" by screen readers.
    expect(screen.getByRole('button', { name: 'Close dialog' })).toHaveFocus();
  });

  test('returns focus to the trigger when it closes', () => {
    render(<Harness />);
    const trigger = openPartner();

    fireEvent.keyDown(document, { key: 'Escape' });

    expect(trigger).toHaveFocus();
  });

  test('renders the partner logo when the partner provides one', () => {
    render(<Harness partner={{ ...PARTNER, logo: 'brains.png' }} />);
    openPartner();

    expect(logoIn(document.body)).toHaveAttribute('src', 'brains.png');
  });

  test('falls back to the initials when the logo fails to load', () => {
    render(<Harness partner={{ ...PARTNER, logo: 'missing.png' }} />);
    openPartner();

    const logo = logoIn(document.body);
    expect(logo).not.toBeNull();

    fireEvent.error(logo);

    // partnerMonogram('Brains') -> 'BR'
    expect(screen.getByText('BR')).toBeInTheDocument();
  });

  test('hides the Products panel when the partner has no products', () => {
    render(<Harness partner={{ ...PARTNER, products: [] }} />);
    openPartner();

    expect(screen.queryByRole('heading', { name: 'Products' })).toBeNull();
    expect(screen.getByRole('heading', { name: 'Services' })).toBeInTheDocument();
  });

  test('carries the brand accent through to the dialog element', () => {
    render(<Harness partner={{ ...PARTNER, accent: '#FA05D8', accentDeep: '#D204B5' }} />);
    openPartner();

    // eslint-disable-next-line testing-library/no-node-access
    const dialog = document.querySelector('.modal');
    expect(dialog.style.getPropertyValue('--accent')).toBe('#FA05D8');
    expect(dialog.style.getPropertyValue('--accent-deep')).toBe('#D204B5');
  });
});
