import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemas, rejectSecrets } from '../src/lib/schemas';
import { checkOrigin, requireScope, AppError } from '../src/lib/auth';
import { failure, limitedJson } from '../src/lib/http';

test('Publication input has bounded content, IDs and tags; identity cannot be supplied', () => {
  const parsed = schemas.create_question.parse({
    request_id: crypto.randomUUID(),
    title: 'A bounded question',
    body: 'Explicit selected excerpt',
    owner_id: crypto.randomUUID(),
    agent_id: crypto.randomUUID(),
  });
  assert.equal('owner_id' in parsed, false);
  assert.equal('agent_id' in parsed, false);
  assert.equal(
    schemas.create_question.safeParse({ ...parsed, body: 'x'.repeat(16001) }).success,
    false,
  );
  assert.equal(
    schemas.create_question.safeParse({ ...parsed, tags: Array(6).fill('Python') }).success,
    false,
  );
  assert.equal(
    schemas.record_test_result.safeParse({
      request_id: crypto.randomUUID(),
      question_id: crypto.randomUUID(),
      reply_id: crypto.randomUUID(),
      outcome: 'passed',
      environment: '',
      evidence: 'Passed',
    }).success,
    false,
  );
});
test('Potential private keys and familiar credential formats are rejected', () => {
  for (const body of [
    '-----BEGIN RSA PRIVATE KEY-----',
    'ghp_' + '1'.repeat(30),
    'api_key=supersecretcredentialvalue',
  ])
    assert.throws(() => rejectSecrets({ body }), /Potential secret detected/);
  assert.doesNotThrow(() =>
    rejectSecrets({ body: 'Use chunks of 1,000 rows and measure peak memory.' }),
  );
});
test('Scope gates deny writes from read-only principals', () => {
  const p = { owner: crypto.randomUUID(), agent: crypto.randomUUID(), scopes: ['read'] };
  requireScope(p, 'read');
  assert.throws(
    () => requireScope(p, 'publish'),
    (e: unknown) => e instanceof AppError && e.status === 403,
  );
});
test('Origin and host checks reject DNS rebinding and cross-site requests', () => {
  const origin = process.env.APP_ORIGIN || 'http://127.0.0.1:3000';
  assert.doesNotThrow(() => checkOrigin(new Request(`${origin}/api/mcp`)));
  assert.doesNotThrow(() =>
    checkOrigin(
      new Request('http://localhost:3000/api/mcp', { headers: { host: new URL(origin).host } }),
    ),
  );
  assert.throws(() =>
    checkOrigin(new Request(`${origin}/api/mcp`, { headers: { host: 'attacker.example' } })),
  );
  assert.throws(() => checkOrigin(new Request('http://attacker.example/api/mcp')));
  assert.throws(() =>
    checkOrigin(
      new Request(`${origin}/api/mcp`, { headers: { Origin: 'https://attacker.example' } }),
    ),
  );
});
test('Request body size is bounded even without Content-Length', async () => {
  const r = new Request('http://localhost', {
    method: 'POST',
    body: JSON.stringify({ body: 'x'.repeat(64001) }),
  });
  await assert.rejects(limitedJson(r), (e: unknown) => e instanceof AppError && e.status === 413);
  await assert.rejects(
    limitedJson(new Request('http://localhost', { method: 'POST', body: '{invalid' })),
    (e: unknown) => e instanceof AppError && e.status === 400,
  );
});
test('Errors do not leak database statements, connection secrets or stack traces', async () => {
  const response = failure(
    Object.assign(new Error('postgres://sensitive:secret@host'), { code: 'CONNECTION_ERROR' }),
  );
  assert.equal(response.status, 500);
  assert.doesNotMatch(await response.text(), /sensitive|secret|postgres:/);
});
