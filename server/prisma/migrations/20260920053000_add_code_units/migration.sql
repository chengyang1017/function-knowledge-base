-- Add class/file knowledge units while preserving all existing function data.
CREATE TABLE IF NOT EXISTS "CodeFile" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'plaintext',
  "code" TEXT NOT NULL,
  "description" TEXT,
  "categoryId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "CodeClass" (
  "id" SERIAL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "language" TEXT NOT NULL DEFAULT 'plaintext',
  "code" TEXT NOT NULL,
  "description" TEXT,
  "categoryId" INTEGER,
  "sourceFileId" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

ALTER TABLE "FunctionEntry"
  ADD COLUMN IF NOT EXISTS "sourceClassId" INTEGER,
  ADD COLUMN IF NOT EXISTS "sourceFileId" INTEGER,
  ADD COLUMN IF NOT EXISTS "extracted" BOOLEAN NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CodeFile_categoryId_fkey'
  ) THEN
    ALTER TABLE "CodeFile"
      ADD CONSTRAINT "CodeFile_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CodeClass_categoryId_fkey'
  ) THEN
    ALTER TABLE "CodeClass"
      ADD CONSTRAINT "CodeClass_categoryId_fkey"
      FOREIGN KEY ("categoryId") REFERENCES "Category"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'CodeClass_sourceFileId_fkey'
  ) THEN
    ALTER TABLE "CodeClass"
      ADD CONSTRAINT "CodeClass_sourceFileId_fkey"
      FOREIGN KEY ("sourceFileId") REFERENCES "CodeFile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FunctionEntry_sourceClassId_fkey'
  ) THEN
    ALTER TABLE "FunctionEntry"
      ADD CONSTRAINT "FunctionEntry_sourceClassId_fkey"
      FOREIGN KEY ("sourceClassId") REFERENCES "CodeClass"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'FunctionEntry_sourceFileId_fkey'
  ) THEN
    ALTER TABLE "FunctionEntry"
      ADD CONSTRAINT "FunctionEntry_sourceFileId_fkey"
      FOREIGN KEY ("sourceFileId") REFERENCES "CodeFile"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "CodeFile_categoryId_idx" ON "CodeFile"("categoryId");
CREATE INDEX IF NOT EXISTS "CodeClass_categoryId_idx" ON "CodeClass"("categoryId");
CREATE INDEX IF NOT EXISTS "CodeClass_sourceFileId_idx" ON "CodeClass"("sourceFileId");
CREATE INDEX IF NOT EXISTS "FunctionEntry_sourceClassId_idx" ON "FunctionEntry"("sourceClassId");
CREATE INDEX IF NOT EXISTS "FunctionEntry_sourceFileId_idx" ON "FunctionEntry"("sourceFileId");
