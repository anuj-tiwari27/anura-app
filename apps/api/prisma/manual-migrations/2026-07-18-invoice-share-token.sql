-- Invoice share links: adds Invoice.shareToken and its unique index explicitly.
--
-- Prisma classifies "add a UNIQUE constraint to an existing table" as a possible
-- data-loss change (pre-existing duplicates would make it fail), so `prisma db
-- push` refuses without --accept-data-loss. Creating the column and index here
-- means db push sees them already in place and has nothing risky left to do —
-- keeping --accept-data-loss off as a safety net for genuinely unplanned changes.
--
-- Safe on existing data: the column is nullable and brand new, so there are no
-- duplicate values for the unique index to reject.
--
-- CONTRACT: re-runnable (applied on every deploy).

ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "shareToken" text;

-- Prisma's naming convention for a field-level @unique is <Table>_<field>_key.
-- Matching it exactly is what makes db push treat the index as already present.
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_shareToken_key" ON "Invoice" ("shareToken");
