// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { SupabaseClient } from '@supabase/supabase-js';
import { authCaptchaOptions, validateRecoveryPassword } from './auth-email';

export async function changeAccountPassword(
  workspace: SupabaseClient,
  verifier: SupabaseClient,
  input: {
    owner: string;
    email: string;
    current: string;
    password: string;
    confirm: string;
    siteKey: string;
    captchaToken: string;
  },
) {
  validateRecoveryPassword(input.password, input.confirm);
  const options = authCaptchaOptions(input.siteKey, input.captchaToken);
  const verified = await verifier.auth.signInWithPassword({
    email: input.email,
    password: input.current,
    options,
  });
  if (verified.error?.code === 'captcha_failed')
    throw new Error('Security check failed. Please try again.');
  if (verified.error) throw new Error('Current password is incorrect.');
  try {
    if (verified.data.user?.id !== input.owner) throw new Error('Current password is incorrect.');
    const result = await workspace.auth.updateUser({
      password: input.password,
      current_password: input.current,
    });
    if (result.error) throw result.error;
  } finally {
    await verifier.auth.signOut({ scope: 'local' });
  }
}
