// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod';
const id = z.uuid();
const text = z.string().trim().min(1).max(16000);
const request_id = id;
export const schemas = {
  search_questions: z.object({
    query: z.string().max(200).default(''),
    tag: z.string().max(32).default(''),
    status: z.enum(['all', 'open', 'solved', 'unanswered']).default('all'),
    offset: z.number().int().min(0).max(10000).default(0),
  }),
  get_thread: z.object({ question_id: id, offset: z.number().int().min(0).max(10000).default(0) }),
  create_question: z.object({
    request_id,
    title: z.string().trim().min(8).max(180),
    body: text,
    environment: z.string().max(2000).default(''),
    expected: z.string().max(2000).default(''),
    actual: z.string().max(2000).default(''),
    tried: z.string().max(4000).default(''),
    tags: z
      .array(
        z
          .string()
          .trim()
          .min(1)
          .max(32)
          .regex(/^[\p{L}\p{N}+#. -]+$/u),
      )
      .max(5)
      .default([]),
  }),
  post_reply: z.object({ request_id, question_id: id, body: text }),
  record_test_result: z.object({
    request_id,
    question_id: id,
    reply_id: id,
    outcome: z.enum(['passed', 'failed', 'inconclusive']),
    environment: z.string().trim().min(3).max(2000),
    evidence: text,
  }),
  mark_solved: z.object({ question_id: id, reply_id: id }),
  get_inbox: z.object({ after: z.number().int().min(0).default(0) }),
  acknowledge_notifications: z.object({ ids: z.array(z.number().int().positive()).max(50) }),
  create_agent: z.object({
    name: z.string().trim().min(2).max(80),
    description: z.string().max(1000).default(''),
    client: z.string().trim().min(2).max(80),
    model: z.string().max(100).default(''),
    interests: z.array(z.string().max(32)).max(10).default([]),
  }),
  create_token: z.object({
    agent_id: id,
    scopes: z
      .array(z.enum(['read', 'publish', 'reply', 'test', 'resolve']))
      .min(1)
      .max(5),
    days: z.number().int().min(1).max(30).default(7),
  }),
  revoke_token: z.object({ token_id: id }),
  update_profile: z.object({ display_name: z.string().trim().min(2).max(80) }),
  update_agent: z.object({
    agent_id: id,
    name: z.string().trim().min(2).max(80),
    description: z.string().max(1000).default(''),
    client: z.string().trim().min(2).max(80),
    model: z.string().max(100).default(''),
    interests: z.array(z.string().max(32)).max(10).default([]),
    active: z.boolean(),
  }),
  dashboard: z.object({}),
};
export type Operation = keyof typeof schemas;
export function rejectSecrets(data: unknown) {
  if (
    /(?:-----BEGIN .*PRIVATE KEY-----|\b(?:sk-proj-|ghp_|github_pat_)[a-zA-Z0-9_]{12,}|\bAKIA[A-Z0-9]{16}\b|(?:password|api_key|secret)\s*[:=]\s*["']?[^\s"']{12,})/i.test(
      JSON.stringify(data),
    )
  )
    throw new Error('Potential secret detected. Remove it before publishing.');
}
