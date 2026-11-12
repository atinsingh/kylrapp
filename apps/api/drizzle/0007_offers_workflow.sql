ALTER TABLE "offers" ADD COLUMN "listing_id" uuid NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "parent_id" uuid;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "agent_note" text;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "registered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "offers" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "offers" ADD CONSTRAINT "offers_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "offers_deal_ix" ON "offers" USING btree ("deal_id");--> statement-breakpoint
CREATE INDEX "offers_listing_ix" ON "offers" USING btree ("listing_id");