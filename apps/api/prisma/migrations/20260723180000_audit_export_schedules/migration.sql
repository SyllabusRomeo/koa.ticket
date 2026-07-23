-- L5 immutable audit export schedules + run checksums
CREATE TABLE IF NOT EXISTS "audit_export_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "audit_export_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_export_schedules_user_id_is_active_idx"
  ON "audit_export_schedules"("user_id", "is_active");
CREATE INDEX IF NOT EXISTS "audit_export_schedules_is_active_last_run_at_idx"
  ON "audit_export_schedules"("is_active", "last_run_at");

DO $$ BEGIN
  ALTER TABLE "audit_export_schedules"
    ADD CONSTRAINT "audit_export_schedules_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "audit_export_runs" (
    "id" TEXT NOT NULL,
    "schedule_id" TEXT,
    "user_id" TEXT NOT NULL,
    "row_count" INTEGER NOT NULL,
    "content_sha256" TEXT NOT NULL,
    "range_from" TIMESTAMP(3),
    "range_to" TIMESTAMP(3),
    "filters" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "audit_export_runs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "audit_export_runs_user_id_created_at_idx"
  ON "audit_export_runs"("user_id", "created_at");
CREATE INDEX IF NOT EXISTS "audit_export_runs_content_sha256_idx"
  ON "audit_export_runs"("content_sha256");

DO $$ BEGIN
  ALTER TABLE "audit_export_runs"
    ADD CONSTRAINT "audit_export_runs_schedule_id_fkey"
    FOREIGN KEY ("schedule_id") REFERENCES "audit_export_schedules"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "audit_export_runs"
    ADD CONSTRAINT "audit_export_runs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
