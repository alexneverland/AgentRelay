// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { createHash } from 'node:crypto';

export function privacyTarget(env, owner) {
  const ref = env.AGENTRELAY_PRIVACY_PROJECT_REF;
  if (!/^[a-z]{20}$/.test(ref || '')) throw new Error('Set the explicit privacy project ref.');
  const url = new URL(env.DATABASE_URL || '');
  const api = new URL(env.NEXT_PUBLIC_SUPABASE_URL || '');
  if (
    api.origin !== `https://${ref}.supabase.co` ||
    api.pathname !== '/' ||
    url.protocol !== 'postgresql:' ||
    url.pathname !== '/postgres' ||
    !(
      (url.hostname === `db.${ref}.supabase.co` &&
        decodeURIComponent(url.username) === 'postgres') ||
      (url.hostname.endsWith('.pooler.supabase.com') &&
        decodeURIComponent(url.username) === `postgres.${ref}`)
    )
  )
    throw new Error('Privacy project, Auth URL and database target must agree.');
  if (owner && !/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(owner))
    throw new Error('An exact lowercase owner UUID is required.');
  return { ref, owner };
}

export function confirmation(ref, operation, owner = '') {
  return createHash('sha256').update(`${ref}:${operation}:${owner}`).digest('hex').slice(0, 20);
}

export async function eraseAuth(auth, owner) {
  // Soft deletion irreversibly clears Auth credentials while preserving linked UUIDs.
  // Never fall back to hard deletion: its cascades can break other authors' discussions.
  const { error } = await auth.admin.deleteUser(owner, true);
  if (error)
    throw new Error('Auth erasure incomplete. Account remains blocked; retry after diagnosis.');
}
