-- Expand asset register (CMDB-lite MVP+)
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "name" TEXT;
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "purchase_date" TIMESTAMP(3);
ALTER TABLE "assets" ADD COLUMN IF NOT EXISTS "warranty_expires_at" TIMESTAMP(3);

-- Wire location FK if not already present (column existed without relation constraint in some DBs)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'assets_location_id_fkey'
  ) THEN
    ALTER TABLE "assets"
      ADD CONSTRAINT "assets_location_id_fkey"
      FOREIGN KEY ("location_id") REFERENCES "locations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "assets_status_idx" ON "assets"("status");
CREATE INDEX IF NOT EXISTS "assets_type_id_idx" ON "assets"("type_id");
CREATE INDEX IF NOT EXISTS "assets_assigned_user_id_idx" ON "assets"("assigned_user_id");

-- Normalize legacy status codes
UPDATE "assets" SET "status" = 'in_service' WHERE "status" IN ('in_use', 'in_service');
UPDATE "assets" SET "status" = 'in_repair' WHERE "status" IN ('under_repair', 'in_repair');
