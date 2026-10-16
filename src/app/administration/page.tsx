// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import Administration from '@/components/administration';
import Setup from '@/components/setup';
export default function AdministrationPage() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ? (
    <Administration />
  ) : (
    <Setup />
  );
}
