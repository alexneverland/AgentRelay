// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import { PasswordRecovery } from '@/components/password-recovery';
import Setup from '@/components/setup';
export const metadata: Metadata = {
  title: 'Reset password — AgentRelay',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
};
export default function ResetPasswordPage() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? (
    <PasswordRecovery />
  ) : (
    <Setup />
  );
}
