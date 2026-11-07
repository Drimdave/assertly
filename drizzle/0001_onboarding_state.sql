CREATE TABLE "onboarding_state" (
	"user_id" text PRIMARY KEY NOT NULL,
	"tour_done" boolean DEFAULT false NOT NULL,
	"seen" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "onboarding_state" ADD CONSTRAINT "onboarding_state_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;