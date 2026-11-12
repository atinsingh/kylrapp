CREATE TABLE "lmr_interest" (
	"application_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"method" text NOT NULL,
	"recorded_by" uuid NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lmr_interest_application_id_due_date_pk" PRIMARY KEY("application_id","due_date")
);
--> statement-breakpoint
ALTER TABLE "lmr_interest" ADD CONSTRAINT "lmr_interest_application_id_lease_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."lease_applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lmr_interest" ADD CONSTRAINT "lmr_interest_recorded_by_users_id_fk" FOREIGN KEY ("recorded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;