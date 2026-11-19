-- Copy change: customer-facing text no longer uses em dashes.
-- Products and gardens are owned by the admin dashboard once seeded, and the
-- product seed rewrites a whole product (prices and photos included) whenever
-- its definition changes, so the seed files keep their original wording and the
-- live rows are updated here instead. Only the exact original sentences are
-- replaced: anything staff have reworded is left as it is, and running this on
-- a database without these sentences changes nothing.
UPDATE "products" SET
  "description" = replace("description", 'The first pluck of spring, whole leaf — bright', 'The first pluck of spring, whole leaf: bright'),
  "long_description" = replace("long_description", 'The first pluck of spring, whole leaf — bright', 'The first pluck of spring, whole leaf: bright'),
  "brewing_guide" = replace("brewing_guide"::text, 'The first pluck of spring, whole leaf — bright', 'The first pluck of spring, whole leaf: bright')::jsonb
WHERE strpos("description", 'The first pluck of spring, whole leaf — bright') > 0 OR strpos(coalesce("long_description", ''), 'The first pluck of spring, whole leaf — bright') > 0 OR strpos("brewing_guide"::text, 'The first pluck of spring, whole leaf — bright') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Skip the milk — first flush is prized', 'Skip the milk. First flush is prized'),
  "long_description" = replace("long_description", 'Skip the milk — first flush is prized', 'Skip the milk. First flush is prized'),
  "brewing_guide" = replace("brewing_guide"::text, 'Skip the milk — first flush is prized', 'Skip the milk. First flush is prized')::jsonb
WHERE strpos("description", 'Skip the milk — first flush is prized') > 0 OR strpos(coalesce("long_description", ''), 'Skip the milk — first flush is prized') > 0 OR strpos("brewing_guide"::text, 'Skip the milk — first flush is prized') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Broken-leaf Darjeeling first flush — the same spring', 'Broken-leaf Darjeeling first flush: the same spring'),
  "long_description" = replace("long_description", 'Broken-leaf Darjeeling first flush — the same spring', 'Broken-leaf Darjeeling first flush: the same spring'),
  "brewing_guide" = replace("brewing_guide"::text, 'Broken-leaf Darjeeling first flush — the same spring', 'Broken-leaf Darjeeling first flush: the same spring')::jsonb
WHERE strpos("description", 'Broken-leaf Darjeeling first flush — the same spring') > 0 OR strpos(coalesce("long_description", ''), 'Broken-leaf Darjeeling first flush — the same spring') > 0 OR strpos("brewing_guide"::text, 'Broken-leaf Darjeeling first flush — the same spring') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'floral top end for body — the everyday Darjeeling', 'floral top end for body. It is the everyday Darjeeling'),
  "long_description" = replace("long_description", 'floral top end for body — the everyday Darjeeling', 'floral top end for body. It is the everyday Darjeeling'),
  "brewing_guide" = replace("brewing_guide"::text, 'floral top end for body — the everyday Darjeeling', 'floral top end for body. It is the everyday Darjeeling')::jsonb
WHERE strpos("description", 'floral top end for body — the everyday Darjeeling') > 0 OR strpos(coalesce("long_description", ''), 'floral top end for body — the everyday Darjeeling') > 0 OR strpos("brewing_guide"::text, 'floral top end for body — the everyday Darjeeling') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'than whole leaf — shorten the steep', 'than whole leaf, so shorten the steep'),
  "long_description" = replace("long_description", 'than whole leaf — shorten the steep', 'than whole leaf, so shorten the steep'),
  "brewing_guide" = replace("brewing_guide"::text, 'than whole leaf — shorten the steep', 'than whole leaf, so shorten the steep')::jsonb
