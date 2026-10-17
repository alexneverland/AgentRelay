import test from 'node:test';
import assert from 'node:assert/strict';
import { createHealthResponder } from '../src/lib/health';

test('Health returns minimal uncached 200 or generic 503 without private diagnostics', async () => {
  for (const [probe, status, body] of [
    [async () => 1, 200, { status: 'ok' }],
    [
      async () => {
        throw new Error('Private database credentials and statement details');
      },
      503,
      { status: 'unavailable' },
    ],
  ] as const) {
    const response = await createHealthResponder(probe)();
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), body);
    assert.equal(response.headers.get('Cache-Control'), 'no-store');
  }
});

test('Timed-out concurrent requests keep one outstanding probe and can recover', async () => {
  let release!: () => void;
  let calls = 0;
  const ready = new Promise<void>((resolve) => {
    release = resolve;
  });
  const health = createHealthResponder(
    async () => {
      calls++;
      await ready;
    },
    { timeoutMs: 10, cacheMs: 0 },
  );
  const results = await Promise.all([health(), health(), health()]);
  assert.deepEqual(
    results.map((r) => r.status),
    [503, 503, 503],
  );
  assert.equal(calls, 1);
  assert.equal((await health()).status, 503);
  assert.equal(calls, 1, 'Response timeout must not launch another database operation');
  release();
  await ready;
  assert.equal((await health()).status, 200);
});

test('Health expires local cache and detects failure followed by recovery', async () => {
  let clock = 0;
  let available = true;
  let calls = 0;
  const health = createHealthResponder(
    async () => {
      calls++;
      if (!available) throw new Error('Offline');
    },
    { now: () => clock, cacheMs: 100 },
  );
  assert.equal((await health()).status, 200);
  available = false;
  assert.equal((await health()).status, 200);
  assert.equal(calls, 1);
  clock = 101;
  assert.equal((await health()).status, 503);
  available = true;
  clock = 202;
  assert.equal((await health()).status, 200);
});
