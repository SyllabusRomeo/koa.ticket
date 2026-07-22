-- M4: Catalog dynamic forms

ALTER TABLE "service_catalog_items" ADD COLUMN "form_schema" JSONB;

ALTER TABLE "tickets" ADD COLUMN "catalog_item_id" TEXT;
ALTER TABLE "tickets" ADD COLUMN "catalog_answers" JSONB;

CREATE INDEX "tickets_catalog_item_id_idx" ON "tickets"("catalog_item_id");
