import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';

export const sha256 = (value) => createHash('sha256').update(value).digest('hex');
export const privateRoot = path.join(process.env.LOCALAPPDATA || '', 'AgentRelay');
export function privateDirectory(folder) {
  const target = path.resolve(folder),
    repo = path.resolve('.');
  if (target === repo || target.startsWith(repo + path.sep))
    throw new Error('Private backups must stay outside the repository.');
  if (!fs.existsSync(target))
    throw new Error('Provision an owner-only private backup directory first.');
  return target;
}
export function pgEnvironment(url) {
  const u = new URL(url);
  return {
    ...process.env,
    PGHOST: u.hostname,
    PGPORT: u.port,
    PGUSER: decodeURIComponent(u.username),
    PGPASSWORD: decodeURIComponent(u.password),
    PGDATABASE: u.pathname.slice(1),
    PGSSLMODE: 'verify-full',
    PGSSLROOTCERT: path.resolve('certs/supabase-ca.crt'),
    PGCONNECT_TIMEOUT: '15',
    PGAPPNAME: 'AgentRelay backup/restore',
  };
}
export async function pgTool(name, args, url) {
  const binary = path.join(
    process.env.AGENTRELAY_PG_BIN || 'C:\\Program Files\\PostgreSQL\\17\\bin',
    `${name}.exe`,
  );
  return new Promise((resolve, reject) => {
    const process = spawn(binary, args, {
      env: pgEnvironment(url),
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const out = [],
      errors = [];
    process.stdout.on('data', (chunk) => out.push(chunk));
    process.stderr.on('data', (chunk) => errors.push(chunk));
    process.on('error', () => reject(new Error(`${name} could not start.`)));
    process.on('close', (code) => {
      if (code !== 0) {
        // Diagnostics can contain private row values: save privately, never print to CI/chat.
        const log = path.join(
          privateDirectory(path.join(privateRoot, 'BackupWork')),
          `${name}-failure.log`,
        );
        fs.writeFileSync(log, Buffer.concat(errors));
        reject(new Error(`${name} failed (${code}); private diagnostics: ${log}`));
      } else resolve(Buffer.concat(out));
    });
  });
}
export async function inventory(db) {
  const tables =
    await db`select schemaname,tablename from pg_tables where schemaname in ('public','private','auth','supabase_migrations') and not (schemaname='auth' and tablename='schema_migrations') order by schemaname,tablename`;
  const results = [];
  for (const { schemaname, tablename } of tables) {
    const quote = (value) => '"' + value.replaceAll('"', '""') + '"';
    const [row] = await db.unsafe(
      `select count(*)::int rows,md5(coalesce(string_agg(to_jsonb(t)::text,E'\\n' order by to_jsonb(t)::text),'')) digest from ${quote(schemaname)}.${quote(tablename)} t`,
    );
    results.push({ schema: schemaname, table: tablename, ...row });
  }
  return results;
}
