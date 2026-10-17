// Destructive operator action for an empty, isolated hosted project only.
// Never load .env.local here: the target URL must be explicitly supplied.
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { assertRestoreTarget } from './backup-core.mjs';
import { inventory, pgTool, privateDirectory, privateRoot, sha256 } from './backup-support.mjs';

const work = privateDirectory(path.join(privateRoot, 'BackupWork'));
const manifestPath = path.join(work, 'restore-manifest.json');
const sqlPath = path.join(work, 'restore.sql');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const target = process.env.AGENTRELAY_RESTORE_TARGET_REF;
const url = process.env.AGENTRELAY_RESTORE_DATABASE_URL;
assertRestoreTarget(manifest.sourceRef, target, url);
if (manifest.restoreTargetRef !== target)
  throw new Error('Prepared restore targets another project.');
const source = fs.readFileSync(sqlPath, 'utf8');
if (sha256(Buffer.from(source)) !== manifest.restoreSqlSha256)
  throw new Error('Prepared SQL was changed.');
const db = postgres(url, {
  max: 1,
  prepare: false,
  ssl: { ca: fs.readFileSync('certs/supabase-ca.crt', 'utf8'), rejectUnauthorized: true },
});
const quote = (v) => '"' + v.replaceAll('"', '""') + '"';
const literal = (v) => "'" + v.replaceAll("'", "''") + "'";
const executionPath = path.join(work, 'restore-execution.sql');
try {
  const [state] = await db`select (select count(*)::int from auth.users) users,
    exists(select 1 from pg_tables where schemaname in ('public','private','supabase_migrations')) occupied`;
  if (state.users || state.occupied)
    throw new Error('Restore target must be a fresh empty hosted project.');
  // Validate fingerprints before COMMIT; any mismatch rolls the whole restore back.
  const checks = manifest.tables
    .map(
      (t) => `do $verify$ begin
    if (select count(*) from ${quote(t.schema)}.${quote(t.table)}) <> ${Number(t.rows)}
      or (select md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) from ${quote(t.schema)}.${quote(t.table)} t) <> ${literal(t.digest)}
    then raise exception 'Restored table verification failed'; end if; end $verify$;`,
    )
    .join('\n');
  fs.writeFileSync(
    executionPath,
    `begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
set local session_replication_role='replica';
alter default privileges for role postgres in schema public revoke all on tables from anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on functions from anon,authenticated,service_role;
alter default privileges for role postgres in schema public revoke all on sequences from anon,authenticated,service_role;
${source}
set local session_replication_role='origin';
${checks}
commit;`,
  );
  await pgTool(
    'psql',
    ['--no-password', '-X', '--set=ON_ERROR_STOP=1', `--file=${executionPath}`],
    url,
  );
  const actual = await inventory(db);
  if (
    actual.length !== manifest.tables.length ||
    manifest.tables.some(
      (t) =>
        !actual.some(
          (a) =>
            a.schema === t.schema &&
            a.table === t.table &&
            a.rows === t.rows &&
            a.digest === t.digest,
        ),
    )
  )
    throw new Error('Post-commit verification differs; isolate the target and investigate.');
  console.log(
    JSON.stringify({
      restored: true,
      tables: actual.length,
      target,
      sourceRef: manifest.sourceRef,
    }),
  );
} finally {
  await db.end();
  for (const file of [executionPath, sqlPath, manifestPath])
    if (fs.existsSync(file)) fs.unlinkSync(file);
}
