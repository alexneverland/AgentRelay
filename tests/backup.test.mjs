import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  sealBackup,
  openBackup,
  assertRestoreTarget,
  checkBackupScope,
} from '../scripts/backup-core.mjs';

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

test(
  'Windows initialization removes stale directory/file grants and preserves the key',
  { skip: process.platform !== 'win32' },
  () => {
    const output = path.resolve('output');
    fs.mkdirSync(output, { recursive: true });
    const fixture = fs.mkdtempSync(path.join(output, 'backup-acl-'));
    try {
      const result = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-File', 'tests/backup-acl.ps1', '-Fixture', fixture],
        {
          encoding: 'utf8',
          windowsHide: true,
          env: {
            ...process.env,
            PSModulePath: path.join(
              process.env.SystemRoot,
              'System32',
              'WindowsPowerShell',
              'v1.0',
              'Modules',
            ),
          },
        },
      );
      assert.match(result, /key preserved on rerun/);
    } finally {
      // Delete only this exact synthetic fixture beneath the verified output directory.
      assert.equal(path.dirname(fs.realpathSync(fixture)), fs.realpathSync(output));
      assert.ok(path.basename(fixture).startsWith('backup-acl-'));
      fs.rmSync(fixture, { recursive: true });
    }
  },
);

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

test('Backup scope rejects even an empty Storage bucket and existing Vault/objects', async () => {
  const empty = { storage_objects: 0, storage_buckets: 0, vault_secrets: 0 };
  const query = (scope) => async (parts) => {
    assert.match(parts.join(''), /from storage\.buckets/);
    return [scope];
  };
  assert.deepEqual(await checkBackupScope(query(empty)), empty);
  for (const field of Object.keys(empty)) {
    await assert.rejects(
      checkBackupScope(query({ ...empty, [field]: 1 })),
      /separately reviewed backup scope/,
    );
  }
});
