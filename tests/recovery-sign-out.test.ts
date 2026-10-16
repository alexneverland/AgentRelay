import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createClient, type AuthChangeEvent } from '@supabase/supabase-js';
import { signOutAfterRecovery } from '../src/lib/recovery-sign-out';

function authFixture(logoutStatus = 204) {
  const storage = new Map<string, string>();
  const requests: URL[] = [];
  const events: AuthChangeEvent[] = [];
  const client = createClient('https://auth.example.test', 'public-test-key', {
    auth: {
      persistSession: true,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      storage: {
        getItem: (key) => storage.get(key) ?? null,
        setItem: (key, value) => {
          storage.set(key, value);
        },
        removeItem: (key) => {
          storage.delete(key);
        },
      },
    },
    global: {
      fetch: async (input) => {
        const url = new URL(String(input));
        requests.push(url);
        if (url.pathname.endsWith('/logout'))
          return new Response(logoutStatus === 204 ? null : JSON.stringify({ msg: 'Failure' }), {
            status: logoutStatus,
            headers: { 'Content-Type': 'application/json' },
          });
        assert.ok(url.pathname.endsWith('/token'));
        return new Response(
          JSON.stringify({
            access_token: 'synthetic-access-token',
            refresh_token: 'synthetic-refresh-token',
            token_type: 'bearer',
            expires_in: 3600,
            user: { id: 'synthetic-owner', email: 'owner@example.test', aud: 'authenticated' },
          }),
          { headers: { 'Content-Type': 'application/json' } },
        );
      },
    },
  });
  client.auth.onAuthStateChange((event) => {
    events.push(event);
  });
  return { client, storage, requests, events };
}

test('Recovery completion clears both SDK sessions and notifies workspace subscribers', async () => {
  const recovery = authFixture(),
    workspace = authFixture();
  for (const fixture of [recovery, workspace]) {
    const { error } = await fixture.client.auth.signInWithPassword({
      email: 'owner@example.test',
      password: 'synthetic-password',
    });
    assert.equal(error, null);
    assert.ok((await fixture.client.auth.getSession()).data.session);
  }
  assert.equal(await signOutAfterRecovery(recovery.client, workspace.client), true);
  for (const fixture of [recovery, workspace]) {
    assert.equal((await fixture.client.auth.getSession()).data.session, null);
    assert.equal(fixture.storage.size, 0);
    assert.ok(fixture.events.includes('SIGNED_OUT'));
    assert.equal(fixture.requests.at(-1)?.searchParams.get('scope'), 'local');
  }
});

test('Recovery sign-out failure still attempts workspace cleanup and reports incomplete logout', async () => {
  const recovery = authFixture(400),
    workspace = authFixture();
  for (const fixture of [recovery, workspace])
    await fixture.client.auth.signInWithPassword({
      email: 'owner@example.test',
      password: 'synthetic-password',
    });
  assert.equal(await signOutAfterRecovery(recovery.client, workspace.client), false);
  assert.equal((await workspace.client.auth.getSession()).data.session, null);
  assert.ok(workspace.events.includes('SIGNED_OUT'));
});

test('An already signed-out workspace needs no logout request', async () => {
  const recovery = authFixture(),
    workspace = authFixture();
  await recovery.client.auth.signInWithPassword({
    email: 'owner@example.test',
    password: 'synthetic-password',
  });
  assert.equal(await signOutAfterRecovery(recovery.client, workspace.client), true);
  assert.equal(workspace.requests.length, 0);
  assert.equal((await workspace.client.auth.getSession()).data.session, null);
});
