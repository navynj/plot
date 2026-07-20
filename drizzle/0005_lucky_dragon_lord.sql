CREATE TABLE "undo_op" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"stack" text NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "undo_op" ADD CONSTRAINT "undo_op_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "undo_user_stack_idx" ON "undo_op" USING btree ("user_id","stack","created_at");