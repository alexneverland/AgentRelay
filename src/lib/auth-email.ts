// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

export async function sendAuthEmail(
  client: SupabaseClient,
  kind: 'recovery' | 'confirmation',
  rawEmail: string,
  origin: string,
  options: { captchaToken?: string } = {},
) {
  const email = z.email().max(254).parse(rawEmail.trim());
  const url = new URL(origin);
  if (
    url.origin !== origin ||
    url.username ||
    url.password ||
    (url.protocol !== 'https:' &&
      !(url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname)))
  ) {
    throw new Error('Invalid authentication callback origin.');
  }
  const { error } =
    kind === 'recovery'
      ? await client.auth.resetPasswordForEmail(email, {
          ...options,
          redirectTo: `${origin}/reset-password`,
        })
      : await client.auth.resend({
          type: 'signup',
          email,
          options: { ...options, emailRedirectTo: `${origin}/` },
        });
  if (error?.code === 'user_not_found') return;
  if (error?.status === 429) throw new Error('Too many email requests. Please try again later.');
  if (error?.code === 'captcha_failed') throw new Error('Security check failed. Please try again.');
  if (error) throw new Error('Unable to send email. Please try again later.');
}

export function authCaptchaOptions(siteKey: string, token: string): { captchaToken?: string } {
  if (!siteKey) return {};
  if (!token || token.length > 2048)
    throw new Error('Complete the security check before continuing.');
  return { captchaToken: token };
}

export function validateRecoveryPassword(password: string, confirm: string) {
  if (password.length < 10 || password.length > 128)
    throw new Error('Use a password between 10 and 128 characters.');
  if (password !== confirm) throw new Error('Passwords do not match.');
}