WHERE strpos("description", 'than whole leaf — shorten the steep') > 0 OR strpos(coalesce("long_description", ''), 'than whole leaf — shorten the steep') > 0 OR strpos("brewing_guide"::text, 'than whole leaf — shorten the steep') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'spring harvest — strong, brisk, and happy', 'spring harvest: strong, brisk, and happy'),
  "long_description" = replace("long_description", 'spring harvest — strong, brisk, and happy', 'spring harvest: strong, brisk, and happy'),
  "brewing_guide" = replace("brewing_guide"::text, 'spring harvest — strong, brisk, and happy', 'spring harvest: strong, brisk, and happy')::jsonb
WHERE strpos("description", 'spring harvest — strong, brisk, and happy') > 0 OR strpos(coalesce("long_description", ''), 'spring harvest — strong, brisk, and happy') > 0 OR strpos("brewing_guide"::text, 'spring harvest — strong, brisk, and happy') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'you get at altitude — which is exactly', 'you get at altitude, which is exactly'),
  "long_description" = replace("long_description", 'you get at altitude — which is exactly', 'you get at altitude, which is exactly'),
  "brewing_guide" = replace("brewing_guide"::text, 'you get at altitude — which is exactly', 'you get at altitude, which is exactly')::jsonb
WHERE strpos("description", 'you get at altitude — which is exactly') > 0 OR strpos(coalesce("long_description", ''), 'you get at altitude — which is exactly') > 0 OR strpos("brewing_guide"::text, 'you get at altitude — which is exactly') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'bring out the malty depth — this grade', 'bring out the malty depth, and this grade'),
  "long_description" = replace("long_description", 'bring out the malty depth — this grade', 'bring out the malty depth, and this grade'),
  "brewing_guide" = replace("brewing_guide"::text, 'bring out the malty depth — this grade', 'bring out the malty depth, and this grade')::jsonb
WHERE strpos("description", 'bring out the malty depth — this grade') > 0 OR strpos(coalesce("long_description", ''), 'bring out the malty depth — this grade') > 0 OR strpos("brewing_guide"::text, 'bring out the malty depth — this grade') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'first flush fannings — fast-brewing', 'first flush fannings: fast-brewing'),
  "long_description" = replace("long_description", 'first flush fannings — fast-brewing', 'first flush fannings: fast-brewing'),
  "brewing_guide" = replace("brewing_guide"::text, 'first flush fannings — fast-brewing', 'first flush fannings: fast-brewing')::jsonb
WHERE strpos("description", 'first flush fannings — fast-brewing') > 0 OR strpos(coalesce("long_description", ''), 'first flush fannings — fast-brewing') > 0 OR strpos("brewing_guide"::text, 'first flush fannings — fast-brewing') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'does not pretend to be — it is the grade', 'does not pretend to be. It is the grade'),
  "long_description" = replace("long_description", 'does not pretend to be — it is the grade', 'does not pretend to be. It is the grade'),
  "brewing_guide" = replace("brewing_guide"::text, 'does not pretend to be — it is the grade', 'does not pretend to be. It is the grade')::jsonb
WHERE strpos("description", 'does not pretend to be — it is the grade') > 0 OR strpos(coalesce("long_description", ''), 'does not pretend to be — it is the grade') > 0 OR strpos("brewing_guide"::text, 'does not pretend to be — it is the grade') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Fannings brew fast and strong — watch the clock', 'Fannings brew fast and strong, so watch the clock'),
  "long_description" = replace("long_description", 'Fannings brew fast and strong — watch the clock', 'Fannings brew fast and strong, so watch the clock'),
  "brewing_guide" = replace("brewing_guide"::text, 'Fannings brew fast and strong — watch the clock', 'Fannings brew fast and strong, so watch the clock')::jsonb
WHERE strpos("description", 'Fannings brew fast and strong — watch the clock') > 0 OR strpos(coalesce("long_description", ''), 'Fannings brew fast and strong — watch the clock') > 0 OR strpos("brewing_guide"::text, 'Fannings brew fast and strong — watch the clock') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'The first pluck of spring — a bright, floral', 'The first pluck of spring: a bright, floral'),
  "long_description" = replace("long_description", 'The first pluck of spring — a bright, floral', 'The first pluck of spring: a bright, floral'),
  "brewing_guide" = replace("brewing_guide"::text, 'The first pluck of spring — a bright, floral', 'The first pluck of spring: a bright, floral')::jsonb
