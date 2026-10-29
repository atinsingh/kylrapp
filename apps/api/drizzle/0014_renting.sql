CREATE TABLE "lease_applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"listing_id" uuid NOT NULL,
	"deal_id" uuid NOT NULL,
	"rent" integer NOT NULL,
	"start_date" date NOT NULL,
	"term_months" integer NOT NULL,
	"snapshot" jsonb NOT NULL,
	"status" text DEFAULT 'submitted' NOT NULL,
	"document_id" uuid,
	"landlord_document_id" uuid,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lease_profiles" (
	"deal_id" uuid PRIMARY KEY NOT NULL,
	"property" jsonb NOT NULL,
	"rent" integer NOT NULL,
	"available_from" date NOT NULL,
	"tenant_side_pct" numeric(4, 2) DEFAULT '0.5' NOT NULL,
	"listing_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tenant_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"data" jsonb NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_applications" ADD CONSTRAINT "lease_applications_landlord_document_id_documents_id_fk" FOREIGN KEY ("landlord_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_profiles" ADD CONSTRAINT "lease_profiles_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lease_profiles" ADD CONSTRAINT "lease_profiles_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tenant_profiles" ADD CONSTRAINT "tenant_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lease_applications_listing_ix" ON "lease_applications" USING btree ("listing_id");