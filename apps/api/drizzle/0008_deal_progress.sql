ALTER TABLE "conditions" ADD COLUMN "document_id" uuid;--> statement-breakpoint
ALTER TABLE "conditions" ADD COLUMN "delivered_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conditions" ADD COLUMN "lapsed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conditions" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "trust_verified_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deposits" ADD COLUMN "reminder_sent_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "conditions" ADD CONSTRAINT "conditions_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;