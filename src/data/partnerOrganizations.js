/**
 * HYT Foundation Inc. partner organizations.
 *
 * Used in two places:
 *  - the "Organization" select when an admin creates an OJT posting
 *    (`src/pages/admin/Opportunities.js`)
 *  - the "Our Partner Organizations" section on the About page
 *
 * Keeping one source means an admin can never hand-type a partner name that
 * does not exist, and the public list stays in step with what can be posted.
 */
export const PARTNER_ORGANIZATIONS = [
  'Brains',
  'Connector',
  'Klassic Solutions Inc.',
  'Klassic Marketing Inc.',
  'WestWood Development Corp.',
  'WestWood Law Firm',
  'The Green Oasis',
  'Luxurious Cleaning Co.',
  'The fitness Fit',
  'HYT Foundation Inc.'
];

/**
 * Short label for the monogram tile on the About page.  Built from the
 * significant words so "Klassic Solutions Inc." renders as "KS" rather than
 * "K" or "KSI".
 */
export const partnerMonogram = (name) => {
  const ignored = new Set(['inc', 'inc.', 'corp', 'corp.', 'co', 'co.', 'the', 'and']);
  const words = String(name || '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter((word) => word && !ignored.has(word.toLowerCase()));
  if (words.length === 0) return 'HY';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
};
