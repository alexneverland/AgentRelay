import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { sealBackup, openBackup, assertRestoreTarget } from '../scripts/backup-core.mjs';

test('Backups decrypt exactly and reject wrong keys, damaged data and truncated files', () => {
  const key = randomBytes(32),
    original = Buffer.from('Synthetic backup content');
  const envelope = sealBackup(original, key);
  assert.deepEqual(openBackup(envelope, key), original);
  assert.notDeepEqual(sealBackup(original, key), envelope);
  assert.throws(() => openBackup(envelope, randomBytes(32)));
  for (const offset of [0, 20, envelope.length - 1]) {
    const damaged = Buffer.from(envelope);
    damaged[offset] ^= 1;
    assert.throws(() => openBackup(damaged, key));
  }
  assert.throws(() => openBackup(envelope.subarray(0, envelope.length - 1), key));
});

test('Restore cannot target the source, another pooler user, transaction port or arbitrary host', () => {
  const source = 'a'.repeat(20),
    target = 'b'.repeat(20);
  const url = `postgres://postgres.${target}:placeholder@aws-0-eu-west-1.pooler.supabase.com:5432/postgres`;
  assert.doesNotThrow(() => assertRestoreTarget(source, target, url));
  assert.throws(() => assertRestoreTarget(source, source, url));
  assert.throws(() => assertRestoreTarget(source, target, url.replace(target, source)));
  assert.throws(() => assertRestoreTarget(source, target, url.replace(':5432', ':6543')));
  assert.throws(() =>
    assertRestoreTarget(
      source,
      target,
      url.replace('aws-0-eu-west-1.pooler.supabase.com', 'host.test'),
    ),
  );
});
