-- User/Lawyer identity merge — run BEFORE deploying the schema that drops
-- Lawyer.fullName/phone/city/state (commit that adds User.city/state).
--
-- Identity fields (fullName, phone, city, state) move to "User" as the single
-- source of truth; "Lawyer" keeps only professional data. This backfill copies
-- existing Lawyer values into User without overwriting anything already set.
--
-- Usage (psql):  \i 2026-07-17-user-identity-merge.sql
-- Safe to re-run (idempotent).

ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "city"  text;
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "state" text;

UPDATE "User" u SET
  "fullName" = COALESCE(u."fullName", l."fullName"),
  "phone"    = COALESCE(u."phone",    l."phone"),
  "city"     = COALESCE(u."city",     l."city"),
  "state"    = COALESCE(u."state",    l."state")
FROM "Lawyer" l
WHERE l."userId" = u."id";

-- After this, `prisma db push` (or the generated migration) may drop the
-- Lawyer columns; the data is preserved on User.
