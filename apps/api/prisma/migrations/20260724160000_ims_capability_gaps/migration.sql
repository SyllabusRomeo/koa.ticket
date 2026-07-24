-- IMS capability gaps: SLA assign team, resolution codes, restricted tickets,
-- saved views, automation rules, IM incident models.

-- SLA escalation: optional team reassignment
ALTER TABLE "sla_escalation_rules" ADD COLUMN IF NOT EXISTS "assign_team_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'sla_escalation_rules_assign_team_id_fkey'
  ) THEN
    ALTER TABLE "sla_escalation_rules"
      ADD CONSTRAINT "sla_escalation_rules_assign_team_id_fkey"
      FOREIGN KEY ("assign_team_id") REFERENCES "teams"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Resolution codes
CREATE TABLE IF NOT EXISTS "resolution_codes" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "resolution_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "resolution_codes_code_key" ON "resolution_codes"("code");

ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "restricted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "resolution_code_id" TEXT;

CREATE INDEX IF NOT EXISTS "tickets_restricted_idx" ON "tickets"("restricted");
CREATE INDEX IF NOT EXISTS "tickets_resolution_code_id_idx" ON "tickets"("resolution_code_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tickets_resolution_code_id_fkey'
  ) THEN
    ALTER TABLE "tickets"
      ADD CONSTRAINT "tickets_resolution_code_id_fkey"
      FOREIGN KEY ("resolution_code_id") REFERENCES "resolution_codes"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- Saved ticket views
CREATE TABLE IF NOT EXISTS "ticket_saved_views" (
  "id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "query_json" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ticket_saved_views_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ticket_saved_views_user_id_name_key"
  ON "ticket_saved_views"("user_id", "name");
CREATE INDEX IF NOT EXISTS "ticket_saved_views_user_id_idx" ON "ticket_saved_views"("user_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ticket_saved_views_user_id_fkey'
  ) THEN
    ALTER TABLE "ticket_saved_views"
      ADD CONSTRAINT "ticket_saved_views_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Automation rules
CREATE TABLE IF NOT EXISTS "automation_rules" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 100,
  "conditions" JSONB NOT NULL,
  "actions" JSONB NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "automation_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "automation_rules_is_active_sort_order_idx"
  ON "automation_rules"("is_active", "sort_order");

-- IM incidents
CREATE TABLE IF NOT EXISTS "im_incidents" (
  "id" TEXT NOT NULL,
  "number" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "summary" TEXT,
  "severity" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'declared',
  "commander_id" TEXT,
  "started_at" TIMESTAMP(3) NOT NULL,
  "resolved_at" TIMESTAMP(3),
  "ticket_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "im_incidents_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "im_incidents_number_key" ON "im_incidents"("number");
CREATE UNIQUE INDEX IF NOT EXISTS "im_incidents_ticket_id_key" ON "im_incidents"("ticket_id");
CREATE INDEX IF NOT EXISTS "im_incidents_status_idx" ON "im_incidents"("status");
CREATE INDEX IF NOT EXISTS "im_incidents_severity_idx" ON "im_incidents"("severity");
CREATE INDEX IF NOT EXISTS "im_incidents_started_at_idx" ON "im_incidents"("started_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'im_incidents_commander_id_fkey'
  ) THEN
    ALTER TABLE "im_incidents"
      ADD CONSTRAINT "im_incidents_commander_id_fkey"
      FOREIGN KEY ("commander_id") REFERENCES "users"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'im_incidents_ticket_id_fkey'
  ) THEN
    ALTER TABLE "im_incidents"
      ADD CONSTRAINT "im_incidents_ticket_id_fkey"
      FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "im_incident_updates" (
  "id" TEXT NOT NULL,
  "incident_id" TEXT NOT NULL,
  "author_id" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "is_internal" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "im_incident_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "im_incident_updates_incident_id_created_at_idx"
  ON "im_incident_updates"("incident_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'im_incident_updates_incident_id_fkey'
  ) THEN
    ALTER TABLE "im_incident_updates"
      ADD CONSTRAINT "im_incident_updates_incident_id_fkey"
      FOREIGN KEY ("incident_id") REFERENCES "im_incidents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'im_incident_updates_author_id_fkey'
  ) THEN
    ALTER TABLE "im_incident_updates"
      ADD CONSTRAINT "im_incident_updates_author_id_fkey"
      FOREIGN KEY ("author_id") REFERENCES "users"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "im_incident_roles" (
  "incident_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "role" TEXT NOT NULL,
  CONSTRAINT "im_incident_roles_pkey" PRIMARY KEY ("incident_id", "user_id", "role")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'im_incident_roles_incident_id_fkey'
  ) THEN
    ALTER TABLE "im_incident_roles"
      ADD CONSTRAINT "im_incident_roles_incident_id_fkey"
      FOREIGN KEY ("incident_id") REFERENCES "im_incidents"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'im_incident_roles_user_id_fkey'
  ) THEN
    ALTER TABLE "im_incident_roles"
      ADD CONSTRAINT "im_incident_roles_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
