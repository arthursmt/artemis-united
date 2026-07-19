CREATE SCHEMA "bob";
--> statement-breakpoint
CREATE TYPE "bob"."assessment_confidence_level" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "bob"."assessment_outcome_result" AS ENUM('approved', 'rejected', 'withdrawn');--> statement-breakpoint
CREATE TYPE "bob"."assessment_status" AS ENUM('draft', 'in_review', 'completed');--> statement-breakpoint
CREATE TYPE "bob"."institution_offer_status" AS ENUM('pending', 'accepted', 'rejected', 'expired');--> statement-breakpoint
CREATE TABLE "bob"."assessment_outcomes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"outcome" "bob"."assessment_outcome_result" NOT NULL,
	"selected_offer_id" uuid,
	"decided_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	CONSTRAINT "assessment_outcomes_assessment_id_unique" UNIQUE("assessment_id")
);
--> statement-breakpoint
CREATE TABLE "bob"."assessment_refinements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"input_data" jsonb,
	"output_data" jsonb,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bob"."assessments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"business_id" uuid NOT NULL,
	"status" "bob"."assessment_status" DEFAULT 'draft' NOT NULL,
	"requested_amount" numeric(14, 2) NOT NULL,
	"currency" text DEFAULT 'USD' NOT NULL,
	"input_snapshot" jsonb NOT NULL,
	"sector_segment" text NOT NULL,
	"recommended_amount" numeric(14, 2),
	"score" numeric,
	"confidence_level" "bob"."assessment_confidence_level",
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bob"."institution_offers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"assessment_id" uuid NOT NULL,
	"institution_name" text NOT NULL,
	"offered_amount" numeric(14, 2) NOT NULL,
	"interest_rate" numeric(6, 3) NOT NULL,
	"terms" jsonb,
	"status" "bob"."institution_offer_status" DEFAULT 'pending' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "bob"."assessment_outcomes" ADD CONSTRAINT "assessment_outcomes_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "bob"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bob"."assessment_outcomes" ADD CONSTRAINT "assessment_outcomes_selected_offer_id_institution_offers_id_fk" FOREIGN KEY ("selected_offer_id") REFERENCES "bob"."institution_offers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bob"."assessment_refinements" ADD CONSTRAINT "assessment_refinements_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "bob"."assessments"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bob"."institution_offers" ADD CONSTRAINT "institution_offers_assessment_id_assessments_id_fk" FOREIGN KEY ("assessment_id") REFERENCES "bob"."assessments"("id") ON DELETE cascade ON UPDATE no action;