-- L3 knowledge deflection / engagement events
CREATE TABLE IF NOT EXISTS "knowledge_events" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "user_id" TEXT,
    "event_type" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "knowledge_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "knowledge_events_article_id_idx" ON "knowledge_events"("article_id");
CREATE INDEX IF NOT EXISTS "knowledge_events_event_type_idx" ON "knowledge_events"("event_type");
CREATE INDEX IF NOT EXISTS "knowledge_events_created_at_idx" ON "knowledge_events"("created_at");
CREATE INDEX IF NOT EXISTS "knowledge_events_user_id_idx" ON "knowledge_events"("user_id");

DO $$ BEGIN
  ALTER TABLE "knowledge_events"
    ADD CONSTRAINT "knowledge_events_article_id_fkey"
    FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "knowledge_events"
    ADD CONSTRAINT "knowledge_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
