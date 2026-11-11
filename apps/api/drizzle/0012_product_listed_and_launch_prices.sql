ALTER TABLE "products" ADD COLUMN "listed" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
-- Taken off the storefront in Nov 2026 while the new range launches. Fresh
-- databases get the same flag from the seed, which creates these products.
UPDATE "products" SET "listed" = false
WHERE "slug" IN ('first-flush-whole-leaf', 'first-flush-broken-leaf', 'first-flush-broken-mixed', 'first-flush-fannings');
--> statement-breakpoint
-- From this release the seed no longer overwrites prices (the admin owns them),
-- so the Nov 2026 launch prices (25% off) are applied here, once, to packs that
-- already exist. Zero-price coming-soon placeholders are skipped: the seed
-- gives those their first price and opening stock. Paise.
UPDATE "product_variants" AS pv
SET "price" = v.price, "compare_at_price" = v.compare_at_price
FROM "products" AS p,
  (VALUES
    ('first-flush', 86100, 114800),
    ('golden-needle', 315700, 420900),
    ('green-tea', 58500, 78100),
    ('pan-roasted', 60800, 81100),
    ('silver-needle', 315700, 420900),
    ('white-tea', 132000, 176000),
    ('whole-leaf-first-flush', 177900, 237200),
    ('second-flush', 74600, 99500),
    ('autumn-flush', 63100, 84200)
  ) AS v(slug, price, compare_at_price)
WHERE pv."product_id" = p."id"
  AND p."slug" = v.slug
  AND pv."size" = '100 g'
  AND pv."price" > 0;
