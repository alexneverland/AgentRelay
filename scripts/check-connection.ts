import { sql } from '../src/lib/db';
try {
  const [row] =
    await sql`select current_database() as database, exists(select 1 from pg_tables where schemaname='public' and tablename='questions') as schema_ready`;
  if (!row.schema_ready) throw new Error('schema_not_ready');
  console.log('Hosted Supabase connection verified; AgentRelay schema is ready.');
} catch (error) {
  console.error(
    'Connection check failed:',
    (error as { code?: string }).code || 'connection_error',
  );
  process.exitCode = 1;
} finally {
  await sql.end();
}
