-- CreateTable
CREATE TABLE "ticket_attachments" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "uploaded_by_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ticket_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_json" TEXT,
    "after_json" TEXT,
    "ip_address" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_hours" (
    "id" TEXT NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "start_time" TEXT NOT NULL,
    "end_time" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',
    "is_active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "business_hours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holidays" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "name" TEXT NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'Africa/Accra',

    CONSTRAINT "holidays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticket_type_id" TEXT,
    "priority_id" TEXT,
    "first_response_minutes" INTEGER NOT NULL,
    "resolve_minutes" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_instances" (
    "id" TEXT NOT NULL,
    "ticket_id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "paused_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "breached_at" TIMESTAMP(3),
    "percent_consumed" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "last_escalation_percent" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sla_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sla_escalation_rules" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "threshold_percent" INTEGER NOT NULL,
    "notify_role_codes" TEXT NOT NULL,

    CONSTRAINT "sla_escalation_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_rules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category_id" TEXT,
    "ticket_type_id" TEXT,
    "location_id" TEXT,
    "team_id" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assignment_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "email_enabled" BOOLEAN NOT NULL DEFAULT true,
    "in_app_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_articles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "category" TEXT,
    "published_at" TIMESTAMP(3),
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "knowledge_articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_catalog_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "ticket_type_code" TEXT NOT NULL,
    "category_code" TEXT,
    "team_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_types" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asset_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "asset_tag" TEXT NOT NULL,
    "serial_number" TEXT,
    "type_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_stock',
    "manufacturer" TEXT,
    "model" TEXT,
    "assigned_user_id" TEXT,
    "location_id" TEXT,
    "notes" TEXT,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ticket_assets" (
    "ticket_id" TEXT NOT NULL,
    "asset_id" TEXT NOT NULL,

    CONSTRAINT "ticket_assets_pkey" PRIMARY KEY ("ticket_id","asset_id")
);

-- CreateIndex
CREATE INDEX "ticket_attachments_ticket_id_idx" ON "ticket_attachments"("ticket_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "business_hours_day_of_week_start_time_end_time_key" ON "business_hours"("day_of_week", "start_time", "end_time");

-- CreateIndex
CREATE UNIQUE INDEX "holidays_date_key" ON "holidays"("date");

-- CreateIndex
CREATE INDEX "sla_instances_ticket_id_idx" ON "sla_instances"("ticket_id");

-- CreateIndex
CREATE INDEX "sla_instances_due_at_idx" ON "sla_instances"("due_at");

-- CreateIndex
CREATE UNIQUE INDEX "sla_escalation_rules_policy_id_threshold_percent_key" ON "sla_escalation_rules"("policy_id", "threshold_percent");

-- CreateIndex
CREATE INDEX "assignment_rules_priority_idx" ON "assignment_rules"("priority");

-- CreateIndex
CREATE INDEX "notifications_user_id_read_at_idx" ON "notifications"("user_id", "read_at");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_user_id_event_type_key" ON "notification_preferences"("user_id", "event_type");

-- CreateIndex
CREATE UNIQUE INDEX "knowledge_articles_slug_key" ON "knowledge_articles"("slug");

-- CreateIndex
CREATE INDEX "knowledge_articles_status_idx" ON "knowledge_articles"("status");

-- CreateIndex
CREATE UNIQUE INDEX "service_catalog_items_code_key" ON "service_catalog_items"("code");

-- CreateIndex
CREATE UNIQUE INDEX "asset_types_code_key" ON "asset_types"("code");

-- CreateIndex
CREATE UNIQUE INDEX "assets_asset_tag_key" ON "assets"("asset_tag");

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_attachments" ADD CONSTRAINT "ticket_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_instances" ADD CONSTRAINT "sla_instances_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sla_escalation_rules" ADD CONSTRAINT "sla_escalation_rules_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "sla_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_articles" ADD CONSTRAINT "knowledge_articles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_type_id_fkey" FOREIGN KEY ("type_id") REFERENCES "asset_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assets" ADD CONSTRAINT "assets_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assets" ADD CONSTRAINT "ticket_assets_ticket_id_fkey" FOREIGN KEY ("ticket_id") REFERENCES "tickets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ticket_assets" ADD CONSTRAINT "ticket_assets_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
