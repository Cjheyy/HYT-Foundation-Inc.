/**
 * Test double for `swiper/react`.
 *
 * Jest 27 (the version react-scripts 5 bundles) predates package `exports`
 * support, so `require('swiper/react')` never resolves: swiper v14 maps that
 * specifier to `./swiper-react.mjs` at the package root, but the legacy
 * resolver looks for `node_modules/swiper/react/index.js` — and that folder
 * holds nothing but `.d.ts` type stubs.
 *
 * `package.json` therefore maps `swiper/react` here via `moduleNameMapper`.
 *
 * The stub renders plain divs and drops every Swiper prop. That is deliberate:
 * the carousel measures real layout through ResizeObserver (which jsdom does
 * not implement), and none of the Home tests exercise the slider itself — they
 * cover section order, the thrust rail and the bento.
 */
export function Swiper({ children, className }) {
  return <div className={className}>{children}</div>;
}

export function SwiperSlide({ children }) {
  return <div className="swiper-slide">{children}</div>;
}
