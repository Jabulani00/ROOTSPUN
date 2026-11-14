// Cross-tenant RLS test (Definition of Done): prove agency A cannot read agency
// B's data. Everything runs inside a transaction that is ROLLED BACK, so the
// database is left untouched. Impersonates users by setting the `authenticated`
// role + request.jwt.claims (what Supabase Auth does), so RLS policies apply.
//
//   DATABASE_URL="postgresql://postgres.<ref>:...@...pooler.supabase.com:5432/postgres" \
//     node scripts/rls-test.mjs
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("Set DATABASE_URL");
  process.exit(1);
}

const uA = "11111111-1111-1111-1111-111111111111";
const uB = "22222222-2222-2222-2222-222222222222";
const agA = "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa";
const agB = "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb";

const c = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });

function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERT FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

async function asUser(uid) {
  await c.query(`set local request.jwt.claims = '{"sub":"${uid}","role":"authenticated"}'`);
}

async function clientNames() {
  const r = await c.query("select name from public.clients order by name");
  return r.rows.map((x) => x.name);
}

try {
  await c.connect();
  await c.query("begin");

  // ── Seed two tenants (as postgres: bypasses RLS) ──────────────────────────
  for (const [id, email] of [[uA, "a@rls.test"], [uB, "b@rls.test"]]) {
    await c.query(
      `insert into auth.users (instance_id, id, aud, role, email, created_at, updated_at)
       values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, now(), now())`,
      [id, email],
    );
  }
  await c.query(`insert into public.agencies (id, name) values ($1,'Agency A'), ($2,'Agency B')`, [agA, agB]);
  await c.query(`insert into public.memberships (agency_id, user_id, role) values ($1,$2,'owner'), ($3,$4,'owner')`, [agA, uA, agB, uB]);
  await c.query(`insert into public.clients (agency_id, name) values ($1,'Client A'), ($2,'Client B')`, [agA, agB]);

  // ── Enforce RLS by acting as the authenticated role ───────────────────────
  await c.query("set local role authenticated");

  console.log("As user A (Agency A):");
  await asUser(uA);
  const aSees = await clientNames();
  assert(aSees.length === 1 && aSees[0] === "Client A", `sees only own client (got ${JSON.stringify(aSees)})`);

  console.log("As user B (Agency B):");
  await asUser(uB);
  const bSees = await clientNames();
  assert(bSees.length === 1 && bSees[0] === "Client B", `sees only own client (got ${JSON.stringify(bSees)})`);

  console.log("\n✅ RLS cross-tenant isolation holds: A cannot read B's data and vice versa.");
} catch (err) {
  console.error("\n❌ RLS TEST FAILED:", err.message);
  process.exitCode = 1;
} finally {
  try {
    await c.query("rollback");
  } catch {}
  await c.end();
}
