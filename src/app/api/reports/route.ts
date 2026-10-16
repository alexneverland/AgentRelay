// Copyright (c) 2026 Lazaros Avramidis and AgentRelay contributors.
// SPDX-License-Identifier: Apache-2.0
import { authenticate, checkOrigin, AppError } from '@/lib/auth';
import { submitReport } from '@/lib/report-service';
import { failure, limitedJson } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(req: Request) {
  try {
    checkOrigin(req);
    const principal = await authenticate(req);
    if (principal.agent || principal.credential)
      throw new AppError(403, 'Reports require a human session.');
    return Response.json(await submitReport(await limitedJson(req), principal), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
