CREATE TABLE "habit" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text NOT NULL,
	"icon" text,
	"log_parent_id" text NOT NULL,
	"values" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"rank" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "habit_check" (
	"id" text PRIMARY KEY NOT NULL,
	"habit_id" text NOT NULL,
	"node_id" text NOT NULL,
	"day" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit" ADD CONSTRAINT "habit_log_parent_id_node_id_fk" FOREIGN KEY ("log_parent_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_check" ADD CONSTRAINT "habit_check_habit_id_habit_id_fk" FOREIGN KEY ("habit_id") REFERENCES "public"."habit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "habit_check" ADD CONSTRAINT "habit_check_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "habit_user_idx" ON "habit" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "habit_check_habit_day_uniq" ON "habit_check" USING btree ("habit_id","day");--> statement-breakpoint
CREATE INDEX "habit_check_habit_idx" ON "habit_check" USING btree ("habit_id");--> statement-breakpoint
CREATE INDEX "habit_check_node_idx" ON "habit_check" USING btree ("node_id");