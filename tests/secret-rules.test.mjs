import test from 'node:test';
import assert from 'node:assert/strict';
import { privatePath, secretCategories } from '../scripts/secret-rules.mjs';

test('Both scanners detect PEM material with real, escaped and JSON-escaped newlines', () => {
  const pem = ['-----BEGIN PRIVATE KEY-----', 'A'.repeat(100), '-----END PRIVATE KEY-----'].join(
    '\n',
  );
  for (const value of [
    pem,
    pem.replaceAll('\n', '\\n'),
    JSON.stringify({ key: pem }),
    JSON.stringify({ key: pem.replaceAll('\n', '\\r\\n') }),
  ])
    assert.ok(secretCategories(value).includes('private-key'));
});

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
