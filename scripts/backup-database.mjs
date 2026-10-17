// Deliberate operator export only. Never run from CI or upload plaintext/key material.
import fs from 'node:fs';
import path from 'node:path';
import postgres from 'postgres';
import { randomUUID } from 'node:crypto';
import { sealBackup, openBackup } from './backup-core.mjs';
import { inventory, pgTool, privateDirectory, privateRoot, sha256 } from './backup-support.mjs';

const sourceRef = process.env.AGENTRELAY_BACKUP_SOURCE_REF;
if (!/^[a-z]{20}$/.test(sourceRef || ''))
  throw new Error('An explicit backup source ref is required.');
const source = new URL(process.env.DATABASE_URL);
if (
  source.hostname.endsWith('.pooler.supabase.com') &&
  decodeURIComponent(source.username) === `postgres.${sourceRef}`
)
  source.port = '5432';
else if (source.hostname !== `db.${sourceRef}.supabase.co` || source.username !== 'postgres')
  throw new Error('Source connection/project mismatch.');
if (!['postgres:', 'postgresql:'].includes(source.protocol) || source.pathname !== '/postgres')
  throw new Error('Expected a PostgreSQL source database.');
source.port = '5432';
const backups = privateDirectory(path.join(privateRoot, 'Backups'));
const work = privateDirectory(path.join(privateRoot, 'BackupWork'));
const key = fs.readFileSync(path.join(privateRoot, 'Recovery', 'backup-key.bin'));
const raw = path.join(work, `snapshot-${randomUUID()}.dump`);
const db = postgres(source.toString(), {
  max: 1,
  prepare: false,
  ssl: { ca: fs.readFileSync('certs/supabase-ca.crt', 'utf8'), rejectUnauthorized: true },
});
try {
  let manifest;
  await db.begin('isolation level repeatable read read only', async (tx) => {
    const [snapshot] =
      await tx`select pg_export_snapshot() snapshot,current_setting('server_version') version,now() taken_at`;
    const [objects] =
      await tx`select (select count(*)::int from storage.objects) storage_objects,(select count(*)::int from vault.secrets) vault_secrets`;
    if (objects.storage_objects || objects.vault_secrets)
      throw new Error('Storage/Vault contents require a separately reviewed backup scope.');
    const tables = await inventory(tx);
    const migrations =
      await tx`select version,name from supabase_migrations.schema_migrations order by version`;
    await pgTool(
      'pg_dump',
      [
        '--no-password',
        '--format=custom',
        '--column-inserts',
        '--no-owner',
        '--no-subscriptions',
        '--no-publications',
        '--lock-wait-timeout=5s',
        `--snapshot=${snapshot.snapshot}`,
        '--schema=public',
        '--schema=private',
        '--schema=auth',
        '--schema=supabase_migrations',
        `--file=${raw}`,
      ],
      source.toString(),
    );
    manifest = {
      format: 1,
      sourceRef,
      takenAt: snapshot.taken_at,
      postgres: snapshot.version,
      tables,
      migrations,
      storageObjects: 0,
      vaultSecrets: 0,
      excluded: [
        'Storage files',
        'Vault secrets',
        'provider configuration and SMTP/Turnstile secrets',
        'database role passwords',
        'hosting environment',
        'auth.schema_migrations is preserved in the archive but not replayed into managed Auth',
      ],
    };
  });
  const dump = fs.readFileSync(raw);
  manifest.dumpSha256 = sha256(dump);
  const payload = Buffer.from(JSON.stringify({ manifest, dump: dump.toString('base64') }));
  const envelope = sealBackup(payload, key);
  if (!openBackup(envelope, key).equals(payload))
    throw new Error('Backup encryption round-trip failed.');
  const target = path.join(
    backups,
    `agentrelay-${new Date().toISOString().replaceAll(':', '-')}.arb`,
  );
  fs.writeFileSync(target, envelope, { flag: 'wx' });
  console.log(
    JSON.stringify({
      backup: target,
      bytes: envelope.length,
      sha256: sha256(envelope),
      tables: manifest.tables.length,
      migrations: manifest.migrations.length,
      encrypted: true,
    }),
  );
} finally {
  await db.end();
  if (fs.existsSync(raw)) fs.unlinkSync(raw);
}
