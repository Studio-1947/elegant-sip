CREATE TABLE "saved_addresses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "label" text NOT NULL,
  "name" text NOT NULL,
  "line1" text NOT NULL,
  "city" text NOT NULL,
  "postal_code" text NOT NULL,
  "state" text,
  "country" text DEFAULT 'India' NOT NULL,
  "phone" text,
  "is_default" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "saved_addresses_user_idx" ON "saved_addresses" USING btree ("user_id");
