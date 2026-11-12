CREATE TABLE "showings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'requested' NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "id_verifications" ADD COLUMN "status" text DEFAULT 'verified' NOT NULL;--> statement-breakpoint
ALTER TABLE "id_verifications" ADD COLUMN "buying_as" text DEFAULT 'self' NOT NULL;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "showings_deal_ix" ON "showings" USING btree ("deal_id","at");