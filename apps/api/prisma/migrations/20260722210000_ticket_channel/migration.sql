-- Omnichannel intake metadata on tickets (M10)
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "channel" TEXT;
ALTER TABLE "tickets" ADD COLUMN IF NOT EXISTS "channel_meta" JSONB;

CREATE INDEX IF NOT EXISTS "tickets_channel_idx" ON "tickets"("channel");

-- Legacy rows: treat unknown origin as web portal / API
UPDATE "tickets" SET "channel" = 'web' WHERE "channel" IS NULL;
