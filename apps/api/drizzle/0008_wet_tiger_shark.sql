CREATE TABLE "app"."two_factor_codes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"code_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "two_factor_codes_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
ALTER TABLE "app"."sessions" ADD COLUMN "is_two_factor_session" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."users" ADD COLUMN "two_factor_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "app"."two_factor_codes" ADD CONSTRAINT "two_factor_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "app"."users"("id") ON DELETE cascade ON UPDATE no action;