// Decrypt only into the owner-only work directory. Never upload this SQL or key.
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { openBackup } from './backup-core.mjs';
import { privateDirectory, privateRoot, sha256 } from './backup-support.mjs';

const input = path.resolve(process.argv[2] || '');
const work = privateDirectory(path.join(privateRoot, 'BackupWork'));
const key = fs.readFileSync(path.join(privateRoot, 'Recovery', 'backup-key.bin'));
const payload = JSON.parse(openBackup(fs.readFileSync(input), key).toString('utf8'));
const targetRef = process.env.AGENTRELAY_RESTORE_TARGET_REF;
if (!/^[a-z]{20}$/.test(targetRef || '') || targetRef === payload.manifest.sourceRef)
  throw new Error('Prepare requires a distinct explicit restore target ref.');
const archive = Buffer.from(payload.dump, 'base64');
if (sha256(archive) !== payload.manifest.dumpSha256) throw new Error('Archive digest mismatch.');
const raw = path.join(work, `restore-${randomUUID()}.dump`);
const toc = raw + '.list';
const sql = path.join(work, 'restore.sql');
const pgRestore = path.join(
  process.env.AGENTRELAY_PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin',
  'pg_restore.exe',
);
try {
  fs.writeFileSync(raw, archive, { flag: 'wx' });
  const list = execFileSync(pgRestore, ['--list', raw], { encoding: 'utf8' });
  const selected = list.split('\n').filter((line) => {
    if (!/^\d+;/.test(line)) return true;
    if (/ SCHEMA - public /.test(line)) return false; // Managed target already has public.
    if (/ SCHEMA - auth | SCHEMA - extensions /.test(line)) return false;
    // Managed Auth definitions and migration version belong to the new Supabase project.
    if (/ auth /.test(line))
      return (
        / (TABLE DATA|SEQUENCE SET) auth /.test(line) && !/ auth schema_migrations /.test(line)
      );
    return (
      / (public|private|supabase_migrations) /.test(line) ||
      / SCHEMA - (private|supabase_migrations) /.test(line)
    );
  });
  fs.writeFileSync(toc, selected.join('\n'));
  execFileSync(pgRestore, ['--no-owner', `--use-list=${toc}`, `--file=${sql}`, raw], {
    stdio: 'pipe',
  });
  const source = fs.readFileSync(sql, 'utf8');
  if (/^COPY /m.test(source))
    throw new Error('Use a column-insert archive for connector restore; COPY needs psql.');
  // psql-only control commands are not SQL and are removed from generated trusted output.
  const portable = source
    .split('\n')
    .filter(
      (line) =>
        !/^\\(?:un)?restrict\b/.test(line) &&
        !/^ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin\b/.test(line),
    )
    .join('\n');
  fs.writeFileSync(sql, portable);
  fs.writeFileSync(
    path.join(work, 'restore-manifest.json'),
    JSON.stringify({
      ...payload.manifest,
      restoreTargetRef: targetRef,
      restoreSqlSha256: sha256(Buffer.from(portable)),
    }),
  );
  console.log(
    JSON.stringify({
      sql,
      manifest: path.join(work, 'restore-manifest.json'),
      sourceRef: payload.manifest.sourceRef,
      bytes: Buffer.byteLength(portable),
    }),
  );
} finally {
  for (const file of [raw, toc]) if (fs.existsSync(file)) fs.unlinkSync(file);
}
