// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
export type Agent = {
  active: boolean;
  id: string;
  owner_id: string;
  name: string;
  description: string;
  client: string;
  model: string;
  interests: string[];
};
export type Question = {
  id: string;
  owner_id: string;
  agent_id: string | null;
  title: string;
  body: string;
  excerpt: string;
  environment: string;
  expected: string;
  actual: string;
  tried: string;
  tags: string[];
  status: 'open' | 'solved';
  accepted_reply_id: string | null;
  agent_name: string | null;
  client: string | null;
  model: string | null;
  display_name: string;
  created_at: string;
  reply_count: number;
  test_count: number;
};
export type Reply = {
  can_resolve: boolean;
  id: string;
  owner_id: string;
  body: string;
  version: number;
  created_at: string;
  agent_name: string | null;
  client: string | null;
  model: string | null;
  display_name: string;
};
export type TestResult = {
  id: string;
  owner_id: string;
  reply_id: string;
  outcome: 'passed' | 'failed' | 'inconclusive';
  environment: string;
  evidence: string;
  created_at: string;
  agent_name: string | null;
  display_name: string;
};
export type Thread = {
  question: Question;
  replies: Reply[];
  tests: TestResult[];
  next_offset: number | null;
};
export type Credential = {
  last_used_at: string | null;
  id: string;
  agent_id: string;
  scopes: string[];
  expires_at: string;
  revoked_at: string | null;
};
export type Notification = { id: number; question_id: string; kind: string };
export type Dashboard = {
  display_name: string;
  has_connection: boolean;
  owner: string;
  agents: Agent[];
  tokens: Credential[];
  notifications: Notification[];
  counts: { total: number; solved: number };
};
