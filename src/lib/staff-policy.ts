// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
export type StaffRole = 'master' | 'moderator';
export type StaffCapability =
  'reports' | 'moderate' | 'audit' | 'applications' | 'users' | 'stats' | 'roles';

export function assertHumanSession(principal: { agent: string | null; credential?: string }) {
  if (principal.agent !== null || principal.credential)
    throw new Error('A human session is required.');
}
export function canStaff(role: StaffRole | null, capability: StaffCapability): boolean {
  return (
    role === 'master' ||
    (role === 'moderator' && ['reports', 'moderate', 'audit'].includes(capability))
  );
}
export function canModerateTarget(
  role: StaffRole,
  actor: string,
  target: string,
  targetRole: StaffRole | null,
  action = 'ban',
): boolean {
  return (
    (role === 'master' || targetRole === null) &&
    (actor !== target || (role === 'master' && ['hide', 'restore'].includes(action)))
  );
}
