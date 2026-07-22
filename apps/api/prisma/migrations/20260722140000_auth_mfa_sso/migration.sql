-- AlterTable
ALTER TABLE "users" ADD COLUMN "auth_provider" TEXT NOT NULL DEFAULT 'local';
ALTER TABLE "users" ADD COLUMN "external_subject" TEXT;

-- CreateTable
CREATE TABLE "auth_challenges" (
    "id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "user_id" TEXT,
    "meta" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "auth_challenges_token_hash_key" ON "auth_challenges"("token_hash");

-- CreateIndex
CREATE INDEX "auth_challenges_kind_expires_at_idx" ON "auth_challenges"("kind", "expires_at");

-- AddForeignKey
ALTER TABLE "auth_challenges" ADD CONSTRAINT "auth_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
