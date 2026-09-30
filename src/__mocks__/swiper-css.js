/**
 * Test double for swiper's stylesheet subpaths (`swiper/css`,
 * `swiper/css/effect-coverflow`, `swiper/css/pagination`).
 *
 * Those specifiers resolve through swiper's `exports` map, which Jest 27 cannot
 * read, and there is no `node_modules/swiper/css/` directory to fall back on.
 * `package.json` maps `swiper/css*` here via `moduleNameMapper`.
 *
 * Stylesheets have no effect in jsdom, so an empty module is all that is needed.
 */
module.exports = {};
