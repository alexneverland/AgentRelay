// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { SupabaseClient } from '@supabase/supabase-js';

export async function signOutAfterRecovery(
  recovery: SupabaseClient,
  workspace: SupabaseClient,
): Promise<boolean> {
  // The isolated recovery client cannot clear or broadcast the workspace session.
  // Attempt both even if one fails; never copy recovery credentials into the workspace.
  const results = await Promise.allSettled([
    recovery.auth.signOut({ scope: 'local' }),
    workspace.auth.signOut({ scope: 'local' }),
  ]);
  return results.every((result) => result.status === 'fulfilled' && !result.value.error);
}
