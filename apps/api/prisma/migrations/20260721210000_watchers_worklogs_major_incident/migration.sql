-- Major incident flag
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "major_incident" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "tickets_major_incident_idx" ON "tickets"("major_incident");

-- Ticket watchers (subscribe + notify)
CREATE TABLE IF NOT EXISTS "ticket_watchers" (
  "id" TEXT NOT NULL,
  "ticket_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_watchers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ticket_watchers_ticket_id_user_id_key"
  ON "ticket_watchers"("ticket_id", "user_id");

CREATE INDEX IF NOT EXISTS "ticket_watchers_user_id_idx" ON "ticket_watchers"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_watchers_ticket_id_fkey'
  ) THEN
    ALTER TABLE "ticket_watchers"
      ADD CONSTRAINT "ticket_watchers_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_watchers_user_id_fkey'
  ) THEN
    ALTER TABLE "ticket_watchers"
      ADD CONSTRAINT "ticket_watchers_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Work logs (time spent)
CREATE TABLE IF NOT EXISTS "ticket_work_logs" (
  "id" TEXT NOT NULL,
  "ticket_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "minutes" INTEGER NOT NULL,
  "note" TEXT,
  "worked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ticket_work_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "ticket_work_logs_ticket_id_idx" ON "ticket_work_logs"("ticket_id");
CREATE INDEX IF NOT EXISTS "ticket_work_logs_author_id_idx" ON "ticket_work_logs"("author_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_work_logs_ticket_id_fkey'
  ) THEN
    ALTER TABLE "ticket_work_logs"
      ADD CONSTRAINT "ticket_work_logs_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_work_logs_author_id_fkey'
  ) THEN
    ALTER TABLE "ticket_work_logs"
      ADD CONSTRAINT "ticket_work_logs_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

-- Change / problem friendly statuses (idempotent)
INSERT INTO "ticket_statuses" ("id", "code", "name", "sort_order", "is_terminal", "pauses_sla", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text), 'under_investigation', 'Under investigation', 35, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ticket_statuses" WHERE "code" = 'under_investigation');

INSERT INTO "ticket_statuses" ("id", "code", "name", "sort_order", "is_terminal", "pauses_sla", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text), 'known_error', 'Known error', 45, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ticket_statuses" WHERE "code" = 'known_error');

INSERT INTO "ticket_statuses" ("id", "code", "name", "sort_order", "is_terminal", "pauses_sla", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text), 'scheduled', 'Scheduled', 48, false, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ticket_statuses" WHERE "code" = 'scheduled');

INSERT INTO "ticket_statuses" ("id", "code", "name", "sort_order", "is_terminal", "pauses_sla", "created_at", "updated_at")
SELECT md5(random()::text || clock_timestamp()::text), 'implementing', 'Implementing', 49, false, false, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (SELECT 1 FROM "ticket_statuses" WHERE "code" = 'implementing');

-- Transitions into new statuses from common open states (idempotent)
INSERT INTO "ticket_status_transitions" ("id", "from_status_id", "to_status_id")
SELECT
  md5(random()::text || clock_timestamp()::text || f.code || t.code),
  f.id,
  t.id
FROM "ticket_statuses" f
CROSS JOIN "ticket_statuses" t
WHERE f.code IN ('new', 'open', 'assigned', 'in_progress', 'under_investigation', 'known_error', 'pending_approval', 'scheduled', 'implementing', 'on_hold')
  AND t.code IN ('under_investigation', 'known_error', 'scheduled', 'implementing', 'in_progress', 'resolved', 'cancelled', 'on_hold', 'open', 'assigned')
  AND f.id <> t.id
  AND NOT EXISTS (
    SELECT 1 FROM "ticket_status_transitions" x
    WHERE x.from_status_id = f.id AND x.to_status_id = t.id
  );
