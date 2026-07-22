-- Change management: plan fields + scheduled/implementing statuses

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "change_risk" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "change_plan" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "rollback_plan" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "scheduled_start" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "scheduled_end" TIMESTAMP(3);
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "cab_required" BOOLEAN NOT NULL DEFAULT false;

INSERT INTO "ticket_statuses" (
  "id", "code", "name", "sort_order", "pauses_sla", "is_terminal", "created_at", "updated_at"
)
SELECT
  'sts_scheduled',
  'scheduled',
  'Scheduled',
  48,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ticket_statuses" WHERE "code" = 'scheduled'
);

INSERT INTO "ticket_statuses" (
  "id", "code", "name", "sort_order", "pauses_sla", "is_terminal", "created_at", "updated_at"
)
SELECT
  'sts_implementing',
  'implementing',
  'Implementing',
  49,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ticket_statuses" WHERE "code" = 'implementing'
);

INSERT INTO "ticket_status_transitions" ("id", "from_status_id", "to_status_id")
SELECT
  'trn_' || f.code || '_to_' || t.code,
  f.id,
  t.id
FROM "ticket_statuses" f
CROSS JOIN "ticket_statuses" t
WHERE (f.code, t.code) IN (
  ('new', 'pending_approval'),
  ('open', 'pending_approval'),
  ('assigned', 'pending_approval'),
  ('in_progress', 'pending_approval'),
  ('pending_approval', 'scheduled'),
  ('pending_approval', 'open'),
  ('pending_approval', 'cancelled'),
  ('scheduled', 'implementing'),
  ('scheduled', 'cancelled'),
  ('scheduled', 'on_hold'),
  ('implementing', 'resolved'),
  ('implementing', 'on_hold'),
  ('implementing', 'scheduled'),
  ('on_hold', 'scheduled'),
  ('on_hold', 'implementing'),
  ('open', 'scheduled'),
  ('assigned', 'scheduled'),
  ('in_progress', 'scheduled'),
  ('in_progress', 'implementing')
)
ON CONFLICT ("from_status_id", "to_status_id") DO NOTHING;
