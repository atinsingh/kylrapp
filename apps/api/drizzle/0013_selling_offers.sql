CREATE TABLE "representation_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"buyer_id" uuid NOT NULL,
	"buyer_document_id" uuid,
	"buyer_signed_at" timestamp with time zone,
	"seller_document_id" uuid,
	"seller_signed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "feedback" jsonb;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "feedback_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "representation_consents" ADD CONSTRAINT "representation_consents_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representation_consents" ADD CONSTRAINT "representation_consents_buyer_id_users_id_fk" FOREIGN KEY ("buyer_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representation_consents" ADD CONSTRAINT "representation_consents_buyer_document_id_documents_id_fk" FOREIGN KEY ("buyer_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "representation_consents" ADD CONSTRAINT "representation_consents_seller_document_id_documents_id_fk" FOREIGN KEY ("seller_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "representation_consents_uq" ON "representation_consents" USING btree ("listing_id","buyer_id");