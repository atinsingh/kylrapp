ALTER TABLE "id_verifications" ADD COLUMN "reviewed_by" uuid;--> statement-breakpoint
ALTER TABLE "id_verifications" ADD COLUMN "reviewed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "id_verifications" ADD COLUMN "review_note" text;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "agent_note" text;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "decided_by" uuid;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "decided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_in_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_in_geom" geometry(point);--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_in_distance_m" integer;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_in_accuracy_m" integer;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_out_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_out_geom" geometry(point);--> statement-breakpoint
ALTER TABLE "showings" ADD COLUMN "check_out_distance_m" integer;--> statement-breakpoint
ALTER TABLE "id_verifications" ADD CONSTRAINT "id_verifications_reviewed_by_users_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "showings" ADD CONSTRAINT "showings_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;