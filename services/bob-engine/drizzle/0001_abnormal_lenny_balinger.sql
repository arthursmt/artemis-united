ALTER TABLE "bob"."assessment_outcomes" ADD COLUMN "effective_interest_rate" numeric;--> statement-breakpoint
ALTER TABLE "bob"."assessment_outcomes" ADD COLUMN "term_months" integer;--> statement-breakpoint
ALTER TABLE "bob"."assessment_outcomes" ADD COLUMN "collateral_description" text;--> statement-breakpoint
ALTER TABLE "bob"."assessment_outcomes" ADD COLUMN "owner_equity_contributed" numeric;