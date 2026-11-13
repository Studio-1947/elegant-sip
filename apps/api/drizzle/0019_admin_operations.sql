ALTER TYPE "public"."stock_reason" ADD VALUE 'damaged';--> statement-breakpoint
ALTER TYPE "public"."stock_reason" ADD VALUE 'sample';--> statement-breakpoint
ALTER TYPE "public"."stock_reason" ADD VALUE 'count_correction';--> statement-breakpoint
ALTER TABLE "product_variants" ADD COLUMN "weight_grams" integer;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "staff_notes" text;--> statement-breakpoint
ALTER TABLE "store_settings" ADD COLUMN "new_order_alerts" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "product_variants" ADD CONSTRAINT "product_variants_weight_positive" CHECK ("product_variants"."weight_grams" IS NULL OR "product_variants"."weight_grams" > 0);