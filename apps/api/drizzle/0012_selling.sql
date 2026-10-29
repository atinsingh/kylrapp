ALTER TYPE "public"."deal_stage" ADD VALUE 'preparing';--> statement-breakpoint
ALTER TYPE "public"."deal_stage" ADD VALUE 'listed';--> statement-breakpoint
CREATE TABLE "sell_profiles" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"property" jsonb NOT NULL,
	"plan" text DEFAULT 'flat' NOT NULL,
	"coop" numeric(6, 4) DEFAULT '0.025' NOT NULL,
	"list_price" integer NOT NULL,
	"mortgage_balance" integer DEFAULT 0 NOT NULL,
	"listing_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "sell_profiles" ADD CONSTRAINT "sell_profiles_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sell_profiles" ADD CONSTRAINT "sell_profiles_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;