ALTER TABLE "orders" ADD COLUMN "billing_name" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_line1" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_city" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_postal_code" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_state" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_country" text;--> statement-breakpoint
ALTER TABLE "orders" ADD COLUMN "billing_phone" text;--> statement-breakpoint
ALTER TABLE "saved_addresses" ADD COLUMN "is_default_shipping" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "saved_addresses" ADD COLUMN "is_default_billing" boolean DEFAULT false NOT NULL;--> statement-breakpoint

UPDATE "orders"
SET
  "billing_name" = "shipping_name",
  "billing_line1" = "shipping_line1",
  "billing_city" = "shipping_city",
  "billing_postal_code" = "shipping_postal_code",
  "billing_state" = "shipping_state",
  "billing_country" = "shipping_country",
  "billing_phone" = "shipping_phone"
WHERE "billing_name" IS NULL;--> statement-breakpoint

UPDATE "saved_addresses"
SET
  "is_default_shipping" = "is_default",
  "is_default_billing" = "is_default";
