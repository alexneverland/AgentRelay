import test from 'node:test';
import assert from 'node:assert/strict';
import { privatePath, secretCategories } from '../scripts/secret-rules.mjs';

test('Staged and history scanners share token and private path coverage', () => {
  for (const path of [
    'token.txt',
    'nested/pass.txt',
    'storage-state.json',
    'nested/auth-state.json',
    'output/file.txt',
    'file.dump',
    'file.log',
    '.env.local',
  ])
    assert.equal(privatePath(path), true, path);
  assert.equal(privatePath('.env.example'), false);
  for (const value of [
    'ar_' + 'a'.repeat(64),
    'sk-proj-' + 'b'.repeat(25),
    'postgres://owner:' + 'synthetic-password' + '@host.test:5432/db',
  ])
    assert.ok(secretCategories(value).length);
  assert.deepEqual(secretCategories('postgres://owner:YOUR_PASSWORD@host.test:5432/db'), []);
  assert.deepEqual(secretCategories("'-----BEGIN RSA PRIVATE KEY-----',"), []);
  assert.ok(
    secretCategories('synthetic-known-value', ['synthetic-known-value']).includes(
      'known-local-secret',
    ),
  );
});
