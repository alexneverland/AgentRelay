import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { sendAuthEmail, validateRecoveryPassword } from '../src/lib/auth-email';

test('Recovery and confirmation requests use distinct same-origin callbacks and no passwords', async () => {
  const requests: Array<{ url: URL; body: Record<string, unknown> }> = [];
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        requests.push({ url: new URL(String(input)), body: JSON.parse(String(init?.body)) });
        return new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
      },
    },
  });
  await sendAuthEmail(client, 'recovery', ' owner@example.test ', 'https://relay.example.test');
  await sendAuthEmail(client, 'confirmation', 'owner@example.test', 'https://relay.example.test');
  assert.equal(requests[0].url.pathname, '/auth/v1/recover');
  assert.equal(
    requests[0].url.searchParams.get('redirect_to'),
    'https://relay.example.test/reset-password',
  );
  assert.equal(requests[1].url.pathname, '/auth/v1/resend');
  assert.equal(requests[1].url.searchParams.get('redirect_to'), 'https://relay.example.test/');
  assert.equal(requests[1].body.type, 'signup');
  for (const r of requests) {
    assert.equal(r.body.email, 'owner@example.test');
    assert.ok(!('password' in r.body));
  }
});

test('Invalid email and unsafe callback origins never send an Auth request', async () => {
  let calls = 0;
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async () => {
        calls++;
        return new Response('{}');
      },
    },
  });
  await assert.rejects(sendAuthEmail(client, 'recovery', 'invalid', 'https://relay.example.test'));
  for (const origin of [
    'javascript:alert(1)',
    'https://relay.example.test/other',
    'https://user:pass@relay.example.test',
    'http://remote.example.test',
  ]) {
    await assert.rejects(sendAuthEmail(client, 'recovery', 'owner@example.test', origin));
  }
  assert.equal(calls, 0);
});

test('Email responses hide account existence and provider internals but surface rate limits', async () => {
  let code = 'user_not_found',
    status = 400;
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async () =>
        new Response(JSON.stringify({ code, msg: 'Private SMTP diagnostic and account details' }), {
          status,
          headers: { 'Content-Type': 'application/json', 'X-Supabase-Api-Version': '2024-01-01' },
        }),
    },
  });
  await sendAuthEmail(client, 'recovery', 'absent@example.test', 'https://relay.example.test');
  code = 'unexpected_failure';
  await assert.rejects(
    sendAuthEmail(client, 'recovery', 'owner@example.test', 'https://relay.example.test'),
    (error) => error instanceof Error && !error.message.includes('Private SMTP'),
  );
  code = 'over_email_send_rate_limit';
  status = 429;
  await assert.rejects(
    sendAuthEmail(client, 'confirmation', 'owner@example.test', 'https://relay.example.test'),
    /Too many email requests/,
  );
});

test('Recovery password checks reject mismatches and invalid lengths before submission', () => {
  assert.throws(() => validateRecoveryPassword('valid-length-password', 'different-password'));
  assert.throws(() => validateRecoveryPassword('short', 'short'));
  assert.throws(() => validateRecoveryPassword('x'.repeat(129), 'x'.repeat(129)));
  assert.doesNotThrow(() =>
    validateRecoveryPassword('valid-length-password', 'valid-length-password'),
  );
});
