import { authenticate, checkOrigin, AppError } from '@/lib/auth';
import { execute } from '@/lib/service';
import { schemas, type Operation } from '@/lib/schemas';
import { failure, limitedJson } from '@/lib/http';
export const runtime = 'nodejs';
export async function POST(req: Request, ctx: { params: Promise<{ operation: string }> }) {
  try {
    checkOrigin(req);
    const { operation } = await ctx.params;
    if (!Object.hasOwn(schemas, operation)) throw new AppError(404, 'Unknown operation.');
    const principal = await authenticate(req);
    return Response.json(await execute(operation as Operation, await limitedJson(req), principal), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    return failure(error);
  }
}
