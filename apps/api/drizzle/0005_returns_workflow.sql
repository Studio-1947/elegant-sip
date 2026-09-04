CREATE TYPE "return_request_type" AS ENUM ('cancellation', 'return');--> statement-breakpoint
CREATE TYPE "return_request_status" AS ENUM ('requested', 'approved', 'rejected', 'received');--> statement-breakpoint
CREATE TABLE "return_requests" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "order_id" uuid NOT NULL UNIQUE REFERENCES "orders"("id") ON DELETE RESTRICT,
  "type" "return_request_type" NOT NULL,
  "status" "return_request_status" DEFAULT 'requested' NOT NULL,
  "reason" text NOT NULL,
  "staff_note" text,
  "requested_at" timestamp with time zone DEFAULT now() NOT NULL,
  "decided_at" timestamp with time zone,
  "received_at" timestamp with time zone
);--> statement-breakpoint
CREATE INDEX "return_requests_status_idx" ON "return_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "return_requests_order_idx" ON "return_requests" USING btree ("order_id");
