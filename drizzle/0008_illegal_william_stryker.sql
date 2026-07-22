ALTER TABLE "node" ALTER COLUMN "pinned" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "node" ALTER COLUMN "pinned" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "node" ALTER COLUMN "pinned" SET DATA TYPE text USING (CASE WHEN "pinned" THEN 'favorite' ELSE NULL END);
