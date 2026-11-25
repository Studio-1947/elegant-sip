ALTER TABLE "products" ADD COLUMN "variety" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "full_name" text GENERATED ALWAYS AS (CASE WHEN coalesce(btrim(variety), '') = '' THEN name ELSE name || ' | ' || btrim(variety) END) STORED NOT NULL;--> statement-breakpoint
-- A product's name was "Tea name | Category", like "Morning Dew | First Flush".
-- The two parts now have their own fields. Names without " | " are left as
-- they are, with no category; full_name rebuilds the original wording.
UPDATE "products" SET
  "variety" = btrim(substr("name", strpos("name", ' | ') + 3)),
  "name" = btrim(substr("name", 1, strpos("name", ' | ') - 1))
WHERE strpos("name", ' | ') > 1 AND btrim(substr("name", strpos("name", ' | ') + 3)) <> '';
