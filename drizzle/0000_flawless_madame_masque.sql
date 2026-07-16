CREATE TABLE "field_value" (
	"id" text PRIMARY KEY NOT NULL,
	"node_id" text NOT NULL,
	"key" text NOT NULL,
	"text_value" text,
	"number_value" numeric,
	"bool_value" boolean,
	"date_value" timestamp with time zone,
	"link_value" text
);
--> statement-breakpoint
CREATE TABLE "link" (
	"source_id" text NOT NULL,
	"target_id" text NOT NULL,
	"rank" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "link_source_id_target_id_pk" PRIMARY KEY("source_id","target_id")
);
--> statement-breakpoint
CREATE TABLE "node" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"title" text,
	"icon" text,
	"body" text,
	"parent_id" text,
	"rank" text,
	"child_schema" jsonb DEFAULT '[]'::jsonb,
	"view_spec" jsonb,
	"captured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"event_date" timestamp with time zone,
	"schema_mode" text DEFAULT 'inherit',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "field_value" ADD CONSTRAINT "field_value_node_id_node_id_fk" FOREIGN KEY ("node_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "field_value" ADD CONSTRAINT "field_value_link_value_node_id_fk" FOREIGN KEY ("link_value") REFERENCES "public"."node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_source_id_node_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "link" ADD CONSTRAINT "link_target_id_node_id_fk" FOREIGN KEY ("target_id") REFERENCES "public"."node"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "node" ADD CONSTRAINT "node_parent_id_node_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."node"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "fv_node_idx" ON "field_value" USING btree ("node_id");--> statement-breakpoint
CREATE INDEX "fv_key_idx" ON "field_value" USING btree ("key");--> statement-breakpoint
CREATE INDEX "fv_key_link_idx" ON "field_value" USING btree ("key","link_value");--> statement-breakpoint
CREATE UNIQUE INDEX "fv_node_key_uniq" ON "field_value" USING btree ("node_id","key");--> statement-breakpoint
CREATE INDEX "link_source_idx" ON "link" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "link_target_idx" ON "link" USING btree ("target_id");--> statement-breakpoint
CREATE INDEX "node_user_idx" ON "node" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "node_parent_idx" ON "node" USING btree ("parent_id");--> statement-breakpoint
CREATE INDEX "node_inbox_idx" ON "node" USING btree ("user_id","parent_id");--> statement-breakpoint
CREATE INDEX "node_captured_idx" ON "node" USING btree ("user_id","captured_at");