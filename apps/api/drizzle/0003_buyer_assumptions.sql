CREATE TABLE "buyer_assumptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"rate" numeric(6, 4) NOT NULL,
	"down_pct" numeric(5, 4) NOT NULL,
	"first_time" boolean NOT NULL,
	"lawyer_fee" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "buyer_assumptions" ADD CONSTRAINT "buyer_assumptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;