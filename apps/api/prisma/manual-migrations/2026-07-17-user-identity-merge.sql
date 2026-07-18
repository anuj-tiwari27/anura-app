-- User/Lawyer identity merge.
--
-- Identity fields (fullName, phone, city, state) move to "User" as the single
-- source of truth; "Lawyer" keeps only professional data.
--
-- This runs BEFORE `prisma db push` in the pre-deploy step. It performs the
-- destructive part explicitly (dropping four named columns) so that db push
-- afterwards sees a schema that already matches and needs no --accept-data-loss.
--
-- CONTRACT: this file must be safely RE-RUNNABLE — the pre-deploy step applies
-- every .sql in this directory on every deploy. Hence IF NOT EXISTS / IF EXISTS
-- guards, and a dynamic-SQL guard around the backfill (a plain UPDATE would be
-- parsed even on the skipped branch and fail once the columns are gone).

-- 1. Destination columns on User.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city"  text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "state" text;

-- 2. Backfill Lawyer -> User, without overwriting anything already set on User.
--    Only runs while the source columns still exist.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Lawyer'
      AND column_name = 'fullName'
  ) THEN
    EXECUTE '
      UPDATE "User" u SET
        "fullName" = COALESCE(u."fullName", l."fullName"),
        "phone"    = COALESCE(u."phone",    l."phone"),
        "city"     = COALESCE(u."city",     l."city"),
        "state"    = COALESCE(u."state",    l."state")
      FROM "Lawyer" l
      WHERE l."userId" = u."id"
    ';
    RAISE NOTICE 'Backfilled identity fields from Lawyer to User';
  ELSE
    RAISE NOTICE 'Lawyer identity columns already removed; skipping backfill';
  END IF;
END $$;

-- 3. Drop the now-duplicated identity columns from Lawyer. Explicit and scoped,
--    so `prisma db push` has no destructive change left to refuse.
ALTER TABLE "Lawyer" DROP COLUMN IF EXISTS "fullName";
ALTER TABLE "Lawyer" DROP COLUMN IF EXISTS "phone";
ALTER TABLE "Lawyer" DROP COLUMN IF EXISTS "city";
ALTER TABLE "Lawyer" DROP COLUMN IF EXISTS "state";
