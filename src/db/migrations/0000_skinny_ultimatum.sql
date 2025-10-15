CREATE TABLE "events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"timestamp" timestamp with time zone DEFAULT now() NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"metadata" jsonb NOT NULL
);
--> statement-breakpoint
CREATE INDEX "timestamp_idx" ON "events" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "event_type_idx" ON "events" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "event_type_timestamp_idx" ON "events" USING btree ("event_type","timestamp");