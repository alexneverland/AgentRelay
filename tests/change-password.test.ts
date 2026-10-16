import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { changeAccountPassword } from '../src/lib/change-password';

function fixture(requireProof = false, code = 'captcha_failed') {
  const requests: Array<{ path: string; method: string; body: Record<string, unknown> }> = [];
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: async (input, init) => {
        const url = new URL(String(input));
        const body = init?.body ? JSON.parse(String(init.body)) : {};
        requests.push({ path: url.pathname, method: init?.method || 'GET', body });
        const headers = {
          'content-type': 'application/json',
          'X-Supabase-Api-Version': '2024-01-01',
        };
        if (url.pathname.endsWith('/logout')) return new Response(null, { status: 204 });
        if (url.pathname.endsWith('/token')) {
          if (
            requireProof &&
            (body.gotrue_meta_security?.captcha_token !== 'synthetic-proof' ||
              code !== 'captcha_failed')
          )
            return new Response(JSON.stringify({ code, msg: 'Synthetic rejection' }), {
              status: 400,
              headers,
            });
          return new Response(
            JSON.stringify({
              access_token: 'synthetic-access-token',
              refresh_token: 'synthetic-refresh-token',
              token_type: 'bearer',
              expires_in: 3600,
              user: { id: 'synthetic-owner', email: 'owner@example.test', aud: 'authenticated' },
            }),
            { headers },
          );
        }
        assert.ok(url.pathname.endsWith('/user'));
        return new Response(
          JSON.stringify({
            id: 'synthetic-owner',
            email: 'owner@example.test',
            aud: 'authenticated',
          }),
          { headers },
        );
      },
    },
  });
  return { client, requests };
}
const input = {
  owner: 'synthetic-owner',
  email: 'owner@example.test',
  current: 'old-synthetic-password',
  password: 'new-synthetic-password',
  confirm: 'new-synthetic-password',
  siteKey: 'configured-site-key',
  captchaToken: 'synthetic-proof',
};

test('Settings password reauthentication sends CAPTCHA and preserves the workspace session', async () => {
  const workspace = fixture(),
    verifier = fixture(true);
  await workspace.client.auth.signInWithPassword({ email: input.email, password: input.current });
  await changeAccountPassword(workspace.client, verifier.client, input);
  assert.deepEqual(verifier.requests[0].body.gotrue_meta_security, {
    captcha_token: 'synthetic-proof',
  });
  const update = workspace.requests.find((r) => r.method === 'PUT');
  assert.ok(update);
  assert.equal(update.body.current_password, input.current);
  assert.equal(update.body.password, input.password);
  assert.equal((await verifier.client.auth.getSession()).data.session, null);
  assert.ok((await workspace.client.auth.getSession()).data.session);
});
test('Missing CAPTCHA, rejected proof and wrong current password cannot update a password', async () => {
  const workspace = fixture();
  for (const [captchaToken, code, expected] of [
    ['', 'captcha_failed', /security check/],
    ['invalid', 'captcha_failed', /Security check failed/],
    ['synthetic-proof', 'invalid_credentials', /Current password is incorrect/],
  ] as const) {
    const verifier = fixture(true, code);
    await assert.rejects(
      changeAccountPassword(workspace.client, verifier.client, { ...input, captchaToken }),
      expected,
    );
  }
  assert.equal(workspace.requests.length, 0);
});

test('An independent installation without CAPTCHA keeps password changes working', async () => {
  const workspace = fixture(),
    verifier = fixture();
  await workspace.client.auth.signInWithPassword({ email: input.email, password: input.current });
  await changeAccountPassword(workspace.client, verifier.client, {
    ...input,
    siteKey: '',
    captchaToken: '',
  });
  assert.ok(workspace.requests.some((r) => r.method === 'PUT'));
  assert.ok((await workspace.client.auth.getSession()).data.session);
});

test('Reauthentication for another owner cannot authorize the workspace password update', async () => {
  const workspace = fixture(),
    verifier = fixture(true);
  await assert.rejects(
    changeAccountPassword(workspace.client, verifier.client, { ...input, owner: 'another-owner' }),
    /Current password is incorrect/,
  );
  assert.equal(workspace.requests.length, 0);
  assert.equal((await verifier.client.auth.getSession()).data.session, null);
});
