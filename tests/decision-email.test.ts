import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  decisionMessage,
  smtpSettings,
  classifyMailFailure,
  dispatchDecisionEmail,
} from '../src/lib/decision-email';

test('Decision emails contain only a fixed decision and the configured sign-in link', () => {
  for (const decision of ['approved', 'declined'] as const) {
    const mail = decisionMessage(decision, 'https://relay.example.test');
    assert.ok(mail.subject.includes(decision === 'approved' ? 'approved' : 'not approved'));
    assert.ok(mail.text.includes('https://relay.example.test/sign-in'));
    assert.ok(!mail.text.includes('token='));
    assert.ok(!mail.text.includes('Reason:'));
  }
  for (const origin of [
    'http://remote.test',
    'https://user:pass@example.test',
    'https://example.test/path',
  ])
    assert.throws(() => decisionMessage('approved', origin));
});

test('SMTP requires server-only credentials, TLS and bounded timeouts', () => {
  assert.throws(() => smtpSettings({}));
  const settings = smtpSettings({
    SMTP_HOST: 'smtp.gmail.com',
    SMTP_PORT: '587',
    SMTP_USER: 'sender@example.test',
    SMTP_PASSWORD: 'synthetic-app-password',
  });
  assert.equal(settings.requireTLS, true);
  assert.equal(settings.tls.rejectUnauthorized, true);
  assert.equal(settings.disableFileAccess, true);
  assert.equal(settings.disableUrlAccess, true);
  assert.ok(settings.socketTimeout <= 15000);
  assert.throws(() =>
    smtpSettings({
      SMTP_HOST: 'smtp.gmail.com',
      SMTP_PORT: '25',
      SMTP_USER: 'sender@example.test',
      SMTP_PASSWORD: 'synthetic',
    }),
  );
});

test('Uncertain SMTP outcomes are never marked safe to retry', () => {
  assert.equal(classifyMailFailure({ code: 'EAUTH', responseCode: 535 }), 'failed');
  assert.equal(classifyMailFailure({ code: 'EENVELOPE', responseCode: 550 }), 'failed');
  assert.equal(classifyMailFailure({ code: 'ETIMEDOUT', command: 'DATA' }), 'unknown');
  assert.equal(classifyMailFailure(new Error('Private SMTP diagnostics')), 'unknown');
});

test('A claimed decision is sent once; replay and uncertain outcomes cannot resend it', async () => {
  let state = 'pending',
    sends = 0;
  const store = {
    claim: async () => {
      if (state !== 'pending') return null;
      state = 'sending';
      return { recipient: 'applicant@example.test', decision: 'approved' as const };
    },
    finish: async (next: string) => {
      state = next;
    },
  };
  const send = async () => {
    sends++;
  };
  await Promise.all([dispatchDecisionEmail(store, send), dispatchDecisionEmail(store, send)]);
  assert.equal(sends, 1);
  assert.equal(state, 'sent');
  await dispatchDecisionEmail(store, send);
  assert.equal(sends, 1);
  state = 'failed';
  await dispatchDecisionEmail(store, send);
  assert.equal(sends, 1);
  state = 'pending';
  await dispatchDecisionEmail(store, async () => {
    throw { code: 'ETIMEDOUT', command: 'DATA' };
  });
  assert.equal(state, 'unknown');
  await dispatchDecisionEmail(store, send);
  assert.equal(sends, 1);
});

test('Rejected SMTP is recorded as failed; failure to record SMTP success does not resend', async () => {
  let state = 'pending';
  const store = {
    claim: async () =>
      state === 'pending'
        ? ((state = 'sending'),
          { recipient: 'applicant@example.test', decision: 'declined' as const })
        : null,
    finish: async (next: string) => {
      state = next;
    },
  };
  await dispatchDecisionEmail(store, async () => {
    throw { code: 'EAUTH', responseCode: 535 };
  });
  assert.equal(state, 'failed');
  state = 'pending';
  await assert.rejects(
    dispatchDecisionEmail(
      {
        ...store,
        finish: async () => {
          throw new Error('database unavailable');
        },
      },
      async () => {},
    ),
  );
  assert.equal(state, 'sending');
});
