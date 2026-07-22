-- M8: Notification digests (daily/weekly email rollups)

ALTER TABLE "users" ADD COLUMN "digest_frequency" TEXT NOT NULL DEFAULT 'none';
ALTER TABLE "users" ADD COLUMN "last_digest_at" TIMESTAMP(3);
ALTER TABLE "users" ADD COLUMN "digest_quiet_start_hour" INTEGER;
ALTER TABLE "users" ADD COLUMN "digest_quiet_end_hour" INTEGER;

CREATE INDEX "users_digest_frequency_idx" ON "users"("digest_frequency");
