CREATE TABLE "event_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"window_type" varchar(10) NOT NULL,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"event_type" varchar(255) NOT NULL,
	"count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "aggregates_window_type_idx" ON "event_aggregates" USING btree ("window_type");--> statement-breakpoint
CREATE INDEX "aggregates_event_type_idx" ON "event_aggregates" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "aggregates_window_event_idx" ON "event_aggregates" USING btree ("window_type","event_type","window_start");--> statement-breakpoint
CREATE INDEX "aggregates_window_start_idx" ON "event_aggregates" USING btree ("window_start");
