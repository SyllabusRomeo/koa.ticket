-- M9: Scheduled report email exports

CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "cadence" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "last_run_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "report_schedules_user_id_is_active_idx" ON "report_schedules"("user_id", "is_active");
CREATE INDEX "report_schedules_is_active_last_run_at_idx" ON "report_schedules"("is_active", "last_run_at");

ALTER TABLE "report_schedules" ADD CONSTRAINT "report_schedules_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
