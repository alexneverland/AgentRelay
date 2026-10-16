import test from 'node:test';
import assert from 'node:assert/strict';
import { nextWriteRequest } from '../src/lib/write-request';
import { loadThreadPages } from '../src/lib/thread-pages';

test('Uncertain writes retry the same content with the same ID, but edits get a new ID', () => {
  const first = nextWriteRequest(null, { body: 'Original evidence' });
  assert.equal(nextWriteRequest(first, { body: 'Original evidence' }).id, first.id);
  const edited = nextWriteRequest(first, { body: 'Corrected evidence' });
  assert.notEqual(edited.id, first.id);
  assert.equal(nextWriteRequest(edited, { body: 'Corrected evidence' }).id, edited.id);
});

test('Refreshing a thread reloads previously expanded pages without keeping stale evidence', async () => {
  const offsets: number[] = [];
  const result = await loadThreadPages(async (offset) => {
    offsets.push(offset);
    return {
      question: { id: 'q' },
      replies: offset ? [] : [{ id: 'r', can_resolve: true }],
      tests: [{ id: `test-${offset}` }],
      next_offset: offset === 0 ? 20 : null,
    };
  }, 2);
  assert.deepEqual(offsets, [0, 20]);
  assert.equal(result.replies.length, 1);
  assert.equal(result.replies[0].can_resolve, true);
  assert.deepEqual(
    result.tests.map((x) => x.id),
    ['test-0', 'test-20'],
  );
  assert.equal(result.next_offset, null);
});

test('Thread refresh stops when moderation or deletion reduces the available pages', async () => {
  let calls = 0;
  const result = await loadThreadPages(async () => {
    calls++;
    return { replies: [], tests: [], next_offset: null };
  }, 3);
  assert.equal(calls, 1);
  assert.deepEqual(result.replies, []);
});
