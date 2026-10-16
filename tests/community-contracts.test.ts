import { test } from 'node:test';
import assert from 'node:assert/strict';
import { canStaff, canModerateTarget, assertHumanSession } from '../src/lib/staff-policy';
import { communitySchemas } from '../src/lib/community-schemas';

const master = { owner: 'master-id', agent: null, scopes: [] };

test('Agent credentials never acquire staff authority even when owned by master', () => {
  assert.doesNotThrow(() => assertHumanSession(master));
  assert.throws(() => assertHumanSession({ ...master, agent: 'agent-id' }));
  assert.throws(() => assertHumanSession({ ...master, credential: 'credential-id' }));
});

test('Moderator capabilities exclude applications, account emails and role assignment', () => {
  for (const capability of ['reports', 'moderate', 'audit'] as const) {
    assert.equal(canStaff('moderator', capability), true);
    assert.equal(canStaff(null, capability), false);
  }
  for (const capability of ['applications', 'users', 'stats', 'roles'] as const) {
    assert.equal(canStaff('moderator', capability), false);
    assert.equal(canStaff('master', capability), true);
  }
});

test('Moderators cannot target staff and no staff may suspend themselves', () => {
  assert.equal(canModerateTarget('moderator', 'mod', 'member', null), true);
  assert.equal(canModerateTarget('moderator', 'mod', 'owner', 'master'), false);
  assert.equal(canModerateTarget('moderator', 'mod', 'other-mod', 'moderator'), false);
  assert.equal(canModerateTarget('master', 'owner', 'mod', 'moderator'), true);
  assert.equal(canModerateTarget('master', 'owner', 'owner', 'master'), false);
});

test('Master may hide own content while self-restrictions remain forbidden', () => {
  assert.equal(canModerateTarget('master', 'owner', 'owner', 'master', 'hide'), true);
  assert.equal(canModerateTarget('master', 'owner', 'owner', 'master', 'restore'), true);
  assert.equal(canModerateTarget('master', 'owner', 'owner', 'master', 'ban'), false);
  assert.equal(canModerateTarget('moderator', 'mod', 'mod', 'moderator', 'hide'), false);
});

test('Applications reject spoofed identity, missing consent and unsafe GitHub URLs', () => {
  const input = {
    request_id: crypto.randomUUID(),
    display_name: 'Applicant',
    use_case: 'I want to share TypeScript debugging evidence.',
    client: 'Codex',
    interests: ['TypeScript'],
    github_url: 'https://github.com/example',
    accepted_rules: true,
  };
  assert.ok(communitySchemas.submit_application.safeParse(input).success);
  for (const github_url of [
    'http://github.com/example',
    'https://github.com.evil.test/example',
    'https://github.com/example/repository',
    'https://github.com/example?tab=repositories',
  ]) {
    assert.equal(
      communitySchemas.submit_application.safeParse({ ...input, github_url }).success,
      false,
    );
  }
  assert.equal(
    communitySchemas.submit_application.safeParse({ ...input, email: 'spoof@example.com' }).success,
    false,
  );
  assert.equal(
    communitySchemas.submit_application.safeParse({ ...input, accepted_rules: false }).success,
    false,
  );
});

test('Moderation requires exact action types, bounded reason and supported suspension duration', () => {
  const input = {
    request_id: crypto.randomUUID(),
    action: 'suspend',
    expected_revision: null,
    owner_id: crypto.randomUUID(),
    reason: 'Repeated targeted harassment.',
    days: 7,
  };
  assert.ok(communitySchemas.moderate.safeParse(input).success);
  assert.equal(communitySchemas.moderate.safeParse({ ...input, days: 365 }).success, false);
  assert.equal(communitySchemas.moderate.safeParse({ ...input, reason: 'bad' }).success, false);
  assert.equal(communitySchemas.moderate.safeParse({ ...input, role: 'master' }).success, false);
});

test('Reporting is bounded and never accepts a caller-supplied target author', () => {
  const input = {
    request_id: crypto.randomUUID(),
    kind: 'reply',
    target_id: crypto.randomUUID(),
    category: 'harassment',
    explanation: 'This reply repeatedly targets a participant.',
  };
  assert.ok(communitySchemas.submit_report.safeParse(input).success);
  assert.equal(
    communitySchemas.submit_report.safeParse({ ...input, owner_id: crypto.randomUUID() }).success,
    false,
  );
  assert.equal(
    communitySchemas.submit_report.safeParse({ ...input, explanation: 'x'.repeat(2001) }).success,
    false,
  );
});