WHERE strpos("description", 'The first pluck of spring — a bright, floral') > 0 OR strpos(coalesce("long_description", ''), 'The first pluck of spring — a bright, floral') > 0 OR strpos("brewing_guide"::text, 'The first pluck of spring — a bright, floral') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Skip the milk — a slightly cooler pour', 'Skip the milk. A slightly cooler pour'),
  "long_description" = replace("long_description", 'Skip the milk — a slightly cooler pour', 'Skip the milk. A slightly cooler pour'),
  "brewing_guide" = replace("brewing_guide"::text, 'Skip the milk — a slightly cooler pour', 'Skip the milk. A slightly cooler pour')::jsonb
WHERE strpos("description", 'Skip the milk — a slightly cooler pour') > 0 OR strpos(coalesce("long_description", ''), 'Skip the milk — a slightly cooler pour') > 0 OR strpos("brewing_guide"::text, 'Skip the milk — a slightly cooler pour') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'honeyed cup — the richest tea', 'honeyed cup, the richest tea'),
  "long_description" = replace("long_description", 'honeyed cup — the richest tea', 'honeyed cup, the richest tea'),
  "brewing_guide" = replace("brewing_guide"::text, 'honeyed cup — the richest tea', 'honeyed cup, the richest tea')::jsonb
WHERE strpos("description", 'honeyed cup — the richest tea') > 0 OR strpos(coalesce("long_description", ''), 'honeyed cup — the richest tea') > 0 OR strpos("brewing_guide"::text, 'honeyed cup — the richest tea') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Unoxidised Darjeeling leaf — fresh, grassy', 'Unoxidised Darjeeling leaf: fresh, grassy'),
  "long_description" = replace("long_description", 'Unoxidised Darjeeling leaf — fresh, grassy', 'Unoxidised Darjeeling leaf: fresh, grassy'),
  "brewing_guide" = replace("brewing_guide"::text, 'Unoxidised Darjeeling leaf — fresh, grassy', 'Unoxidised Darjeeling leaf: fresh, grassy')::jsonb
WHERE strpos("description", 'Unoxidised Darjeeling leaf — fresh, grassy') > 0 OR strpos(coalesce("long_description", ''), 'Unoxidised Darjeeling leaf — fresh, grassy') > 0 OR strpos("brewing_guide"::text, 'Unoxidised Darjeeling leaf — fresh, grassy') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'for a few minutes first — too hot', 'for a few minutes first. Too hot'),
  "long_description" = replace("long_description", 'for a few minutes first — too hot', 'for a few minutes first. Too hot'),
  "brewing_guide" = replace("brewing_guide"::text, 'for a few minutes first — too hot', 'for a few minutes first. Too hot')::jsonb
WHERE strpos("description", 'for a few minutes first — too hot') > 0 OR strpos(coalesce("long_description", ''), 'for a few minutes first — too hot') > 0 OR strpos("brewing_guide"::text, 'for a few minutes first — too hot') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'withered and dried — the most delicate', 'withered and dried, the most delicate'),
  "long_description" = replace("long_description", 'withered and dried — the most delicate', 'withered and dried, the most delicate'),
  "brewing_guide" = replace("brewing_guide"::text, 'withered and dried — the most delicate', 'withered and dried, the most delicate')::jsonb
WHERE strpos("description", 'withered and dried — the most delicate') > 0 OR strpos(coalesce("long_description", ''), 'withered and dried — the most delicate') > 0 OR strpos("brewing_guide"::text, 'withered and dried — the most delicate') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Gently withered leaf and bud — soft, sweet', 'Gently withered leaf and bud: soft, sweet'),
  "long_description" = replace("long_description", 'Gently withered leaf and bud — soft, sweet', 'Gently withered leaf and bud: soft, sweet'),
  "brewing_guide" = replace("brewing_guide"::text, 'Gently withered leaf and bud — soft, sweet', 'Gently withered leaf and bud: soft, sweet')::jsonb
