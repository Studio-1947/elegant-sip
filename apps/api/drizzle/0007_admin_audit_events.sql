CREATE TABLE "admin_audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "actor_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" text NOT NULL,
  "resource" text NOT NULL,
  "status_code" integer NOT NULL,
  "occurred_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
CREATE INDEX "admin_audit_events_actor_idx" ON "admin_audit_events" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "admin_audit_events_occurred_idx" ON "admin_audit_events" USING btree ("occurred_at");
