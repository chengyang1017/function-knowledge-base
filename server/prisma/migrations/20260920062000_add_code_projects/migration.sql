-- CreateTable
CREATE TABLE "CodeProject" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "language" TEXT NOT NULL DEFAULT 'dart',
    "categoryId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CodeProject_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "CodeFile"
ADD COLUMN "projectId" INTEGER,
ADD COLUMN "projectPath" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "CodeFile_projectId_projectPath_key"
ON "CodeFile"("projectId", "projectPath");

-- AddForeignKey
ALTER TABLE "CodeProject"
ADD CONSTRAINT "CodeProject_categoryId_fkey"
FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CodeFile"
ADD CONSTRAINT "CodeFile_projectId_fkey"
FOREIGN KEY ("projectId") REFERENCES "CodeProject"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
