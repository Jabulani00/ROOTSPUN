// Apply all Supabase migrations (and seed) to a remote Postgres database.
//
//   DATABASE_URL="postgresql://postgres:...@db.xxxx.supabase.co:5432/postgres" \
//     node scripts/apply-remote.mjs
//
// Runs supabase/migrations/*.sql in filename order, then supabase/seed.sql.
// Idempotent-ish: stops on the first error and prints which file failed.
import { readdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL to your Supabase connection string (URI).");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

async function run(label, sql) {
  process.stdout.write(`applying ${label} ... `);
  await client.query(sql);
  console.log("ok");
}

try {
  await client.connect();
  const migDir = join(root, "supabase", "migrations");
  const files = readdirSync(migDir).filter((f) => f.endsWith(".sql")).sort();
  for (const f of files) {
    await run(f, readFileSync(join(migDir, f), "utf8"));
  }
  try {
    await run("seed.sql", readFileSync(join(root, "supabase", "seed.sql"), "utf8"));
  } catch (e) {
    console.warn("seed skipped:", e.message);
  }
  console.log("\nAll migrations applied.");
} catch (err) {
  console.error("\nFailed:", err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
