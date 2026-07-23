ALTER TABLE "app"."businesses" ALTER COLUMN "legal_name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."businesses" ALTER COLUMN "tax_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ALTER COLUMN "period_start" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ALTER COLUMN "period_end" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ALTER COLUMN "expenses" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."businesses" ADD COLUMN "name" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."businesses" ADD COLUMN "sector_segment" text NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ADD COLUMN "direct_costs" numeric(14, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ADD COLUMN "operating_expenses" numeric(14, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ADD COLUMN "current_debt_service" numeric(14, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ADD COLUMN "personal_extra_income" numeric(14, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."financial_statements" ADD COLUMN "personal_expenses" numeric(14, 2) NOT NULL;