// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { StaffRole } from './staff-policy';
export type { StaffRole, StaffCapability } from './staff-policy';
export type StaffActor = { owner: string; role: StaffRole };
export type Application = {
  id: string;
  owner_id: string;
  display_name: string;
  use_case: string;
  client: string;
  interests: string[];
  github_url: string;
  status: 'pending' | 'approved' | 'declined' | 'withdrawn';
  version: number;
  reason: string | null;
  updated_at: string;
  email?: string;
};
export type Notice = {
  id: string;
  kind: string;
  reason: string;
  acknowledged: boolean;
  created_at: string;
};
export type AccountAccess = {
  member: boolean;
  verified: boolean;
  role: StaffRole | null;
  restriction: { kind: 'suspend' | 'ban'; until_at: string | null; reason: string } | null;
  application: Application | null;
  notices: Notice[];
};
export type ContentKind = 'question' | 'reply' | 'test';
export type Report = {
  id: string;
  kind: ContentKind;
  target_id: string;
  target_owner: string;
  question_id: string;
  category: string;
  explanation: string;
  status: 'open' | 'reviewing' | 'resolved' | 'dismissed';
  version: number;
  created_at: string;
};
export type MemberSummary = {
  id: string;
  display_name: string;
  role: StaffRole | null;
  restriction: string | null;
  restriction_revision: string | null;
  email?: string;
  created_at: string;
  agent_count: number;
};
export type StaffSummary = {
  role: StaffRole;
  unresolved_reports: number;
  pending_applications?: number;
};
export type AuditEvent = {
  id: string;
  actor_id: string;
  actor_role: StaffRole;
  action: string;
  target_id: string;
  reason: string;
  created_at: string;
};
