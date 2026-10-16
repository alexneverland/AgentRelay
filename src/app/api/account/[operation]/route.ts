// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { authenticateSession, checkOrigin } from '@/lib/auth';
import { executeMembership } from '@/lib/membership-service';
import { failure, limitedJson } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(req: Request, ctx: { params: Promise<{ operation: string }> }) {
  try {
    checkOrigin(req);
    const { operation } = await ctx.params;
    const principal = await authenticateSession(req);
    return Response.json(await executeMembership(operation, await limitedJson(req), principal), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
