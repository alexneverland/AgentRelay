import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { authCaptchaOptions, sendAuthEmail } from '../src/lib/auth-email';
import { failure } from '../src/lib/http';

test('Configured CAPTCHA rejects missing proof and sends proof in every Auth flow', async () => {
  assert.throws(() => authCaptchaOptions('configured-site-key', ''), /security check/);
  assert.deepEqual(authCaptchaOptions('', ''), {});
  const requests: Array<{ url: string; body: Record<string, unknown> }> = [];
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        requests.push({ url: String(input), body: JSON.parse(String(init?.body)) });
        return new Response('{}', { headers: { 'content-type': 'application/json' } });
      },
    },
  });
  const options = authCaptchaOptions('configured-site-key', 'synthetic-captcha-proof');
  await client.auth.signUp({
    email: 'owner@example.test',
    password: 'synthetic-password',
    options,
  });
  await client.auth.signInWithPassword({
    email: 'owner@example.test',
    password: 'synthetic-password',
    options,
  });
  await sendAuthEmail(
    client,
    'recovery',
    'owner@example.test',
    'https://relay.example.test',
    options,
  );
  await sendAuthEmail(
    client,
    'confirmation',
    'owner@example.test',
    'https://relay.example.test',
    options,
  );
  assert.equal(requests.length, 4);
  for (const { body } of requests)
    assert.deepEqual(body.gotrue_meta_security, { captcha_token: 'synthetic-captcha-proof' });
});

test('Database throttling returns a bounded retry delay without private diagnostics', async () => {
  const response = failure(
    Object.assign(new Error('private SQL and owner data'), { code: 'PT429', detail: '321' }),
  );
  assert.equal(response.status, 429);
  assert.equal(response.headers.get('retry-after'), '321');
  const result = await response.json();
  assert.equal(result.retry_after_seconds, 321);
  assert.doesNotMatch(JSON.stringify(result), /private SQL|owner data/);
});
