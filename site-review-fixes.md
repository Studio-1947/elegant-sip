# Elegant SIP site review fixes

## Goal

Implement the nine storefront changes in `Site Review.md` while preserving the existing React/Vite architecture.

## Tasks

- [x] Audit product, cart, navigation, and hero components -> Verify all report items have an owning file.
- [x] Update catalogue variants and shared pricing to 100 g / 200 g / 500 g and 18% GST -> Verify API and storefront use the same totals.
- [x] Simplify product and shop surfaces, including visible buy/cart actions -> Verify responsive purchase flows remain usable.
- [x] Add cart and wishlist feedback with post-add cart navigation -> Verify all add/toggle paths announce their state.
- [x] Remove FAQ from navigation and rename Contact to Support -> Verify desktop and mobile navigation labels.
- [x] Make hero playback one-time per browser session and improve video loading/scroll quality -> Verify repeat home visits skip the intro.
- [x] Run lint, types, tests, build, and start both development servers -> Verify storefront and API respond locally.

## Done When

- [x] All nine Elegant SIP report items are implemented and validated.

## Verification

- `npm run typecheck`, `npm run build`, shared-money tests, and the checkout integration suite pass.
- Web dev server: `http://localhost:5173/`; API health: `http://127.0.0.1:4000/health`.
- The repository-wide lint command still reports two pre-existing errors in `AdminPage.tsx` and `OrderPage.tsx`, outside this change set.
