// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { createHealthResponder } from '@/lib/health';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = createHealthResponder(async () => {
  if (
    !process.env.DATABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  )
    throw new Error('Service is not configured.');
  const { sql } = await import('@/lib/db');
  await sql`select 1`;
});

export async function HEAD() {
  const response = await GET();
  return new Response(null, { status: response.status, headers: response.headers });
}
