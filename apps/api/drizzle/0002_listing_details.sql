CREATE TABLE "listing_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"at" date NOT NULL,
	"event" text NOT NULL,
	"price" integer
);
--> statement-breakpoint
CREATE TABLE "listing_insights" (
	"listing_id" uuid PRIMARY KEY NOT NULL,
	"schools" jsonb NOT NULL,
	"commute" jsonb NOT NULL,
	"nearby" text,
	"source" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "lot" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "parking" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "heating" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "open_house" text;--> statement-breakpoint
ALTER TABLE "listings" ADD COLUMN "offer_date" text;--> statement-breakpoint
ALTER TABLE "listing_events" ADD CONSTRAINT "listing_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listing_insights" ADD CONSTRAINT "listing_insights_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "listing_events_listing_ix" ON "listing_events" USING btree ("listing_id","at");