CREATE TABLE "shipments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"provider" text NOT NULL,
	"provider_order_id" text,
	"provider_shipment_id" text,
	"awb" text,
	"courier_id" integer,
	"courier_name" text,
	"status" text DEFAULT 'created' NOT NULL,
	"provider_status" text,
	"weight_grams" integer NOT NULL,
	"label_url" text,
	"tracking_url" text,
	"pickup_scheduled_at" timestamp with time zone,
	"expected_delivery_at" timestamp with time zone,
	"delivered_at" timestamp with time zone,
	"last_error" text,
	"events" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_synced_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "shipments_order_id_unique" UNIQUE("order_id")
);
--> statement-breakpoint
ALTER TABLE "shipments" ADD CONSTRAINT "shipments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "shipments_awb_idx" ON "shipments" USING btree ("awb");--> statement-breakpoint
CREATE INDEX "shipments_status_idx" ON "shipments" USING btree ("status");