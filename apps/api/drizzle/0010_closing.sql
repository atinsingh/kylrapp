CREATE TABLE "deal_tasks" (
	"deal_id" uuid NOT NULL,
	"key" text NOT NULL,
	"details" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"done_at" timestamp with time zone DEFAULT now() NOT NULL,
	"done_by" uuid NOT NULL,
	CONSTRAINT "deal_tasks_deal_id_key_pk" PRIMARY KEY("deal_id","key")
);
--> statement-breakpoint
ALTER TABLE "cash_back_payouts" ADD COLUMN "pct" integer DEFAULT 60 NOT NULL;--> statement-breakpoint
ALTER TABLE "cash_back_payouts" ADD COLUMN "reference" text;--> statement-breakpoint
ALTER TABLE "cash_back_payouts" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "deals" ADD COLUMN "closed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deal_tasks" ADD CONSTRAINT "deal_tasks_done_by_users_id_fk" FOREIGN KEY ("done_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;