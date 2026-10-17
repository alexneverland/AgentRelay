// Private backup envelopes use authenticated encryption. Keys never belong in Git.
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
const magic = Buffer.from('AGENTRELAY-BACKUP-1\n');

export async function checkBackupScope(db) {
  const [scope] = await db`select (select count(*)::int from storage.objects) storage_objects,
    (select count(*)::int from storage.buckets) storage_buckets,
    (select count(*)::int from vault.secrets) vault_secrets`;
  if (scope.storage_objects || scope.storage_buckets || scope.vault_secrets)
    throw new Error(
      'Storage buckets/objects or Vault secrets require a separately reviewed backup scope.',
    );
  return scope;
}

export function sealBackup(payload, key) {
  if (key.length !== 32) throw new Error('A 32-byte backup key is required.');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(magic);
  const body = Buffer.concat([cipher.update(payload), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), body]);
}

export function openBackup(envelope, key) {
  if (!envelope.subarray(0, magic.length).equals(magic)) throw new Error('Unknown backup format.');
  const offset = magic.length;
  const cipher = createDecipheriv('aes-256-gcm', key, envelope.subarray(offset, offset + 12));
  cipher.setAAD(magic);
  cipher.setAuthTag(envelope.subarray(offset + 12, offset + 28));
  return Buffer.concat([cipher.update(envelope.subarray(offset + 28)), cipher.final()]);
}

export function assertRestoreTarget(sourceRef, targetRef, url) {
  if (!/^[a-z]{20}$/.test(sourceRef) || !/^[a-z]{20}$/.test(targetRef) || sourceRef === targetRef)
    throw new Error('Restore requires a distinct explicit project ref.');
  const connection = new URL(url);
  const direct =
    connection.hostname === `db.${targetRef}.supabase.co` && connection.username === 'postgres';
  const pooler =
    connection.hostname.endsWith('.pooler.supabase.com') &&
    decodeURIComponent(connection.username) === `postgres.${targetRef}`;
  if ((!direct && !pooler) || connection.port !== '5432' || connection.pathname !== '/postgres')
    throw new Error('Restore requires the target project session/direct connection on port 5432.');
}
