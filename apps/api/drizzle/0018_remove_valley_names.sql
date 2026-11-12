-- Copy change: the site no longer names the Rungbong or Kurseong valleys.
-- Gardens are created once by the seed and then owned by the admin garden
-- editor, so existing rows are updated here. Only the exact original phrases
-- are replaced: any other wording staff have edited stays as it is.
UPDATE "gardens" SET "region" = 'Mirik · Darjeeling'
WHERE "slug" = 'gopaldhara' AND "region" = 'Rungbong Valley, Mirik · Darjeeling';
--> statement-breakpoint
UPDATE "gardens" SET "region" = 'Darjeeling'
WHERE "slug" = 'rohini' AND "region" = 'Kurseong Valley · Darjeeling';
--> statement-breakpoint
UPDATE "gardens"
SET "story" = replace("story"::text, 'Gopaldhara sits in the Rungbong Valley above Mirik, and', 'Gopaldhara sits above Mirik, and')::jsonb
WHERE "slug" = 'gopaldhara';
--> statement-breakpoint
UPDATE "gardens"
SET "story" = replace(
  "story"::text,
  'Rohini lies lower down the hill, on the slopes below Kurseong where the Darjeeling foothills warm earlier in the season.',
  'Rohini lies lower down the hill, on warmer slopes where the Darjeeling foothills heat up earlier in the season.'
)::jsonb
WHERE "slug" = 'rohini';
