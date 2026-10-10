// Run with PGlite installed locally or TESTORBIT_PGLITE_MODULE pointing to its ESM entry.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const { PGlite } = await import(process.env.TESTORBIT_PGLITE_MODULE || '@electric-sql/pglite');
const db = new PGlite();
let checks = 0;
const check = (condition, message) => { assert.ok(condition, message); checks++; };
const schema = await readFile(new URL('../supabase_schema.sql', import.meta.url), 'utf8');
await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema auth;
  create table auth.users (id uuid primary key, email text, raw_user_meta_data jsonb default '{}');
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.email() returns text language sql stable as $$
    select nullif(current_setting('request.jwt.claim.email', true), '') $$;
  create function auth.role() returns text language sql stable as $$ select current_user::text $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on all functions in schema auth to anon, authenticated;
`);
if (process.env.TESTORBIT_BASELINE_SCHEMA) {
  const baseline = await readFile(process.env.TESTORBIT_BASELINE_SCHEMA, 'utf8');
  await db.exec(baseline.replace('create extension if not exists "uuid-ossp";', '')
    .replaceAll('uuid_generate_v4()', 'gen_random_uuid()'));
}
await db.exec(schema);
await db.exec(schema); // Idempotence is part of the bootstrap contract.
checks += 2;
await db.exec(`grant usage on schema public to anon, authenticated;
  grant select, insert, update, delete on all tables in schema public to anon, authenticated;`);
const alice = '00000000-0000-0000-0000-000000000001';
const bob = '00000000-0000-0000-0000-000000000002';
const mallory = '00000000-0000-0000-0000-000000000003';
for (const [id, name] of [[alice, 'alice'], [bob, 'bob'], [mallory, 'mallory']]) {
  await db.query('insert into auth.users(id,email) values($1,$2)', [id, `${name}@example.com`]);
}
async function asUser(id, email, role = 'authenticated') {
  await db.exec('reset role');
  await db.query("select set_config('request.jwt.claim.sub',$1,false), set_config('request.jwt.claim.email',$2,false)", [id, email]);
  await db.exec(`set role ${role}`);
}
async function denied(sql, values = []) {
  await assert.rejects(() => db.query(sql, values));
  checks++;
}
await asUser('', '', 'anon');
check((await db.query('select * from profiles')).rows.length === 0, 'Anonymous profiles must be hidden');
await denied('select private.is_team_member($1,$2)', [alice, 'alice@example.com']);
await asUser(alice, 'alice@example.com');
check((await db.query('select * from profiles')).rows.length === 1, 'Users see only their own profile');
const team = (await db.query('insert into teams(name,owner_id) values($1,$2) returning id', ['A team', alice])).rows[0].id;
await db.query("insert into team_members(team_id,user_id,user_email,role) values($1,$2,$3,'owner')", [team, alice, 'alice@example.com']);
await db.query("insert into team_members(team_id,user_id,user_email,role) values($1,$2,$3,'admin')", [team, bob, 'bob@example.com']);
const col = (await db.query("insert into collections(name,owner_id,team_id) values('Private', $1,$2) returning id", [alice, team])).rows[0].id;
const env = (await db.query("insert into environments(name,owner_id,team_id) values('Private', $1,$2) returning id", [alice, team])).rows[0].id;
await asUser(mallory, 'mallory@example.com');
check((await db.query('select * from collections')).rows.length === 0, 'Outsiders cannot read collections');
check((await db.query('select * from environments')).rows.length === 0, 'Outsiders cannot read environments');
await denied("insert into collections(name,owner_id,team_id) values('Injected',$1,$2)", [mallory, team]);
await denied("insert into environments(name,owner_id,team_id) values('Injected',$1,$2)", [mallory, team]);
await asUser(bob, 'bob@example.com');
check((await db.query('select * from collections')).rows.length === 1, 'Team members retain collection access');
await denied("insert into collections(name,owner_id,team_id) values('Forged owner',$1,$2)", [alice, team]);
await denied('update collections set owner_id=$1 where id=$2', [bob, col]);
await denied('update environments set owner_id=$1 where id=$2', [bob, env]);
await denied('update collections set team_id=null where id=$1', [col]);
await denied("update team_members set role='owner' where user_id=$1", [bob]);
await denied("update team_members set user_email='mallory@example.com' where user_id=$1", [bob]);
// Retired pricing restrictions must not limit new team members or collection shares.
await asUser(alice, 'alice@example.com');
for (let i = 0; i < 5; i++) {
  await db.query("insert into team_members(team_id,user_email,role) values($1,$2,'viewer')", [team, `member${i}@example.com`]);
  await db.query("insert into collection_shares(collection_id,user_email) values($1,$2)", [col, `share${i}@example.com`]);
}
check((await db.query('select * from collection_shares')).rows.length === 5, 'Sharing has no paid-tier restriction');
await db.exec('reset role');
check((await db.query("select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef")).rows.length === 0, 'No public SECURITY DEFINER RPCs');
await db.close();
console.log(`Database security checks passed: ${checks}`);
