-- M3: multi-step approval policies

CREATE TABLE "approval_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ticket_type_id" TEXT,
    "category_id" TEXT,
    "change_risk" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_policies_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "approval_policies_priority_idx" ON "approval_policies"("priority");

CREATE TABLE "approval_steps" (
    "id" TEXT NOT NULL,
    "policy_id" TEXT NOT NULL,
    "step_order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "approver_role_code" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'any',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "approval_steps_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "approval_steps_policy_id_step_order_key" ON "approval_steps"("policy_id", "step_order");

ALTER TABLE "approval_steps" ADD CONSTRAINT "approval_steps_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "approvals" ADD COLUMN "policy_id" TEXT;
ALTER TABLE "approvals" ADD COLUMN "step_id" TEXT;
ALTER TABLE "approvals" ADD COLUMN "step_order" INTEGER;

CREATE INDEX "approvals_ticket_id_step_order_status_idx" ON "approvals"("ticket_id", "step_order", "status");

ALTER TABLE "approvals" ADD CONSTRAINT "approvals_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "approval_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "approvals" ADD CONSTRAINT "approvals_step_id_fkey" FOREIGN KEY ("step_id") REFERENCES "approval_steps"("id") ON DELETE SET NULL ON UPDATE CASCADE;
