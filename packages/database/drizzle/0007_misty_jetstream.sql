ALTER TABLE "users" ADD COLUMN "name" varchar(255);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "locale" varchar(35) DEFAULT 'en-US' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "timezone" varchar(64) DEFAULT 'UTC' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "country_code" varchar(2);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "avatar_url" text;