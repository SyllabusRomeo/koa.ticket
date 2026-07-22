-- Problem management: RCA fields + investigation statuses

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "root_cause" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "workaround" TEXT;

INSERT INTO "ticket_statuses" (
  "id", "code", "name", "sort_order", "pauses_sla", "is_terminal", "created_at", "updated_at"
)
SELECT
  'sts_under_investigation',
  'under_investigation',
  'Under investigation',
  45,
  false,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ticket_statuses" WHERE "code" = 'under_investigation'
);

INSERT INTO "ticket_statuses" (
  "id", "code", "name", "sort_order", "pauses_sla", "is_terminal", "created_at", "updated_at"
)
SELECT
  'sts_known_error',
  'known_error',
  'Known error',
  55,
  true,
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "ticket_statuses" WHERE "code" = 'known_error'
);

-- Core problem-flow transitions (idempotent)
INSERT INTO "ticket_status_transitions" ("id", "from_status_id", "to_status_id")
SELECT
  'trn_' || f.code || '_to_' || t.code,
  f.id,
  t.id
FROM "ticket_statuses" f
CROSS JOIN "ticket_statuses" t
WHERE (f.code, t.code) IN (
  ('assigned', 'under_investigation'),
  ('in_progress', 'under_investigation'),
  ('open', 'under_investigation'),
  ('under_investigation', 'known_error'),
  ('under_investigation', 'in_progress'),
  ('under_investigation', 'resolved'),
  ('under_investigation', 'on_hold'),
  ('known_error', 'in_progress'),
  ('known_error', 'under_investigation'),
  ('known_error', 'resolved'),
  ('on_hold', 'under_investigation')
)
ON CONFLICT ("from_status_id", "to_status_id") DO NOTHING;
