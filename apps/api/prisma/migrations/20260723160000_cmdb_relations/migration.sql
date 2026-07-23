-- L1 CMDB: CI source stamp + directed relationships
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT 'manual';

CREATE INDEX IF NOT EXISTS "assets_source_idx" ON "assets"("source");

CREATE TABLE IF NOT EXISTS "asset_relations" (
    "id" TEXT NOT NULL,
    "from_asset_id" TEXT NOT NULL,
    "to_asset_id" TEXT NOT NULL,
    "relation_type" TEXT NOT NULL,
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "asset_relations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "asset_relations_from_asset_id_to_asset_id_relation_type_key"
  ON "asset_relations"("from_asset_id", "to_asset_id", "relation_type");

CREATE INDEX IF NOT EXISTS "asset_relations_to_asset_id_idx" ON "asset_relations"("to_asset_id");
CREATE INDEX IF NOT EXISTS "asset_relations_relation_type_idx" ON "asset_relations"("relation_type");

DO $$ BEGIN
  ALTER TABLE "asset_relations"
    ADD CONSTRAINT "asset_relations_from_asset_id_fkey"
    FOREIGN KEY ("from_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "asset_relations"
    ADD CONSTRAINT "asset_relations_to_asset_id_fkey"
    FOREIGN KEY ("to_asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
