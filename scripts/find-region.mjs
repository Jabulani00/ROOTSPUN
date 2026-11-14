// Detect a Supabase project's pooler region by trying to connect.
//   SUPABASE_PROJECT_REF=xxxx SUPABASE_DB_PASSWORD=secret node scripts/find-region.mjs
// Prints the connection string host that works (password omitted).
import pg from "pg";

const ref = process.env.SUPABASE_PROJECT_REF;
const password = process.env.SUPABASE_DB_PASSWORD;
if (!ref || !password) {
  console.error("Set SUPABASE_PROJECT_REF and SUPABASE_DB_PASSWORD");
  process.exit(1);
}

const regions = [
  "eu-west-1", "eu-west-2", "eu-central-1", "eu-central-2",
  "us-east-1", "us-east-2", "us-west-1",
  "ap-southeast-1", "ap-south-1", "ap-southeast-2", "sa-east-1",
];

for (const region of regions) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  const client = new pg.Client({
    host,
    port: 5432,
    user: `postgres.${ref}`,
    password,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    await client.query("select 1");
    console.log(`MATCH region=${region} host=${host}`);
    await client.end();
    process.exit(0);
  } catch (e) {
    console.log(`no  ${region}: ${String(e.message).slice(0, 55)}`);
    try { await client.end(); } catch {}
  }
}
console.log("No region matched.");
process.exit(1);
