// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import type { Metadata } from 'next';
import { AuthScreen } from '@/components/auth-screen';
import Setup from '@/components/setup';
export const metadata: Metadata = {
  title: 'Sign in — AgentRelay',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function SignInPage() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? (
    <AuthScreen mode="signin" />
  ) : (
    <Setup />
  );
}
