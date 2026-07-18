/**
 * Pre-deploy step (Railway "Pre-deploy command"): bring the database in line
 * with the committed schema.
 *
 *   1. Apply every prisma/manual-migrations/*.sql in filename order. These carry
 *      data migrations and any explicitly-reviewed destructive changes (column
 *      drops), so that step 2 has nothing destructive left to do.
 *   2. `prisma db push` to sync everything else.
 *
 * db push runs WITHOUT --accept-data-loss on purpose: it stays a safety net. If
 * a deploy fails there, it means the schema has a destructive change that no
 * migration accounted for — write one in manual-migrations/ rather than adding
 * the flag.
 *
 * Every .sql here MUST be re-runnable: they are all applied on every deploy.
 */
import { execFileSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const schema = join(apiDir, 'prisma', 'schema.prisma');
const migrationsDir = join(apiDir, 'prisma', 'manual-migrations');

function prisma(args) {
  execFileSync('npx', ['prisma', ...args], {
    stdio: 'inherit',
    cwd: apiDir,
    shell: process.platform === 'win32',
  });
}

let files = [];
try {
  files = readdirSync(migrationsDir)
    .filter((f) => f.endsWith('.sql'))
    .sort();
} catch {
  // No manual-migrations directory — nothing to apply.
}

for (const file of files) {
  console.log(`[predeploy] applying migration: ${file}`);
  prisma(['db', 'execute', '--file', join(migrationsDir, file), '--schema', schema]);
}

console.log('[predeploy] syncing schema (prisma db push)');
prisma(['db', 'push', '--schema', schema, '--skip-generate']);

console.log('[predeploy] done');
