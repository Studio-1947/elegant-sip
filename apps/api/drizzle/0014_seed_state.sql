CREATE TABLE "seed_state" (
	"key" text PRIMARY KEY NOT NULL,
	"hash" text NOT NULL,
	"sizes" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"applied_at" timestamp with time zone DEFAULT now() NOT NULL
);
