// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { z } from 'zod';

const id = z.uuid();
const request = { request_id: id };
const reason = z.string().trim().min(10).max(2000);
const target = { kind: z.enum(['question', 'reply', 'test']), target_id: id };
const page = {
  offset: z.number().int().min(0).max(10000).default(0),
  limit: z.number().int().min(1).max(50).default(20),
};
const github = z
  .string()
  .trim()
  .max(200)
  .refine((value) => {
    if (value === '') return true;
    try {
      const url = new URL(value);
      return (
        url.protocol === 'https:' &&
        url.hostname === 'github.com' &&
        !url.username &&
        !url.password &&
        !url.port &&
        !url.search &&
        !url.hash &&
        /^\/[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,38})\/?$/.test(url.pathname)
      );
    } catch {
      return false;
    }
  }, 'Use an HTTPS GitHub user profile URL.');
const accountAction = { ...request, owner_id: id, reason };
const restrictionAction = { ...accountAction, expected_revision: id.nullable() };
const contentAction = { ...request, ...target, reason };
export const communitySchemas = {
  status: z.strictObject({}),
  submit_application: z.strictObject({
    ...request,
    display_name: z.string().trim().min(2).max(80),
    use_case: z.string().trim().min(20).max(2000),
    client: z.string().trim().min(2).max(80),
    interests: z.array(z.string().trim().min(1).max(32)).max(10).default([]),
    github_url: github.default(''),
    accepted_rules: z.literal(true),
  }),
  withdraw_application: z.strictObject(request),
  acknowledge_notice: z.strictObject({ notice_id: id }),
  submit_report: z.strictObject({
    ...request,
    ...target,
    category: z.enum(['harassment', 'spam', 'private_information', 'abuse', 'other']),
    explanation: reason,
  }),
  summary: z.strictObject({}),
  stats: z.strictObject({}),
  applications: z.strictObject({
    ...page,
    status: z.enum(['pending', 'approved', 'declined', 'withdrawn']).default('pending'),
  }),
  decide_application: z.strictObject({
    ...request,
    application_id: id,
    version: z.number().int().positive(),
    decision: z.enum(['approved', 'declined']),
    reason,
  }),
  reports: z.strictObject({
    ...page,
    status: z.enum(['open', 'reviewing', 'resolved', 'dismissed']).default('open'),
  }),
  report_context: z.strictObject({ report_id: id, parent: z.boolean().default(false) }),
  update_report: z.strictObject({
    ...request,
    report_id: id,
    version: z.number().int().positive(),
    status: z.enum(['reviewing', 'resolved', 'dismissed']),
    reason,
  }),
  users: z.strictObject({ ...page, query: z.string().trim().max(100).default('') }),
  audit: z.strictObject(page),
  set_moderator: z.strictObject({ ...accountAction, enabled: z.boolean() }),
  moderate: z.discriminatedUnion('action', [
    z.strictObject({ ...contentAction, action: z.enum(['hide', 'restore']) }),
    z.strictObject({ ...accountAction, action: z.literal('warn') }),
    z.strictObject({ ...restrictionAction, action: z.enum(['ban', 'lift_restriction']) }),
    z.strictObject({
      ...restrictionAction,
      action: z.literal('suspend'),
      days: z.union([z.literal(1), z.literal(3), z.literal(7), z.literal(30)]),
    }),
  ]),
};
export type CommunityOperation = keyof typeof communitySchemas;
