ALTER TABLE "orders" ADD COLUMN "guest_access_token_hash" text;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_guest_access_token_hash_unique" UNIQUE("guest_access_token_hash");
