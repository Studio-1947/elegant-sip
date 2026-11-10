ALTER TABLE "shipments" ADD COLUMN "booking_attempt" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "shipments" ADD COLUMN "booking_started_at" timestamp with time zone;