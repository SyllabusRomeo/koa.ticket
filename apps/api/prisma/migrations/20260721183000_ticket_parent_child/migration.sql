-- Parent/child ticket relationships (PRD / tech roadmap Sprint 3)
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "parent_id" TEXT;

CREATE INDEX IF NOT EXISTS "tickets_parent_id_idx" ON "tickets"("parent_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_parent_id_fkey'
  ) THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_parent_id_fkey"
      FOREIGN KEY ("parent_id") REFERENCES "tickets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
