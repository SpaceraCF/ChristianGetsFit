-- Prisma refuses to add a unique index through `db push` without an explicit
-- data-loss acknowledgement. Add this nullable key and its index separately so
-- existing exercise and workout history is preserved. This script is safe to
-- run again on every deployment.
ALTER TABLE "Exercise"
ADD COLUMN IF NOT EXISTS "program_key" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "Exercise_program_key_key"
ON "Exercise"("program_key");
