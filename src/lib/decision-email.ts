// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod';

export type MailState = 'pending' | 'sending' | 'sent' | 'failed' | 'unknown' | 'cancelled';
export type DecisionMail = { recipient: string; decision: 'approved' | 'declined' };
export function decisionMessage(decision: DecisionMail['decision'], origin: string) {
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname)))
  )
    throw new Error('Invalid mail origin.');
  const approved = decision === 'approved';
  return {
    subject: approved
      ? 'Your AgentRelay application has been approved'
      : 'Your AgentRelay application was not approved',
    text: `${approved ? 'Your application to join AgentRelay has been approved. Sign in to enter the community.' : 'Your application to join AgentRelay was not approved. Sign in to view the decision and its reason.'}\n\n${origin}/sign-in\n\nAgentRelay`,
  };
}
export function smtpSettings(env: Record<string, string | undefined>) {
  const host = z
    .string()
    .regex(/^[a-zA-Z0-9.-]+$/)
    .parse(env.SMTP_HOST);
  const port = z.enum(['465', '587']).parse(env.SMTP_PORT || '587');
  const user = z.email().parse(env.SMTP_USER);
  const pass = z.string().min(1).parse(env.SMTP_PASSWORD);
  return {
    host,
    port: Number(port),
    secure: port === '465',
    requireTLS: true,
    auth: { user, pass },
    tls: { rejectUnauthorized: true },
    connectionTimeout: 8000,
    greetingTimeout: 8000,
    socketTimeout: 10000,
    disableFileAccess: true,
    disableUrlAccess: true,
    logger: false as const,
    debug: false,
  };
}
export function classifyMailFailure(error: unknown): 'failed' | 'unknown' {
  const e = error as { code?: string; responseCode?: number };
  return e &&
    (e.code === 'MAIL_CONFIG' ||
      e.code === 'EAUTH' ||
      (typeof e.responseCode === 'number' && e.responseCode >= 400 && e.responseCode < 600))
    ? 'failed'
    : 'unknown';
}
export async function dispatchDecisionEmail(
  store: { claim: () => Promise<DecisionMail | null>; finish: (state: MailState) => Promise<void> },
  send: (mail: DecisionMail) => Promise<void>,
) {
  const mail = await store.claim();
  if (!mail) return;
  let state: MailState;
  try {
    await send(mail);
    state = 'sent';
  } catch (error) {
    state = classifyMailFailure(error);
  }
  // A database failure after SMTP acceptance must not be mistaken for a send failure.
  await store.finish(state);
}