WHERE strpos("description", 'Gently withered leaf and bud — soft, sweet') > 0 OR strpos(coalesce("long_description", ''), 'Gently withered leaf and bud — soft, sweet') > 0 OR strpos("brewing_guide"::text, 'Gently withered leaf and bud — soft, sweet') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'picked by hand — the fullest expression', 'picked by hand, the fullest expression'),
  "long_description" = replace("long_description", 'picked by hand — the fullest expression', 'picked by hand, the fullest expression'),
  "brewing_guide" = replace("brewing_guide"::text, 'picked by hand — the fullest expression', 'picked by hand, the fullest expression')::jsonb
WHERE strpos("description", 'picked by hand — the fullest expression') > 0 OR strpos(coalesce("long_description", ''), 'picked by hand — the fullest expression') > 0 OR strpos("brewing_guide"::text, 'picked by hand — the fullest expression') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'Whole leaves are bulky — use a little more', 'Whole leaves are bulky, so use a little more'),
  "long_description" = replace("long_description", 'Whole leaves are bulky — use a little more', 'Whole leaves are bulky, so use a little more'),
  "brewing_guide" = replace("brewing_guide"::text, 'Whole leaves are bulky — use a little more', 'Whole leaves are bulky, so use a little more')::jsonb
WHERE strpos("description", 'Whole leaves are bulky — use a little more') > 0 OR strpos(coalesce("long_description", ''), 'Whole leaves are bulky — use a little more') > 0 OR strpos("brewing_guide"::text, 'Whole leaves are bulky — use a little more') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'The summer pluck — a deeper, fruitier', 'The summer pluck: a deeper, fruitier'),
  "long_description" = replace("long_description", 'The summer pluck — a deeper, fruitier', 'The summer pluck: a deeper, fruitier'),
  "brewing_guide" = replace("brewing_guide"::text, 'The summer pluck — a deeper, fruitier', 'The summer pluck: a deeper, fruitier')::jsonb
WHERE strpos("description", 'The summer pluck — a deeper, fruitier') > 0 OR strpos(coalesce("long_description", ''), 'The summer pluck — a deeper, fruitier') > 0 OR strpos("brewing_guide"::text, 'The summer pluck — a deeper, fruitier') > 0;
--> statement-breakpoint
UPDATE "products" SET
  "description" = replace("description", 'The autumn pluck — a mellow, rounded', 'The autumn pluck: a mellow, rounded'),
  "long_description" = replace("long_description", 'The autumn pluck — a mellow, rounded', 'The autumn pluck: a mellow, rounded'),
  "brewing_guide" = replace("brewing_guide"::text, 'The autumn pluck — a mellow, rounded', 'The autumn pluck: a mellow, rounded')::jsonb
WHERE strpos("description", 'The autumn pluck — a mellow, rounded') > 0 OR strpos(coalesce("long_description", ''), 'The autumn pluck — a mellow, rounded') > 0 OR strpos("brewing_guide"::text, 'The autumn pluck — a mellow, rounded') > 0;
--> statement-breakpoint
UPDATE "gardens" SET "story" = replace("story"::text, 'land in Darjeeling — rising past 7,000 feet.', 'land in Darjeeling, rising past 7,000 feet.')::jsonb
WHERE "slug" = 'gopaldhara' AND strpos("story"::text, 'land in Darjeeling — rising past 7,000 feet.') > 0;
--> statement-breakpoint
UPDATE "gardens" SET "story" = replace("story"::text, 'makes a bolder cup — more body, more malt', 'makes a bolder cup: more body, more malt')::jsonb
WHERE "slug" = 'rohini' AND strpos("story"::text, 'makes a bolder cup — more body, more malt') > 0;
