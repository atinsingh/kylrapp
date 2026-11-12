CREATE TABLE "saved_search_hits" (
	"search_id" uuid NOT NULL,
	"listing_id" uuid NOT NULL,
	"price" integer NOT NULL,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "saved_search_hits_search_id_listing_id_pk" PRIMARY KEY("search_id","listing_id")
);
--> statement-breakpoint
ALTER TABLE "saved_searches" ADD COLUMN "last_alerted_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "saved_search_hits" ADD CONSTRAINT "saved_search_hits_search_id_saved_searches_id_fk" FOREIGN KEY ("search_id") REFERENCES "public"."saved_searches"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_search_hits" ADD CONSTRAINT "saved_search_hits_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;