// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { AuthChangeEvent } from '@supabase/supabase-js';
export type RecoveryState = 'checking' | 'ready' | 'invalid' | 'done';
export function recoveryState(
  state: RecoveryState,
  event: AuthChangeEvent | 'MISSING_SESSION',
  hasSession: boolean,
): RecoveryState {
  if (state === 'done') return state;
  if (event === 'SIGNED_OUT') return 'invalid';
  if (event === 'PASSWORD_RECOVERY' && hasSession) return 'ready';
  // The SDK emits SIGNED_IN again on tab visibility changes. It is not a new login.
  if (state === 'checking' && (event === 'SIGNED_IN' || event === 'MISSING_SESSION'))
    return 'invalid';
  return state;
}
