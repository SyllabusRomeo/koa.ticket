-- Ticket merge: secondary tickets point at primary via merged_into_id; status "merged"
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "merged_into_id" TEXT;

CREATE INDEX IF NOT EXISTS "tickets_merged_into_id_idx" ON "tickets"("merged_into_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_merged_into_id_fkey'
  ) THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_merged_into_id_fkey"
      FOREIGN KEY ("merged_into_id") REFERENCES "tickets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Terminal status for merged duplicates (idempotent upsert by code)
INSERT INTO "ticket_statuses" ("id", "code", "name", "sort_order", "is_terminal", "pauses_sla", "created_at", "updated_at")
SELECT
  md5(random()::text || clock_timestamp()::text),
  'merged',
  'Merged',
  120,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ticket_statuses" WHERE "code" = 'merged'
);
