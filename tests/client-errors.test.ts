import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RequestError, isUnavailable } from '../src/lib/request-error';

test('Fresh authorization/not-found failures invalidate previously loaded discussion data', () => {
  for (const status of [401, 403, 404])
    assert.equal(isUnavailable(new RequestError(status, 'Unavailable')), true);
  for (const status of [409, 429, 500, 503])
    assert.equal(isUnavailable(new RequestError(status, 'Retry')), false);
  assert.equal(isUnavailable(new Error('Network disconnected')), false);
});
