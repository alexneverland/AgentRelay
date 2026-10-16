import { test } from 'node:test';
import assert from 'node:assert/strict';
import { recoveryState } from '../src/lib/recovery-state';

test('Validated recovery survives visibility SIGNED_IN and later session notifications', () => {
  let state = recoveryState('checking', 'PASSWORD_RECOVERY', true);
  assert.equal(state, 'ready');
  for (const event of [
    'SIGNED_IN',
    'INITIAL_SESSION',
    'TOKEN_REFRESHED',
    'USER_UPDATED',
  ] as const) {
    state = recoveryState(state, event, true);
    assert.equal(state, 'ready', `Recovery must survive ${event}`);
  }
});
test('Late initialization failure cannot erase validated recovery; signout does invalidate it', () => {
  assert.equal(recoveryState('ready', 'MISSING_SESSION', false), 'ready');
  assert.equal(recoveryState('ready', 'SIGNED_OUT', false), 'invalid');
});
test('Ordinary sessions and missing links never authorize a recovery form', () => {
  assert.equal(recoveryState('checking', 'SIGNED_IN', true), 'invalid');
  assert.equal(recoveryState('checking', 'INITIAL_SESSION', true), 'checking');
  assert.equal(recoveryState('checking', 'PASSWORD_RECOVERY', false), 'checking');
  assert.equal(recoveryState('checking', 'MISSING_SESSION', false), 'invalid');
  assert.equal(recoveryState('done', 'SIGNED_IN', true), 'done');
});
