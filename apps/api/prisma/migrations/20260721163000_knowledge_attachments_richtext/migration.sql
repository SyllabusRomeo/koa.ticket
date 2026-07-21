-- CreateTable
CREATE TABLE "knowledge_attachments" (
    "id" TEXT NOT NULL,
    "article_id" TEXT,
    "uploaded_by_id" TEXT NOT NULL,
    "original_name" TEXT NOT NULL,
    "stored_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'attachment',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_attachments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "knowledge_attachments_article_id_idx" ON "knowledge_attachments"("article_id");

-- AddForeignKey
ALTER TABLE "knowledge_attachments" ADD CONSTRAINT "knowledge_attachments_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "knowledge_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_attachments" ADD CONSTRAINT "knowledge_attachments_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
